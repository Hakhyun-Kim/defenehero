/* =====================================================
 * 엔진 불변식 검사
 *
 * 밸런스 봇은 "재미있나"를, 이 검사기는 "규약이 지켜지나"를 본다.
 * 실제로 이런 버그가 있었다: 자리 교환이 벤치로 돌아간 용사에게 padIndex=null 을
 * 넣었는데, 자바스크립트에서 null >= 0 이 true라 그 용사가 "배치됨"으로 분류돼
 * 조합할 때 D.PADS[null] 을 읽고 게임이 죽었다. 값 하나가 규약을 벗어나면
 * 멀쩡해 보이다가 전혀 다른 곳에서 터진다.
 *
 *   node scripts/engine-check.mjs
 * ===================================================== */
import * as D from '../src/data.js';
import * as E from '../src/engine.js';

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`✅ ${name}`);
  else { failed++; console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
};
const fresh = (gold = 99999) => {
  const st = E.createGame({ difficulty: 'normal' });
  st.gold = gold;
  return st;
};
const put = (st, cls, tier, pad) => {
  const h = E.makeHero(st, cls, tier);
  st.bench.push(h);
  if (pad != null) E.placeHero(st, h.id, pad);
  return h;
};

/* ---------- ① padIndex 규약: 벤치는 항상 -1, 필드는 항상 유효한 정수 ---------- */
function padIndexSane(st, label) {
  const bad = [];
  for (const h of st.bench) if (h.padIndex !== -1) bad.push(`bench ${h.cls}#${h.id} padIndex=${JSON.stringify(h.padIndex)}`);
  for (const h of st.field) {
    if (!Number.isInteger(h.padIndex) || h.padIndex < 0 || h.padIndex >= D.PADS.length) {
      bad.push(`field ${h.cls}#${h.id} padIndex=${JSON.stringify(h.padIndex)}`);
    }
  }
  ok(`padIndex 규약 (${label})`, bad.length === 0, bad.join(', '));
}

{
  const st = fresh();
  put(st, 'knight', 0, 0);
  put(st, 'archer', 0, 3);
  put(st, 'mage', 0, null);
  padIndexSane(st, '배치 직후');

  E.recallHero(st, st.field[0].id);
  padIndexSane(st, '회수 후');

  E.moveHero(st, st.field[0].id, 7);
  padIndexSane(st, '이동 후');

  const a = st.field[0];
  const b = put(st, 'guard', 0, 5);
  E.swapHeroes(st, a.id, b.id);
  padIndexSane(st, '필드끼리 교환 후');
}

{
  /* 회귀: 벤치 용사를 찬 발판에 놓아 교환한 뒤의 상태 */
  const st = fresh();
  const placed = put(st, 'knight', 0, 0);
  const benched = put(st, 'knight', 0, null);
  E.swapBenchWithPad(st, benched.id, 0);
  padIndexSane(st, '벤치↔필드 교환 후');
  ok('교환: 벤치 용사가 발판으로', E.padOccupant(st, 0)?.id === benched.id);
  ok('교환: 밀려난 용사가 벤치로', st.bench.some(h => h.id === placed.id));
  ok('교환: 인원 수 보존', st.field.length === 1 && st.bench.length === 1);

  /* 이 상태에서 조합이 터지지 않아야 한다 (실제로 여기서 죽었다) */
  let crash = null;
  try {
    E.listCombos(st);
    const r = E.combineRankUp(st, 'knight', 0);
    ok('교환 후 조합 성공', r.ok, JSON.stringify(r));
    ok('교환 후 조합 결과가 유효한 발판에', r.pad === -1 || (Number.isInteger(r.pad) && r.pad >= 0));
  } catch (e) {
    crash = `${e.constructor.name}: ${e.message}`;
  }
  ok('교환 후 조합이 예외를 던지지 않음', crash === null, crash || '');
}

/* ---------- ② 벤치가 가득해도 교환은 된다 ---------- */
{
  const st = fresh();
  const placed = put(st, 'knight', 0, 0);
  while (st.bench.length < D.BENCH_MAX) put(st, 'archer', 0, null);
  const inc = st.bench[0];
  const before = { bench: st.bench.length, field: st.field.length };
  const r = E.swapBenchWithPad(st, inc.id, 0);
  ok('벤치 가득 상태에서도 교환 성공', r.ok);
  ok('교환이 인원 수를 바꾸지 않음', st.bench.length === before.bench && st.field.length === before.field,
    `${before.bench}/${before.field} → ${st.bench.length}/${st.field.length}`);
  ok('밀려난 용사가 벤치에', st.bench.some(h => h.id === placed.id));
  padIndexSane(st, '벤치 만석 교환 후');
}

/* ---------- ③ 쿨다운 승계: 갈아 끼워도 공격이 앞당겨지지 않는다 ---------- */
{
  const st = fresh();
  const on = put(st, 'knight', 0, 2);
  on.cd = 0.77;
  const inc = put(st, 'mage', 0, null);
  const r = E.swapBenchWithPad(st, inc.id, 2);
  ok('교환 시 쿨다운 승계', r.ok && Math.abs(r.placed.cd - 0.77) < 1e-9, `cd=${r.placed && r.placed.cd}`);

  const x = put(st, 'archer', 0, 6);
  const y = put(st, 'guard', 0, 8);
  x.cd = 0.5; y.cd = 0.2;
  E.swapHeroes(st, x.id, y.id);
  ok('필드끼리 교환도 쿨다운 유지', x.cd === 0.5 && y.cd === 0.2);
}

/* ---------- ④ 발판 점유는 언제나 1명 ---------- */
{
  const st = fresh();
  for (let i = 0; i < 6; i++) put(st, 'knight', 0, i);
  for (let i = 0; i < 40; i++) {
    const h = st.field[i % st.field.length];
    E.moveHero(st, h.id, (i * 5) % D.PADS.length);
  }
  const counts = new Map();
  for (const h of st.field) counts.set(h.padIndex, (counts.get(h.padIndex) || 0) + 1);
  ok('한 발판에 두 명이 겹치지 않음', [...counts.values()].every(v => v === 1));
  padIndexSane(st, '이동 40회 후');
}

/* ---------- ⑤ 조합 재료는 벤치+필드를 함께 센다 ---------- */
{
  const st = fresh();
  put(st, 'knight', 0, 0);      // 배치
  put(st, 'knight', 0, null);   // 벤치
  const combos = E.listCombos(st);
  ok('배치+벤치가 한 쌍으로 잡힌다', combos.some(c => c.kind === 'rankup' && c.cls === 'knight'));
}

console.log(failed ? `\n❌ 불변식 ${failed}건 실패` : '\n✅ 엔진 불변식 모두 통과');
process.exit(failed ? 1 : 0);
