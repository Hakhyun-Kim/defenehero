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

/* 어려운 문제가 걸리면 정답률이 떨어진다 — 이걸 모델링하지 않으면 센 문제가 공짜 돈이 된다.
 * (게임에서도 실제로 그렇다: 한 칸 위 문제는 수가 크고 단계가 하나 더 많다) */
const ACC_PER_LV = 0.08;

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
    /* 문제 룰렛 + 적응형 보정까지 그대로 태운다 — 게임에서 실제로 도는 규칙을 봇이 안 밟으면
     * "봇은 통과하는데 사람은 다른 난이도를 푸는" 시뮬레이션이 된다.
     * 센 문제는 환급이 크고 정답률이 낮다. */
    const raw = D.mathLevel(pick.resultTier, pick.kind === 'recipe', !!D.CLASSES[pick.result].mythic);
    const base = Math.max(1, Math.min(5, raw + D.adaptOffset(state.mathWindow)));
    const lvs = D.cardLevels(base);
    const ci = D.cardRoll(base, state.rng);      // 고르지 않는다 — 룰렛이 정한다
    const lv = lvs[ci];
    const acc = Math.max(0.05, P.acc - ACC_PER_LV * (lv - base));
    const rounds = D.mathRounds(lv);
    /* 조합 관문: 정답까지 최대 3회 시도. 최고 난이도는 연속 정답이라야 통과 */
    let passed = false, tries = 0;
    for (; tries < 3; tries++) {
      let streakOk = true;
      for (let s = 0; s < rounds; s++) {
        const ok = state.rng() < acc;
        E.applyMathResult(state, ok);
        /* 봇은 힌트를 안 사고 재도전마다 새 문제를 받으므로 "한 번에 맞힘" = 정답 여부 */
        E.recordMathOutcome(state, ok);
        if (!ok) { streakOk = false; break; }
      }
      if (streakOk) { passed = true; break; }
    }
    if (!passed) break;
    const r = pick.kind === 'recipe'
      ? E.combineRecipe(state, pick.result)
      : E.combineRankUp(state, pick.cls, pick.tier);
    if (r.ok && tries === 0) {
      E.refundFirstTry(state, r.cost, P.grade, D.cardRefundMul(lv, base));
      state.mathShards = (state.mathShards || 0) + D.cardShards(lv, base);
    }
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
