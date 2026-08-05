/* =====================================================
 * AI 플레이어의 판단 — 밸런스 봇과 데모 모드가 함께 쓴다
 *
 * 여기 있는 것은 전부 순수 판단이다. DOM·타이머·Node API를 쓰지 않는다.
 * 그래서 헤드리스 밸런스 봇(scripts/balance-bot.mjs)과
 * 브라우저 데모(src/demo.js)가 **같은 뇌**를 쓸 수 있다.
 * 판단이 두 벌로 갈라지면 "봇은 통과하는데 화면에선 이상한" 상황이 생긴다.
 *
 * 밸런스 봇은 한 번에 다 해치우고(batch), 데모는 프레임마다 하나씩 먹는다(stream).
 * 그래서 같은 정책을 두 모양으로 노출한다 — prepActions(배치) / nextPrepAction(스트림).
 * ===================================================== */
import * as D from './data.js';
import * as E from './engine.js';

/* 결정적 난수 — 같은 시드는 같은 판을 만든다 */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 가상 플레이어 프로필 ----------
 * acc            수학 정답률
 * grade          푸는 문제의 학년
 * combineChance  조합할 기회가 왔을 때 실제로 할 확률
 * reserve        소환에 쓰지 않고 남겨 두는 골드
 * useCastle      true=전부 / 'repairOnly'=수리만 / false=안 씀
 * midWave        전투 중에도 소환·배치하는가
 * sloppy         배치를 아무 데나 할 확률
 *
 * 문제 난이도는 프로필에 없다 — 이제 룰렛이 정한다(balance/mathgate.js의 cardRoll).
 */
export const PROFILES = {
  '초보': { acc: 0.45, grade: 3, combineChance: 0.15, reserve: 0,   useCastle: false,        midWave: false, sloppy: 0.5, spellUse: 0.3 },
  '보통': { acc: 0.70, grade: 4, combineChance: 0.70, reserve: 50,  useCastle: 'repairOnly', midWave: false, sloppy: 0.3, spellUse: 0.6 },
  '고수': { acc: 0.90, grade: 6, combineChance: 1.00, reserve: 100, useCastle: true,         midWave: true,  sloppy: 0,   spellUse: 0.95 },
};

/* ---------- 배치 정책 ----------
 * 각 발판이 그 직업의 사거리로 덮는 "길의 길이"를 재서 큰 쪽부터 채운다. */
const coverageCache = new Map();
export function rankedPads(range) {
  if (!coverageCache.has(range)) {
    const scored = D.PADS.map((pad, i) => ({ i, cover: D.padCoverage(pad, range) }))
      .sort((a, b) => b.cover - a.cover);
    coverageCache.set(range, scored);
  }
  return coverageCache.get(range);
}

/* 센 용사부터 좋은 자리에 */
export const benchOrder = (state) => [...state.bench].sort((a, b) => b.tier - a.tier);

/* 이 용사를 어디에 놓을까 — 엔진을 건드리지 않고 자리만 고른다 */
export function pickPad(state, hero, sloppy = 0, rng = Math.random) {
  const free = (i) => !E.padOccupant(state, i);
  if (sloppy && rng() < sloppy) {
    const empties = D.PADS.map((_, i) => i).filter(free);
    return empties.length ? empties[Math.floor(rng() * empties.length)] : null;
  }
  const slot = rankedPads(D.CLASSES[hero.cls].range).find(r => free(r.i));
  return slot ? slot.i : null;
}

export function placeAll(state, sloppy = 0) {
  for (const h of benchOrder(state)) {
    const pad = pickPad(state, h, sloppy, state.rng);
    if (pad != null) E.placeHero(state, h.id, pad);
  }
}

/* 조합 선택 — 게임(main.js)과 같은 판단을 쓴다 (E.bestCombo) */
export const chooseCombo = E.bestCombo;

/* ---------- 성 관리 ----------
 * 엔진을 부르지 않고 "무엇을 할지" 키만 돌려준다. */
export function castlePlan(state, P) {
  const out = [];
  if (!P.useCastle) return out;
  if (state.castleHp < state.castleMax * 0.5 && state.gold > 100) out.push('repair');
  if (P.useCastle === true) {
    if (state.wave >= 4 && state.castle.tower < 1 && state.gold > 250) out.push('tower');
    if (state.wave >= 8 && state.castle.tower < 2 && state.gold > 400) out.push('tower');
    if (state.wave >= 6 && state.castle.fortify < 3 && state.gold > 350) out.push('fortify');
  }
  return out;
}

export const wantsSummon = (state, P) =>
  state.gold >= D.SUMMON_COST + P.reserve && state.bench.length < D.BENCH_MAX;

/* ---------- 별지기 ----------
 * 스킬은 정해진 순서(SKILL_PLAN)로 찍는다 — 사람마다 다르지만 봇은 무난한 한 길이면 된다. */
export function nextSkill(state) {
  const c = state.champ;
  if (!c || c.sp < 1) return null;
  for (const key of D.SKILL_PLAN) {
    const SK = D.CHAMP_SKILLS[key];
    if ((c.skills[key] || 0) >= SK.max) continue;
    if (E.branchSpent(c, SK.branch) < SK.need) continue;
    return key;
  }
  return null;
}

/* 전투 중 마법 판단: 별똥별은 적이 몇이라도 몰리면, 은하수는 보스나 대부대가 있을 때 */
export function wantsStar(state, P) {
  const c = state.champ;
  if (!c || c.ko || c.spellCd > 0) return false;
  return state.enemies.filter(e => !e.dead).length >= 3 && state.rng() < P.spellUse;
}
export function wantsUlt(state, P) {
  const c = state.champ;
  if (!c || c.ko || c.ult < 1) return false;
  const boss = state.enemies.some(e => (e.boss || e.midBoss) && !e.dead);
  const horde = state.enemies.filter(e => !e.dead).length >= 10;
  return (boss || horde) && state.rng() < P.spellUse;
}

/* ---------- 수학 ----------
 * 봇은 문제를 만들지도 풀지도 않고 동전을 던진다(state.rng() < acc).
 * 데모는 진짜 문제창이 뜨므로 "무엇을 입력할지"가 필요하다.
 * 틀릴 때는 채점기가 확실히 오답으로 볼 만큼 벗어난 값을 낸다. */
export function answerFor(prob, P, rng = Math.random) {
  if (rng() < P.acc) return String(prob.answer);
  const off = (1 + Math.floor(rng() * 9)) * (rng() < 0.5 ? -1 : 1);
  return String(Math.round((Number(prob.answer) + off) * 1000) / 1000);
}

/* ---------- 준비 단계: 스트림 ----------
 * 한 번에 하나씩만 돌려준다. 데모가 프레임마다 하나씩 소비하면
 * 소환→조합→배치가 사람이 하는 것처럼 순서대로 화면에 보인다.
 * null이면 준비 완료 = 웨이브를 시작해도 된다. */
export function nextPrepAction(state, P, rng = Math.random) {
  /* ⓪ 별지기 스킬 — 공짜 성장이라 제일 먼저 */
  const sk = nextSkill(state);
  if (sk) return { type: 'skill', key: sk, skill: D.CHAMP_SKILLS[sk] };

  /* ① 소환 — 벤치를 채운다 */
  if (wantsSummon(state, P)) return { type: 'summon' };

  /* ② 조합 — 할 수 있으면 한다 (확률은 프로필이 정한다) */
  const combo = chooseCombo(state);
  if (combo && rng() < P.combineChance) {
    return { type: 'combine', action: E.comboToAction(combo), combo };
  }

  /* ③ 배치 — 벤치에 남은 용사를 좋은 자리에 */
  for (const h of benchOrder(state)) {
    const pad = pickPad(state, h, P.sloppy || 0, rng);
    if (pad != null) return { type: 'place', heroId: h.id, pad, hero: h };
  }

  /* ④ 성 관리 */
  const plan = castlePlan(state, P);
  if (plan.length) return { type: 'castle', key: plan[0] };

  /* ⑤ 잔치 — 할 일이 다 끝났고 골드가 남으면 */
  if (wantsFeast(state, P)) return { type: 'feast' };

  return null;
}

/* 전투 중에는 여유 골드로 소환만 한다 (고수 프로필) */
export function midWaveAction(state, P) {
  if (!P.midWave) return null;
  return wantsSummon(state, P) ? { type: 'summon' } : null;
}

/* ---------- 잔치 ----------
 * 성 관리까지 하는 프로필(고수)만, 잔치 값을 내고도 여유가 남을 때. */
export function wantsFeast(state, P) {
  if (P.useCastle !== true || state.phase !== 'prep') return false;
  if (state.feastWave === state.wave) return false;
  const cost = D.feastCost(state.wave);
  if (state.gold < cost + 600) return false;
  return [...state.bench, ...state.field].some(h => h.tier < D.maxTierOf(h.cls));
}
