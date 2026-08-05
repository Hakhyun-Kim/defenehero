/* =====================================================
 * 경제 — 성 업그레이드 · 수학 관문의 환급/재도전/힌트
 * ===================================================== */
import * as D from '../data.js';

/* ---------- 성 업그레이드 ---------- */
export function castleUpgrade(state, key) {
  const U = D.CASTLE_UPGRADES[key];
  if (!U) return { ok: false };
  const n = key === 'repair' ? 0 : state.castle[key];
  if (U.max && n >= U.max) return { ok: false, reason: 'max' };
  if (key === 'repair' && state.castleHp >= state.castleMax) return { ok: false, reason: 'full' };
  const cost = U.cost(n);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  if (key === 'repair') {
    state.castleHp = Math.min(state.castleMax, state.castleHp + 25);
  } else if (key === 'fortify') {
    state.castle.fortify++;
    state.castleMax += 30;
    state.castleHp += 30;
  } else if (key === 'tower') {
    state.castle.tower++;
  }
  return { ok: true, cost };
}

/* ---------- 수학 / 힌트 ---------- */
export function applyMathResult(state, correct) {
  state.solved++;
  if (correct) state.correct++;
  return { correct };
}

/* 적응형 난이도의 원재료 — "한 번에, 힌트 없이" 맞혔는지만 남긴다.
 * 왜 정답 여부가 아니라 '깔끔한 정답'인가: 오답이어도 다시 풀면 결국 맞히므로
 * 정답률은 어떤 난이도에서든 100%에 수렴한다. 난이도 신호가 되지 못한다. */
export function recordMathOutcome(state, clean) {
  if (!state.mathWindow) state.mathWindow = [];
  state.mathWindow.push(clean ? 1 : 0);
  while (state.mathWindow.length > D.ADAPT_WINDOW) state.mathWindow.shift();
  return state.mathWindow;
}

/* 첫 시도에 맞히면 조합 비용 일부를 환급 — 정확도 × 학년이 곧 골드
 * mul: 속도 보너스 × 연승 배수 (빠르고 연달아 맞힐수록 커진다) */
export function refundFirstTry(state, cost, grade, mul = 1) {
  const back = Math.round(cost * D.refundRatio(grade) * state.mathMul * mul);
  state.gold += back;
  state.goldEarned += back;
  state.firstTryWins++;
  return back;
}

/* 틀렸다가 **끝내** 맞힌 경우 — 첫 시도만큼은 아니어도 0은 아니다 (mathgate.js 참고).
 * 여기에 재도전에 쓴 골드의 절반을 얹어 돌려준다: 이미 낸 돈이 매몰비용이 아니라
 * "끝까지 풀면 돌아오는 보증금"이 되어야 포기 버튼 앞에서 한 번 더 붙어 본다. */
export function refundPersist(state, cost, grade, mul = 1, retrySpent = 0) {
  const back = Math.round(cost * D.refundRatio(grade) * state.mathMul * mul * D.PERSIST_REFUND);
  const give = Math.round(retrySpent * D.RETRY_BACK);
  state.gold += back + give;
  state.goldEarned += back + give;
  state.persisted = (state.persisted || 0) + 1;
  return { back, give };
}

/* 오답 뒤 재도전을 산다 — 값은 그 조합의 비용과 틀린 횟수가 정한다(mathgate.js).
 * 조합 비용을 떼어 놓고도 낼 수 있을 때만 팔린다: 재도전을 사느라 조합을 못 하게 되면
 * "정답을 맞혔는데 골드가 모자라요"라는 최악의 결말이 생긴다. */
export function buyRetry(state, combineCost, fails) {
  const cost = D.retryCost(combineCost, fails);
  if (!D.canRetry(state.gold, combineCost, fails)) {
    return { ok: false, reason: 'gold', cost };
  }
  state.gold -= cost;
  state.retries = (state.retries || 0) + 1;
  state.retryGold = (state.retryGold || 0) + cost;
  return { ok: true, cost };
}

/* 힌트 한 단계를 산다. 값은 난이도가 정한다(mathgate.hintCost) — 호출부가 넘긴다 */
export function useHint(state, cost = D.HINT_GOLD) {
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  state.hints++;
  return { ok: true, cost };
}
