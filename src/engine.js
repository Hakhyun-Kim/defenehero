/* =====================================================
 * 게임 엔진 (순수 로직, DOM/렌더링 없음)
 * v3: 경로 기반 타워 디펜스
 *  - 몬스터는 길(PATH)을 따라 진행도 s로 이동
 *  - 용사는 지정 패드에 배치, 사거리 안 "최전방" 적을 자동 공격
 *  - 용사는 탑처럼 파괴되지 않는다 (성 체력만 관리)
 * ===================================================== */
import * as D from './data.js';

const riFor = (rng) => (a, b) => Math.floor(rng() * (b - a + 1)) + a;
const pickFor = (rng) => (arr) => arr[Math.floor(rng() * arr.length)];

/* 진행도 s → 좌표 + 진행 방향 (측면 오프셋 적용용) */
function pathPosDir(s) {
  const segs = D.PATH_SEGS;
  if (s <= 0) {
    const g = segs[0];
    return { x: g.x1, y: g.y1, dx: (g.x2 - g.x1) / g.len, dy: (g.y2 - g.y1) / g.len };
  }
  for (const seg of segs) {
    if (s <= seg.start + seg.len) {
      const t = (s - seg.start) / seg.len;
      return {
        x: seg.x1 + (seg.x2 - seg.x1) * t,
        y: seg.y1 + (seg.y2 - seg.y1) * t,
        dx: (seg.x2 - seg.x1) / seg.len,
        dy: (seg.y2 - seg.y1) / seg.len,
      };
    }
  }
  const last = segs[segs.length - 1];
  return { x: last.x2, y: last.y2, dx: (last.x2 - last.x1) / last.len, dy: (last.y2 - last.y1) / last.len };
}

/* ---------- 생성 ---------- */
export function createGame(opts = {}) {
  const rng = opts.rng || Math.random;
  const meta = Object.assign({ startGold: 0, castleHp: 0, heroDmg: 0, mathBonus: 0 }, opts.metaLevels);
  const diff = D.DIFFICULTIES[opts.difficulty] || D.DIFFICULTIES.normal;
  const castleMax = D.META_UPGRADES.castleHp.apply(meta.castleHp);
  const state = {
    rng, ri: riFor(rng), pick: pickFor(rng),
    difficulty: opts.difficulty || 'normal', diff,
    meta,
    dmgMul: D.META_UPGRADES.heroDmg.apply(meta.heroDmg),
    mathMul: D.META_UPGRADES.mathBonus.apply(meta.mathBonus),

    phase: 'prep',                 // prep | wave | over
    gold: D.META_UPGRADES.startGold.apply(meta.startGold),
    wave: 1,
    castleHp: castleMax, castleMax,
    castle: { fortify: 0, tower: 0 },
    towerCd: 0,
    knowledge: 0,

    nextId: 1,
    bench: [], field: [],          // field 용사는 padIndex를 가진다
    enemies: [], projectiles: [],
    spawnQueue: [], waveT: 0,
    pendingWave: null,             // 다음 웨이브 스폰 목록 (미리보기용)

    kills: 0, bossKills: 0, summons: 0, combos: 0,
    solved: 0, correct: 0, goldEarned: 0, upgrades: 0, hints: 0,
    shardsEarned: 0,
    combo: { count: 0, timer: 0 },
    time: 0,
  };
  state.pendingWave = buildWave(state);
  return state;
}

export function makeHero(state, cls, tier, level = 1) {
  const s = D.heroStats(cls, tier, level);
  return {
    id: state.nextId++, cls, tier, level,
    dmg: Math.round(s.dmg * state.dmgMul),
    padIndex: -1, x: 0, y: 0, cd: 0,
  };
}

/* ---------- 소환 / 조합 ---------- */
export function rollTier(state) {
  const p = D.tierProbs(state.knowledge);
  let r = state.rng() * 100;
  for (let i = 0; i < 4; i++) { r -= p[i]; if (r < 0) return i; }
  return 3;
}

export function summon(state) {
  if (state.phase === 'over') return { ok: false, reason: 'over' };
  if (state.gold < D.SUMMON_COST) return { ok: false, reason: 'gold' };
  if (state.bench.length >= D.BENCH_MAX) return { ok: false, reason: 'bench' };
  state.gold -= D.SUMMON_COST;
  const tier = rollTier(state);
  const cls = state.pick(D.CLASS_KEYS);
  const hero = makeHero(state, cls, tier);
  state.bench.push(hero);
  state.summons++;
  return { ok: true, hero };
}

export const benchCountByTier = (state, tier) => state.bench.filter(h => h.tier === tier).length;

export function combine(state, tier) {
  const targets = state.bench.filter(h => h.tier === tier).slice(0, 2);
  if (targets.length < 2 || tier >= 3) return { ok: false };
  state.bench = state.bench.filter(h => !targets.includes(h));
  const cls = state.pick(D.CLASS_KEYS);
  const level = Math.max(targets[0].level, targets[1].level);
  const hero = makeHero(state, cls, tier + 1, level);
  state.bench.push(hero);
  state.combos++;
  return { ok: true, hero };
}

/* ---------- 배치 / 회수 / 판매 / 강화 ---------- */
export const padOccupant = (state, padIndex) => state.field.find(h => h.padIndex === padIndex);

export function placeHero(state, heroId, padIndex) {
  const idx = state.bench.findIndex(h => h.id === heroId);
  if (idx < 0) return { ok: false };
  if (padIndex < 0 || padIndex >= D.PADS.length) return { ok: false };
  if (padOccupant(state, padIndex)) return { ok: false, reason: 'occupied' };
  const h = state.bench[idx];
  state.bench.splice(idx, 1);
  h.padIndex = padIndex;
  h.x = D.PADS[padIndex].x;
  h.y = D.PADS[padIndex].y;
  h.cd = 0;
  state.field.push(h);
  return { ok: true, hero: h };
}

export function recallHero(state, heroId) {
  const h = state.field.find(v => v.id === heroId);
  if (!h) return { ok: false };
  if (state.bench.length >= D.BENCH_MAX) return { ok: false, reason: 'bench' };
  state.field = state.field.filter(v => v !== h);
  h.padIndex = -1;
  state.bench.push(h);
  return { ok: true };
}

export function sellHero(state, heroId) {
  const h = state.field.find(v => v.id === heroId) || state.bench.find(v => v.id === heroId);
  if (!h) return { ok: false };
  state.field = state.field.filter(v => v !== h);
  state.bench = state.bench.filter(v => v !== h);
  const price = D.SELL_PRICE[h.tier];
  state.gold += price;
  return { ok: true, price };
}

export function upgradeHero(state, heroId) {
  const h = state.field.find(v => v.id === heroId) || state.bench.find(v => v.id === heroId);
  if (!h) return { ok: false };
  if (h.level >= D.HERO_LEVEL_MAX) return { ok: false, reason: 'max' };
  const cost = D.levelCost(h.tier, h.level);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  h.level++;
  h.dmg = Math.round(D.heroStats(h.cls, h.tier, h.level).dmg * state.dmgMul);
  state.upgrades++;
  return { ok: true, hero: h, cost };
}

/* ---------- 성 업그레이드 ---------- */
export function castleUpgrade(state, key) {
  const U = D.CASTLE_UPGRADES[key];
  if (!U) return { ok: false };
  const n = key === 'repair' ? 0 : state.castle[key];
  if (U.max && n >= U.max) return { ok: false, reason: 'max' };
  if (key === 'repair' && state.castleHp >= state.castleMax) return { ok: false, reason: 'full' };
  const cost = U.cost(n);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  if (key === 'repair') {
    state.castleHp = Math.min(state.castleMax, state.castleHp + 25);
  } else if (key === 'fortify') {
    state.castle.fortify++;
    state.castleMax += 30;
    state.castleHp += 30;
  } else if (key === 'tower') {
    state.castle.tower++;
  }
  return { ok: true, cost };
}

/* ---------- 수학 결과 / 힌트 ---------- */
export function applyMathResult(state, correct, grade) {
  state.solved++;
  if (correct) {
    state.correct++;
    const gold = Math.round(D.MATH_GOLD(grade) * state.mathMul);
    const kp = D.MATH_KP(grade);
    state.gold += gold;
    state.goldEarned += gold;
    state.knowledge = Math.min(D.KNOW_MAX, state.knowledge + kp);
    return { gold, kp };
  }
  state.knowledge = Math.max(0, state.knowledge + D.WRONG_KP);
  return { gold: 0, kp: D.WRONG_KP };
}

/* 힌트: 소환 희귀도(지식)를 대가로 지불 */
export function useHint(state) {
  state.hints++;
  state.knowledge = Math.max(0, state.knowledge - D.HINT_COST);
  return { knowledge: state.knowledge };
}

/* ---------- 웨이브 ---------- */
function pickWeighted(state, mix) {
  let total = 0;
  for (const m of mix) total += m.weight;
  let r = state.rng() * total;
  for (const m of mix) { r -= m.weight; if (r < 0) return m.type; }
  return mix[0].type;
}

export function buildWave(state) {
  const w = state.wave;
  const count = Math.round(D.waveCount(w) * state.diff.countMul);
  const interval = D.waveInterval(w);
  const mix = D.waveMix(w);
  const list = [];
  let t = 1.2;
  for (let i = 0; i < count; i++) {
    list.push({ t, type: pickWeighted(state, mix) });
    t += interval * (0.7 + state.rng() * 0.6);
  }
  if (D.isBossWave(w)) list.push({ t: t + 1.5, type: 'boss' });
  return list;
}

/* 다음 웨이브 미리보기: 종류별 마릿수 */
export function waveSummary(state) {
  const counts = {};
  for (const s of (state.pendingWave || [])) counts[s.type] = (counts[s.type] || 0) + 1;
  return counts;
}

export function startWave(state) {
  if (state.phase !== 'prep') return { ok: false };
  state.phase = 'wave';
  state.spawnQueue = [...(state.pendingWave || buildWave(state))];
  state.waveT = 0;
  return { ok: true, boss: D.isBossWave(state.wave) };
}

function spawnEnemy(state, type, events) {
  const E = D.ENEMY_TYPES[type];
  const w = state.wave;
  const hp = Math.round(E.hp * D.hpScale(w) * state.diff.hpMul);
  const start = pathPosDir(0);
  const e = {
    id: state.nextId++, type,
    hp, maxHp: hp,
    s: 0,                                          // 길 진행도
    off: state.ri(-10, 10),                        // 길 중심에서의 측면 오프셋
    x: start.x, y: start.y,
    spd: E.spd * (0.92 + state.rng() * 0.16),
    gold: Math.round(E.gold * D.enemyGoldScale(w) * state.diff.goldMul),
    castleDmg: E.castleDmg,
    size: E.size, boss: !!E.boss,
    heal: E.heal || 0, healPeriod: E.healPeriod || 0, healRange: E.healRange || 0,
    healCd: E.healPeriod || 0,
    slowT: 0, slowMul: 1, aura: false,
    dead: false,
  };
  state.enemies.push(e);
  events.push({ type: 'spawn', etype: type, x: e.x, y: e.y, boss: e.boss });
  if (e.boss) events.push({ type: 'bossSpawn' });
}

/* ---------- 전투 ---------- */
function damageEnemy(state, e, dmg, events, kind = 'hit') {
  if (e.dead) return;
  e.hp -= dmg;
  events.push({ type: 'enemyHit', x: e.x, y: e.y - e.size / 2, dmg, kind });
  if (e.hp <= 0) {
    e.dead = true;
    state.kills++;
    if (e.boss) state.bossKills++;
    state.combo.count++;
    state.combo.timer = D.COMBO.window;
    const mul = state.combo.count >= D.COMBO.x3At ? 3 : state.combo.count >= D.COMBO.x2At ? 2 : 1;
    const gold = e.gold * mul;
    state.gold += gold;
    state.goldEarned += gold;
    events.push({ type: 'kill', x: e.x, y: e.y, gold, etype: e.type, boss: e.boss, combo: state.combo.count, mul });
  }
}

/* 사거리 안 최전방(진행도 최대) 적 — 일반적인 TD의 'first' 타겟팅 */
function firstInRange(state, x, y, range) {
  let target = null, best = -1;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - x, e.y - y) <= range) {
      if (e.s > best) { best = e.s; target = e; }
    }
  }
  return target;
}

function updateHeroes(state, dt, events) {
  for (const h of state.field) {
    h.cd -= dt;
    if (h.cd > 0) continue;
    const C = D.CLASSES[h.cls];
    const legend = h.tier === 3;
    const target = firstInRange(state, h.x, h.y, C.range);
    if (!target) continue;
    h.cd = 1 / C.spd;

    if (h.cls === 'knight') {
      if (legend) {
        for (const e of [...state.enemies]) {
          if (e.dead) continue;
          if (Math.hypot(e.x - h.x, e.y - h.y) <= C.range) damageEnemy(state, e, h.dmg, events);
        }
        events.push({ type: 'meleeHit', x: h.x, y: h.y, cls: 'knight', heroId: h.id, cleave: true, tx: target.x, ty: target.y });
      } else {
        damageEnemy(state, target, h.dmg, events);
        events.push({ type: 'meleeHit', x: target.x, y: target.y, cls: 'knight', heroId: h.id, tx: target.x, ty: target.y });
      }
    } else if (h.cls === 'guard') {
      damageEnemy(state, target, h.dmg, events);
      if (!target.dead) {
        target.slowT = C.slowDur;
        target.slowMul = C.slow;
      }
      events.push({ type: 'meleeHit', x: target.x, y: target.y, cls: 'guard', heroId: h.id, tx: target.x, ty: target.y, slow: true });
    } else if (h.cls === 'archer') {
      state.projectiles.push({
        id: state.nextId++, kind: 'arrow', x: h.x, y: h.y - 20, target,
        dmg: h.dmg, spd: D.ARROW_SPEED, dead: false,
        pierce: legend ? D.PIERCE_COUNT : 1,
        srcX: h.x, srcY: h.y,
      });
      events.push({ type: 'shoot', kind: 'arrow', x: h.x, y: h.y, heroId: h.id, tx: target.x, ty: target.y });
    } else { // mage
      state.projectiles.push({
        id: state.nextId++, kind: 'orb', x: h.x, y: h.y - 24, target,
        dmg: h.dmg, spd: D.ORB_SPEED, dead: false,
        splash: C.splash * (legend ? D.LEGEND_SPLASH_MUL : 1),
        burn: legend,
      });
      events.push({ type: 'shoot', kind: 'orb', x: h.x, y: h.y, heroId: h.id, tx: target.x, ty: target.y });
    }
  }
}

function updateTower(state, dt, events) {
  const lv = state.castle.tower;
  if (lv <= 0) return;
  state.towerCd -= dt;
  if (state.towerCd > 0) return;
  const target = firstInRange(state, D.CASTLE_POS.x, D.CASTLE_POS.y, D.TOWER_RANGE);
  if (!target) return;
  state.towerCd = D.TOWER_PERIOD(lv);
  state.projectiles.push({
    id: state.nextId++, kind: 'bolt',
    x: D.CASTLE_POS.x - 40, y: D.CASTLE_POS.y - 60,
    target, dmg: D.TOWER_DMG(lv), spd: 420, dead: false,
  });
  events.push({ type: 'shoot', kind: 'bolt', x: D.CASTLE_POS.x - 40, y: D.CASTLE_POS.y - 60 });
}

function updateEnemies(state, dt, events) {
  /* 전설 수호병의 서리 결계: 사거리 안 모든 적을 계속 감속 */
  const auraGuards = state.field.filter(h => h.cls === 'guard' && h.tier === 3);
  for (const e of state.enemies) e.aura = false;
  for (const g of auraGuards) {
    const range = D.CLASSES.guard.range;
    for (const e of state.enemies) {
      if (e.dead || e.aura) continue;
      if (Math.hypot(e.x - g.x, e.y - g.y) <= range) e.aura = true;
    }
  }

  for (const e of state.enemies) {
    if (e.dead) continue;

    /* 화상 */
    if (e.burn) {
      e.burn.t -= dt;
      e.burnAcc = (e.burnAcc || 0) + e.burn.dps * dt;
      const whole = Math.floor(e.burnAcc);
      if (whole >= 1) {
        e.burnAcc -= whole;
        damageEnemy(state, e, whole, events, 'burn');
        if (e.dead) continue;
      }
      if (e.burn && e.burn.t <= 0) delete e.burn;
    }

    /* 주술사 회복 */
    if (e.heal) {
      e.healCd -= dt;
      if (e.healCd <= 0) {
        e.healCd = e.healPeriod;
        let ally = null, worst = 1;
        for (const o of state.enemies) {
          if (o.dead || o === e) continue;
          const ratio = o.hp / o.maxHp;
          if (ratio < worst && Math.hypot(o.x - e.x, o.y - e.y) <= e.healRange) { worst = ratio; ally = o; }
        }
        if (ally) {
          ally.hp = Math.min(ally.maxHp, ally.hp + e.heal);
          events.push({ type: 'heal', x: ally.x, y: ally.y, from: { x: e.x, y: e.y } });
        }
      }
    }

    /* 감속 계산 */
    if (e.slowT > 0) e.slowT -= dt;
    let mul = 1;
    if (e.slowT > 0) mul = Math.min(mul, e.slowMul);
    if (e.aura) mul = Math.min(mul, D.LEGEND_AURA_SLOW);
    e.slowed = mul < 1;

    /* 길을 따라 이동 */
    e.s += e.spd * mul * dt;
    if (e.s >= D.PATH_LEN) {
      e.dead = true;
      const dmg = Math.round(e.castleDmg * D.castleDmgScale(state.wave));
      state.castleHp = Math.max(0, state.castleHp - dmg);
      events.push({ type: 'castleHit', dmg, y: e.y });
      if (state.castleHp <= 0) {
        gameOver(state, events);
        return;
      }
      continue;
    }
    const p = pathPosDir(e.s);
    /* 진행 방향의 수직으로 살짝 흩어져 걷는다 */
    e.x = p.x + (-p.dy) * e.off;
    e.y = p.y + (p.dx) * e.off;
    e.dirX = p.dx; e.dirY = p.dy;
  }
}

function updateProjectiles(state, dt, events) {
  for (const p of state.projectiles) {
    if (p.dead) continue;
    let t = p.target;
    if (!t || t.dead) {
      let best = 150; t = null;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < best) { best = d; t = e; }
      }
      if (!t) { p.dead = true; continue; }
      p.target = t;
    }
    const dx = t.x - p.x, dy = t.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = p.spd * dt;
    if (d <= step + 14) {
      p.dead = true;
      if (p.splash) {
        events.push({ type: 'explode', x: t.x, y: t.y, big: !!p.burn });
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) <= p.splash) {
            damageEnemy(state, e, p.dmg, events);
            if (p.burn && !e.dead) e.burn = { dps: Math.max(1, Math.round(p.dmg * D.BURN.ratio)), t: D.BURN.dur };
          }
        }
      } else {
        damageEnemy(state, t, p.dmg, events);
        if (p.kind === 'bolt') events.push({ type: 'boltHit', x: t.x, y: t.y });
        /* 전설 궁수: 관통 — 화살 진행 방향의 일직선상 적 추가 타격 */
        if (p.pierce > 1) {
          const ux = (t.x - p.srcX), uy = (t.y - p.srcY);
          const ul = Math.hypot(ux, uy) || 1;
          const nx = ux / ul, ny = uy / ul;
          let remaining = p.pierce - 1;
          const cands = state.enemies
            .filter(e => {
              if (e.dead || e === t) return false;
              const rx = e.x - t.x, ry = e.y - t.y;
              const along = rx * nx + ry * ny;           // 관통 방향으로 앞쪽
              if (along < 0 || along > 180) return false;
              const side = Math.abs(rx * -ny + ry * nx); // 직선에서 벗어난 거리
              return side <= D.PIERCE_WIDTH;
            })
            .sort((a, b) => {
              const da = (a.x - t.x) * nx + (a.y - t.y) * ny;
              const db = (b.x - t.x) * nx + (b.y - t.y) * ny;
              return da - db;
            });
          for (const e of cands) {
            if (remaining <= 0) break;
            damageEnemy(state, e, p.dmg, events, 'pierce');
            events.push({ type: 'pierceHit', x: e.x, y: e.y });
            remaining--;
          }
        }
      }
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }
}

function gameOver(state, events) {
  state.phase = 'over';
  state.shardsEarned = D.shardReward(state.wave, state.bossKills);
  events.push({ type: 'gameOver', shards: state.shardsEarned });
}

function endWave(state, events) {
  const bonus = D.WAVE_BONUS(state.wave);
  state.gold += bonus;
  state.goldEarned += bonus;
  state.combo.count = 0;
  state.combo.timer = 0;
  events.push({ type: 'waveEnd', wave: state.wave, bonus });
  state.wave++;
  state.phase = 'prep';
  state.pendingWave = buildWave(state);   // 다음 웨이브 미리 생성 (미리보기용)
}

/* ---------- 틱 ---------- */
export function tick(state, dt) {
  const events = [];
  state.time += dt;
  if (state.phase !== 'wave') return events;

  if (state.combo.timer > 0) {
    state.combo.timer -= dt;
    if (state.combo.timer <= 0) state.combo.count = 0;
  }

  state.waveT += dt;
  while (state.spawnQueue.length && state.spawnQueue[0].t <= state.waveT) {
    const s = state.spawnQueue.shift();
    spawnEnemy(state, s.type, events);
  }

  updateHeroes(state, dt, events);
  updateTower(state, dt, events);
  updateEnemies(state, dt, events);
  if (state.phase !== 'wave') return events;
  updateProjectiles(state, dt, events);

  state.enemies = state.enemies.filter(e => !e.dead);
  state.projectiles = state.projectiles.filter(p => !p.dead);

  if (!state.spawnQueue.length && !state.enemies.length) endWave(state, events);
  return events;
}

export const remainingEnemies = (state) => state.spawnQueue.length + state.enemies.length;
