/* =====================================================
 * 수학 관문 — 조합을 통과시키는 문제의 난이도·시간·보상 규칙
 *
 * ★ 성인판에서 통째로 재설계될 파일.
 *   여기 있는 건 "문제 자체"가 아니라 "관문의 규칙"이다.
 *   문제를 만들어내는 쪽은 src/mathgen/ 이 담당한다 — 둘은 분리돼 있다.
 *
 *   현재(어린이판): 학년(3~6) = 교과 범위, 난이도(1~6) = 조이는 정도.
 *   성인판 예정   : grade 축을 도메인 축(기댓값/최적화/성장률/조합론/모듈러)으로 교체한다.
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
 * 등급업 희귀(⭐) … 신화 조합(⭐⭐⭐⭐⭐)까지. 6단계는 도전 카드 전용이다. */
export const MATH_LEVELS = [
  null,
  { name: '쉬움',   stars: '⭐',           color: '#3aa76d' },
  { name: '보통',   stars: '⭐⭐',         color: '#2478e0' },
  { name: '어려움', stars: '⭐⭐⭐',       color: '#a855f7' },
  { name: '고난도', stars: '⭐⭐⭐⭐',     color: '#f59e0b' },
  { name: '극한',   stars: '⭐⭐⭐⭐⭐',   color: '#ff4d9d' },
  { name: '초극한', stars: '⭐⭐⭐⭐⭐+', color: '#ff2d55' },
];
export const MAX_MATH_LV = 6;
const clampLv = (lv) => Math.max(1, Math.min(MAX_MATH_LV, Math.round(lv || 1)));

/* 결과 등급(1~4) + 레시피/신화 프리미엄 → 관문의 **기본** 난이도 1~5.
 * 여기서 나온 값이 카드 3장의 한가운데가 된다. */
export const mathLevel = (resultTier, isRecipe, isMythic) => {
  const base = [1, 1, 2, 3, 5][Math.max(0, Math.min(4, resultTier))];
  return Math.max(1, Math.min(5, base + (isRecipe ? 1 : 0) + (isMythic ? 1 : 0)));
};

/* ---------- 문제 카드 3장 ----------
 * ★ 관문을 "세금"에서 "내기"로 바꾸는 규칙.
 *
 * 예전에는 문제가 그냥 던져졌고, 유일한 선택지는 힌트를 사는 것뿐이었다.
 * 그래서 난이도가 조금만 어긋나도 (너무 쉽거나 벅차거나) 손쓸 방법이 없었다.
 * 이제는 관문이 열리는 순간 **난이도가 저절로 뽑힌다.** 고르지도, 뽑는 걸 보지도 않는다.
 *
 * ▸ 두 번 갈아엎고 여기 왔다
 *   ① 세 장 중에서 **고르게** 했다. 난이도 보정을 푸는 사람 손에 넘긴다는 뜻이었는데,
 *      조합은 연쇄로 이어지므로 그 결정이 한 판에 열댓 번 반복된다 —
 *      선택이 재미가 아니라 **짐**이 됐다.
 *   ② 세 장을 펼쳐 놓고 **룰렛을 돌렸다.** 결정 비용은 0이 됐지만 뽑는 과정이 요란해서,
 *      수학 문제를 푸는 게임이 아니라 **뽑기 게임**처럼 보였다.
 *   ③ 지금은 뽑는 과정을 아예 보여 주지 않는다. 조합을 누르면 바로 문제가 뜨고,
 *      난이도 배지가 한 번 뿅 튕기며 무엇이 나왔는지 알린다.
 *      **변덕은 남기고 연출만 걷어냈다.**
 *   난이도가 어긋나던 진짜 원인(하한선 없음 · lv이 수의 크기를 안 건드림)은 이미
 *   생성기 쪽에서 고쳤고, 사람마다 다른 편차는 적응형 보정이 알아서 맞춘다.
 *   그래서 세 장은 이제 화면에 안 나오지만, 확률 표로는 그대로 남아 있다.
 *
 * 세 장은 항상 서로 다른 난이도여야 한다(같은 게 두 장이면 변덕이 줄어든다).
 * 그래서 base가 양 끝(1 또는 5)일 때는 위/아래로 밀어서 셋을 확보한다. */
export const cardLevels = (base) => {
  const b = Math.max(1, Math.min(5, base || 1));
  const lo = Math.max(1, Math.min(4, b - 1));
  const mid = Math.max(lo + 1, Math.min(5, b));
  const hi = Math.max(mid + 1, Math.min(MAX_MATH_LV, b + 1));
  return [lo, mid, hi];
};
/* 화면에는 이름만 나온다(환급 배수 옆에 "🎯센 문제 ×1.55" 처럼) */
export const CARD_STYLE = [
  { key: 'safe',  emoji: '🟢', name: '순한 문제', note: '가볍게 통과' },
  { key: 'std',   emoji: '🔵', name: '보통 문제', note: '이 조합에 딱 맞게' },
  { key: 'bold',  emoji: '🔴', name: '센 문제',   note: '어려운 만큼 크게' },
];

/* ---------- 뽑기 확률 ----------
 * 균등하게 굴리지 않는다. 센 문제(🔴)는 환급이 크고 별조각까지 붙는 "당첨"이라
 * 자주 나오면 당첨이 아니게 되고, 무엇보다 base 5에서는 lv6 + 2문제 연속이라
 * 매번 나오면 벌칙이 된다. 그래서 관문이 셀수록 🔴가 귀해진다.
 * (초반 관문은 🔴가 나와도 부담이 적으니 넉넉하게 준다 — 변덕의 맛이 거기서 산다) */
export const cardOdds = (base) => {
  const b = Math.max(1, Math.min(5, base || 1));
  if (b <= 2) return [0.20, 0.45, 0.35];
  if (b <= 4) return [0.25, 0.50, 0.25];
  return [0.35, 0.50, 0.15];
};
/* 어느 장이 나왔는가. rnd는 주입받는다 — 밸런스 봇이 시드 난수로 같은 규칙을 밟아야 한다 */
export function cardRoll(base, rnd = Math.random) {
  const w = cardOdds(base);
  let r = rnd();
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r < 0) return i;
  }
  return w.length - 1;
}

/* base보다 어려운 게 나올수록 환급이 커진다 — 센 문제가 나온 게 반가운 이유.
 * base 자리(가운데)가 1.0. base가 1일 때는 아래로 밀 수 없으므로 세 장 모두 1.0 이상이 된다. */
export const cardRefundMul = (lv, base) =>
  Math.max(0.5, Math.min(2.4, 1 + (clampLv(lv) - Math.max(1, Math.min(5, base))) * 0.55));
/* 별조각은 "센 관문에서 더 센 게 나왔는데 한 번에 통과"했을 때만 준다.
 * 흔해지면 영구 축복의 의미가 사라지므로 조건을 일부러 좁게 잡았다. */
export const cardShards = (lv, base) => (clampLv(lv) > base && clampLv(lv) >= 4 ? 1 : 0);

/* ---------- 적응형 보정 ----------
 * ★ 선택을 지운 지금, 사람마다 다른 편차를 맞추는 일은 전적으로 여기 달렸다.
 * 최근 성적을 보고 뽑기에 올라가는 **세 장을 통째로** 한 칸 밀어 준다.
 * 변덕은 그대로 두고, 뽑히는 범위만 조용히 움직인다.
 *
 * 재료는 정답률이 아니라 "한 번에, 힌트 없이 맞힌 비율"이다 —
 * 세 번 만에 맞힌 것도 정답으로 세면 아무리 어려워도 정답률이 100%가 된다. */
export const ADAPT_WINDOW = 8;        // 최근 몇 문제를 보는가
export const ADAPT_MIN = 6;           // 이만큼 쌓이기 전엔 건드리지 않는다 (판단 근거가 없다)
export const ADAPT_UP = 0.85;         // 이 이상 깔끔하게 맞히면 한 칸 위로
export const ADAPT_DOWN = 0.4;        // 이 아래로 떨어지면 한 칸 아래로
export function adaptOffset(window) {
  if (!window || window.length < ADAPT_MIN) return 0;
  const w = window.slice(-ADAPT_WINDOW);
  let sum = 0;
  for (const v of w) sum += v;
  const rate = sum / w.length;
  if (rate >= ADAPT_UP) return 1;
  if (rate <= ADAPT_DOWN) return -1;
  return 0;
}

/* ---------- 제한 시간 ----------
 * ★ 시간은 관문 등급이 아니라 **문제 유형**이 정한다.
 *   예전엔 등급×학년으로 계산해서 "20의 10%는?"에 119초를 주기도 했다.
 *   유형마다 실제 계산 노동량이 다르니, 그 값(prob.sec)을 그대로 쓰는 게 정직하다.
 *   난이도가 높으면 같은 유형이라도 수가 커지므로 조금만 더 얹는다. */
export const mathTime = (sec, lv) => Math.round((sec || 40) * (0.92 + 0.06 * clampLv(lv)));
/* 최고 난이도는 "2문제 연속 정답" 관문 — 한 번 틀리면 1단계부터 */
export const mathRounds = (lv) => (clampLv(lv) >= 5 ? 2 : 1);
export const TIME_WARN = 0.3;          // 남은 시간 30% 이하 = 긴박 연출
/* 빨리 풀수록 환급이 커진다 (남은 시간 비율 × 최대 60%) */
export const SPEED_BONUS_MAX = 0.6;
/* 지혜 연승: 한 번에 맞힌 문제가 연달아 쌓이면 환급 배수가 오른다 (최대 2배) */
export const streakMul = (n) => 1 + Math.min(4, Math.max(0, n - 1)) * 0.25;
export const STREAK_MAX = 5;
