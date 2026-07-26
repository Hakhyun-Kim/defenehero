/* =====================================================
 * 게임 엔진 (순수 로직, DOM/렌더링 없음)
 * v4: 세 갈래 길 + 레시피 조합(특수 직업)
 *  - 몬스터는 무게 추첨으로 길을 골라 아래→위로 행진
 *  - 공격은 데이터 주도 수정자(다단타/화상/감속/폭발/성회복/관통)
 * ===================================================== */
import * as D from './data.js';

const riFor = (rng) => (a, b) => Math.floor(rng() * (b - a + 1)) + a;
const pickFor = (rng) => (arr) => arr[Math.floor(rng() * arr.length)];

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

    phase: 'prep',
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
    pendingWave: null,

    kills: 0, bossKills: 0, midBossKills: 0, summons: 0, combos: 0,
    solved: 0, correct: 0, goldEarned: 0, upgrades: 0, hints: 0,
    specialsMade: 0,
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

/* 등급/전설 오버라이드를 합친 실효 수정자 */
export function heroMods(h) {
  const C = D.CLASSES[h.cls];
  const o = h.tier === 3 ? (D.LEGEND_OVERRIDES[h.cls] || {}) : {};
  return {
    atk: C.atk,
    range: C.range,
    spd: C.spd,
    hits: o.hits ?? C.hits ?? 1,
    burn: o.burn ?? C.burn ?? 0,
    slowOnHit: o.slowOnHit ?? C.slowOnHit ?? null,
    splash: (C.splash || 0) * (o.splashMul || 1),
    splashSlow: o.splashSlow ?? C.splashSlow ?? null,
    healOnKill: o.healOnKill ?? C.healOnKill ?? 0,
    pierce: o.pierce ?? C.pierce ?? 1,
    cleave: !!o.cleave,
    aura: o.aura || 0,
  };
}

/* ---------- 소환 ---------- */
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
  const cls = state.pick(D.GACHA_KEYS);          // 특수 직업은 소환으로 안 나온다 — 조합 전용!
  const hero = makeHero(state, cls, tier);
  state.bench.push(hero);
  state.summons++;
  return { ok: true, hero };
}

/* ---------- 조합 ----------
 * ① 등급업: 같은 직업 + 같은 등급 2명 → 같은 직업 등급+1 (예측 가능)
 * ② 레시피: 서로 다른 두 직업(같은 등급) → 특수 직업 등급+1  */
export function benchOf(state, cls, tier) {
  return state.bench.filter(h => h.cls === cls && h.tier === tier);
}

/* 조합 재료 후보: 벤치 + 배치된 용사 모두 (회수하지 않아도 조합 가능)
 * 벤치를 먼저 소비해 필드 방어를 최대한 유지한다. */
export function unitsOf(state, cls, tier) {
  return [
    ...state.bench.filter(h => h.cls === cls && h.tier === tier),
    ...state.field.filter(h => h.cls === cls && h.tier === tier),
  ];
}

/* 결과를 놓을 발판 고르기: 배치돼 있던 재료 우선, 둘 다면 더 강한(레벨↑, 커버리지↑) 쪽 */
function resultPad(mats, resultCls) {
  const placed = mats.filter(m => m.padIndex >= 0);
  if (!placed.length) return -1;
  if (placed.length === 1) return placed[0].padIndex;
  const range = D.CLASSES[resultCls].range;
  const best = placed.slice().sort((a, b) =>
    b.level - a.level ||
    D.padCoverage(D.PADS[b.padIndex], range) - D.padCoverage(D.PADS[a.padIndex], range)
  )[0];
  return best.padIndex;
}

/* 재료를 벤치/필드에서 제거 */
function consume(state, mats) {
  state.bench = state.bench.filter(h => !mats.includes(h));
  state.field = state.field.filter(h => !mats.includes(h));
}

export function listCombos(state) {
  const out = [];
  /* 등급업 — 벤치/필드 통합 집계 */
  const seen = new Set();
  for (const h of [...state.bench, ...state.field]) {
    const key = `${h.cls}:${h.tier}`;
    if (seen.has(key) || h.tier >= 3) continue;
    seen.add(key);
    if (unitsOf(state, h.cls, h.tier).length >= 2) {
      const cost = D.combineCost(h.tier + 1, false);
      out.push({
        kind: 'rankup', cls: h.cls, tier: h.tier, result: h.cls, resultTier: h.tier + 1,
        cost, affordable: state.gold >= cost,
      });
    }
  }
  /* 레시피 */
  for (const r of D.RECIPES) {
    for (let tier = 0; tier <= 2; tier++) {
      if (unitsOf(state, r.a, tier).length >= 1 && unitsOf(state, r.b, tier).length >= 1) {
        const cost = D.combineCost(tier + 1, true);
        out.push({
          kind: 'recipe', result: r.result, a: r.a, b: r.b, tier, resultTier: tier + 1,
          cost, affordable: state.gold >= cost,
        });
      }
    }
  }
  return out;
}

export function combineRankUp(state, cls, tier) {
  const mats = unitsOf(state, cls, tier).slice(0, 2);
  if (mats.length < 2 || tier >= 3) return { ok: false };
  const cost = D.combineCost(tier + 1, false);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  /* 럭키! 낮은 확률로 두 등급 점프 (전설까지는 못 뛴다) */
  const lucky = tier + 2 <= D.LUCKY_MAX_TIER && state.rng() < D.LUCKY_JUMP;
  const newTier = lucky ? tier + 2 : tier + 1;
  const pad = resultPad(mats, cls);
  consume(state, mats);
  const hero = makeHero(state, cls, newTier, Math.max(mats[0].level, mats[1].level));
  state.bench.push(hero);
  /* 재료가 배치돼 있었다면 결과도 그 자리에 바로 배치 (회수 불필요) */
  if (pad >= 0) placeHero(state, hero.id, pad);
  state.combos++;
  return { ok: true, hero, lucky, cost, pad };
}

export function combineRecipe(state, result, tier) {
  const R = D.CLASSES[result];
  if (!R || !R.recipe || tier >= 3) return { ok: false };
  const a = unitsOf(state, R.recipe[0], tier)[0];
  const b = unitsOf(state, R.recipe[1], tier)[0];
  if (!a || !b) return { ok: false };
  const cost = D.combineCost(tier + 1, true);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  const mats = [a, b];
  const pad = resultPad(mats, result);
  consume(state, mats);
  const hero = makeHero(state, result, tier + 1, Math.max(a.level, b.level));
  state.bench.push(hero);
  if (pad >= 0) placeHero(state, hero.id, pad);
  state.combos++;
  state.specialsMade++;
  return { ok: true, hero, cost, pad };
}

/* 배치된 용사를 다른 빈 발판으로 이동 (회수 없이) */
export function moveHero(state, heroId, padIndex) {
  const h = state.field.find(v => v.id === heroId);
  if (!h) return { ok: false };
  if (padIndex < 0 || padIndex >= D.PADS.length) return { ok: false };
  if (padIndex === h.padIndex) return { ok: false, reason: 'same' };
  const occupant = padOccupant(state, padIndex);
  if (occupant) return { ok: false, reason: 'occupied' };
  h.padIndex = padIndex;
  h.x = D.PADS[padIndex].x;
  h.y = D.PADS[padIndex].y;
  h.cd = 0;
  return { ok: true, hero: h };
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

/* ---------- 수학 / 힌트 ---------- */
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

function pickRoute(state) {
  let r = state.rng();
  for (let i = 0; i < D.ROUTE_WEIGHTS.length; i++) {
    r -= D.ROUTE_WEIGHTS[i];
    if (r < 0) return i;
  }
  return 0;
}

/* 분대 단위로 몰려오는 웨이브를 만든다 (+ 웨이브 말미의 보스들) */
export function buildWave(state) {
  const w = state.wave;
  const total = Math.round(D.waveCount(w) * state.diff.countMul);
  const mix = D.waveMix(w);
  const list = [];
  let t = 1.2;
  let spawned = 0;
  while (spawned < total) {
    const size = Math.min(D.squadSize(w), total - spawned);
    /* 분대는 같은 종류가 뭉쳐 나오되, 30%는 섞인 혼성 분대 */
    const uniform = state.rng() < 0.7;
    const squadType = pickWeighted(state, mix);
    const route = pickRoute(state);          // 분대는 같은 길로 함께 진군
    for (let i = 0; i < size; i++) {
      list.push({
        t: t + i * D.SQUAD_INNER_GAP,
        type: uniform ? squadType : pickWeighted(state, mix),
        route,
      });
    }
    spawned += size;
    t += size * D.SQUAD_INNER_GAP + D.squadGap(w) * (0.8 + state.rng() * 0.4);
  }

  /* 중간보스: 매 웨이브 마지막을 장식한다 */
  const midT = t + 1.6;
  const midType = D.midBossType(w);
  list.push({ t: midT - D.BOSS_WARN_LEAD, warnOnly: true, tier: 'mid', etype: midType });
  list.push({ t: midT, type: midType, route: pickRoute(state) });

  /* 대보스: 5웨이브마다, 중간보스 뒤에 지름길로 돌진 */
  if (D.isBossWave(w)) {
    const bossT = midT + 4.5;
    const bType = D.greatBossType(w);
    list.push({ t: bossT - D.BOSS_WARN_LEAD, warnOnly: true, tier: 'great', etype: bType });
    list.push({ t: bossT, type: bType });
  }
  return list;
}

export function waveSummary(state) {
  const counts = {};
  for (const s of (state.pendingWave || [])) {
    if (s.warnOnly) continue;
    counts[s.type] = (counts[s.type] || 0) + 1;
  }
  return counts;
}

export function startWave(state) {
  if (state.phase !== 'prep') return { ok: false };
  state.phase = 'wave';
  state.spawnQueue = [...(state.pendingWave || buildWave(state))];
  state.waveT = 0;
  return { ok: true, boss: D.isBossWave(state.wave) };
}

function spawnEnemy(state, type, events, presetRoute) {
  const E = D.ENEMY_TYPES[type];
  const w = state.wave;
  const rampMul = E.midBoss ? D.midBossRamp(w) : 1;
  const hp = Math.round(E.hp * D.hpScale(w) * state.diff.hpMul * rampMul);
  /* 대보스는 지름길로 돌진 */
  const route = E.boss ? D.BOSS_ROUTE : (presetRoute != null ? presetRoute : pickRoute(state));
  const start = D.routePoint(route, 0);
  const e = {
    id: state.nextId++, type, route,
    hp, maxHp: hp,
    s: 0,
    off: state.ri(-10, 10),
    x: start.x, y: start.y,
    spd: E.spd * (0.92 + state.rng() * 0.16),
    gold: Math.round(E.gold * D.enemyGoldScale(w) * state.diff.goldMul),
    castleDmg: E.castleDmg,
    size: E.size, boss: !!E.boss, midBoss: !!E.midBoss,
    name: E.name,
    enrageAt: E.enrageAt || 0, enrageSpd: E.enrageSpd || 1, enraged: false,
    heal: E.heal || 0, healPeriod: E.healPeriod || 0, healRange: E.healRange || 0,
    healCd: E.healPeriod || 0,
    slowT: 0, slowMul: 1, auraMul: 1,
    dead: false,
  };
  state.enemies.push(e);
  events.push({ type: 'spawn', etype: type, x: e.x, y: e.y, boss: e.boss, midBoss: e.midBoss });
  if (e.boss) events.push({ type: 'bossSpawn', tier: 'great', name: E.name, emoji: E.emoji });
  else if (e.midBoss) events.push({ type: 'bossSpawn', tier: 'mid', name: E.name, emoji: E.emoji });
}

/* ---------- 전투 ---------- */
function damageEnemy(state, e, dmg, events, kind = 'hit', healOnKill = 0) {
  if (e.dead) return;
  e.hp -= dmg;
  events.push({ type: 'enemyHit', x: e.x, y: e.y - e.size / 2, dmg, kind });
  if (e.hp <= 0) {
    e.dead = true;
    state.kills++;
    if (e.boss) state.bossKills++;
    if (e.midBoss) state.midBossKills++;
    state.combo.count++;
    state.combo.timer = D.COMBO.window;
    const mul = state.combo.count >= D.COMBO.x3At ? 3 : state.combo.count >= D.COMBO.x2At ? 2 : 1;
    const gold = e.gold * mul;
    state.gold += gold;
    state.goldEarned += gold;
    events.push({
      type: 'kill', x: e.x, y: e.y, gold, etype: e.type,
      boss: e.boss, midBoss: e.midBoss, name: e.name,
      combo: state.combo.count, mul,
    });
    /* 성기사: 처치 시 성 회복 */
    if (healOnKill > 0 && state.castleHp < state.castleMax) {
      state.castleHp = Math.min(state.castleMax, state.castleHp + healOnKill);
      events.push({ type: 'castleHeal', amount: healOnKill, x: e.x, y: e.y });
    }
  }
}

function applyBurn(e, dmg, ratio) {
  e.burn = { dps: Math.max(1, Math.round(dmg * ratio)), t: D.BURN_DUR };
}
function applySlow(e, s) {
  if (e.slowT > 0) e.slowMul = Math.min(e.slowMul, s.mul);
  else e.slowMul = s.mul;
  e.slowT = Math.max(e.slowT, s.dur);
}

function firstInRange(state, x, y, range) {
  let target = null, best = -1;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - x, e.y - y) <= range) {
      /* 루트 길이가 달라 진행률(%)로 비교 — 성문에 가까운 적 우선 */
      const prog = e.s / D.ROUTE_LENS[e.route];
      if (prog > best) { best = prog; target = e; }
    }
  }
  return target;
}

function meleeStrike(state, h, mods, e, events) {
  for (let k = 0; k < mods.hits; k++) {
    damageEnemy(state, e, h.dmg, events, 'hit', mods.healOnKill);
    if (e.dead) break;
  }
  if (!e.dead) {
    if (mods.burn) applyBurn(e, h.dmg, mods.burn);
    if (mods.slowOnHit) applySlow(e, mods.slowOnHit);
  }
}

function updateHeroes(state, dt, events) {
  for (const h of state.field) {
    h.cd -= dt;
    if (h.cd > 0) continue;
    const mods = heroMods(h);
    const target = firstInRange(state, h.x, h.y, mods.range);
    if (!target) continue;
    h.cd = 1 / mods.spd;

    if (mods.atk === 'melee') {
      if (mods.cleave) {
        for (const e of [...state.enemies]) {
          if (e.dead) continue;
          if (Math.hypot(e.x - h.x, e.y - h.y) <= mods.range) meleeStrike(state, h, mods, e, events);
        }
        events.push({ type: 'meleeHit', x: h.x, y: h.y, cls: h.cls, heroId: h.id, cleave: true, tx: target.x, ty: target.y });
      } else {
        meleeStrike(state, h, mods, target, events);
        events.push({
          type: 'meleeHit', x: target.x, y: target.y, cls: h.cls, heroId: h.id,
          tx: target.x, ty: target.y,
          slow: !!mods.slowOnHit, burn: !!mods.burn, hits: mods.hits,
        });
      }
    } else {
      state.projectiles.push({
        id: state.nextId++,
        kind: mods.atk,                    // 'arrow' | 'orb'
        x: h.x, y: h.y - 22, target,
        dmg: h.dmg,
        spd: mods.atk === 'arrow' ? D.ARROW_SPEED : D.ORB_SPEED,
        dead: false,
        splash: mods.splash || 0,
        splashSlow: mods.splashSlow,
        slowOnHit: mods.slowOnHit,
        burn: mods.burn,
        pierce: mods.pierce,
        srcX: h.x, srcY: h.y,
      });
      events.push({ type: 'shoot', kind: mods.atk, x: h.x, y: h.y, heroId: h.id, tx: target.x, ty: target.y });
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
    x: D.CASTLE_POS.x, y: D.CASTLE_POS.y - 20,
    target, dmg: D.TOWER_DMG(lv), spd: 420, dead: false,
    splash: 0, pierce: 1,
  });
  events.push({ type: 'shoot', kind: 'bolt', x: D.CASTLE_POS.x, y: D.CASTLE_POS.y });
}

function updateEnemies(state, dt, events) {
  /* 서리 결계(오라) 감속 */
  const auraHeroes = [];
  for (const h of state.field) {
    const mods = heroMods(h);
    if (mods.aura) auraHeroes.push({ h, aura: mods.aura, range: mods.range });
  }
  for (const e of state.enemies) e.auraMul = 1;
  for (const g of auraHeroes) {
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - g.h.x, e.y - g.h.y) <= g.range) e.auraMul = Math.min(e.auraMul, g.aura);
    }
  }

  for (const e of state.enemies) {
    if (e.dead) continue;

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

    /* 대보스 분노: 체력이 절반 아래로 떨어지면 폭주 */
    if (e.enrageAt && !e.enraged && e.hp / e.maxHp <= e.enrageAt) {
      e.enraged = true;
      e.spd *= e.enrageSpd;
      events.push({ type: 'bossEnrage', x: e.x, y: e.y, name: e.name });
    }

    if (e.slowT > 0) e.slowT -= dt;
    let mul = 1;
    if (e.slowT > 0) mul = Math.min(mul, e.slowMul);
    mul = Math.min(mul, e.auraMul);
    e.slowed = mul < 1;

    e.s += e.spd * mul * dt;
    const routeLen = D.ROUTE_LENS[e.route];
    if (e.s >= routeLen) {
      e.dead = true;
      const dmg = Math.round(e.castleDmg * D.castleDmgScale(state.wave));
      state.castleHp = Math.max(0, state.castleHp - dmg);
      events.push({ type: 'castleHit', dmg, x: e.x, y: e.y });
      if (state.castleHp <= 0) {
        gameOver(state, events);
        return;
      }
      continue;
    }
    const p = D.routePoint(e.route, e.s);
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
      if (p.splash > 0) {
        events.push({ type: 'explode', x: t.x, y: t.y, big: p.splash > 66, frost: !!p.splashSlow });
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) <= p.splash) {
            damageEnemy(state, e, p.dmg, events);
            if (!e.dead) {
              if (p.splashSlow) applySlow(e, p.splashSlow);
              if (p.burn) applyBurn(e, p.dmg, p.burn);
            }
          }
        }
      } else {
        damageEnemy(state, t, p.dmg, events);
        if (!t.dead) {
          if (p.slowOnHit) applySlow(t, p.slowOnHit);
          if (p.burn) applyBurn(t, p.dmg, p.burn);
        }
        if (p.kind === 'bolt') events.push({ type: 'boltHit', x: t.x, y: t.y });
        if (p.pierce > 1) {
          const ux = (t.x - p.srcX), uy = (t.y - p.srcY);
          const ul = Math.hypot(ux, uy) || 1;
          const nx = ux / ul, ny = uy / ul;
          let remaining = p.pierce - 1;
          const cands = state.enemies
            .filter(e => {
              if (e.dead || e === t) return false;
              const rx = e.x - t.x, ry = e.y - t.y;
              const along = rx * nx + ry * ny;
              if (along < 0 || along > 180) return false;
              const side = Math.abs(rx * -ny + ry * nx);
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
            if (!e.dead && p.slowOnHit) applySlow(e, p.slowOnHit);
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
  state.pendingWave = buildWave(state);
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
    if (s.warnOnly) {
      events.push({ type: 'bossWarn', tier: s.tier, name: D.ENEMY_TYPES[s.etype].name, emoji: D.ENEMY_TYPES[s.etype].emoji });
      continue;
    }
    spawnEnemy(state, s.type, events, s.route);
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
