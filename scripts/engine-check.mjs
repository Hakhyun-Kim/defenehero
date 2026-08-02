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

/* ---------- ⑥ 레시피 재료: 같은 등급 2명끼리만 ----------
 * 실제로 이런 일이 있었다: 전설 검사 + 일반 마법사를 조합하면 "최고 등급" 재료를
 * 소비해서 전설이 갈려 나가고 희귀 마검사가 나왔다 — 조합할수록 약해지고,
 * 플레이어 눈에는 영웅이 사라진 것처럼 보인다. 지금은 등급업과 규칙이 하나다:
 * 같은 등급 2명 = 등급 UP. 등급이 다른 용사는 재료 후보조차 되지 않는다. */
{
  /* 전설 검사(배치) + 일반 검사 + 일반 마법사: 일반끼리 조합돼야 한다 (전설 보호) */
  const st = fresh();
  const legend = put(st, 'knight', 3, 0);
  put(st, 'knight', 0, null);
  put(st, 'mage', 0, null);
  const r = E.combineRecipe(st, 'spellblade');
  ok('같은 등급(일반) 짝으로 조합된다', r.ok && r.hero.tier === 1, JSON.stringify(r));
  ok('전설 용사는 재료로 소비되지 않는다', st.field.some(h => h.id === legend.id));

  /* 전설 검사 + 일반 마법사뿐: 같은 등급 짝이 없다 — 조합이 아예 나오지 않는다 */
  const st2 = fresh();
  put(st2, 'knight', 3, 0);
  put(st2, 'mage', 0, null);
  const combos = E.listCombos(st2);
  ok('등급이 다르면 조합이 제안되지 않는다',
    !combos.some(c => c.kind === 'recipe' && c.result === 'spellblade'));
  const rs = E.recipeStatus(st2, D.RECIPES.find(x => x.result === 'spellblade'));
  ok('그 이유가 gap으로 표시된다', rs.state === 'gap' && rs.low === 'mage', JSON.stringify(rs));
  ok('gap 상태에선 실행도 거부된다', !E.combineRecipe(st2, 'spellblade').ok);

  /* 한 등급 차이(전설+영웅)도 이제 안 된다 — 같은 등급만 */
  const st3 = fresh();
  put(st3, 'knight', 3, 0);
  put(st3, 'mage', 2, null);
  ok('한 등급 차이도 조합 불가', !E.combineRecipe(st3, 'spellblade').ok
    && E.recipeStatus(st3, D.RECIPES.find(x => x.result === 'spellblade')).state === 'gap');

  /* 같은 등급이면 된다 — 영웅 검사 + 영웅 마법사 = 전설 마검사 */
  const st4 = fresh();
  put(st4, 'knight', 2, 0);
  put(st4, 'mage', 2, null);
  const r4 = E.combineRecipe(st4, 'spellblade');
  ok('같은 등급 조합은 그 등급 +1', r4.ok && r4.hero.tier === 3, JSON.stringify(r4));

  /* 여러 등급이 겹치면 가장 높은 결과를 만드는 짝을 고른다 */
  const st5 = fresh();
  put(st5, 'knight', 0, null); put(st5, 'knight', 2, null);
  put(st5, 'mage', 0, null); put(st5, 'mage', 2, null);
  const pair = E.bestRecipePair(st5, D.RECIPES.find(x => x.result === 'spellblade'));
  ok('같은 등급 짝이 여럿이면 높은 쪽 우선', pair && pair.ta === 2 && pair.tb === 2 && pair.resultTier === 3,
    JSON.stringify(pair));
}

/* ---------- ⑦ 무작위 상태에서도: 제안된 조합은 언제나 "같은 등급 → +1" ---------- */
{
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let bad = 0;
  for (let trial = 0; trial < 300; trial++) {
    const st = fresh();
    const n = 2 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const cls = D.CLASS_KEYS[Math.floor(rnd() * D.CLASS_KEYS.length)];
      put(st, cls, Math.floor(rnd() * (D.maxTierOf(cls) + 1)), null);
    }
    for (const c of E.listCombos(st)) {
      if (c.kind === 'recipe' && (c.ta !== c.tb || c.resultTier !== c.ta + 1)) bad++;
      if (c.kind === 'rankup' && c.resultTier < c.tier) bad++;
    }
  }
  ok('무작위 300판: 재료 등급 불일치·등급 하락 제안 없음', bad === 0, `${bad}건`);
}

/* ---------- ⑧ 저장/불러오기 왕복 ---------- */
{
  const st = fresh(777);
  st.wave = 9;
  st.castle.fortify = 2;
  st.castle.tower = 1;
  st.castleMax = 160;
  st.castleHp = 120;
  put(st, 'knight', 3, 0);
  put(st, 'spellblade', 2, 5);
  put(st, 'archer', 1, null);
  st.discovered.add('spellblade');
  st.kills = 123;
  st.combos = 7;
  const data = E.serialize(st);
  const back = E.deserialize(JSON.parse(JSON.stringify(data)));   // 파일 왕복과 같다
  ok('불러오기: 복원된다', !!back);
  ok('불러오기: 골드/웨이브/성 유지',
    back.gold === 777 && back.wave === 9 && back.castleHp === 120 && back.castleMax === 160
    && back.castle.fortify === 2 && back.castle.tower === 1);
  ok('불러오기: 용사와 배치 유지',
    back.field.length === 2 && back.bench.length === 1
    && back.field.some(h => h.cls === 'knight' && h.tier === 3 && h.padIndex === 0)
    && back.field.some(h => h.cls === 'spellblade' && h.tier === 2 && h.padIndex === 5)
    && back.bench.some(h => h.cls === 'archer' && h.tier === 1));
  ok('불러오기: 도감/통계 유지', back.discovered.has('spellblade') && back.kills === 123 && back.combos === 7);
  ok('불러오기: 준비 단계에서 시작',
    back.phase === 'prep' && Array.isArray(back.pendingWave) && back.pendingWave.length > 0
    && back.enemies.length === 0 && back.projectiles.length === 0);
  padIndexSane(back, '불러온 뒤');

  ok('망가진 파일은 null', E.deserialize({ hello: 1 }) === null && E.deserialize(null) === null);

  /* 손으로 고친 파일: 겹친 발판·초과 등급·모르는 직업이 게임을 깨면 안 된다 */
  const evil = JSON.parse(JSON.stringify(data));
  evil.field[1].pad = 0;                                   // 발판 겹침
  evil.bench[0].tier = 99;                                 // 등급 초과
  evil.bench.push({ cls: 'no-such-class', tier: 1, pad: 3 });
  const b2 = E.deserialize(evil);
  ok('겹친 발판의 용사는 벤치로 대피', b2.field.length === 1 && b2.bench.length === 2,
    `field=${b2.field.length} bench=${b2.bench.length}`);
  ok('등급은 그 직업의 천장으로 잘린다', [...b2.bench, ...b2.field].every(h => h.tier <= D.maxTierOf(h.cls)));
  padIndexSane(b2, '망가진 파일 복원 후');
}

console.log(failed ? `\n❌ 불변식 ${failed}건 실패` : '\n✅ 엔진 불변식 모두 통과');
process.exit(failed ? 1 : 0);
