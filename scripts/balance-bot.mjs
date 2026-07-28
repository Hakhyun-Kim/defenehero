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
/* 판단 로직은 src/bot.js 하나뿐이다 — 브라우저 데모(src/demo.js)와 같은 것을 쓴다.
 * 여기서 다시 구현하면 "봇은 통과하는데 화면에선 다르게 노는" 상황이 생긴다. */
import { PROFILES, mulberry32, placeAll, chooseCombo, castlePlan, wantsSummon } from '../src/bot.js';

/* ---------- 가상 플레이어 프로필 ---------- */
/* ---------- 준비 페이즈 정책 ----------
 * 봇은 한 번에 다 해치운다. 데모는 같은 정책을 하나씩 스트림으로 먹는다
 * (src/bot.js 의 nextPrepAction). 정책 자체는 한 곳에만 있다. */
function prepActions(state, P) {
  /* 1) 소환 */
  while (wantsSummon(state, P)) {
    if (!E.summon(state).ok) break;
  }
  /* 2) 조합 (수학 관문 + 골드) */
  for (let round = 0; round < 6; round++) {
    const pick = chooseCombo(state);
    if (!pick || state.rng() >= P.combineChance) break;
    /* 조합 관문: 정답까지 최대 3회 시도. 첫 시도 정답이면 비용 일부 환급 */
    let passed = false, tries = 0;
    for (; tries < 3; tries++) {
      const ok = state.rng() < P.acc;
      E.applyMathResult(state, ok);
      if (ok) { passed = true; break; }
    }
    if (!passed) break;
    const r = pick.kind === 'recipe'
      ? E.combineRecipe(state, pick.result)
      : E.combineRankUp(state, pick.cls, pick.tier);
    if (r.ok && tries === 0) E.refundFirstTry(state, r.cost, P.grade);
  }
  /* 3) 배치 */
  placeAll(state, P.sloppy || 0);
  /* 4) 성 관리 */
  for (const key of castlePlan(state, P)) E.castleUpgrade(state, key);
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
          if (E.summon(state).ok) placeAll(state, P.sloppy || 0);
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
/* 프로필도 하나만 돌릴 수 있다 — 게이트가 판을 잘게 쪼개 돌리기 위해서다 */
const profArg = args.find(a => Object.keys(PROFILES).includes(a));
const profs = profArg ? [profArg] : Object.keys(PROFILES);

console.log(`\n=== 용사 수학 디펜스 밸런스 봇 (판수: ${runs}${checkMode ? ', 기준선 검증 모드' : ''}) ===\n`);

let baseline = null;
if (checkMode) {
  const p = join(dirname(fileURLToPath(import.meta.url)), 'balance-baseline.json');
  baseline = JSON.parse(readFileSync(p, 'utf8'));
}

let drift = false;
for (const d of diffs) {
  for (const p of profs) {
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
