/* =====================================================
 * 수학 관문 — 조합을 통과시키는 문제의 난이도·시간·보상 규칙
 *
 * ★ 성인판에서 통째로 재설계될 파일.
 *   여기 있는 건 "문제 자체"가 아니라 "관문의 규칙"이다.
 *   문제를 만들어내는 쪽은 src/mathgen/ 이 담당한다 — 둘은 분리돼 있다.
 *
 *   현재(어린이판): 학년(3~6) = 교과 범위, 난이도(1~5) = 조이는 정도.
 *   성인판 예정   : grade 축을 도메인 축(기댓값/최적화/성장률/조합론/모듈러)으로 교체하고
 *                   제한 시간을 45~95초 → 10~20초로 줄인다(계산이 아니라 판단이므로).
 * ===================================================== */

/* ---------- 수학 (조합 전용) ----------
 * 수학 문제는 "조합의 관문"으로만 등장한다 — 따로 풀 이유를 억지로 만들지 않고,
 * 게임 진행에 반드시 필요한 순간에만 자연스럽게 만난다.
 * 첫 시도에 맞히면 조합 비용의 일부를 환급해 정확도를 보상한다. */
/* 첫 시도 정답 환급률 — 높은 학년 문제를 고르면 크게 돌려받는다
 * (3학년 15% … 6학년 45%) → 어려운 수학에 도전할 이유가 생긴다 */
export const refundRatio = (grade) => 0.15 + (Math.max(3, Math.min(6, grade)) - 3) * 0.10;
export const HINT_GOLD = 30;          // 힌트는 골드로 산다

/* ---------- 수학 난이도 (조합 난이도와 1:1로 묶인다) ----------
 * 핵심 규칙: **만들기 어려운 용사일수록 문제도 어렵고 시간도 빠듯하다.**
 * 등급업 희귀(⭐) … 신화 조합(⭐⭐⭐⭐⭐)까지 5단계.
 * 덕분에 "전설·신화를 만드는 순간"이 게임 안에서 가장 긴장되는 장면이 된다. */
export const MATH_LEVELS = [
  null,
  { name: '쉬움',   stars: '⭐',          color: '#3aa76d', time: 45 },
  { name: '보통',   stars: '⭐⭐',        color: '#2478e0', time: 50 },
  { name: '어려움', stars: '⭐⭐⭐',      color: '#a855f7', time: 62 },
  { name: '고난도', stars: '⭐⭐⭐⭐',    color: '#f59e0b', time: 78 },
  { name: '극한',   stars: '⭐⭐⭐⭐⭐',  color: '#ff4d9d', time: 95 },
];
/* 결과 등급(1~4) + 레시피/신화 프리미엄 → 1~5 */
export const mathLevel = (resultTier, isRecipe, isMythic) => {
  const base = [1, 1, 2, 3, 5][Math.max(0, Math.min(4, resultTier))];
  return Math.max(1, Math.min(5, base + (isRecipe ? 1 : 0) + (isMythic ? 1 : 0)));
};
/* 학년이 높으면 계산량 자체가 많으니 시간을 조금 더 준다 */
export const mathTime = (lv, grade) =>
  MATH_LEVELS[Math.max(1, Math.min(5, lv))].time + (Math.max(3, Math.min(6, grade)) - 3) * 8;
/* 최고 난이도(신화 조합)는 "2문제 연속 정답" 관문 — 한 번 틀리면 1단계부터 */
export const mathRounds = (lv) => (lv >= 5 ? 2 : 1);
export const TIME_WARN = 0.3;          // 남은 시간 30% 이하 = 긴박 연출
/* 빨리 풀수록 환급이 커진다 (남은 시간 비율 × 최대 60%) */
export const SPEED_BONUS_MAX = 0.6;
/* 지혜 연승: 한 번에 맞힌 문제가 연달아 쌓이면 환급 배수가 오른다 (최대 2배) */
export const streakMul = (n) => 1 + Math.min(4, Math.max(0, n - 1)) * 0.25;
export const STREAK_MAX = 5;
