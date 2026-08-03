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

const fails = { 계산불일치: [], 약분가능: [], 한줄분수: [], 무한소수: [], 난이도미달: [], 정보누락: [] };
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
 * 카드 세 장은 게임의 약속이다: 서로 다른 난이도여야 하고, 어려운 쪽이 더 줘야 하고,
 * 화면에 적어 준 시간·환급이 실제와 같아야 한다. 하나라도 깨지면 고를 이유가 사라진다. */
const gate = [];
const gateFail = (m) => gate.push(m);
for (let base = 1; base <= 5; base++) {
  const [lo, mid, hi] = D.cardLevels(base);
  if (!(lo < mid && mid < hi)) gateFail(`base=${base}: 카드 난이도가 겹친다 [${lo},${mid},${hi}]`);
  if (hi > D.MAX_MATH_LV || lo < 1) gateFail(`base=${base}: 난이도가 범위를 벗어난다 [${lo},${mid},${hi}]`);
  if (!D.MATH_LEVELS[hi]) gateFail(`base=${base}: MATH_LEVELS[${hi}] 가 없다`);
  const muls = [lo, mid, hi].map(lv => D.cardRefundMul(lv, base));
  if (!(muls[0] < muls[1] && muls[1] < muls[2])) gateFail(`base=${base}: 어려운 카드가 더 주지 않는다 ${muls}`);
  if (Math.abs(D.cardRefundMul(base, base) - 1) > 1e-9 && base > 1) {
    gateFail(`base=${base}: 기준 난이도의 환급 배수가 1이 아니다 (${D.cardRefundMul(base, base)})`);
  }
  /* 별조각은 "기준보다 어려운 걸 골랐을 때"만 — 안전 카드로는 절대 안 나온다 */
  if (D.cardShards(lo, base) !== 0) gateFail(`base=${base}: 안전 카드에서 별조각이 나온다`);
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
/* 최고 난이도만 2문제 연속 관문 */
for (let lv = 1; lv <= 4; lv++) if (D.mathRounds(lv) !== 1) gateFail(`lv${lv}: 2문제 관문이 너무 일찍 나온다`);
if (D.mathRounds(5) !== 2 || D.mathRounds(6) !== 2) gateFail('최고 난이도가 2문제 관문이 아니다');

console.log('\n--- 관문 규칙 (카드 3장 · 적응형) ---');
if (gate.length) {
  bad = true;
  for (const m of gate) console.log(`   ❌ ${m}`);
} else {
  console.log('  ✅ 카드 3장 · 환급 · 시간 · 적응형 보정 불변식 모두 통과');
  for (let base = 1; base <= 5; base++) {
    const lvs = D.cardLevels(base);
    console.log(`  base ${base} → ${lvs.map((lv, i) =>
      `${D.CARD_STYLE[i].emoji}lv${lv}(×${D.cardRefundMul(lv, base).toFixed(2)}${D.cardShards(lv, base) ? ' ✨' : ''})`).join(' ')}`);
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
