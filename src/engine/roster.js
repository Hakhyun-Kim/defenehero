/* =====================================================
 * 용사 관리 — 소환 / 조합 / 배치 / 판매 / 잔치
 * ===================================================== */
import * as D from '../data.js';
import { gainChampXp } from './champion.js';

export function makeHero(state, cls, tier) {
  const s = D.heroStats(cls, tier);
  return {
    id: state.nextId++, cls, tier,
    dmg: Math.round(s.dmg * state.dmgMul),
    padIndex: -1, x: 0, y: 0, cd: 0,
  };
}

/* 빠른 풀이 보너스를 용사에게 새긴다 (mathgate.js 참고).
 * spark 를 따로 들고 있는 이유: 저장/불러오기에서 dmg 는 등급표로 다시 계산되므로,
 * 곱한 결과만 남기면 불러올 때 보너스가 사라진다. */
export function empowerHero(hero, power) {
  if (!hero || !(power > 0)) return 0;
  hero.spark = Math.min(1, (hero.spark || 0) + power);
  hero.dmg = Math.round(hero.dmg * (1 + power));
  return hero.spark;
}

/* 등급 오버라이드를 합친 실효 수정자 (전설 → 신화 순으로 덮어씌움) */
export function heroMods(h) {
  const C = D.CLASSES[h.cls];
  const o = Object.assign(
    {},
    h.tier >= 3 ? (D.LEGEND_OVERRIDES[h.cls] || {}) : {},
    h.tier >= 4 ? (D.MYTHIC_OVERRIDES[h.cls] || {}) : {},
  );
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
    crit: o.crit ?? C.crit ?? null,
    block: o.block ?? C.block ?? null,
  };
}

/* 초당 기대 피해 — 툴팁/정보 표시용 (치명타·다단타 반영) */
export function heroDps(h) {
  const m = heroMods(h);
  const critMul = m.crit ? 1 + m.crit.chance * (m.crit.mul - 1) : 1;
  return Math.round(h.dmg * m.hits * m.spd * critMul * 10) / 10;
}

/* ---------- 소환 ---------- */
export function rollTier(state) {
  const p = D.SUMMON_PROBS;
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

/* 조합 재료 후보: 벤치 + 배치된 용사 모두 (회수하지 않아도 조합 가능)
 * 벤치를 먼저 소비해 필드 방어를 최대한 유지한다. */
export function unitsOf(state, cls, tier) {
  return [
    ...state.bench.filter(h => h.cls === cls && h.tier === tier),
    ...state.field.filter(h => h.cls === cls && h.tier === tier),
  ];
}

/* 결과를 놓을 발판 고르기: 배치돼 있던 재료 우선, 둘 다면 더 강한(등급↑, 커버리지↑) 쪽 */
function resultPad(mats, resultCls) {
  const placed = mats.filter(m => Number.isInteger(m.padIndex) && m.padIndex >= 0);
  if (!placed.length) return -1;
  if (placed.length === 1) return placed[0].padIndex;
  const range = D.CLASSES[resultCls].range;
  const best = placed.slice().sort((a, b) =>
    b.tier - a.tier ||
    D.padCoverage(D.PADS[b.padIndex], range) - D.padCoverage(D.PADS[a.padIndex], range)
  )[0];
  return best.padIndex;
}

/* 재료를 벤치/필드에서 제거 */
function consume(state, mats) {
  state.bench = state.bench.filter(h => !mats.includes(h));
  state.field = state.field.filter(h => !mats.includes(h));
}

/* 그 직업의 최고 보유 등급 (없으면 -1) */
export function bestTierOf(state, cls) {
  let best = -1;
  for (const h of [...state.bench, ...state.field]) {
    if (h.cls === cls && h.tier > best) best = h.tier;
  }
  return best;
}

/* 보유한 그 직업의 등급 목록 (벤치+필드, 중복 없이) */
function tiersOf(state, cls) {
  const t = new Set();
  for (const h of state.bench) if (h.cls === cls) t.add(h.tier);
  for (const h of state.field) if (h.cls === cls) t.add(h.tier);
  return [...t];
}

/* 레시피에 쓸 최선의 짝 — **같은 등급 2명끼리만** 조합되고, 결과는 그 등급 +1.
 * 등급업과 규칙이 하나라 외울 게 없다: "같은 등급 2명 = 등급 UP".
 * 등급이 다른 용사는 재료로 아예 쓰이지 않으므로, 높은 용사가 낮은 결과에
 * 갈려 사라지는 사고(전설+일반=희귀)도 원천적으로 없다.
 * 같은 등급 짝이 여럿이면 가장 높은 결과를 만드는 짝을 고른다. */
export function bestRecipePair(state, r) {
  const cap = D.maxTierOf(r.result);
  const tb = new Set(tiersOf(state, r.b));
  let best = null;
  for (const t of tiersOf(state, r.a)) {
    if (!tb.has(t)) continue;                        // 같은 등급끼리만
    const resultTier = Math.min(t + 1, cap);
    if (resultTier <= t) continue;                   // 등급 천장 — 올라가지 않는 조합
    if (!best || resultTier > best.resultTier) best = { ta: t, tb: t, base: t, resultTier };
  }
  return best;
}

/* 레시피 한 줄의 "지금 상태" — 조합이 안 될 때 **왜 안 되는지**를 화면에 그리기 위한 것.
 * listCombos는 조합 가능한 것만 담아야 하므로(봇과 자동 조합이 소비한다) 따로 둔다.
 *   ready    : 지금 바로 된다 (ta/tb = 실제로 재료가 될 등급)
 *   gold     : 재료는 있는데 골드가 모자라다
 *   material : 재료가 모자라다 (missing에 부족한 직업)
 *   cap      : 재료는 충분한데 등급 천장이라 더 안 오른다
 *   gap      : 두 직업 다 있는데 **같은 등급 짝이 없다** (low = 등급이 낮은 직업)
 */
export function recipeStatus(state, r, cost) {
  const ta = bestTierOf(state, r.a);
  const tb = bestTierOf(state, r.b);
  const missing = [];
  if (ta < 0) missing.push(r.a);
  if (tb < 0) missing.push(r.b);
  if (missing.length) return { state: 'material', missing, ta, tb };

  const pair = bestRecipePair(state, r);
  if (!pair) {
    const base = Math.min(ta, tb);
    const cap = D.maxTierOf(r.result);
    if (base >= cap) return { state: 'cap', missing: [], ta, tb, base, cap };
    return { state: 'gap', missing: [], ta, tb, low: ta <= tb ? r.a : r.b };
  }

  const c = cost != null ? cost : D.combineCost(pair.resultTier, true);
  return {
    state: state.gold >= c ? 'ready' : 'gold',
    missing: [], ta: pair.ta, tb: pair.tb, base: pair.base, resultTier: pair.resultTier, cost: c,
  };
}

/* 조합 하나를 가리키는 열쇠 — 잠금 집합의 키이자 UI/봇이 같은 것을 가리키는 이름.
 * pending 객체(main.js)와 listCombos 항목 둘 다 이 함수로 같은 문자열이 나와야 한다. */
export const comboKey = (c) =>
  (c.kind === 'rankup' ? `rankup:${c.cls}:${Number(c.tier)}` : `recipe:${c.result}`);

/* listCombos 항목 → 수학 관문에 걸 pending 액션 (UI 버튼 dataset과 같은 모양) */
export function comboToAction(c) {
  return c.kind === 'rankup'
    ? { kind: 'rankup', cls: c.cls, tier: String(c.tier) }
    : { kind: 'recipe', result: c.result };
}

/* 포기하거나 세 번 틀린 조합을 잠근다 (mathgate.js 참고).
 * 웨이브를 한 번 치르면 풀린다 — 영구 박탈이 아니라 "이번엔 못 한다"이다. */
export function lockCombo(state, key) {
  if (!state.mathLocked) state.mathLocked = new Set();
  state.mathLocked.add(key);
  return state.mathLocked;
}
export const isComboLocked = (state, key) => !!(state.mathLocked && state.mathLocked.has(key));

export function listCombos(state) {
  const out = [];
  /* 등급업 — 벤치/필드 통합 집계 (천장 = 신화, 모든 직업 공통) */
  const seen = new Set();
  for (const h of [...state.bench, ...state.field]) {
    const key = `${h.cls}:${h.tier}`;
    if (seen.has(key) || h.tier >= D.maxTierOf(h.cls)) continue;
    seen.add(key);
    if (unitsOf(state, h.cls, h.tier).length >= 2) {
      const cost = D.combineCost(h.tier + 1, false);
      const c = {
        kind: 'rankup', cls: h.cls, tier: h.tier, result: h.cls, resultTier: h.tier + 1,
        cost, affordable: state.gold >= cost,
      };
      c.key = comboKey(c);
      c.locked = isComboLocked(state, c.key);
      out.push(c);
    }
  }
  /* 레시피 — 새 직업이 태어나는 길 (같은 등급 2명, 결과는 그 등급 +1) */
  for (const r of D.RECIPES) {
    const pair = bestRecipePair(state, r);
    if (!pair) continue;
    const cost = D.combineCost(pair.resultTier, true);
    const c = {
      kind: 'recipe', result: r.result, a: r.a, b: r.b, gen: r.gen,
      tier: pair.base, ta: pair.ta, tb: pair.tb, resultTier: pair.resultTier,
      cost, affordable: state.gold >= cost,
    };
    c.key = comboKey(c);
    c.locked = isComboLocked(state, c.key);
    out.push(c);
  }
  return out;
}

/* 지금 가능한 조합 중 최선 — 높은 등급 우선, 동급이면 특수 레시피 우선.
 * 게임(main)과 봇(bot)이 같은 함수를 봐야 판단이 갈라지지 않는다.
 * 잠긴 조합은 후보에서 뺀다 — 안 그러면 봇이 같은 관문을 무한히 다시 연다. */
export function bestCombo(state) {
  const combos = listCombos(state).filter(c => c.affordable && !c.locked);
  if (!combos.length) return null;
  return combos.sort((a, b) =>
    b.resultTier - a.resultTier ||
    (b.kind === 'recipe' ? 1 : 0) - (a.kind === 'recipe' ? 1 : 0)
  )[0];
}

export function combineRankUp(state, cls, tier) {
  const mats = unitsOf(state, cls, tier).slice(0, 2);
  if (mats.length < 2 || tier >= D.maxTierOf(cls)) return { ok: false };
  const cost = D.combineCost(tier + 1, false);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  /* 럭키! 낮은 확률로 두 등급 점프 (영웅까지) */
  const lucky = tier + 2 <= D.LUCKY_MAX_TIER && state.rng() < D.LUCKY_JUMP;
  const newTier = lucky ? tier + 2 : tier + 1;
  const pad = resultPad(mats, cls);
  consume(state, mats);
  const hero = makeHero(state, cls, newTier);
  state.bench.push(hero);
  /* 재료가 배치돼 있었다면 결과도 그 자리에 바로 배치 (회수 불필요) */
  if (pad >= 0) placeHero(state, hero.id, pad);
  state.combos++;
  return { ok: true, hero, lucky, cost, pad };
}

/* 레시피 조합 — 같은 등급 2명끼리, 결과는 그 등급 +1 (신화까지) */
export function combineRecipe(state, result) {
  const R = D.CLASSES[result];
  if (!R || !R.recipe) return { ok: false };
  const r = D.RECIPES.find(x => x.result === result);
  const pair = bestRecipePair(state, r);
  if (!pair) return { ok: false };
  const a = unitsOf(state, r.a, pair.ta)[0];
  const b = unitsOf(state, r.b, pair.tb)[0];
  if (!a || !b || a === b) return { ok: false };
  const cost = D.combineCost(pair.resultTier, true);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  const mats = [a, b];
  const pad = resultPad(mats, result);
  consume(state, mats);
  const hero = makeHero(state, result, pair.resultTier);
  state.bench.push(hero);
  if (pad >= 0) placeHero(state, hero.id, pad);
  state.combos++;
  state.discovered.add(result);
  if (R.mythic) state.mythicsMade++;
  else state.specialsMade++;
  return { ok: true, hero, cost, pad };
}

/* ---------- 배치 / 이동 / 회수 / 판매 ---------- */
export const padOccupant = (state, padIndex) => state.field.find(h => h.padIndex === padIndex);

/* 배치된 두 용사의 자리를 맞바꾼다 — 회수·재배치 없이 진형만 고친다.
 * (근접 용사가 뒤에, 궁수가 앞에 서 있을 때 한 번에 바로잡는 조작) */
export function swapHeroes(state, idA, idB) {
  const a = state.field.find(v => v.id === idA);
  const b = state.field.find(v => v.id === idB);
  if (!a || !b || a === b) return { ok: false };
  const pa = a.padIndex, pb = b.padIndex;
  /* 공격 쿨다운은 그대로 들고 간다 — 자리를 계속 바꿔 쿨다운을 초기화하는 꼼수 방지 */
  a.padIndex = pb; a.x = D.PADS[pb].x; a.y = D.PADS[pb].y;
  b.padIndex = pa; b.x = D.PADS[pa].x; b.y = D.PADS[pa].y;
  return { ok: true, a, b };
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
  /* 쿨다운 유지 — 이동을 반복해 공격을 앞당기는 꼼수를 막는다 */
  return { ok: true, hero: h };
}

/* 벤치 용사를 이미 찬 발판에 놓으면 그 자리 용사와 위치를 맞바꾼다.
 * (벤치 ↔ 필드 교환이라 벤치 수가 그대로여서 벤치가 가득 차 있어도 언제나 된다) */
export function swapBenchWithPad(state, benchHeroId, padIndex) {
  const idx = state.bench.findIndex(h => h.id === benchHeroId);
  const occ = padOccupant(state, padIndex);
  if (idx < 0 || !occ) return { ok: false };
  const inc = state.bench[idx];
  state.bench.splice(idx, 1);
  state.field = state.field.filter(v => v !== occ);
  occ.padIndex = -1;          // 벤치 규약값. null을 넣으면 null>=0 이 true라 "배치됨"으로 샌다
  state.bench.push(occ);
  inc.padIndex = padIndex;
  inc.x = D.PADS[padIndex].x;
  inc.y = D.PADS[padIndex].y;
  /* 그 자리에 남아 있던 쿨다운을 이어받는다 — 전투 중에 용사를 갈아 끼워
   * 공격을 앞당기는 꼼수를 막는다 (필드끼리 교환과 같은 규칙) */
  inc.cd = occ.cd || 0;
  state.field.push(inc);
  return { ok: true, placed: inc, benched: occ };
}

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

/* ---------- 잔치 ----------
 * 준비 단계에 한 번, 골드로 잔치를 벌이면 승급 가능한 용사 중 하나가 랜덤으로 등급 UP.
 * 별지기도 얻어먹고 경험치를 챙긴다. 배치된 용사는 그 자리에서 그대로 승급한다. */
export function holdFeast(state) {
  if (state.phase !== 'prep') return { ok: false, reason: 'phase' };
  if (state.feastWave === state.wave) return { ok: false, reason: 'done' };
  const cost = D.feastCost(state.wave);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  const cands = [...state.bench, ...state.field].filter(h => h.tier < D.maxTierOf(h.cls));
  if (!cands.length) return { ok: false, reason: 'none', cost };   // 전원 신화 — 승급할 사람이 없다
  state.gold -= cost;
  state.feastWave = state.wave;
  state.feasts++;

  /* 낮은 등급일수록 잘 뽑힌다 — 게임 난수(state.rng)를 쓴다: 저장/불러오기로 리롤 못 한다 */
  let total = 0;
  for (const h of cands) total += D.feastTierWeight(h.tier);
  let r = state.rng() * total;
  let hero = cands[cands.length - 1];
  for (const h of cands) {
    r -= D.feastTierWeight(h.tier);
    if (r < 0) { hero = h; break; }
  }
  const from = hero.tier;
  hero.tier++;
  /* 공격력은 등급표에서 다시 계산하고, 빠른 풀이 보너스(spark)는 그 위에 다시 얹는다 */
  hero.dmg = Math.round(D.heroStats(hero.cls, hero.tier).dmg * state.dmgMul);
  if (hero.spark > 0) hero.dmg = Math.round(hero.dmg * (1 + hero.spark));

  const events = [];
  gainChampXp(state, D.feastChampXp(state.wave), events);
  events.push({
    type: 'feast', heroId: hero.id, cls: hero.cls, from, to: hero.tier,
    pad: hero.padIndex, x: hero.x, y: hero.y, cost,
  });
  return { ok: true, hero, from, cost, events };
}
