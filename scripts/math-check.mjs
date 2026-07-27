/* =====================================================
 * 수학 문제 생성기 전수 검사
 *
 * 문제는 "게임이 틀렸다"고 알려 줄 사람이 아이라서, 잘못된 정답이나
 * 헷갈리는 표기가 나가면 알아채기가 어렵다. 그래서 기계가 대신 푼다:
 *   ① 식을 실제로 계산해 answer와 맞는지 (문장제는 건너뛴다)
 *   ② 분수가 기약분수인지 (3/6 같은 표기는 교과서에 안 나온다)
 *   ③ 분수를 한 줄 슬래시로 쓴 곳이 남아 있는지 (15 ÷ 3/6 은 15÷3÷6 으로도 읽힌다)
 *   ④ 정답이 유한소수인지 (0.333... 을 입력칸에 넣을 수는 없다)
 *
 *   node scripts/math-check.mjs [학년당판수=3000]
 * ===================================================== */
import * as M from '../src/math.js';

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

const problems = [];
for (const grade of [3, 4, 5, 6]) {
  for (let lv = 1; lv <= 5; lv++) {
    for (let i = 0; i < N / 5; i++) problems.push({ grade, lv, ...M.gen(grade, lv) });
  }
}

const fails = { 계산불일치: [], 약분가능: [], 한줄분수: [], 무한소수: [] };
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
console.log(bad ? '\n❌ 문제 발견' : '\n✅ 모두 통과');
process.exit(bad ? 1 : 0);
