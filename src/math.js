/* =====================================================
 * 수학 문제 생성기 — 배럴 / 디스패처
 *
 * 문제를 "만드는 쪽"의 유일한 진입점. 게임 본체는 이 파일 너머를 모른다.
 * 실제 생성기는 src/mathgen/ 아래에 하나씩 들어간다.
 *
 * ▸ 계약 (생성기가 지켜야 할 인터페이스)
 *     gen(level, lv, remember) -> { text, answer, hint, label, sec, ... }
 *     check(input, answer) -> boolean        답을 채점한다
 *     keep(prob)                             뽑아만 둔 문제를 "낸 문제"로 기록한다
 *   이 세 함수만 맞추면 새 생성기를 한 줄로 끼울 수 있고,
 *   scripts/math-check.mjs 의 자동 검산(3,000문항)도 그대로 붙는다.
 *
 *   remember=false 는 **카드 3장**을 위해 있다: 문제를 미리 뽑아 놓고 보여 준 뒤,
 *   플레이어가 고른 한 장만 keep()으로 기록한다. 안 고른 두 장까지 "낸 문제"로
 *   세면 다음 관문의 후보가 괜히 좁아진다.
 *
 * ▸ 호출 지점은 main.js 단 3곳뿐이다 (gen 1 · check 1 · 환급 계산 1).
 *   성인판 전환의 폭발 반경이 여기서 끝난다.
 *
 * ▸ 예정: tactical.js — 산술이 아니라 "게임 상태에 대한 판단"을 묻는 생성기.
 *   (예: "이 웨이브, 지금 배치로 뚫린다 / 안 뚫린다?")
 *   엔진 시뮬레이션으로 정답을 뽑으므로 ctx(게임 상태)를 받는 형태가 된다.
 * ===================================================== */

import * as arithmetic from './mathgen/arithmetic.js';

/* 사용 가능한 생성기 — 새 생성기는 여기에 한 줄 추가하면 끝 */
export const GENERATORS = { arithmetic };
export const DEFAULT_KIND = 'arithmetic';

export function gen(level, lv = 1, remember = true, kind = DEFAULT_KIND) {
  return GENERATORS[kind].gen(level, lv, remember);
}

export function keep(prob, kind = DEFAULT_KIND) {
  return GENERATORS[kind].keep(prob);
}

export function check(input, answer, kind = DEFAULT_KIND) {
  return GENERATORS[kind].check(input, answer);
}
