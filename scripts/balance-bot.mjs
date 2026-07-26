/* =====================================================
 * 난이도 밸런스 봇
 * 실제 게임 엔진(src/engine.js)을 그대로 사용해
 * 가상 플레이어(초보/보통/고수)로 수백 판을 시뮬레이션한다.
 *
 * 사용법:  node scripts/balance-bot.mjs [runs] [difficulty]
 *   예)    node scripts/balance-bot.mjs 200 normal
 * ===================================================== */
import * as D from '../src/data.js';
import * as E from '../src/engine.js';

/* 결정적 난수 (mulberry32) */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 가상 플레이어 프로필 ---------- */
const PROFILES = {
  /* 초보: 문제를 거의 안 풀고, 조합도 잘 모름, 뽑는 대로 배치 */
  '초보': {
    acc: 0.45, grade: 3, problemsPerPrep: 1,
    combineChance: 0.15, reserve: 0,
    useCastle: false, midWave: false, sloppy: 0.5,
  },
  /* 보통: 가끔 문제 풀고 조합도 하지만 최적은 아님 */
  '보통': {
    acc: 0.7, grade: 4, problemsPerPrep: 3,
    combineChance: 0.7, reserve: 50,
    useCastle: 'repairOnly', midWave: false, sloppy: 0.3,
  },
  /* 고수: 수학 열심히, 조합/강화/포탑 풀활용 */
  '고수': {
    acc: 0.9, grade: 6, problemsPerPrep: 6,
    combineChance: 1.0, reserve: 100,
    useCastle: true, midWave: true,
  },
};

/* ---------- 배치 정책 ----------
 * 각 패드가 해당 직업 사거리로 덮는 "길의 길이"를 계산해
 * 커버리지가 가장 큰 빈 패드부터 채운다. */
const coverageCache = new Map();
function rankedPads(range) {
  if (!coverageCache.has(range)) {
    const scored = D.PADS.map((pad, i) => ({ i, cover: D.padCoverage(pad, range) }))
      .sort((a, b) => b.cover - a.cover);
    coverageCache.set(range, scored);
  }
  return coverageCache.get(range);
}

function placeAll(state, sloppy = 0) {
  const bench = () => [...state.bench].sort((a, b) => b.tier - a.tier || b.level - a.level);
  const free = (i) => !state.field.some(v => v.padIndex === i);
  for (const h of bench()) {
    /* 미숙한 플레이어: 일정 확률로 아무 빈 패드에 놓는다 */
    if (sloppy && state.rng() < sloppy) {
      const empties = D.PADS.map((_, i) => i).filter(free);
      if (empties.length) E.placeHero(state, h.id, empties[Math.floor(state.rng() * empties.length)]);
      continue;
    }
    const slot = rankedPads(D.CLASSES[h.cls].range).find(r => free(r.i));
    if (slot) E.placeHero(state, h.id, slot.i);
  }
}

/* ---------- 준비 페이즈 정책 ---------- */
function prepActions(state, P) {
  /* 수학 문제는 조합할 때만 나온다 — 따로 푸는 행동은 없음 */
  /* 2) 소환 */
  while (state.gold >= D.SUMMON_COST + P.reserve && state.bench.length < D.BENCH_MAX) {
    if (!summonOk(state)) break;
  }
  /* 3) 조합 (수학 문제 + 골드 필요) — 높은 등급 우선, 동급이면 특수 레시피 우선 */
  for (let round = 0; round < 6; round++) {
    const combos = E.listCombos(state)
      .filter(c => c.affordable)
      .sort((a, b) => b.resultTier - a.resultTier ||
        (b.kind === 'recipe' ? 1 : 0) - (a.kind === 'recipe' ? 1 : 0));
    if (!combos.length || state.rng() >= P.combineChance) break;
    /* 조합 관문: 정답까지 최대 3회 시도. 첫 시도 정답이면 비용 일부 환급 */
    let passed = false, tries = 0;
    for (; tries < 3; tries++) {
      const ok = state.rng() < P.acc;
      E.applyMathResult(state, ok);
      if (ok) { passed = true; break; }
    }
    if (!passed) break;
    const pick = combos[0];
    const r = pick.kind === 'recipe'
      ? E.combineRecipe(state, pick.result)
      : E.combineRankUp(state, pick.cls, pick.tier);
    if (r.ok && tries === 0) E.refundFirstTry(state, r.cost, P.grade);
  }
  /* 4) 배치 */
  placeAll(state, P.sloppy || 0);
  /* 5) 성 관리 */
  if (P.useCastle) {
    if (state.castleHp < state.castleMax * 0.5 && state.gold > 100) E.castleUpgrade(state, 'repair');
    if (P.useCastle === true) {
      if (state.wave >= 4 && state.castle.tower < 1 && state.gold > 250) E.castleUpgrade(state, 'tower');
      if (state.wave >= 8 && state.castle.tower < 2 && state.gold > 400) E.castleUpgrade(state, 'tower');
      if (state.wave >= 6 && state.castle.fortify < 3 && state.gold > 350) E.castleUpgrade(state, 'fortify');
    }
  }
}

function summonOk(state) {
  return E.summon(state).ok;
}

/* ---------- 한 판 실행 ---------- */
function playRun(profileName, difficulty, seed, waveCap = 40) {
  const P = PROFILES[profileName];
  const state = E.createGame({ rng: mulberry32(seed), difficulty });
  /* 시작 용사 2명 (게임 본체와 동일) */
  state.bench.push(E.makeHero(state, 'knight', 0));
  state.bench.push(E.makeHero(state, 'archer', 0));

  const castleLog = [];
  let stalemate = false;
  while (state.phase !== 'over' && state.wave <= waveCap && !stalemate) {
    prepActions(state, P);
    E.startWave(state);
    let midTimer = 0, waveClock = 0;
    while (state.phase === 'wave') {
      E.tick(state, 0.05);
      midTimer += 0.05;
      waveClock += 0.05;
      if (waveClock > 900) {   // 15분 넘게 안 끝나는 웨이브 = 교착
        stalemate = true;
        console.warn(`  ⚠ 교착 감지: seed=${seed} wave=${state.wave} 적=${state.enemies.length} 용사=${state.field.length}`);
        break;
      }
      if (P.midWave && midTimer >= 2) {
        midTimer = 0;
        if (state.gold >= D.SUMMON_COST && state.bench.length < D.BENCH_MAX) {
          if (summonOk(state)) placeAll(state);
        }
      }
    }
    castleLog.push(state.castleHp);
  }
  return {
    wave: Math.min(state.wave, waveCap + 1),
    survived: state.wave > waveCap,
    kills: state.kills,
    castleLog,
    solved: state.solved,
  };
}

/* ---------- 통계 ---------- */
const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

function runProfile(profileName, difficulty, runs) {
  const waves = [], survived = [];
  for (let i = 0; i < runs; i++) {
    const r = playRun(profileName, difficulty, i * 7919 + 13);
    waves.push(r.wave);
    survived.push(r.survived ? 1 : 0);
  }
  return {
    profile: profileName,
    difficulty,
    mean: avg(waves).toFixed(1),
    p25: pct(waves, 0.25), p50: pct(waves, 0.5), p75: pct(waves, 0.75),
    min: Math.min(...waves), max: Math.max(...waves),
    survivedPct: (avg(survived) * 100).toFixed(0) + '%',
  };
}

/* ---------- 메인 ---------- */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const checkMode = args.includes('check');
const nums = args.filter(a => /^\d+$/.test(a));
const runs = Number(nums[0]) || 150;
const diffArg = args.find(a => ['easy', 'normal', 'hard'].includes(a));
const diffs = diffArg ? [diffArg] : ['easy', 'normal', 'hard'];

console.log(`\n=== 용사 수학 디펜스 밸런스 봇 (판수: ${runs}${checkMode ? ', 기준선 검증 모드' : ''}) ===\n`);

let baseline = null;
if (checkMode) {
  const p = join(dirname(fileURLToPath(import.meta.url)), 'balance-baseline.json');
  baseline = JSON.parse(readFileSync(p, 'utf8'));
}

let drift = false;
for (const d of diffs) {
  for (const p of Object.keys(PROFILES)) {
    const r = runProfile(p, d, runs);
    let flag = '';
    if (baseline) {
      const key = `${d}/${p}`;
      const base = baseline.medians[key];
      if (base != null && Math.abs(r.p50 - base) > baseline.tolerance) {
        flag = `  ⚠ 기준선 이탈! (기준 중앙값 ${base}, 허용 ±${baseline.tolerance})`;
        drift = true;
      } else if (base != null) {
        flag = `  ✓ 기준선 OK (${base}±${baseline.tolerance})`;
      }
    }
    console.log(
      `[${D.DIFFICULTIES[d].name}] ${r.profile}  평균 ${r.mean}웨이브` +
      `  (p25 ${r.p25} / 중앙값 ${r.p50} / p75 ${r.p75})  범위 ${r.min}~${r.max}  40웨이브 생존 ${r.survivedPct}${flag}`
    );
  }
  console.log('');
}
if (checkMode) {
  console.log(drift ? '❌ 밸런스가 기준선에서 벗어났습니다. 수치를 확인하세요.' : '✅ 모든 항목이 기준선 안에 있습니다.');
  if (drift) process.exitCode = 1;
}
