/* 경제/조합 진단: 고수 프로필이 전설·특수 용사를 어디까지 얻는지 */
import * as D from '../src/data.js';
import * as E from '../src/engine.js';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const coverageCache = new Map();
function rankedPads(range) {
  if (!coverageCache.has(range)) {
    coverageCache.set(range, D.PADS.map((pad, i) => ({ i, cover: D.padCoverage(pad, range) }))
      .sort((a, b) => b.cover - a.cover));
  }
  return coverageCache.get(range);
}
function placeAll(state) {
  const free = (i) => !state.field.some(v => v.padIndex === i);
  for (const h of [...state.bench].sort((a, b) => b.tier - a.tier)) {
    const slot = rankedPads(D.CLASSES[h.cls].range).find(r => free(r.i));
    if (slot) E.placeHero(state, h.id, slot.i);
  }
}

const P = { acc: 0.9, grade: 6, problemsPerPrep: 6, combineChance: 1.0, reserve: 100, upgradeOver: 120 };
const rows = [];
for (const seed of [11, 4242, 777, 90210, 31337]) {
  const state = E.createGame({ rng: mulberry32(seed), difficulty: 'normal' });
  state.bench.push(E.makeHero(state, 'knight', 0), E.makeHero(state, 'archer', 0));
  const log = [];
  while (state.phase !== 'over' && state.wave <= 40) {
    for (let i = 0; i < P.problemsPerPrep; i++) E.applyMathResult(state, state.rng() < P.acc, P.grade);
    while (state.gold >= D.SUMMON_COST + P.reserve && state.bench.length < D.BENCH_MAX) {
      if (!E.summon(state).ok) break;
    }
    for (let r = 0; r < 6; r++) {
      const combos = E.listCombos(state).filter(c => c.affordable)
        .sort((a, b) => b.resultTier - a.resultTier ||
          (b.kind === 'recipe' ? 1 : 0) - (a.kind === 'recipe' ? 1 : 0));
      if (!combos.length) break;
      let passed = false;
      for (let t = 0; t < 3; t++) {
        const ok = state.rng() < P.acc;
        E.applyMathResult(state, ok, P.grade);
        if (ok) { passed = true; break; }
      }
      if (!passed) break;
      const pick = combos[0];
      if (pick.kind === 'recipe') E.combineRecipe(state, pick.result, pick.tier);
      else E.combineRankUp(state, pick.cls, pick.tier);
    }
    placeAll(state);
    if (state.castleHp < state.castleMax * 0.5 && state.gold > 100) E.castleUpgrade(state, 'repair');
    if (state.wave >= 4 && state.castle.tower < 2 && state.gold > 300) E.castleUpgrade(state, 'tower');
    for (const h of [...state.field].sort((a, b) => b.tier - a.tier)) {
      if (state.gold <= P.upgradeOver) break;
      E.upgradeHero(state, h.id);
    }
    const all = [...state.field, ...state.bench];
    log.push({
      w: state.wave,
      gold: state.gold,
      top: all.length ? Math.max(...all.map(h => h.tier)) : -1,
      sp: state.specialsMade,
    });
    E.startWave(state);
    let clock = 0;
    while (state.phase === 'wave' && clock < 900) { E.tick(state, 0.05); clock += 0.05; }
  }
  const all = [...state.field, ...state.bench];
  rows.push({
    seed,
    끝난웨이브: state.wave,
    최고등급: all.length ? D.TIERS[Math.max(...all.map(h => h.tier))].name : '-',
    전설수: all.filter(h => h.tier === 3).length,
    특수용사: state.specialsMade,
    조합: state.combos,
    누적골드: state.goldEarned,
    첫전설웨이브: (log.find(r => r.top === 3) || {}).w || '-',
  });
}
console.log('\n=== 고수 프로필 경제/조합 진단 (보통 난이도) ===');
console.table(rows);
const legendWaves = rows.map(r => r.첫전설웨이브).filter(v => v !== '-');
console.log(legendWaves.length
  ? `전설 첫 획득 웨이브: ${legendWaves.join(', ')} (${legendWaves.length}/${rows.length}판에서 달성)`
  : '⚠ 전설을 아무도 얻지 못했습니다 — 너무 어려울 수 있음');
