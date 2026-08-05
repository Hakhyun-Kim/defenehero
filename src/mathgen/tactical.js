/* =====================================================
 * 전술 문제 생성기 — 산술이 아니라 "지금 이 판"을 묻는다
 *
 * ▸ 왜 필요한가
 *   산술 관문은 아무리 잘 조율해도 결국 **게임을 멈추고 푸는 숙제**다.
 *   여기서는 숫자를 지어내지 않는다. 지금 배치된 용사의 공격력, 이번 웨이브에
 *   실제로 나올 몬스터의 체력·마릿수, 남은 성 체력을 그대로 읽어 와서 묻는다.
 *   그래서 문제를 푸는 일이 곧 **판을 읽는 일**이 된다 —
 *   "이 웨이브 정리하는 데 몇 초 걸리지?"는 수학이면서 동시에 전술 판단이다.
 *
 * ▸ 규칙 (이걸 어기면 전술 문제가 산술 문제보다 나쁜 것이 된다)
 *   ① 문제에 적힌 숫자는 **엔진이 실제로 쓰는 값**이어야 한다.
 *      화면 툴팁의 초당 피해와 여기 적힌 초당 피해가 다르면 아이는 게임을 못 믿는다.
 *      (그래서 engine.heroDps / waveSummary 를 그대로 쓴다 — 다시 구현하지 않는다)
 *   ② 정답은 **문제에 적힌 숫자만으로 손으로 계산**돼야 한다.
 *      시뮬레이션을 돌려야만 알 수 있는 답(예: 정확한 잔여 성 체력)은 찍기와 같다.
 *      전술 판단은 "묻는 방식"으로 넣고, 계산은 끝까지 정직하게 남긴다.
 *   ③ ctx(게임 상태)를 **절대 건드리지 않는다.** 특히 state.rng()를 부르면
 *      다음 웨이브 구성이 바뀐다 — 문제를 냈다는 이유로 판이 달라지면 안 된다.
 *      그래서 이 파일은 Math.random()만 쓴다.
 *
 * ▸ 계약은 arithmetic.js 와 같다 (src/math.js 참고). 다만 ctx를 하나 더 받는다:
 *     gen(grade, lv, remember, ctx) -> 문제 하나 · ctx가 부족하면 null
 *     ready(grade, lv, ctx)         -> 지금 낼 수 있는 전술 문제가 있는가
 * ===================================================== */
import * as D from '../data.js';
import { heroDps, waveSummary, mythicCount } from '../engine.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const at = (over, lo, hi) => Math.round(lo + (hi - lo) * over);

/* ---------- 엔진이 쓰는 값 그대로 (spawnEnemy와 같은 식) ----------
 * 여기 세 함수가 engine.js 와 어긋나면 문제가 통째로 거짓말이 된다.
 * scripts/math-check.mjs 가 실제로 웨이브를 돌려서 이 값들을 대조한다. */
/* 신화의 압력(enemies.js) — 다음 웨이브는 **지금** 데리고 있는 신화 수에 반응한다.
 * state.mythicPress 는 지난 웨이브의 값이라 준비 단계에서 쓰면 한 박자 늦는다. */
const press = (ctx) => mythicCount(ctx);
export function enemyHp(ctx, type) {
  const E = D.ENEMY_TYPES[type];
  const ramp = E.midBoss ? D.midBossRamp(ctx.wave) : 1;
  return Math.round(E.hp * D.hpScale(ctx.wave) * ctx.diff.hpMul * ramp
    * D.mythicHpMul(press(ctx)) * D.loopHpMul(ctx.loop));
}
export function enemyGold(ctx, type) {
  const E = D.ENEMY_TYPES[type];
  return Math.round(E.gold * D.enemyGoldScale(ctx.wave) * ctx.diff.goldMul
    * D.mythicGoldMul(press(ctx)) * D.loopGoldMul(ctx.loop));
}
export function enemyCastleDmg(ctx, type) {
  return Math.round(D.ENEMY_TYPES[type].castleDmg * D.loopCastleDmgMul(ctx.loop) * D.castleDmgScale(ctx.wave));
}

const label = (type) => `${D.ENEMY_TYPES[type].emoji} ${D.ENEMY_TYPES[type].name}`;
const heroLabel = (h) => `${D.CLASSES[h.cls].emoji} ${D.TIERS[h.tier].name} ${D.CLASSES[h.cls].name}`;

/* 이번 웨이브에 실제로 나오는 몬스터 (많이 나오는 순).
 * 경고 전용 항목은 waveSummary가 이미 걸러 준다. */
function waveTypes(ctx, minCount = 1) {
  const counts = waveSummary(ctx);
  return Object.entries(counts)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => ({ type, n }));
}

/* 이번 웨이브 몬스터 체력의 합 — "이 웨이브 감당되나"의 분자 */
function waveHpTotal(ctx) {
  let sum = 0;
  for (const { type, n } of waveTypes(ctx)) sum += enemyHp(ctx, type) * n;
  return sum;
}

/* 배치된 용사들의 초당 피해 (툴팁과 같은 값을 정수로 반올림해서 쓴다 —
 * 문제에 12.5 같은 수를 늘어놓으면 더하기가 문제의 본질을 가린다) */
const dpsOf = (h) => Math.round(heroDps(h));
const fieldDps = (ctx) => ctx.field.reduce((a, h) => a + dpsOf(h), 0);

/* ---------- 학년이 감당하는 수의 크기 ----------
 * ★ 전술 문제의 숫자는 판에서 **그대로** 읽어 온다 — 웨이브가 갈수록 커진다.
 *   유형만 minGrade로 막아 놨더니 3학년에게 "15420 ÷ 172" 가 나갔다.
 *   3학년 나눗셈은 (세 자리) ÷ (한 자리)까지다. 유형이 아니라 **수**를 막아야 한다.
 *
 *   그래서 각 문제가 "무슨 계산이 필요한가"를 스스로 신고한다(calc).
 *   신고한 수가 학년을 넘으면 그 문제는 버리고 다른 유형을 뽑는다 —
 *   판에서 읽은 수는 우리가 고를 수 없으니 걸러 내는 것 말고는 방법이 없다.
 *   calc: { div: [나뉘는 수, 나누는 수], mul: [두 인수] }  (필요한 것만 적는다) */
const GRADE_LIMITS = {
  3: { divisor: 9,    dividend: 999,     mulA: 999,    mulB: 9 },
  4: { divisor: 99,   dividend: 99999,   mulA: 9999,   mulB: 99 },
  5: { divisor: 999,  dividend: 999999,  mulA: 99999,  mulB: 999 },
  6: { divisor: 9999, dividend: 9999999, mulA: 999999, mulB: 9999 },
};
const gradeLimit = (grade) => GRADE_LIMITS[Math.max(3, Math.min(6, grade))];
export function fitsGrade(grade, p) {
  if (!p) return false;
  const L = gradeLimit(grade);
  const c = p.calc;
  if (!c) return true;
  if (c.div && (c.div[1] > L.divisor || c.div[0] > L.dividend)) return false;
  if (c.mul) {
    const a = Math.max(c.mul[0], c.mul[1]), b = Math.min(c.mul[0], c.mul[1]);
    if (a > L.mulA || b > L.mulB) return false;
  }
  return true;
}

/* =====================================================
 * 문제 유형
 *   min       : 이 난이도부터 등장 (arithmetic.js 와 같은 규칙)
 *   minGrade  : 이 학년부터 (올림·반올림·큰 수 나눗셈이 필요한 것들)
 *   ready(ctx): 지금 판에서 낼 수 있는가 — 없는 정보를 묻지 않기 위한 관문
 * ===================================================== */
const TYPES = [
  {
    /* lv1에 놓을 수 있는 유일한 전술 문제 — 배치된 용사가 없어도 낼 수 있다.
     * 초반 관문(희귀 등급업)이 제일 자주 열리는데 거기서 전술 문제가 한 번도
     * 안 나오면 "판을 묻는다"는 감각 자체가 안 생긴다.
     * 답에 필요한 숫자는 화면 오른쪽 웨이브 미리보기에 그대로 적혀 있다. */
    id: 'waveCount', min: 1, minGrade: 3, sec: 24, label: '⚔️ 이번 웨이브 몬스터 수',
    ready: (ctx) => waveTypes(ctx).length >= 2,
    make: (over, ctx) => {
      const list = waveTypes(ctx);
      const parts = list.map(({ type, n }) => `${label(type)} ${n}마리`);
      const total = list.reduce((a, x) => a + x.n, 0);
      return {
        text: `이번 웨이브에 나오는 몬스터예요.\n${parts.join('\n')}\n모두 몇 마리일까요?`,
        answer: total, needs: list.map(x => x.n),
        hint: `${list.map(x => x.n).join(' + ')} 를 차례대로 더해요.`,
      };
    },
  },
  {
    id: 'hits', min: 1, minGrade: 3, sec: 28, label: '⚔️ 몇 번 때려야 잡을까',
    ready: (ctx) => ctx.field.length > 0 && waveTypes(ctx).length > 0,
    make: (over, ctx, grade) => {
      const heroes = ctx.field, types = waveTypes(ctx);
      /* ★ 3학년에게는 이 질문을 나눗셈으로 물을 수 없다. 용사의 한 방은 두 자리를
       * 넘는데 3학년 나눗셈은 (세 자리) ÷ (한 자리)까지다. 그래서 **방향을 뒤집는다** —
       * "몇 번 때려야 잡나"(나눗셈) 대신 "몇 번 때리면 얼마나 아픈가"(곱셈).
       * 판을 읽는 감각은 그대로 두고 계산만 학년 안으로 들여온다. */
      if (grade <= 3) {
        const h = pick(heroes), n = 2 + Math.floor(Math.random() * 8);   // 2~9번
        return {
          text: `${heroLabel(h)}의 한 방은 ${h.dmg}이에요.\n${n}번 때리면 피해는 모두 얼마일까요?`,
          answer: h.dmg * n, needs: [h.dmg, n], calc: { mul: [h.dmg, n] },
          hint: `${h.dmg} × ${n} 을 계산해요.`,
        };
      }
      /* 때리는 횟수가 2~25 사이가 되는 조합을 고른다.
       * 1번에 죽거나 200번 때려야 하면 계산이 아니라 그냥 큰 수 나눗셈이 된다.
       * 나누는 수(한 방)가 학년을 넘는 조합은 아예 후보에서 뺀다. */
      const L = gradeLimit(grade);
      let best = null;
      for (let i = 0; i < 24; i++) {
        const h = pick(heroes), t = pick(types).type;
        if (h.dmg > L.divisor) continue;
        const hp = enemyHp(ctx, t), n = Math.ceil(hp / h.dmg);
        if (hp > L.dividend) continue;
        if (n >= 2 && n <= 25) { best = { h, t, hp, n }; break; }
        if (!best) best = { h, t, hp, n };
      }
      if (!best) return null;                  // 이 학년으로 낼 수 있는 조합이 없다
      const { h, t, hp, n } = best;
      return {
        text: `${label(t)}의 체력은 ${hp}이에요.\n${heroLabel(h)}의 한 방은 ${h.dmg}.\n몇 번 때려야 쓰러질까요?`,
        answer: n, needs: [hp, h.dmg], calc: { div: [hp, h.dmg] },
        hint: `${hp} ÷ ${h.dmg} 를 계산하고, 딱 안 떨어지면 한 번 더 때려야 하니 「올림」해요.`,
      };
    },
  },
  {
    id: 'waveGold', min: 2, minGrade: 3, sec: 34, label: '⚔️ 이 웨이브 골드',
    ready: (ctx) => waveTypes(ctx, 2).length > 0,
    make: (over, ctx) => {
      const list = waveTypes(ctx, 2);
      const a = pick(list);
      const g = enemyGold(ctx, a.type);
      /* 난이도가 오르면 두 종류를 한꺼번에 묻는다 (곱셈 두 번 + 덧셈) */
      const two = over >= 0.5 && list.length >= 2;
      if (!two) {
        return {
          text: `이번 웨이브에는 ${label(a.type)}이(가) ${a.n}마리 나와요.\n한 마리를 잡으면 골드 ${g}.\n다 잡으면 골드를 얼마나 벌까요?`,
          answer: a.n * g, needs: [a.n, g], calc: { mul: [a.n, g] },
          hint: `${a.n} × ${g} 를 계산해요.`,
        };
      }
      const b = pick(list.filter(x => x.type !== a.type)) || a;
      const gb = enemyGold(ctx, b.type);
      return {
        text: `이번 웨이브에는 ${label(a.type)} ${a.n}마리(한 마리 ${g}골드)와\n${label(b.type)} ${b.n}마리(한 마리 ${gb}골드)가 나와요.\n둘을 다 잡으면 골드를 얼마나 벌까요?`,
        answer: a.n * g + b.n * gb, needs: [a.n, g, b.n, gb], calc: { mul: [Math.max(a.n, b.n), Math.max(g, gb)] },
        hint: `① ${a.n} × ${g} = ${a.n * g} ② ${b.n} × ${gb} = ${b.n * gb} ③ 둘을 더해요.`,
      };
    },
  },
  {
    id: 'dpsSum', min: 2, minGrade: 3, sec: 32, label: '⚔️ 우리 편 초당 피해',
    ready: (ctx) => ctx.field.length >= 2,
    make: (over, ctx) => {
      const want = Math.min(ctx.field.length, at(over, 2, 4));
      const heroes = [...ctx.field].sort(() => Math.random() - 0.5).slice(0, want);
      const parts = heroes.map(h => `${heroLabel(h)} ${dpsOf(h)}`);
      const sum = heroes.reduce((a, h) => a + dpsOf(h), 0);
      return {
        text: `지금 배치된 용사들의 「초당 피해」예요.\n${parts.join('\n')}\n모두 더하면 1초에 얼마일까요?`,
        answer: sum, needs: heroes.map(dpsOf),
        hint: `${heroes.map(h => dpsOf(h)).join(' + ')} 를 차례대로 더해요.`,
      };
    },
  },
  {
    id: 'castleFall', min: 3, minGrade: 3, sec: 34, label: '⚔️ 성이 무너지는 마릿수',
    ready: (ctx) => ctx.castleHp > 0 && waveTypes(ctx).length > 0,
    make: (over, ctx) => {
      const t = pick(waveTypes(ctx)).type;
      const d = enemyCastleDmg(ctx, t);
      const n = Math.ceil(ctx.castleHp / d);
      return {
        text: `성 체력이 ${ctx.castleHp} 남았어요.\n${label(t)}이(가) 성에 닿으면 ${d}의 피해를 줘요.\n몇 마리가 닿으면 성이 무너질까요?`,
        answer: n, needs: [ctx.castleHp, d], calc: { div: [ctx.castleHp, d] },
        hint: `${ctx.castleHp} ÷ ${d} 를 계산하고 「올림」해요 — 마지막 한 마리가 마무리를 하니까요.`,
      };
    },
  },
  {
    id: 'survive', min: 3, minGrade: 3, sec: 36, label: '⚔️ 다 놓치면 성이?',
    ready: (ctx) => ctx.castleHp > 0 && waveTypes(ctx, 2).length > 0,
    make: (over, ctx) => {
      const a = pick(waveTypes(ctx, 2));
      const d = enemyCastleDmg(ctx, a.type);
      /* 성이 버티는 마릿수를 넘기면 답이 0이 된다. 0이 자주 나오면 찍어서 맞힐 수 있으니
       * 대부분은 "아슬아슬하게 버티는" 쪽에서 뽑고, 가끔만 무너지는 쪽을 낸다. */
      const room = Math.floor(ctx.castleHp / d);
      const want = Math.random() < 0.2 ? room + 2 : room - 1 - Math.floor(Math.random() * 3);
      const n = Math.min(a.n, Math.max(1, want));
      return {
        /* ★ 한 마리당 피해(d)를 반드시 문장에 적는다. 예전엔 힌트에만 있어서
         * 힌트를 사지 않으면 풀 수 없는 문제였다 — 규칙 ②(적힌 숫자만으로 풀린다) 위반. */
        text: `성 체력이 ${ctx.castleHp} 남았어요.\n${label(a.type)}은(는) 성에 닿을 때마다 ${d}씩 깎아요.\n${n}마리를 하나도 못 막으면 성 체력이 얼마나 남을까요? (0보다 작아지면 0)`,
        answer: Math.max(0, ctx.castleHp - n * d),
        needs: [ctx.castleHp, d, n], calc: { mul: [n, d] },
        hint: `${n} × ${d} = ${n * d} 를 ${ctx.castleHp}에서 빼요 (음수면 0).`,
      };
    },
  },
  {
    id: 'reachTime', min: 4, minGrade: 4, sec: 34, label: '⚔️ 성까지 몇 초',
    ready: (ctx) => waveTypes(ctx).length > 0,
    make: (over, ctx) => {
      const routes = [0, 1, 2];
      const names = ['왼쪽 길', '가운데 지름길', '오른쪽 길'];
      let r, t, len, spd, exact;
      /* 정확히 x.5초가 나오면 반올림이 애매해진다 — 그런 조합은 다시 뽑는다 */
      for (let i = 0; i < 12; i++) {
        r = pick(routes);
        t = pick(waveTypes(ctx)).type;
        len = Math.round(D.ROUTE_LENS[r]);
        spd = D.ENEMY_TYPES[t].spd;
        exact = len / spd;
        if (Math.abs(exact - Math.floor(exact) - 0.5) > 0.08) break;
      }
      /* "이 빠르기로" 라고 못 박는 이유: 실제 개체는 스폰할 때 속도가 ±8% 흔들린다
       * (engine.spawnEnemy). 종족 표의 빠르기는 맞는 값이지만, 스톱워치로 재면
       * 조금 다를 수 있다 — 그래서 특정 한 마리의 예언이 아니라 주어진 수의 계산으로 묻는다. */
      return {
        text: `${names[r]}의 길이는 ${len}이에요.\n${label(t)}의 빠르기는 1초에 ${spd}.\n이 빠르기로 포탈에서 성까지 가면 몇 초일까요? (반올림해서 정수로)`,
        answer: Math.round(exact), needs: [len, spd], calc: { div: [len, spd] },
        hint: `${len} ÷ ${spd} 를 계산하고 소수 첫째 자리에서 반올림해요.`,
      };
    },
  },
  {
    id: 'clearTime', min: 4, minGrade: 4, sec: 42, label: '⚔️ 이 웨이브 정리 시간',
    ready: (ctx) => ctx.field.length >= 1 && fieldDps(ctx) > 0 && waveTypes(ctx).length > 0,
    make: (over, ctx) => {
      const hp = waveHpTotal(ctx);
      const dps = fieldDps(ctx);
      return {
        text: `이번 웨이브 몬스터의 체력을 모두 더하면 ${hp}이에요.\n지금 배치된 용사들의 초당 피해 합은 ${dps}.\n쉬지 않고 때린다면 정리하는 데 몇 초 걸릴까요? (올림)`,
        answer: Math.ceil(hp / dps), needs: [hp, dps], calc: { div: [hp, dps] },
        hint: `${hp} ÷ ${dps} 를 계산하고 「올림」해요. 남은 한 조각도 때려야 끝나니까요.`,
      };
    },
  },
  {
    id: 'dpsNeed', min: 5, minGrade: 4, sec: 44, label: '⚔️ 얼마나 세져야 하나',
    ready: (ctx) => waveTypes(ctx).length > 0 && waveHpTotal(ctx) > 0,
    make: (over, ctx) => {
      const hp = waveHpTotal(ctx);
      const t = pick([10, 15, 20, 25, 30, 40]);
      return {
        text: `이번 웨이브 몬스터의 체력을 모두 더하면 ${hp}이에요.\n${t}초 안에 다 정리하려면\n용사들의 초당 피해 합이 「적어도」 얼마여야 할까요? (올림)`,
        answer: Math.ceil(hp / t), needs: [hp, t], calc: { div: [hp, t] },
        hint: `${hp} ÷ ${t} 를 계산하고 「올림」해요 — 모자라면 시간 안에 못 끝내니까요.`,
      };
    },
  },
  {
    id: 'goldAfter', min: 5, minGrade: 3, sec: 40, label: '⚔️ 웨이브 뒤 골드 (적어도)',
    ready: (ctx) => waveTypes(ctx, 2).length > 0,
    make: (over, ctx) => {
      const a = pick(waveTypes(ctx, 2));
      const g = enemyGold(ctx, a.type);
      const bonus = D.WAVE_BONUS(ctx.wave);
      /* "적어도"가 핵심이다. 실제로는 콤보 배율과 다른 종류의 몬스터가 더 얹히므로
       * 딱 이 금액이 된다고 하면 게임이 지키지 못할 약속을 하는 셈이 된다.
       * 하한선을 묻는 것으로 바꾸면 문장도 참이 되고 계산도 그대로 남는다. */
      return {
        text: `지금 골드가 ${ctx.gold}이에요.\n${label(a.type)} ${a.n}마리를 잡으면 한 마리당 ${g}골드,\n웨이브를 깨면 보너스로 ${bonus}골드를 더 받아요.\n웨이브가 끝나면 골드가 「적어도」 얼마가 될까요?`,
        answer: ctx.gold + a.n * g + bonus, needs: [ctx.gold, a.n, g, bonus], calc: { mul: [a.n, g] },
        hint: `① ${a.n} × ${g} = ${a.n * g} ② ${ctx.gold} + ${a.n * g} + ${bonus}`,
      };
    },
  },
  {
    /* 순수한 계획 문제 — "지금 몇 명 더 뽑을 수 있지?"는 실제로 매 준비 단계마다 하는 계산이다 */
    id: 'summonMax', min: 3, minGrade: 3, sec: 30, label: '⚔️ 몇 명 더 뽑을까',
    ready: (ctx) => ctx.gold >= D.SUMMON_COST,
    make: (over, ctx) => ({
      text: `지금 골드가 ${ctx.gold}이에요.\n용사 한 명을 소환하는 데 ${D.SUMMON_COST}골드가 들어요.\n최대 몇 명까지 뽑을 수 있을까요?`,
      answer: Math.floor(ctx.gold / D.SUMMON_COST), needs: [ctx.gold, D.SUMMON_COST], calc: { div: [ctx.gold, D.SUMMON_COST] },
      hint: `${ctx.gold} ÷ ${D.SUMMON_COST} 를 계산하고, 남는 골드로는 못 뽑으니 「버림」해요.`,
    }),
  },
];

export const MAX_LV = 6;

/* arithmetic.js 와 같은 하한선 규칙 — lv보다 두 칸 넘게 쉬운 유형은 후보에서 뺀다 */
const FLOOR = 1;
function eligible(grade, lv, ctx) {
  const usable = TYPES.filter(t => (t.minGrade || 3) <= grade && t.ready(ctx));
  for (let f = FLOOR; f <= MAX_LV; f++) {
    const pool = usable.filter(t => t.min <= lv && t.min >= lv - f);
    if (pool.length) return pool;
  }
  return usable;
}

/* 지금 이 판에서 낼 수 있는 전술 문제가 있는가.
 * 없으면 산술로 돌아간다 — 판에 없는 정보를 묻느니 평범한 계산이 낫다. */
export function ready(grade, lv, ctx) {
  if (!ctx || !ctx.field || !ctx.diff) return false;
  return eligible(grade, lv, ctx).length > 0;
}

const RECENT_MAX = 6;
const recent = [];
export function keep(prob) {
  if (!prob) return;
  recent.push(prob.type);
  if (recent.length > RECENT_MAX) recent.shift();
}
/* 방금 뽑은 유형 — keep()과 별개로 gen()마다 갱신된다.
 * 카드 3장은 remember=false로 뽑히므로 keep()이 안 불린다. 이것이 없으면
 * 한 화면에 "몇 번 때려야 잡을까"가 두 장 뜬다 — 고르라면서 같은 걸 내미는 셈이다. */
let lastId = '';

export function gen(grade, lv = 1, remember = true, ctx = null) {
  if (!ready(grade, lv, ctx)) return null;
  const L = Math.max(1, Math.min(MAX_LV, Math.round(lv)));
  const pool = eligible(grade, L, ctx);
  /* 직전에 낸 유형은 피한다. 전술 문제는 후보가 적어서 그냥 뽑으면 금세 반복된다 */
  const skip = new Set([lastId, ...recent.slice(-2)]);
  const fresh = pool.filter(t => !skip.has(t.id));
  const use = fresh.length ? fresh : pool;
  /* ★ 학년을 넘는 수가 나오면 그 문제를 버리고 다른 유형을 뽑는다.
   * 판에서 읽은 수는 우리가 고를 수 없으므로 "만들고 나서 재 보는" 수밖에 없다.
   * 전부 걸리면 null — 호출부(math.js)가 조용히 산술 문제로 되돌린다. */
  let t = null, p = null;
  const left = use.slice();
  while (left.length) {
    const i = Math.floor(Math.random() * left.length);
    const cand = left.splice(i, 1)[0];
    const made = cand.make(Math.max(0, Math.min(1, L - cand.min)), ctx, grade);
    if (made && fitsGrade(grade, made)) { t = cand; p = made; break; }
  }
  if (!p) return null;
  lastId = t.id;
  const over = Math.max(0, Math.min(1, L - t.min));
  const prob = {
    text: p.text,
    answer: p.answer,
    hint: p.hint,
    label: t.label,
    sec: t.sec,
    over,
    needs: p.needs || [],
    calc: p.calc || null,       // 어떤 계산이 필요한가 (학년 한도 검사용 — math-check.mjs)
    min: t.min,
    lv: L,
    grade,
    type: t.id,
    kind: 'tactical',
  };
  if (remember) keep(prob);
  return prob;
}

export function check(input, answer) {
  const v = parseFloat(String(input).replace(/,/g, '').trim());
  if (Number.isNaN(v)) return false;
  return Math.abs(v - answer) < 0.001;
}
