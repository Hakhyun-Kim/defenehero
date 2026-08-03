/* =====================================================
 * 수학 문제 생성기 — 배럴 / 디스패처
 *
 * 문제를 "만드는 쪽"의 유일한 진입점. 게임 본체는 이 파일 너머를 모른다.
 * 실제 생성기는 src/mathgen/ 아래에 하나씩 들어간다.
 *
 * ▸ 계약 (생성기가 지켜야 할 인터페이스)
 *     gen(grade, lv, remember, ctx) -> { text, answer, hint, label, sec, kind, ... } | null
 *     check(input, answer)          -> boolean   답을 채점한다
 *     keep(prob)                    -> void      뽑아만 둔 문제를 "낸 문제"로 기록한다
 *   이 셋만 맞추면 새 생성기를 한 줄로 끼울 수 있고,
 *   scripts/math-check.mjs 의 자동 검산도 그대로 붙는다.
 *
 *   remember=false 는 **카드 3장**을 위해 있다: 문제를 미리 뽑아 놓고 보여 준 뒤,
 *   플레이어가 고른 한 장만 keep()으로 기록한다. 안 고른 두 장까지 "낸 문제"로
 *   세면 다음 관문의 후보가 괜히 좁아진다.
 *
 *   ctx 는 게임 상태다. 산술 생성기는 무시하고, 전술 생성기는 여기서 숫자를 읽는다.
 *   낼 수 있는 전술 문제가 없으면 tactical.gen 이 null 을 돌려주고 산술로 되돌아간다.
 *
 * ▸ 두 생성기의 역할 분담
 *     arithmetic  교과 범위의 계산 — 언제나 낼 수 있다 (기본값)
 *     tactical    지금 이 판을 묻는다 — 준비 단계에 용사가 배치돼 있어야 낼 수 있다
 *   섞는 비율은 여기서만 정한다. 게임 본체는 어느 쪽이 나왔는지 신경 쓰지 않는다
 *   (문제 객체가 kind를 달고 다니므로 채점·기록은 알아서 제 생성기로 돌아간다).
 * ===================================================== */

import * as arithmetic from './mathgen/arithmetic.js';
import * as tactical from './mathgen/tactical.js';

/* 사용 가능한 생성기 — 새 생성기는 여기에 한 줄 추가하면 끝 */
export const GENERATORS = { arithmetic, tactical };
export const DEFAULT_KIND = 'arithmetic';

/* 낼 수 있는 상황이면 이 확률로 전술 문제를 낸다.
 * 전부 전술로 하지 않는 이유: 전술 문제는 판을 읽어야 해서 무겁고, 준비 단계에
 * 용사가 없으면 아예 못 낸다. 가끔 섞일 때 "어, 이건 내 판 얘기잖아"가 산다. */
export const TACTICAL_CHANCE = 0.35;

/* opts: { remember = true, ctx = null, kind = null, tactical = TACTICAL_CHANCE } */
export function gen(grade, lv = 1, opts = {}) {
  const {
    remember = true,
    ctx = null,
    kind = null,
    tactical: chance = TACTICAL_CHANCE,
  } = opts;
  if (kind) return GENERATORS[kind].gen(grade, lv, remember, ctx);
  if (ctx && chance > 0 && Math.random() < chance) {
    const p = GENERATORS.tactical.gen(grade, lv, remember, ctx);
    if (p) return p;                       // 낼 수 없으면 조용히 산술로
  }
  return GENERATORS.arithmetic.gen(grade, lv, remember);
}

/* 문제가 스스로 어느 생성기에서 왔는지 알고 있다 — 호출부가 기억할 필요가 없다 */
export function keep(prob) {
  if (!prob) return;
  const g = GENERATORS[prob.kind] || GENERATORS[DEFAULT_KIND];
  g.keep(prob);
}

export function check(input, answer, kind = DEFAULT_KIND) {
  return (GENERATORS[kind] || GENERATORS[DEFAULT_KIND]).check(input, answer);
}
