/* =====================================================
 * 게임 엔진 (순수 로직, DOM/렌더링 없음)
 * 브라우저 게임 본체와 밸런스 봇(Node)이 함께 사용한다.
 * tick()은 이벤트 배열을 반환하고, 렌더러/사운드가 이를 소비한다.
 * ===================================================== */
import * as D from './data.js';

const riFor = (rng) => (a, b) => Math.floor(rng() * (b - a + 1)) + a;
const pickFor = (rng) => (arr) => arr[Math.floor(rng() * arr.length)];

export const cellX = (col) => D.GRID_X + col * D.CELL + D.CELL / 2;
export const cellY = (row) => D.GRID_Y + row * D.CELL + D.CELL / 2;

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
    bench: [], field: [],
    enemies: [], projectiles: [],
    spawnQueue: [], waveT: 0,

    kills: 0, bossKills: 0, summons: 0, combos: 0,
    solved: 0, correct: 0, goldEarned: 0, upgrades: 0,
    shardsEarned: 0,
    combo: { count: 0, timer: 0 },
    time: 0,
  };
  return state;
}

export function makeHero(state, cls, tier, level = 1) {
  const s = D.heroStats(cls, tier, level);
  const dmg = Math.round(s.dmg * state.dmgMul);
  return {
    id: state.nextId++, cls, tier, level,
    dmg, maxHp: s.hp, hp: s.hp,
    row: -1, col: -1, x: 0, y: 0, cd: 0,
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
  /* 조합 결과는 재료 중 높은 레벨을 물려받는다 */
  const level = Math.max(targets[0].level, targets[1].level);
  const hero = makeHero(state, cls, tier + 1, level);
  state.bench.push(hero);
  state.combos++;
  return { ok: true, hero };
}

/* ---------- 배치 / 회수 / 판매 / 강화 ---------- */
export function placeHero(state, heroId, row, col) {
  const idx = state.bench.findIndex(h => h.id === heroId);
  if (idx < 0) return { ok: false };
  if (state.field.some(h => h.row === row && h.col === col)) return { ok: false, reason: 'occupied' };
  const h = state.bench[idx];
  state.bench.splice(idx, 1);
  h.row = row; h.col = col;
  h.x = cellX(col); h.y = cellY(row);
  h.cd = 0;
  state.field.push(h);
  return { ok: true, hero: h };
}

export function recallHero(state, heroId) {
  const h = state.field.find(v => v.id === heroId);
  if (!h) return { ok: false };
  if (state.bench.length >= D.BENCH_MAX) return { ok: false, reason: 'bench' };
  state.field = state.field.filter(v => v !== h);
  h.row = -1; h.col = -1;
  state.bench.push(h);
  return { ok: true };
}

export function sellHero(state, heroId) {
  const inField = state.field.find(v => v.id === heroId);
  const inBench = state.bench.find(v => v.id === heroId);
  const h = inField || inBench;
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
  const ratio = h.hp / h.maxHp;
  h.level++;
  const s = D.heroStats(h.cls, h.tier, h.level);
  h.dmg = Math.round(s.dmg * state.dmgMul);
  h.maxHp = s.hp;
  h.hp = Math.round(s.hp * ratio);
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

/* ---------- 수학 결과 ---------- */
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
    list.push({ t, type: pickWeighted(state, mix), row: state.ri(0, D.ROWS - 1) });
    t += interval * (0.7 + state.rng() * 0.6);
  }
  if (D.isBossWave(w)) list.push({ t: t + 1.5, type: 'boss', row: 2 });
  return list;
}

export function startWave(state) {
  if (state.phase !== 'prep') return { ok: false };
  state.phase = 'wave';
  state.spawnQueue = buildWave(state);
  state.waveT = 0;
  return { ok: true, boss: D.isBossWave(state.wave) };
}

function spawnEnemy(state, type, row, events) {
  const E = D.ENEMY_TYPES[type];
  const w = state.wave;
  const hp = Math.round(E.hp * D.hpScale(w) * state.diff.hpMul);
  const e = {
    id: state.nextId++, type, row,
    hp, maxHp: hp,
    x: D.FIELD_W + 20 + state.ri(0, 26),
    y: cellY(row) + state.ri(-10, 10),
    spd: E.spd * (0.92 + state.rng() * 0.16),
    dmg: Math.round(E.dmg * D.enemyDmgScale(w)),
    gold: Math.round(E.gold * D.enemyGoldScale(w) * state.diff.goldMul),
    castleDmg: E.castleDmg,
    size: E.size, boss: !!E.boss,
    heal: E.heal || 0, healPeriod: E.healPeriod || 0, healRange: E.healRange || 0,
    atkCd: 0, healCd: E.healPeriod || 0, dead: false,
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
    /* 킬 콤보: 3초 안에 이어서 처치하면 골드 배율 상승 */
    state.combo.count++;
    state.combo.timer = D.COMBO.window;
    const mul = state.combo.count >= D.COMBO.x3At ? 3 : state.combo.count >= D.COMBO.x2At ? 2 : 1;
    const gold = e.gold * mul;
    state.gold += gold;
    state.goldEarned += gold;
    events.push({ type: 'kill', x: e.x, y: e.y, gold, etype: e.type, boss: e.boss, combo: state.combo.count, mul });
  }
}

function killHero(state, h, events) {
  state.field = state.field.filter(v => v !== h);
  events.push({ type: 'heroDead', x: h.x, y: h.y, heroId: h.id });
}

function updateHeroes(state, dt, events) {
  for (const h of state.field) {
    h.cd -= dt;
    if (h.cd > 0) continue;
    const C = D.CLASSES[h.cls];
    let target = null, best = Infinity;

    const legend = h.tier === 3;

    if (C.type === 'melee') {
      for (const e of state.enemies) {
        if (e.dead || e.row !== h.row) continue;
        const dx = e.x - h.x;
        if (dx >= -D.MELEE_BEHIND && dx <= D.MELEE_RANGE && dx < best) { best = dx; target = e; }
      }
      if (target) {
        h.cd = 1 / C.spd;
        if (legend && h.cls === 'knight') {
          /* 전설 검사: 회전베기 — 사거리 안 모든 적 타격 */
          for (const e of [...state.enemies]) {
            if (e.dead || e.row !== h.row) continue;
            const dx = e.x - h.x;
            if (dx >= -D.MELEE_BEHIND && dx <= D.MELEE_RANGE) damageEnemy(state, e, h.dmg, events);
          }
          events.push({ type: 'meleeHit', x: h.x, y: h.y, cls: h.cls, cleave: true });
        } else {
          damageEnemy(state, target, h.dmg, events);
          events.push({ type: 'meleeHit', x: target.x, y: target.y, cls: h.cls });
        }
      }
    } else if (C.type === 'lane') {
      for (const e of state.enemies) {
        if (e.dead || e.row !== h.row) continue;
        const dx = e.x - h.x;
        if (dx >= -20 && dx < best) { best = dx; target = e; }
      }
      if (target) {
        h.cd = 1 / C.spd;
        state.projectiles.push({
          id: state.nextId++, kind: 'arrow', x: h.x + 16, y: h.y - 6, target,
          dmg: h.dmg, spd: D.ARROW_SPEED, dead: false,
          pierce: legend ? D.PIERCE_COUNT : 1, row: h.row,   /* 전설 궁수: 관통 화살 */
        });
        events.push({ type: 'shoot', kind: 'arrow', x: h.x, y: h.y });
      }
    } else { // radius
      for (const e of state.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - h.x, e.y - h.y);
        if (d <= C.radius && d < best) { best = d; target = e; }
      }
      if (target) {
        h.cd = 1 / C.spd;
        state.projectiles.push({
          id: state.nextId++, kind: 'orb', x: h.x, y: h.y - 10, target,
          dmg: h.dmg, spd: D.ORB_SPEED, dead: false,
          splash: C.splash * (legend ? D.LEGEND_SPLASH_MUL : 1),
          burn: legend,                                        /* 전설 마법사: 화염 폭발 */
        });
        events.push({ type: 'shoot', kind: 'orb', x: h.x, y: h.y });
      }
    }
  }
}

function updateTower(state, dt, events) {
  const lv = state.castle.tower;
  if (lv <= 0) return;
  state.towerCd -= dt;
  if (state.towerCd > 0) return;
  let target = null, best = Infinity;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.x <= D.CASTLE_HIT_X + D.TOWER_RANGE && e.x < best) { best = e.x; target = e; }
  }
  if (!target) return;
  state.towerCd = D.TOWER_PERIOD(lv);
  state.projectiles.push({
    id: state.nextId++, kind: 'bolt',
    x: 60, y: D.FIELD_H / 2 - 40,
    target, dmg: D.TOWER_DMG(lv), spd: 420, dead: false,
  });
  events.push({ type: 'shoot', kind: 'bolt', x: 60, y: D.FIELD_H / 2 - 40 });
}

function updateEnemies(state, dt, events) {
  for (const e of state.enemies) {
    if (e.dead) continue;

    /* 화상(전설 마법사): 초당 지속 피해 */
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

    /* 주술사: 주변 아군 회복 */
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

    /* 앞을 막는 용사 */
    let blocker = null;
    for (const h of state.field) {
      if (h.row !== e.row) continue;
      const dx = e.x - h.x;
      if (dx >= -6 && dx <= D.BLOCK_DIST && (!blocker || h.x > blocker.x)) blocker = h;
    }
    if (blocker) {
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        e.atkCd = D.ENEMY_ATK_PERIOD;
        blocker.hp -= e.dmg;
        events.push({ type: 'heroHurt', x: blocker.x, y: blocker.y, dmg: e.dmg, heroId: blocker.id });
        /* 전설 방패병: 가시 갑옷 반사 */
        if (blocker.tier === 3 && blocker.cls === 'guard') {
          const reflect = Math.round(e.dmg * D.THORNS_RATIO);
          if (reflect > 0) {
            damageEnemy(state, e, reflect, events, 'thorns');
            events.push({ type: 'thorns', x: e.x, y: e.y });
          }
        }
        if (blocker.hp <= 0) killHero(state, blocker, events);
      }
    } else {
      e.x -= e.spd * dt;
      if (e.x <= D.CASTLE_HIT_X) {
        e.dead = true;
        const dmg = Math.round(e.castleDmg * D.castleDmgScale(state.wave));
        state.castleHp = Math.max(0, state.castleHp - dmg);
        events.push({ type: 'castleHit', dmg, y: e.y });
        if (state.castleHp <= 0) {
          gameOver(state, events);
          return;
        }
      }
    }
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
        /* 전설 궁수: 관통 — 뚫고 지나가며 뒤쪽 적도 타격 */
        if (p.pierce > 1) {
          let remaining = p.pierce - 1;
          const others = state.enemies
            .filter(e => !e.dead && e.row === p.row && e !== t && e.x > t.x - 10 && e.x < t.x + 170)
            .sort((a, b) => a.x - b.x);
          for (const e of others) {
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
  state.field.forEach(h => h.hp = h.maxHp);
  state.bench.forEach(h => h.hp = h.maxHp);
  events.push({ type: 'waveEnd', wave: state.wave, bonus });
  state.wave++;
  state.phase = 'prep';
}

/* ---------- 틱 ---------- */
export function tick(state, dt) {
  const events = [];
  state.time += dt;
  if (state.phase !== 'wave') return events;

  /* 킬 콤보 타이머 */
  if (state.combo.timer > 0) {
    state.combo.timer -= dt;
    if (state.combo.timer <= 0) state.combo.count = 0;
  }

  state.waveT += dt;
  while (state.spawnQueue.length && state.spawnQueue[0].t <= state.waveT) {
    const s = state.spawnQueue.shift();
    spawnEnemy(state, s.type, s.row, events);
  }

  updateHeroes(state, dt, events);
  updateTower(state, dt, events);
  updateEnemies(state, dt, events);
  if (state.phase !== 'wave') return events;   // 성 함락으로 중단
  updateProjectiles(state, dt, events);

  state.enemies = state.enemies.filter(e => !e.dead);
  state.projectiles = state.projectiles.filter(p => !p.dead);

  if (!state.spawnQueue.length && !state.enemies.length) endWave(state, events);
  return events;
}

export const remainingEnemies = (state) => state.spawnQueue.length + state.enemies.length;
