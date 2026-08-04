/* =====================================================
 * 수학 문제 생성기 전수 검사
 *
 * 문제는 "게임이 틀렸다"고 알려 줄 사람이 아이라서, 잘못된 정답이나
 * 헷갈리는 표기가 나가면 알아채기가 어렵다. 그래서 기계가 대신 푼다:
 *   ① 식을 실제로 계산해 answer와 맞는지 (문장제는 건너뛴다)
 *   ② 분수가 기약분수인지 (3/6 같은 표기는 교과서에 안 나온다)
 *   ③ 분수를 한 줄 슬래시로 쓴 곳이 남아 있는지 (15 ÷ 3/6 은 15÷3÷6 으로도 읽힌다)
 *   ④ 정답이 유한소수인지 (0.333... 을 입력칸에 넣을 수는 없다)
 *   ⑤ 난이도 하한선이 지켜지는지 (신화 관문에 두 자리 덧셈이 섞이면 안 된다)
 *   ⑥ 카드에 적을 정보(유형 이름·기준 시간)가 다 있는지
 *
 *   그리고 관문 규칙(카드 3장 · 적응형 보정) 자체의 불변식도 여기서 검사한다.
 *   문제와 관문은 다른 파일이지만, 어긋나면 증상은 "난이도가 이상하다" 하나로 나온다.
 *
 *   node scripts/math-check.mjs [학년당판수=3000]
 * ===================================================== */
import * as M from '../src/math.js';
import * as D from '../src/data.js';
import * as E from '../src/engine.js';
import * as T from '../src/mathgen/tactical.js';
import { mulberry32 } from '../src/bot.js';

const N = Number(process.argv[2]) || 3000;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/* {a/b} 를 실제 값으로 바꿔 식을 계산한다. 계산할 수 없는 문장제는 null */
function evalText(text) {
  const head = text.split('\n')[0];
  if (!/=\s*\?\s*$/.test(head)) return null;             // 순수 계산식만
  let t = head.replace(/=\s*\?\s*$/, '')
    .replace(/\{(-?\d+)\/(\d+)\}/g, '($1/$2)')
    .replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');
  if (!/^[\d+\-*/(). ]+$/.test(t)) return null;          // 한글이 섞이면 문장제
  try { return Function(`"use strict";return (${t})`)(); } catch { return null; }
}

const MAXLV = 6;
const problems = [];
for (const grade of [3, 4, 5, 6]) {
  for (let lv = 1; lv <= MAXLV; lv++) {
    for (let i = 0; i < N / MAXLV; i++) problems.push({ grade, lv, ...M.gen(grade, lv) });
  }
}

const fails = { 계산불일치: [], 약분가능: [], 한줄분수: [], 무한소수: [], 난이도미달: [], 정보누락: [], 세로셈불일치: [] };
let checked = 0;

for (const p of problems) {
  const all = `${p.text}\n${p.hint || ''}`;

  /* ② 기약분수인가 */
  for (const m of all.matchAll(/\{(-?\d+)\/(\d+)\}/g)) {
    const a = Math.abs(Number(m[1])), b = Number(m[2]);
    if (b !== 100 && a > 0 && gcd(a, b) !== 1) fails.약분가능.push(`${p.grade}학년 lv${p.lv}: ${m[0]} in "${p.text}"`);
  }
  /* ③ {a/b} 밖에서 숫자/숫자 를 쓴 곳 */
  const stripped = all.replace(/\{(-?\d+)\/(\d+)\}/g, '');
  for (const m of stripped.matchAll(/(\d)\s*\/\s*(\d)/g)) {
    fails.한줄분수.push(`${p.grade}학년 lv${p.lv}: "${m[0]}" in "${p.text.split('\n')[0]}"`);
  }
  /* ④ 답이 딱 떨어지는가 (소수 셋째 자리까지) */
  if (typeof p.answer === 'number' && Math.abs(p.answer * 1000 - Math.round(p.answer * 1000)) > 1e-9) {
    fails.무한소수.push(`${p.grade}학년 lv${p.lv}: answer=${p.answer} "${p.text.split('\n')[0]}"`);
  }
  /* ⑤ 난이도 하한선이 지켜지는가 — 이 검사가 이 파일에서 제일 중요하다.
   * 신화 관문(⭐⭐⭐⭐⭐)에 두 자리 덧셈이 섞이면 연출이 거짓말이 된다.
   * 유형 해금 시점(min)이 lv보다 두 칸 넘게 아래면 실패. */
  if (typeof p.min === 'number' && p.lv - p.min > 1) {
    fails.난이도미달.push(`${p.grade}학년 lv${p.lv}: [${p.type}] min=${p.min} "${p.text.split('\n')[0]}"`);
  }
  /* ⑥ 카드에 적을 정보가 다 있는가 (이름·기준 시간이 없으면 고를 수가 없다) */
  if (!p.label || !(p.sec > 0)) {
    fails.정보누락.push(`${p.grade}학년 lv${p.lv}: [${p.type}] label=${p.label} sec=${p.sec}`);
  }
  /* ⑦ 세로셈 칸이 문제와 맞는가 — 칸에 적힌 두 수로 실제 답이 나와야 한다.
   * 어긋나면 아이가 칸대로 계산했는데 오답이 되는, 제일 나쁜 종류의 버그가 된다. */
  if (p.vert) {
    /* 칸은 두 형태다: {op,a,b} 두 항 · {terms:[{v,op}]} 여러 항.
     * 여러 항은 부호를 따라 누적하면 되고, 소수는 소수점 셋째 자리까지 비교한다. */
    const v = p.vert;
    const terms = v.terms || [{ v: v.a }, { v: v.b, op: v.op }];
    let got = 0, bad = null;
    for (let i = 0; i < terms.length; i++) {
      const n = terms[i].v;
      if (!(typeof n === 'number') || !Number.isFinite(n) || n < 0) { bad = n; break; }
      if (i === 0) got = n;
      else if (terms[i].op === '−') got -= n;
      else if (terms[i].op === '×') got *= n;
      else got += n;
    }
    /* 칸에 곱셈이 섞이면 왼쪽부터 순서대로 계산한 값이라 우선순위와 어긋날 수 있다.
     * 지금은 {op,a,b} 곱셈만 그러며 두 항이라 문제가 없다. */
    const want = v.value != null ? v.value : p.answer;
    const shown = terms.map((t, i) => (i ? `${t.op || '+'} ${t.v}` : `${t.v}`)).join(' ');
    if (bad !== null) {
      fails.세로셈불일치.push(`${p.grade}학년 [${p.type}]: 칸에 쓸 수 없는 수 ${bad}`);
    } else if (Math.abs(got - want) > 1e-9) {
      fails.세로셈불일치.push(`${p.grade}학년 [${p.type}]: 칸은 ${shown} = ${got} 인데 ${v.value != null ? '적어 둔 값' : '정답'}은 ${want}`);
    }
  }
  /* ① 식을 실제로 풀어 본다 */
  const v = evalText(p.text);
  if (v !== null) {
    checked++;
    if (Math.abs(v - p.answer) > 1e-9) {
      fails.계산불일치.push(`${p.grade}학년 lv${p.lv}: "${p.text}" → 식=${v} 정답=${p.answer}`);
    }
  }
}

console.log(`\n=== 수학 생성기 검사 (문제 ${problems.length}개, 식으로 검산한 것 ${checked}개) ===\n`);
let bad = false;
for (const [name, list] of Object.entries(fails)) {
  if (list.length) {
    bad = true;
    console.log(`❌ ${name}: ${list.length}건`);
    for (const l of [...new Set(list)].slice(0, 5)) console.log(`   ${l}`);
  } else {
    console.log(`✅ ${name} 없음`);
  }
}
/* ---------- 관문 규칙 불변식 ----------
 * 세 장은 게임의 약속이다: 서로 다른 난이도여야 하고, 센 쪽이 더 줘야 하고,
 * 룰렛이 세 장 모두에 닿아야 한다. 하나라도 깨지면 뽑기가 뽑기가 아니게 된다. */
const gate = [];
const gateFail = (m) => gate.push(m);
for (let base = 1; base <= 5; base++) {
  const [lo, mid, hi] = D.cardLevels(base);
  if (!(lo < mid && mid < hi)) gateFail(`base=${base}: 세 장의 난이도가 겹친다 [${lo},${mid},${hi}]`);
  if (hi > D.MAX_MATH_LV || lo < 1) gateFail(`base=${base}: 난이도가 범위를 벗어난다 [${lo},${mid},${hi}]`);
  if (!D.MATH_LEVELS[hi]) gateFail(`base=${base}: MATH_LEVELS[${hi}] 가 없다`);
  const muls = [lo, mid, hi].map(lv => D.cardRefundMul(lv, base));
  if (!(muls[0] < muls[1] && muls[1] < muls[2])) gateFail(`base=${base}: 센 문제가 더 주지 않는다 ${muls}`);
  if (Math.abs(D.cardRefundMul(base, base) - 1) > 1e-9 && base > 1) {
    gateFail(`base=${base}: 기준 난이도의 환급 배수가 1이 아니다 (${D.cardRefundMul(base, base)})`);
  }
  /* 별조각은 "기준보다 센 게 걸렸을 때"만 — 순한 문제로는 절대 안 나온다 */
  if (D.cardShards(lo, base) !== 0) gateFail(`base=${base}: 순한 문제에서 별조각이 나온다`);

  /* --- 룰렛 --- */
  const odds = D.cardOdds(base);
  const sum = odds.reduce((a, b) => a + b, 0);
  if (odds.length !== 3) gateFail(`base=${base}: 확률이 세 장 몫이 아니다 (${odds.length})`);
  if (Math.abs(sum - 1) > 1e-9) gateFail(`base=${base}: 확률의 합이 1이 아니다 (${sum})`);
  if (odds.some(p => p <= 0)) gateFail(`base=${base}: 절대 안 걸리는 장이 있다 ${odds}`);
  /* 실제로 굴려서 세 장 모두 나오는지, 분포가 확률과 맞는지 */
  const hit = [0, 0, 0];
  let seed = 12345 + base;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 60000; i++) hit[D.cardRoll(base, rnd)]++;
  hit.forEach((n, i) => {
    if (n === 0) gateFail(`base=${base}: ${i}번 장이 한 번도 안 걸린다`);
    if (Math.abs(n / 60000 - odds[i]) > 0.02) {
      gateFail(`base=${base}: ${i}번 장 실제 ${(n / 60000 * 100).toFixed(1)}% ≠ 규정 ${(odds[i] * 100).toFixed(0)}%`);
    }
  });
}
/* 룰렛은 게임 난수를 쓰지 않는다(기본값이 Math.random). 주입한 난수만 쓰는지 확인 */
{
  let used = 0;
  D.cardRoll(3, () => { used++; return 0.5; });
  if (used !== 1) gateFail(`cardRoll이 난수를 ${used}번 쓴다 — 정확히 한 번이어야 한다`);
}
/* 적응형 보정: 근거가 쌓이기 전엔 0, 잘하면 +1, 막히면 -1 */
if (D.adaptOffset([]) !== 0) gateFail('기록이 없는데 난이도를 움직인다');
if (D.adaptOffset([1, 1, 1]) !== 0) gateFail(`표본이 ${D.ADAPT_MIN}개 미만인데 난이도를 움직인다`);
if (D.adaptOffset(Array(8).fill(1)) !== 1) gateFail('전부 맞혔는데 난이도가 안 오른다');
if (D.adaptOffset(Array(8).fill(0)) !== -1) gateFail('전부 틀렸는데 난이도가 안 내려간다');
if (D.adaptOffset([1, 0, 1, 0, 1, 0, 1, 0]) !== 0) gateFail('반반인데 난이도가 움직인다');
/* 제한 시간: 유형이 정하고, 난이도가 오르면 조금 늘어난다 (수가 커지니까) */
for (const sec of [18, 40, 62]) {
  if (!(D.mathTime(sec, 1) < D.mathTime(sec, 6))) gateFail(`sec=${sec}: 난이도가 올라도 시간이 안 는다`);
  if (D.mathTime(sec, 1) < sec * 0.9) gateFail(`sec=${sec}: lv1인데 기준 시간보다 짧다`);
}
if (!(D.mathTime(18, 5) < D.mathTime(62, 1))) gateFail('쉬운 유형이 어려운 유형보다 시간을 더 받는다');
/* 자릿수가 커지면(over↑) 시간이 늘어야 한다 — 같은 유형이라도 468×68은 112×23보다 오래 걸린다 */
for (const sec of [22, 40, 62]) {
  if (!(D.mathTime(sec, 3, 1) > D.mathTime(sec, 3, 0))) gateFail(`sec=${sec}: 수가 커져도 시간이 안 는다`);
  if (D.mathTime(sec, 3, 1) / D.mathTime(sec, 3, 0) > 1.5) gateFail(`sec=${sec}: 크기 보정이 과하다`);
}
if (!(D.VERT_DELAY_MS >= 2000 && D.VERT_DELAY_MS <= 15000)) gateFail(`VERT_DELAY_MS=${D.VERT_DELAY_MS} 는 범위 밖`);
/* 한 관문 = 한 문제 (다단계 관문은 없앴다 — 통과의 왕복이 길어지면 피로가 된다) */
for (let lv = 1; lv <= D.MAX_MATH_LV; lv++) if (D.mathRounds(lv) !== 1) gateFail(`lv${lv}: 관문이 한 문제가 아니다`);

/* ---------- 재도전 값 ----------
 * 틀리면 골드로 다시 산다. 세 가지가 지켜져야 한다:
 *  ① 비싼 조합일수록 비싸다 (조합에 비례)
 *  ② 틀릴수록 비싸진다 (계속 밀어붙이는 게 가장 비싸야 한다)
 *  ③ 재도전을 사고도 조합 비용이 남는다 — 안 그러면 정답을 맞히고도 못 만든다 */
for (const [a, b] of [[60, 300], [300, 1200], [1200, 2800]]) {
  if (!(D.retryCost(a, 1) <= D.retryCost(b, 1))) gateFail(`재도전 값이 조합 비용을 안 따라간다 (${a} vs ${b})`);
}
for (const cost of [60, 300, 1200, 2800]) {
  if (!(D.retryCost(cost, 1) < D.retryCost(cost, 2))) gateFail(`cost=${cost}: 두 번째 재도전이 안 비싸진다`);
  if (D.retryCost(cost, 1) > cost * 0.5) gateFail(`cost=${cost}: 첫 재도전이 조합값의 절반을 넘는다`);
  /* 조합 비용 + 재도전 값을 다 가진 사람만 살 수 있어야 한다 */
  if (D.canRetry(cost, cost, 1)) gateFail(`cost=${cost}: 조합 골드만 있는데 재도전이 팔린다`);
  if (!D.canRetry(cost + D.retryCost(cost, 1), cost, 1)) gateFail(`cost=${cost}: 값을 다 가졌는데 재도전을 못 산다`);
}
if (D.retryCost(0, 1) < D.RETRY_COST_MIN) gateFail('재도전 최소값이 지켜지지 않는다');

console.log('\n--- 관문 규칙 (문제 룰렛 · 적응형) ---');
if (gate.length) {
  bad = true;
  for (const m of gate) console.log(`   ❌ ${m}`);
} else {
  console.log('  ✅ 세 장 · 확률 · 환급 · 시간 · 적응형 보정 불변식 모두 통과');
  for (let base = 1; base <= 5; base++) {
    const lvs = D.cardLevels(base);
    const odds = D.cardOdds(base);
    console.log(`  base ${base} → ${lvs.map((lv, i) =>
      `${D.CARD_STYLE[i].emoji}lv${lv} ${Math.round(odds[i] * 100)}%(×${D.cardRefundMul(lv, base).toFixed(2)}${D.cardShards(lv, base) ? ' ✨' : ''})`).join('  ')}`);
  }
}

/* ---------- 전술 문제 ----------
 * 여기서 잡아야 하는 사고는 딱 두 가지다.
 *   ① 문제에 적힌 숫자가 엔진이 실제로 쓰는 값과 다르다 → 게임이 거짓말을 한다
 *   ② 문제를 내면서 state.rng()를 건드린다 → 문제를 냈다는 이유로 웨이브가 바뀐다
 * 둘 다 화면만 봐서는 절대 안 보이므로 기계가 대조한다. */
const tac = [];
const tacFail = (m) => tac.push(m);

/* 실제로 굴러가는 판 하나를 만든다 (봇과 같은 방식) */
function makeCtx(wave = 1, difficulty = 'normal', mythics = 0) {
  let calls = 0;
  const base = mulberry32(1234 + wave);
  const state = E.createGame({ rng: () => { calls++; return base(); }, difficulty });
  for (const cls of ['knight', 'archer', 'mage', 'guard']) {
    const h = E.makeHero(state, cls, wave > 6 ? 2 : 1);
    state.bench.push(h);
    E.placeHero(state, h.id, state.field.length);
  }
  /* 신화를 데리고 있으면 몬스터가 단단해진다(신화의 압력) — 그 상태도 대조해야 한다 */
  for (let i = 0; i < mythics; i++) state.bench.push(E.makeHero(state, 'swordsaint', 4));
  for (let w = 1; w < wave; w++) { state.wave++; state.pendingWave = E.buildWave(state); }
  return { state, rngCalls: () => calls };
}

/* ① 엔진이 실제로 스폰한 몬스터와 대조 — 체력·골드·성 피해 */
for (const difficulty of ['easy', 'normal', 'hard']) {
  for (const wave of [1, 4, 9, 15]) {
    /* 신화 0명·2명 두 상태로 — 압력을 빠뜨리면 문제의 체력이 실제와 어긋난다 */
    const { state } = makeCtx(wave, difficulty, wave >= 9 ? 2 : 0);
    const expect = {};
    for (const [type] of Object.entries(E.waveSummary(state))) {
      expect[type] = { hp: T.enemyHp(state, type), gold: T.enemyGold(state, type) };
    }
    E.startWave(state);
    for (let i = 0; i < 4000 && state.enemies.length < 6; i++) E.tick(state, 0.05);
    for (const e of state.enemies) {
      if (e.elite || !expect[e.type]) continue;          // 엘리트는 "성난" 개체라 따로 표시된다
      if (e.maxHp !== expect[e.type].hp) {
        tacFail(`${difficulty} w${wave} ${e.type}: 체력 ${expect[e.type].hp} 라고 냈는데 실제는 ${e.maxHp}`);
      }
      if (e.gold !== expect[e.type].gold) {
        tacFail(`${difficulty} w${wave} ${e.type}: 골드 ${expect[e.type].gold} 라고 냈는데 실제는 ${e.gold}`);
      }
      const realDmg = Math.round(e.castleDmg * D.castleDmgScale(state.wave));
      if (realDmg !== T.enemyCastleDmg(state, e.type)) {
        tacFail(`${difficulty} w${wave} ${e.type}: 성 피해 ${T.enemyCastleDmg(state, e.type)} 라고 냈는데 실제는 ${realDmg}`);
      }
    }
  }
}
/* 초당 피해도 화면 툴팁(engine.heroDps)과 같은 값이어야 한다 */
{
  const { state } = makeCtx(5);
  for (const h of state.field) {
    if (Math.round(E.heroDps(h)) !== Math.round(E.heroDps(h))) tacFail('heroDps 불안정');
  }
}

/* ② 문제를 내도 판이 흔들리지 않는가 + 답이 성립하는가 */
let tacCount = 0;
for (const grade of [3, 4, 5, 6]) {
  for (let lv = 1; lv <= MAXLV; lv++) {
    const { state, rngCalls } = makeCtx(1 + ((lv * 3 + grade) % 14));
    const before = rngCalls();
    const waveBefore = JSON.stringify(E.waveSummary(state));
    const goldBefore = state.gold, hpBefore = state.castleHp;
    for (let i = 0; i < 60; i++) {
      const p = T.gen(grade, lv, false, state);
      if (!p) continue;
      tacCount++;
      if (!Number.isFinite(p.answer)) tacFail(`${grade}학년 lv${lv} [${p.type}]: 답이 숫자가 아니다 (${p.answer})`);
      if (!Number.isInteger(p.answer)) tacFail(`${grade}학년 lv${lv} [${p.type}]: 답이 정수가 아니다 (${p.answer})`);
      if (p.answer < 0) tacFail(`${grade}학년 lv${lv} [${p.type}]: 답이 음수다 (${p.answer})`);
      if (!p.label || !(p.sec > 0)) tacFail(`${grade}학년 lv${lv} [${p.type}]: 카드에 적을 정보가 없다`);
      if (p.lv - p.min > 1) tacFail(`${grade}학년 lv${lv} [${p.type}]: 난이도 하한선 위반 (min=${p.min})`);
      if (p.kind !== 'tactical') tacFail(`${grade}학년 lv${lv} [${p.type}]: kind가 tactical이 아니다`);
      if (/\*\*|undefined|NaN/.test(`${p.text}${p.hint}`)) tacFail(`${grade}학년 lv${lv} [${p.type}]: 문장이 깨졌다 — "${p.text.split('\n')[0]}"`);
      if (!M.check(String(p.answer), p.answer, p.kind)) tacFail(`${grade}학년 lv${lv} [${p.type}]: 자기 답을 오답으로 채점한다`);
      /* ★ 규칙 ②: 답에 필요한 수가 전부 문장에 적혀 있는가.
       * "오크 11마리를 다 놓치면?" 인데 한 마리당 피해가 문장에 없어서 풀 수 없던 적이 있다.
       * 힌트에만 적혀 있으면 힌트를 사야만 풀리는 문제가 된다 — 그건 문제가 아니라 함정이다. */
      if (!p.needs || !p.needs.length) tacFail(`${grade}학년 lv${lv} [${p.type}]: needs가 비어 있다 (검사 불가)`);
      for (const nv of (p.needs || [])) {
        if (!new RegExp(`(^|[^0-9])${nv}([^0-9]|$)`).test(p.text)) {
          tacFail(`${grade}학년 lv${lv} [${p.type}]: 풀려면 필요한 수 ${nv} 가 문장에 없다 — "${p.text.replace(/\n/g, ' ')}"`);
        }
      }
    }
    if (rngCalls() !== before) tacFail(`${grade}학년 lv${lv}: 문제를 내면서 state.rng()를 ${rngCalls() - before}번 썼다 (웨이브가 바뀐다)`);
    if (JSON.stringify(E.waveSummary(state)) !== waveBefore) tacFail(`${grade}학년 lv${lv}: 웨이브 구성이 바뀌었다`);
    if (state.gold !== goldBefore || state.castleHp !== hpBefore) tacFail(`${grade}학년 lv${lv}: 게임 상태가 바뀌었다`);
  }
}
/* ③ 낼 수 없는 상황에서는 조용히 산술로 돌아가는가 */
{
  const { state } = makeCtx(3);
  state.field = [];                                  // 배치된 용사가 없다
  state.pendingWave = [];                            // 다음 웨이브 정보도 없다
  state.gold = 0;                                    // 소환 계획도 세울 수 없다
  for (let lv = 1; lv <= MAXLV; lv++) {
    if (T.ready(3, lv, state)) tacFail(`lv${lv}: 아무 정보도 없는데 전술 문제를 낼 수 있다고 한다`);
    if (T.gen(3, lv, false, state) !== null) tacFail(`lv${lv}: 낼 수 없는데 문제를 만들어 냈다`);
    const p = M.gen(3, lv, { remember: false, ctx: state, tactical: 1 });
    if (!p || p.kind !== 'arithmetic') tacFail(`lv${lv}: 전술이 불가능한데 산술로 되돌아가지 않았다`);
  }
}
/* ④ 배치된 용사가 없어도 (준비 단계 첫 조합) 낼 수 있는 유형이 남아 있는가.
 * 봇 순서가 소환 → 조합 → 배치라서 첫 관문에는 필드가 비어 있다.
 * 여기서 전술 문제가 하나도 못 나오면 "판을 묻는다"는 감각 자체가 안 생긴다. */
{
  const { state } = makeCtx(4);
  state.field = [];
  let none = [];
  for (let lv = 1; lv <= 5; lv++) if (!T.ready(4, lv, state)) none.push(lv);
  if (none.length) tacFail(`배치 전인데 전술 문제를 못 내는 난이도가 있다: lv${none.join(',')}`);
}

console.log(`\n--- 전술 문제 (판을 읽는 문제 ${tacCount}개) ---`);
if (tac.length) {
  bad = true;
  for (const m of [...new Set(tac)].slice(0, 8)) console.log(`   ❌ ${m}`);
} else {
  console.log('  ✅ 엔진 값 일치 · 상태 불변 · 답 성립 · 불가 상황 폴백 모두 통과');
  const { state } = makeCtx(7);
  for (const lv of [1, 3, 5]) {
    const p = T.gen(5, lv, false, state);
    if (p) console.log(`  lv${lv} ${p.label} → ${p.text.replace(/\n/g, ' ')} = ${p.answer}`);
  }
}

/* 난이도별로 실제 어떤 유형이 나오는지 — 숫자로 봐야 "센 관문인데 쉬운 문제"를 잡는다 */
console.log('\n--- 난이도별 유형 분포 (학년 6 기준) ---');
for (const lv of [1, 3, 5, 6]) {
  const c = {};
  for (const p of problems) {
    if (p.grade !== 6 || p.lv !== lv) continue;
    c[p.type] = (c[p.type] || 0) + 1;
  }
  const n = Object.values(c).reduce((a, b) => a + b, 0) || 1;
  const s = Object.entries(c).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${Math.round((v / n) * 100)}%`).join(' · ');
  console.log(`  lv${lv}: ${s}`);
}
console.log(bad ? '\n❌ 문제 발견' : '\n✅ 모두 통과');
process.exit(bad ? 1 : 0);
