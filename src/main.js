/* =====================================================
 * 메인 컨트롤러: 엔진 + 3D 렌더러 + UI + 사운드 배선
 * ===================================================== */
import * as D from './data.js';
import * as E from './engine.js';
import * as MathGen from './math.js';
import { Renderer3D, heroPortrait } from './render3d.js';
import { UI } from './ui.js';
import { SFX, toggleSfx, toggleMusic, toggleAll, isSfxMuted, isMusicMuted, forceMute, getAc, getMaster } from './sfx.js';
import { music } from './music.js';
import * as Story from './story.js';
import { demo } from './demo.js';

/* ---------- 저장 ---------- */
const store = {
  get shards() { return Number(localStorage.getItem('mathdef_shards') || 0); },
  set shards(v) { localStorage.setItem('mathdef_shards', String(v)); },
  get meta() { try { return JSON.parse(localStorage.getItem('mathdef_meta') || '{}'); } catch { return {}; } },
  set meta(v) { localStorage.setItem('mathdef_meta', JSON.stringify(v)); },
  get diff() { return localStorage.getItem('mathdef_diff') || 'normal'; },
  set diff(v) { localStorage.setItem('mathdef_diff', v); },
  best(diff) { return Number(localStorage.getItem(`mathdef_best_${diff}`) || 0); },
  setBest(diff, w) { localStorage.setItem(`mathdef_best_${diff}`, String(w)); },
  get gfx() { return localStorage.getItem('mathdef_gfx'); },
  /* 배경 장식 끄기 — 너무 느린 기기에서 한 번 켜지면 계속 유지된다.
   * 장식을 켜고 끄는 건 지형·카메라까지 바뀌는 일이라 실행 중엔 못 바꾼다.
   * 그래서 "다음에 켤 때부터"로 미룬다. */
  get decorOff() { return localStorage.getItem('mathdef_decor_off') === '1'; },
  set decorOff(v) { localStorage.setItem('mathdef_decor_off', v ? '1' : '0'); },
  get storyOff() { return localStorage.getItem('mathdef_story_off') === '1'; },
  set storyOff(v) { localStorage.setItem('mathdef_story_off', v ? '1' : '0'); },
  get deaths() { return Number(localStorage.getItem('mathdef_deaths') || 0); },
  set deaths(v) { localStorage.setItem('mathdef_deaths', String(v)); },
  set gfx(v) { localStorage.setItem('mathdef_gfx', v); },
  /* 자동 저장 슬롯 (웨이브가 끝날 때마다 갱신, 함락되면 삭제) */
  get autosave() { try { return JSON.parse(localStorage.getItem('mathdef_autosave') || 'null'); } catch { return null; } },
  set autosave(v) {
    if (v == null) localStorage.removeItem('mathdef_autosave');
    else localStorage.setItem('mathdef_autosave', JSON.stringify(v));
  },
};

/* ---------- 초기화 ---------- */
const ui = new UI();
/* URL로 강제 지정 가능: ?gfx=high|lite|min (min은 테스트/초저사양용) */
const urlParams = new URLSearchParams(location.search);
const urlGfx = urlParams.get('gfx');
/* 자동화로 열었거나 ?mute를 붙였으면 소리 없이 시작한다.
 * 검증을 돌릴 때마다 옆에서 효과음이 터지면 사람이 못 견딘다.
 * (설정을 저장하지 않으므로 사용자가 평소 쓰던 소리 설정은 그대로 남는다) */
if (urlParams.has('mute') || urlParams.has('rafshim')) forceMute();

/* ---------- 모바일이면 배경 장식을 끈다 ----------
 * 잔디 14,000장 · 픽셀마다 도는 파도 셰이더 · 하늘 밴드는 데스크톱 GPU 기준으로
 * 만든 것들이라 폰에서는 프레임을 그대로 먹는다. 게다가 작은 화면에서는
 * 하늘에 내줬던 19%가 아깝다 — 끄면 그만큼 전장이 커져 발판을 누르기 쉬워진다.
 * ?decor=on 으로 폰에서도 켜 볼 수 있고, ?decor=off 로 데스크톱에서 꺼 볼 수 있다. */
function detectMobile() {
  /* ?mobile=1 은 폰 없이 이 경로를 확인하려고 둔다. 데스크톱 브라우저는
   * 창을 줄여도 pointer:coarse 로 안 바뀌어서 그냥은 검증이 안 된다. */
  const forced = urlParams.get('mobile');
  if (forced != null) return !/^(0|off|no|false)$/i.test(forced);
  try {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true;
  } catch { /* matchMedia 없는 환경 */ }
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent || '');
}
const urlDecor = urlParams.get('decor');
const isMobile = detectMobile();
const useDecor = urlDecor != null ? !/^(0|off|no|false)$/i.test(urlDecor)
                                  : (!isMobile && !store.decorOff);

const renderer = new Renderer3D(ui.el.scene3d, {
  /* 폰은 처음부터 lite 로 시작한다. high 로 켰다가 7초 뒤에 떨어뜨리면
   * 그 7초가 하필 제일 버벅이는 구간(첫인상)이 된다. */
  quality: urlGfx || (store.gfx === 'lite' || (isMobile && store.gfx == null) ? 'lite' : 'high'),
  preserve: urlParams.has('rafshim') || urlGfx === 'min',
  decor: useDecor,
});

let state = null;
let grade = 3;
let gradeBeforeDemo = null;   // 데모가 프로필 학년으로 바꾸기 전의 값
let speed = 1;
let selBench = null;      // 배치 대기 중인 벤치 용사
let selHero = null;       // 정보 패널에 표시 중인 용사 (벤치/필드)
let hoverHeroId = null;   // 툴팁 표시 중인 필드 용사
let overHandled = false;
let heartbeatT = 0;
let panelT = 0;
const modal = { mode: null, pending: null, prob: null };
let streak = 0;               // 연속 "한 번에 정답" 횟수 (지혜 연승)
let sellMode = false;         // 여러 명 판매 모드 (벤치 카드가 체크박스가 된다)
const sellSel = new Set();    // 판매하려고 고른 용사 id

function newGame(difficulty, opts = {}) {
  gameOverToken++;                 // 게임오버 연출 예약이 새 판을 덮지 않게
  state = E.createGame({ difficulty, metaLevels: store.meta });
  state.bench.push(E.makeHero(state, 'knight', 0));
  state.bench.push(E.makeHero(state, 'archer', 0));
  selBench = null;
  selHero = null;
  streak = 0;
  overHandled = false;
  sellMode = false;
  sellSel.clear();
  renderer.setPlacementMode(false);
  renderer.setSelectedHero(null);
  refreshAll();
  ui.hideOver();
  music.setWave(1);
  /* 이어하기 메뉴를 띄울 때는 프롤로그를 잠시 미룬다 — 메뉴 위에 이야기가 겹치면 안 된다 */
  if (!opts.holdStory) playStory('prologue');
}

/* 판매 모드에 들어가면 배치/이동 선택은 모두 풀어 한 번에 한 가지만 하게 한다 */
function setSellMode(on) {
  if (sellMode === !!on) return;
  sellMode = !!on;
  sellSel.clear();
  if (sellMode) {
    selBench = null;
    selHero = null;
    kbPad = null;
    renderer.setPlacementMode(false);
    renderer.setSelectedHero(null);
    renderer.setHover(null);
    ui.restoreTab();
  }
  refreshPanels();
}

function refreshPanels() {
  /* 조합 등으로 사라진 용사가 판매 선택에 남지 않게 정리 */
  if (sellSel.size) {
    for (const id of [...sellSel]) if (!state.bench.some(h => h.id === id)) sellSel.delete(id);
  }
  ui.renderBench(state, selBench, sellMode ? sellSel : null);
  ui.renderSellBar(state, sellMode, sellSel);
  ui.renderCombine(state);
  ui.renderCastlePanel(state);
  ui.renderHeroPanel(state, selHero);
}
function refreshAll() {
  refreshPanels();
  ui.updateHud(state, store.shards, store.best(state.difficulty));
  ui.setWaveUI(state);
  ui.renderWavePreview(state, E.waveSummary(state));
}

/* ---------- 수학 모달 ----------
 * 문제 난이도는 "지금 하려는 조합"이 정한다:
 *   희귀 등급업(⭐) … 신화 조합(⭐⭐⭐⭐⭐).
 * 여기에 제한 시간 · 연승 · 다단계 관문을 얹어 긴장감을 만든다. */

/* 지금 pending이 가리키는 조합의 실제 정보(비용/결과 등급)를 엔진에서 가져온다 */
function comboInfo(pending) {
  if (!pending) return null;
  const combos = E.listCombos(state);
  if (pending.kind === 'rankup') {
    return combos.find(c => c.kind === 'rankup'
      && c.cls === pending.cls && c.tier === Number(pending.tier)) || null;
  }
  return combos.find(c => c.kind === 'recipe' && c.result === pending.result) || null;
}
function comboLevel(info) {
  if (!info) return 1;
  return D.mathLevel(info.resultTier, info.kind === 'recipe', !!D.CLASSES[info.result].mythic);
}

function openMath(mode, pending = null) {
  if (state.phase === 'over') return;
  const pre = comboInfo(pending);
  /* 골드가 모자란 조합은 문제를 내지 않는다 — 풀고 나서 실패하면 노력이 통째로 날아간다 */
  if (mode === 'combine' && pre && state.gold < pre.cost) {
    ui.toast(`조합에 💰${pre.cost}이 필요해요 (지금 💰${state.gold}) — 몬스터를 잡아 모아 보세요 ⚔️`, 'bad');
    return;
  }
  modal.mode = mode;
  modal.pending = pending;
  const info = comboInfo(pending);
  modal.info = info;
  /* 카드 3장의 한가운데. 최근 성적에 따라 세 장이 통째로 한 칸 오르내린다 */
  modal.adapt = D.adaptOffset(state.mathWindow);
  modal.base = Math.max(1, Math.min(5, comboLevel(info) + modal.adapt));
  /* 학년은 관문이 열리는 순간 얼려 둔다.
   * 카드에 "💰+57"이라고 적어 놓고 도중에 학년이 바뀌면 실제 환급이 달라진다 —
   * 적어 준 숫자와 주는 숫자가 다르면 카드를 고를 이유가 사라진다.
   * (데모를 켜고 끄면 프로필 학년으로 갈아타므로 실제로 벌어질 수 있는 일이다) */
  modal.grade = grade;
  modal.card = null;
  modal.prob = null;                     // 카드를 고르기 전엔 "낸 문제"가 없다 (시계·힌트가 돌면 안 된다)
  modal.lv = modal.base;
  modal.allClean = true;                 // 모든 단계를 한 번에 맞혔는가
  modal.minLeft = 1;                     // 단계별 남은 시간 비율의 최솟값
  modal.fails = 0;                        // 이 관문에서 틀린 횟수 (재도전 값이 여기에 비례한다)
  modal.retrySpent = 0;                   // 재도전에 쓴 골드 — 끝내 맞히면 절반 돌아온다
  let title = '✏️ 지혜의 시험!';
  if (mode === 'combine' && pending) {
    if (pending.kind === 'rankup') {
      const C = D.CLASSES[pending.cls];
      title = `⚗️ 조합 시험! (${C.name} ${D.TIERS[pending.tier].name}×2)`;
    } else {
      const R = D.CLASSES[pending.result];
      title = `${R.mythic ? '🌌 신화의 시험!' : '⚗️ 조합 시험!'} (${R.emoji} ${R.name} 만들기)`;
    }
  }
  ui.showMath(title, modal.base);
  SFX.challenge(modal.base);
  rollProblem();
}

/* ---------- 난이도 뽑기 ----------
 * ★ 관문의 난이도는 조합 등급을 한가운데 두고 위아래로 한 칸씩 흔들린다.
 *   같은 조합이라도 어떤 날은 순하게, 어떤 날은 세게 나온다 — 그 변덕이
 *   환급 배수와 별조각으로 이어져서, 문제를 여는 순간이 매번 조금씩 다르다.
 *
 *   여기까지 오는 데 두 번 갈아엎었다.
 *   ① 세 장을 펼쳐 놓고 고르게 했다 → 조합이 연쇄로 이어지다 보니 한 판에
 *      열댓 번 같은 메뉴를 넘기는 일이 됐다. 선택이 재미가 아니라 짐이 됐다.
 *   ② 세 장을 펼쳐 놓고 룰렛을 돌렸다 → 뽑는 과정이 슬롯머신처럼 요란해서,
 *      수학 문제를 푸는 게임이 아니라 뽑기 게임처럼 보였다.
 *   그래서 지금은 **뽑는 과정을 아예 보여 주지 않는다.** 조합을 누르면 바로
 *   문제가 뜨고, 난이도 배지가 한 번 뿅 튕기며 "이번엔 이게 걸렸다"를 알린다.
 *   변덕은 남기고 연출만 걷어낸 셈이다. */
/* 환급 배수에 붙는 이름 — 슬롯 번호가 아니라 **배수 자체**를 설명한다.
 * base가 1일 때는 아래로 밀 수 없어 가운데 장에도 보너스가 붙는데, 그때 슬롯 이름으로
 * "보통 문제 ×1.55"라고 적으면 왜 더 주는지 설명이 안 된다. */
const mulName = (mul) => (mul > 1 ? '센 문제' : '순한 문제');

function rollProblem() {
  const base = modal.base;
  /* 뽑기는 게임 난수(state.rng)를 쓰지 않는다 — 문제를 뽑았다고 웨이브가 바뀌면 안 된다 */
  const i = D.cardRoll(base);
  const lv = D.cardLevels(base)[i];
  modal.card = {
    i, lv,
    mul: D.cardRefundMul(lv, base),
    shards: D.cardShards(lv, base),
  };
  modal.lv = lv;
  ui.setMathTone(lv);
  SFX.challenge(lv);
  /* 난이도가 저절로 움직였으면 반드시 말해 준다 — 말없이 조용히 조이면
   * "왜 갑자기 어려워졌지?"가 되고, 아이는 자기가 못한다고 생각한다. */
  if (modal.adapt > 0) ui.toast('🔥 요즘 척척 맞히고 있어요 — 문제가 한 칸 올라갔어요!', 'good');
  else if (modal.adapt < 0) ui.toast('🌱 잠깐 숨 고르기 — 문제가 한 칸 쉬워졌어요');
  if (modal.card.shards) {
    SFX.shard();
    ui.toast(`🔴 센 문제가 나왔어요! 한 번에 맞히면 ✨별조각 +${modal.card.shards}`, 'good');
  }
  newProblem(true);
}

/* 오답 재도전은 뽑힌 난이도 그대로 새 문제를 낸다 —
 * 다시 뽑게 하면 틀릴 때마다 쉬운 쪽이 걸리기를 기대하며 버티게 된다. */
function newProblem(pop = false) {
  startProblem(MathGen.gen(modal.grade, modal.lv, { ctx: state }), pop);
}

function startProblem(prob, pop = false) {
  modal.prob = prob;
  modal.tries = 0;
  modal.usedHint = false;                // 힌트는 문제마다 새로 산다
  modal.retryArmAt = 0;                  // 새 문제가 나왔으니 재도전 잠금 해제
  /* 제한 시간은 관문 등급이 아니라 문제 유형이 정한다 (mathgate.js 참고) */
  modal.timeMax = D.mathTime(prob.sec, modal.lv, prob.over);
  modal.time = modal.timeMax;
  const cost = modal.info ? modal.info.cost : 0;
  const mul = modal.card ? modal.card.mul : 1;
  const refund = Math.round(cost * D.refundRatio(modal.grade) * state.mathMul * mul);
  const bonus = [];
  /* 배수가 1이 아니면 항상 적는다 — 깎일 때(순한 문제 ×0.5)도 왜 적은지 말해 줘야 한다 */
  if (Math.abs(mul - 1) > 0.01) bonus.push(`🎯${mulName(mul)} ×${mul.toFixed(2)}`);
  if (streak >= 1) bonus.push(`🔥${streak + 1}연승 ×${D.streakMul(streak + 1).toFixed(2)}`);
  const shard = modal.card && modal.card.shards ? ` ✨별조각 +${modal.card.shards}` : '';
  ui.setProblem({
    grade: modal.grade, lv: modal.lv, text: prob.text, label: prob.label,
    time: modal.timeMax, streak, pop,
    vert: prob.vert,
    /* 틀렸을 때 얼마가 드는지 미리 보여 준다 — 답을 넣기 전에 알아야 판돈이 된다 */
    retry: cost ? retryPlan() : null,
    /* 지금 포기하면 무엇을 잃는지 버튼에 적는다 — 누르기 전에 알아야 한다 */
    giveUp: modal.mode === 'combine' && modal.pending
      ? { lost: modal.retrySpent || 0 }
      : null,
    freeHint: (modal.fails || 0) >= D.FREE_HINT_AFTER,
    canGiveUp: modal.mode === 'combine' && !!modal.pending,
    reward: refund
      ? `⏱ 빨리 한 번에 맞힐수록 환급이 커져요! (기본 💰${refund}${bonus.length ? ' · ' + bonus.join(' ') : ''})${shard}`
      : '맞히면 조합 성공!',
  });
}

/* ---------- 재도전 값 ----------
 * 다음에 틀리면 얼마가 드는지, 그리고 낼 수 있는지. 조합 비용을 떼어 놓고 판단한다
 * (재도전을 사느라 조합을 못 하게 되는 게 제일 나쁜 결말 — mathgate.js 참고). */
function retryPlan(nextFails = (modal.fails || 0) + 1) {
  const cost = modal.info ? modal.info.cost : 0;
  if (!cost) return null;
  return {
    price: D.retryCost(cost, nextFails),
    afford: D.canRetry(state.gold, cost, nextFails),
  };
}

/* ---------- 포기 · 실패 ----------
 * ★ 예전에는 문제창을 닫는 데 아무 대가가 없었다. 그래서 껐다 다시 켜면 난이도와 유형이
 *   새로 뽑혔고(공짜 리롤), 틀려도 새 문제가 무한히 나왔다. 결국 아무렇게나 눌러도
 *   언젠간 조합이 됐고, 수학은 있으나 마나였다.
 *   이제 포기하면 **그 조합이 이번 준비 단계 동안 잠기고**, 재도전은 **골드로 산다.**
 *   조합이 이 게임의 유일한 성장 수단이라 이게 가장 자연스러운 대가다. */
function lockPending(why) {
  const p = modal.pending;
  if (!p) return false;
  E.lockCombo(state, E.comboKey(p));
  streak = 0;
  modal.pending = null;                  // 여기서 비워야 재도전 경로로 새 문제가 나가지 않는다
  ui.toast(`🔒 ${why} — 이 조합은 이번 웨이브엔 못 해요 (웨이브를 치르면 다시 열려요)`, 'bad');
  return true;
}

/* 닫기·Esc = 포기. 조합이 걸려 있으면 대가가 따른다 */
function giveUpMath() {
  if (modal.mode === 'combine' && modal.pending) {
    SFX.wrong();
    lockPending('문제를 포기했어요');
  }
  closeMathAll();
  refreshAll();
}

/* 오답·시간 초과 공통 뒤처리.
 * 재도전은 골드로 산다 — 그러니 **자동으로 넘어가지 않는다.** 돈이 나가는 행동을
 * 타이머가 대신 눌러 주면 안 된다. 낼 수 없으면 거기서 관문이 끝난다. */
function afterMiss(msg) {
  streak = 0;
  modal.allClean = false;
  modal.fails = (modal.fails || 0) + 1;
  E.recordMathOutcome(state, false);
  const plan = retryPlan(modal.fails);
  if (modal.mode === 'combine' && modal.pending) {
    if (!plan || !plan.afford) {
      const why = plan
        ? `재도전에 💰${plan.price}이 필요한데 조합 골드(💰${modal.info.cost})까지는 모자라요`
        : '더 도전할 수 없어요';
      lockPending(why);
      ui.mathFeedback(false, `${msg} 여기까지! 이 조합은 이번 웨이브엔 못 해요.`, null);
      autoNext(RETRY_MS);                // 결과를 읽을 시간을 준 뒤 알아서 닫힌다
      refreshAll();
      return;
    }
    /* 답을 넣은 Enter가 그대로 흘러 재도전까지 사 버리지 않게 잠깐 잠가 둔다.
     * 골드가 나가는 버튼은 "손이 미끄러져서" 눌리면 안 된다. */
    modal.retryArmAt = performance.now() + RETRY_ARM_MS;
    ui.mathFeedback(false, `${msg} 다시 풀어 볼까요? (💰${plan.price})`,
      `🔁 다시 도전 (💰${plan.price} · Enter)`);
    refreshAll();
    return;
  }
  ui.mathFeedback(false, msg, '🔁 다시 도전 (Enter)');
  refreshAll();
}

/* 시간 초과 — 오답과 똑같이 도전 횟수를 깎는다.
 * 예전엔 시간이 지나도 무한히 새 문제가 나와서, 가만히 두는 게 전략이 될 수 있었다. */
function timeUp() {
  if (!modal.prob || ui.isAnswered()) return;
  state.timeOuts++;
  E.applyMathResult(state, false);
  SFX.timeOut();
  ui.flashHit();
  afterMiss(`⏰ 시간 초과! 정답은 ${modal.prob.answer} 이에요.`);
}

function submitMath(value) {
  if (!modal.prob || ui.isAnswered() || !String(value).trim()) return;
  modal.tries = (modal.tries || 0) + 1;
  const ok = MathGen.check(value, modal.prob.answer, modal.prob.kind);
  E.applyMathResult(state, ok);
  if (ok) {
    const clean = modal.tries === 1 && !modal.usedHint;
    E.recordMathOutcome(state, clean);       // 적응형 난이도의 원재료
    modal.allClean = modal.allClean && clean;
    modal.minLeft = Math.min(modal.minLeft, modal.timeMax ? modal.time / modal.timeMax : 0);
    if (clean) {
      streak = Math.min(D.STREAK_MAX, streak + 1);
      state.bestStreak = Math.max(state.bestStreak, streak);
      if (streak >= 2) SFX.streak(streak);
    } else streak = 0;
    SFX.correct();
    if (modal.mode === 'combine' && modal.pending) {
      const p = modal.pending;
      const firstTry = modal.allClean;
      const r = p.kind === 'rankup'
        ? E.combineRankUp(state, p.cls, Number(p.tier))
        : E.combineRecipe(state, p.result);
      if (!r.ok && r.reason === 'gold') {
        afterCorrect(`정답! 그런데 조합 골드가 부족해요 (💰${r.cost} 필요)`);
        refreshAll();
        return;
      }
      if (r.ok) {
        SFX.combine();
        const C = D.CLASSES[r.hero.cls];
        let msg = `🎉 정답! ${D.TIERS[r.hero.tier].name} ${C.name} ${C.emoji} 탄생! (💰-${r.cost})`;
        if (r.lucky) {
          msg = `🍀 럭키!! 두 등급 점프! ${D.TIERS[r.hero.tier].name} ${C.name} ${C.emoji} 탄생! (💰-${r.cost})`;
          renderer.celebrate(0x7fd45e, true);
          SFX.summon(3);
        }
        if (p.kind === 'recipe') {
          ui.toast(`📖 도감 해금! ✨ [${C.name}] ${C.desc}`, 'good');
          renderer.celebrate(0xd8b4ff, true);
        }
        if (firstTry) {
          /* ★ 빨리 푼 만큼 이 용사가 세진다 — 제한 시간을 넉넉히 준 대신,
           * 서두를 이유를 "벌"이 아니라 "상"으로 붙였다 (mathgate.js 참고).
           * 수학을 잘하면 성을 더 잘 지킨다 — 이 게임이 하려던 말이 여기서 완성된다. */
          const power = D.speedPower(modal.minLeft);
          if (power > 0) {
            E.empowerHero(r.hero, power);
            msg += ` ⚡빠른 풀이! 공격력 +${Math.round(power * 100)}%`;
            renderer.celebrate(0xffe066, false);
          }
          /* 정확 + 속도 + 연승 + 나온 난이도 = 환급. 시계를 보며 푸는 이유가 여기서 생긴다 */
          const speed = 1 + D.SPEED_BONUS_MAX * modal.minLeft;
          const sm = D.streakMul(streak);
          const cm = modal.card ? modal.card.mul : 1;
          const back = E.refundFirstTry(state, r.cost, modal.grade, speed * sm * cm);
          const tags = [`⚡속도 +${Math.round((speed - 1) * 100)}%`];
          if (Math.abs(cm - 1) > 0.01) tags.push(`🎯${mulName(cm)} ×${cm.toFixed(2)}`);
          if (sm > 1) tags.push(`🔥${streak}연승 ×${sm.toFixed(2)}`);
          msg += ` ✅ 한 번에 정답! 💰+${back} 환급 (${tags.join(' · ')})`;
          /* 센 문제가 나왔는데 한 번에 통과했을 때만 별조각 — 흔해지면 의미가 없다.
           * 판이 끝날 때까지 기다리지 않고 바로 준다: 지금 이 순간의 보상이라야 다음에도 반갑다. */
          const sh = modal.card ? modal.card.shards : 0;
          if (sh) {
            store.shards = store.shards + sh;
            state.mathShards = (state.mathShards || 0) + sh;
            SFX.shard();
            msg += ` ✨별조각 +${sh}!`;
          }
        } else {
          /* ★ 늦게 맞혔어도 0은 아니다 (mathgate.js 참고).
           * 예전엔 한 번 틀리는 순간 남는 게 "조합 성공"뿐이라, 어려운 문제 앞에서
           * 포기가 합리적인 선택이 됐다. 이제 끝까지 푼 값을 작게라도 치른다 —
           * 그리고 재도전에 쓴 골드의 절반을 돌려줘 "이미 낸 돈"이 발목을 잡지 않게 한다. */
          const cm = modal.card ? modal.card.mul : 1;
          const { back, give } = E.refundPersist(
            state, r.cost, modal.grade, cm, modal.retrySpent || 0);
          const power = D.speedPower(modal.minLeft) * D.PERSIST_POWER;
          if (power > 0.005) {
            E.empowerHero(r.hero, power);
            msg += ` 공격력 +${Math.round(power * 100)}%`;
          }
          msg += ` 💪 포기하지 않았어요! 💰+${back} 환급`;
          if (give) msg += ` · 🔁재도전 💰+${give} 반환`;
          SFX.streak(2);
          ui.toast('💪 끝까지 풀었어요! 포기했으면 하나도 못 받았을 거예요', 'good');
        }
        if (r.hero.tier >= 4) ui.toast(`🌌 신화 등급 [${C.name}] 탄생!! 최강의 용사예요!`, 'good');
        /* 영웅(2) 이상 탄생은 확실한 연출로 */
        if (r.hero.tier >= 2) {
          renderer.combineFlourish(r.pad, r.hero.tier);
          ui.flashCombine(r.hero.tier);
        }
        if (r.pad >= 0) {
          msg += ' 🎯 그 자리에 바로 배치!';
          renderer.burst((D.PADS[r.pad].x - D.FIELD_W / 2) / 36, 0.5, (D.PADS[r.pad].y - D.FIELD_H / 2) / 36, 0x7fff9e, 12, 2.4);
        }
        modal.pending = null;
        /* 전설·신화는 그림과 함께 크게 보여 준다. 예약된 자동 진행을 끄지 않으면
         * 연출 뒤에서 수학 모달이 혼자 다음 문제로 넘어가 버린다. */
        if (r.hero.tier >= 3) {
          cancelAutoNext();
          const storyKey = r.hero.tier >= 4 ? 'firstMythic' : 'firstLegend';
          playReveal(r.hero, () => playStory(storyKey, () => afterCorrect(msg)));
        } else {
          /* 여기서 pending을 비운 뒤에 afterCorrect를 부른다 —
           * 남은 조합 후보를 다시 세야 "다음 문제 / 닫기"를 옳게 고른다 */
          afterCorrect(msg);
        }
        if (r.hero.tier === 3) ui.toast(`👑 전설! [${D.LEGEND_ABILITIES[r.hero.cls].name}] ${D.LEGEND_ABILITIES[r.hero.cls].desc}`, 'good');
      } else {
        afterCorrect('정답! 그런데 조합 재료가 부족해요…');
      }
    } else {
      afterCorrect('🎉 정답!');
    }
  } else {
    SFX.wrong();
    /* 다단계 관문은 "연속"이 조건이니 처음 단계로 되돌린다 (afterMiss가 처리) */
    afterMiss(`😢 아쉬워요! 정답은 ${modal.prob.answer} 이에요.`);
    return;
  }
  refreshAll();
}

/* 응답 후 Enter/Space: 상황에 맞는 다음 행동 (연쇄 조합 → 자동 종료) */
let autoCloseToken = 0;
/* 정답을 맞혔을 때 "다음" 버튼을 누르게 하지 않는다 — 결과만 잠깐 보여 주고 스스로 넘어간다.
 * 사용자가 먼저 Enter를 누르거나 창을 닫으면 토큰이 바뀌어 예약이 무효가 된다. */
let autoNextToken = 0;
let autoNextPending = false;
function autoNext(delay) {
  const token = ++autoNextToken;
  autoNextPending = true;
  setTimeout(() => {
    if (token !== autoNextToken || !ui.isMathOpen() || !ui.isAnswered()) return;
    advanceMath();
  }, delay);
}
const cancelAutoNext = () => { autoNextToken++; autoNextPending = false; };

/* 정답을 맞히면 **거기서 끝난다. 한 번에 한 문제.**
 * ★ 예전에는 만들 수 있는 조합이 남아 있으면 곧장 다음 관문으로 이어졌다.
 *   의도는 "묻지 않는 흐름"이었는데, 실제로는 그만두려면 창을 닫아야 했고
 *   닫기는 곧 포기라서 **그 조합이 잠겼다.** 멈추고 싶을 뿐인데 벌을 받는 구조였다.
 *   이제 관문 하나를 통과하면 조용히 닫힌다. 다음 조합은 목록에서 직접 누르면 된다
 *   (C키는 그대로 — 가장 좋은 조합을 한 번에 연다). */
const CLOSE_MS = 1500;    // 닫기 — 결과(환급·별조각·공격력)를 읽을 만큼은 보여 준다
const RETRY_MS = 2600;    // 실패로 관문이 끝났을 때 — 정답을 읽을 시간
function afterCorrect(baseMsg) {
  /* 다음에 뭘 할 수 있는지만 한 줄 덧붙인다 — 자동으로 끌고 가지는 않는다 */
  const next = chooseBestCombo();
  const blocked = next ? null : E.listCombos(state).find(c => !c.affordable);
  const tail = next
    ? ' — 조합을 더 할 수 있어요 (C)'
    : (blocked ? ` — 골드가 모자라 여기까지! (다음 조합 💰${blocked.cost})` : '');
  ui.mathFeedback(true, baseMsg + tail, null);
  const token = ++autoCloseToken;
  autoNextPending = true;                // 기다리는 중 Enter = "지금 바로 닫기"
  setTimeout(() => {
    if (token === autoCloseToken && ui.isMathOpen()) closeMathAll();
  }, CLOSE_MS);
}
function closeMathAll() {
  autoCloseToken++;
  cancelAutoNext();
  ui.hideMath();
  modal.mode = null;
  modal.pending = null;
}
function chooseBestCombo() {
  const combos = E.listCombos(state).filter(c => c.affordable && !c.locked);
  if (!combos.length) return null;
  /* 가장 높은 등급을 만들 수 있는 것 우선, 동급이면 특수 레시피 우선 */
  return combos.sort((a, b) =>
    b.resultTier - a.resultTier ||
    (b.kind === 'recipe' ? 1 : 0) - (a.kind === 'recipe' ? 1 : 0)
  )[0];
}
function comboToAction(c) {
  return c.kind === 'rankup'
    ? { kind: 'rankup', cls: c.cls, tier: String(c.tier) }
    : { kind: 'recipe', result: c.result };
}
/* "다시 도전" — 유일하게 사람이 눌러야 하는 버튼이다. 골드가 나가기 때문이다. */
const RETRY_ARM_MS = 700;   // 오답 직후 이만큼은 재도전 버튼이 안 눌린다 (Enter 흘러듦 방지)
function advanceMath() {
  if (modal.retryArmAt && performance.now() < modal.retryArmAt) return;
  autoCloseToken++;
  cancelAutoNext();          // 예약된 자동 진행이 한 번 더 터져 문제를 건너뛰는 일을 막는다
  if (modal.mode !== 'combine') { newProblem(); return; }
  if (!modal.pending) { closeMathAll(); return; }       // 이미 통과했거나 잠긴 관문
  const r = E.buyRetry(state, modal.info ? modal.info.cost : 0, modal.fails);
  if (!r.ok) {
    /* afterMiss가 미리 막지만, 그 사이 골드가 줄었을 수도 있다 (동시에 성 수리 등) */
    lockPending(`재도전에 💰${r.cost}이 필요해요`);
    ui.mathFeedback(false, '골드가 모자라 여기까지! 이 조합은 이번 웨이브엔 못 해요.', null);
    autoNext(RETRY_MS);
    refreshAll();
    return;
  }
  SFX.coin();
  modal.retrySpent = (modal.retrySpent || 0) + r.cost;
  /* 낸 돈이 "날아간 돈"이 아니라 "끝까지 풀면 돌아오는 보증금"임을 그 자리에서 말해 준다 —
   * 포기 버튼 앞에서 한 번 더 붙어 보게 만드는 건 이 한 줄이다 */
  ui.toast(`🔁 재도전 (💰-${r.cost}) — 끝내 맞히면 💰${Math.round(r.cost * D.RETRY_BACK)} 돌려받아요!`, 'bad');
  newProblem();
  refreshAll();
}

/* ---------- 막간 이야기 ----------
 * 매 웨이브 띄우면 "스킵을 누르는 게임"이 된다. 초반에 몰고 뒤로 갈수록 성글게,
 * 한 판에 최대 열댓 번. 이미 본 것은 state.seenStory로 걸러진다. */
let storyResume = null;
function playStory(key, onDone = null) {
  if (store.storyOff || !Story.BEATS[key]) { if (onDone) onDone(); return false; }
  if (!state.seenStory) state.seenStory = new Set();
  if (state.seenStory.has(key)) { if (onDone) onDone(); return false; }
  state.seenStory.add(key);
  storyResume = onDone;
  ui.showStory(Story.BEATS[key]);
  SFX.tap();
  return true;
}
function closeStory() {
  ui.hideStory();
  const fn = storyResume;
  storyResume = null;
  if (fn) fn();
}

/* ---------- 전설·신화 탄생 연출 ----------
 * 수학 모달이 아직 열려 있는 상태에서 그 위에 덮인다.
 * 예약된 자동 진행을 반드시 끄고, 닫힐 때 원래 흐름을 이어 준다. */
let revealResume = null;
function playReveal(hero, onDone) {
  if (store.storyOff) { onDone(); return; }
  if (!state.revealed) state.revealed = new Set();
  const key = `${hero.cls}:${hero.tier}`;
  const short = state.revealed.has(key);       // 두 번째부터는 짧게
  state.revealed.add(key);
  const C = D.CLASSES[hero.cls];
  const T = D.TIERS[hero.tier];
  const ab = hero.tier >= 4 ? (D.MYTHIC_ABILITIES && D.MYTHIC_ABILITIES[hero.cls])
                            : (D.LEGEND_ABILITIES && D.LEGEND_ABILITIES[hero.cls]);
  revealResume = onDone;
  ui.showReveal({
    tierName: T.name, tierColor: T.color, name: C.name, emoji: C.emoji,
    desc: ab ? `[${ab.name}] ${ab.desc}` : C.desc,
    art: heroPortrait(hero.cls, hero.tier), short,
  });
  SFX.summon(hero.tier);
  renderer.celebrate(hero.tier >= 4 ? 0xd8b4ff : 0xffd93d, true);
  clearTimeout(revealTimer);
  revealTimer = setTimeout(closeReveal, short ? 1200 : 3200);
}
let revealTimer = null;
function closeReveal() {
  clearTimeout(revealTimer);
  if (!ui.isRevealOpen()) return;
  ui.hideReveal();
  const fn = revealResume;
  revealResume = null;
  if (fn) fn();
}

/* ---------- 액션 ---------- */
function doSummon() {
  const r = E.summon(state);
  if (!r.ok) {
    if (r.reason === 'gold') ui.toast('골드가 부족해요! 몬스터를 잡으면 골드가 들어와요 ⚔️', 'bad');
    else if (r.reason === 'bench') ui.toast('벤치가 가득 찼어요! 배치하거나 조합해 보세요.', 'bad');
    return;
  }
  SFX.summon(r.hero.tier);
  const C = D.CLASSES[r.hero.cls], T = D.TIERS[r.hero.tier];
  /* 등급이 높을수록 화려하게 */
  renderer.summonBurst(r.hero.tier);
  ui.summonReveal(r.hero, r.hero.tier);
  ui.toast(`${T.name} 등급 ${C.name} ${C.emoji} 등장!`, r.hero.tier >= 2 ? 'good' : '');
  if (r.hero.tier === 3) ui.toast(`👑 전설! [${D.LEGEND_ABILITIES[r.hero.cls].name}] ${D.LEGEND_ABILITIES[r.hero.cls].desc}`, 'good');
  refreshAll();
}

function doPlace(padIndex) {
  /* 이미 용사가 있는 자리를 골랐다면 "거기 놓고 싶다"는 뜻이다 — 거절하지 말고 자리를 바꾼다.
   * 벤치 ↔ 필드 교환이라 벤치 수가 그대로여서 벤치가 가득 차 있어도 항상 된다. */
  const occ = E.padOccupant(state, padIndex);
  if (occ) {
    const s = E.swapBenchWithPad(state, selBench, padIndex);
    if (!s.ok) return;
    SFX.place();
    padFx(s.placed, 0x9fdcff);
    ui.toast(`🔀 ${D.CLASSES[s.placed.cls].name} 배치 · ${D.CLASSES[s.benched.cls].name}은 벤치로!`);
    deselectAll();      // 배치가 끝나면 선택도 끝 — 다음 클릭이 또 뭔가를 옮기지 않게
    refreshAll();
    return;
  }
  const r = E.placeHero(state, selBench, padIndex);
  if (!r.ok) return;
  SFX.place();
  renderer.burst((r.hero.x - D.FIELD_W / 2) / 36, 0.5, (r.hero.y - D.FIELD_H / 2) / 36, 0x7fff9e, 10, 2.2);
  deselectAll();
  refreshAll();
}

/* 배치된 용사 선택 — 선택하면 빈 발판(초록)과 다른 용사 자리(파랑)가 함께 빛난다 */
function selectField(hero) {
  if (hero) setSellMode(false);        // 배치/이동을 시작하면 판매 모드는 끝
  selBench = null;
  selHero = hero ? hero.id : null;
  renderer.setSelectedHero(selHero);
  renderer.setPlacementMode(!!hero, hero ? D.CLASSES[hero.cls].range : 0, true);
  ui.renderBench(state, null, sellMode ? sellSel : null);
  ui.renderHeroPanel(state, selHero);
  if (hero) { ui.showHeroTab(); SFX.tap(); }
  else ui.restoreTab();
}

const padFx = (h, color) =>
  renderer.burst((h.x - D.FIELD_W / 2) / 36, 0.5, (h.y - D.FIELD_H / 2) / 36, color, 8, 2);

/* 이동 — 목적지에 용사가 있으면 "자리 교환"이 된다 (회수 없이 진형만 바꾼다).
 * 한 번 움직이면 선택을 푼다 — 선택이 남아 있으면 다음 클릭이
 * 의도치 않은 이동/교환이 돼서 "누를 때마다 자리가 바뀌는" 불편이 생긴다. */
function doMove(padIndex) {
  const occ = E.padOccupant(state, padIndex);
  if (occ && occ.id !== selHero) {
    const r = E.swapHeroes(state, selHero, occ.id);
    if (!r.ok) return;
    SFX.place();
    padFx(r.a, 0x9fdcff);
    padFx(r.b, 0x9fdcff);
    ui.toast(`🔀 ${D.CLASSES[r.a.cls].name} ↔ ${D.CLASSES[r.b.cls].name} 자리를 바꿨어요!`);
    deselectAll();
    refreshAll();
    return;
  }
  const r = E.moveHero(state, selHero, padIndex);
  if (!r.ok) return;
  SFX.place();
  padFx(r.hero, 0x9fdcff);
  deselectAll();
  refreshAll();
}

/* ---------- 끌어서 옮기기 / 자리 바꾸기 ---------- */
let dragId = null;
function onDragStart(cx, cy) {
  if (state.phase === 'over') return false;
  const pad = renderer.screenToPad(cx, cy);
  if (pad == null) return false;
  const hero = E.padOccupant(state, pad);
  if (!hero) return false;
  dragId = hero.id;
  selectField(hero);
  return true;
}
function onDragMove(cx, cy) {
  renderer.setHover(renderer.screenToPad(cx, cy));
}
function onDragEnd(cx, cy) {
  const id = dragId;
  dragId = null;
  renderer.setHover(null);
  if (id == null || selHero !== id || cx == null) return;   // cx == null: 드래그 취소
  const pad = renderer.screenToPad(cx, cy);
  const hero = state.field.find(h => h.id === id);
  if (pad == null || !hero || pad === hero.padIndex) return;   // 제자리에 놓으면 그냥 선택만
  doMove(pad);
}

function doRecall(heroId) {
  const r = E.recallHero(state, heroId);
  if (!r.ok) { ui.toast('벤치가 가득 차서 회수할 수 없어요!', 'bad'); return; }
  SFX.tap();
  if (selHero === heroId) { selHero = null; renderer.setSelectedHero(null); renderer.setPlacementMode(false); }
  ui.toast('↩ 용사를 벤치로 회수했어요.');
  refreshAll();
}

/* ---------- 저장 / 불러오기 (간단한 파일 하나) ----------
 * 저장 = 준비 단계 스냅샷을 JSON으로 내려받기, 불러오기 = 그 파일을 다시 열기.
 * 별조각·최고 기록은 원래 localStorage에 있으니 파일에는 "이번 판"만 담는다. */
function saveGame() {
  if (state.phase === 'wave') {
    ui.toast('⚔️ 전투 중에는 저장할 수 없어요 — 웨이브를 끝내고 눌러 주세요!', 'bad');
    return;
  }
  if (state.phase === 'over') {
    ui.toast('끝난 판은 저장할 수 없어요 — 새로 시작한 뒤에 저장해요', 'bad');
    return;
  }
  const data = E.serialize(state);
  data.grade = grade;                  // 문제 학년은 화면 설정이라 엔진 밖에서 얹는다
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `용사수학디펜스_${state.wave}웨이브_${D.DIFFICULTIES[state.difficulty].name}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  SFX.tap();
  ui.toast(`💾 ${state.wave}웨이브 준비 상태를 파일로 저장했어요!`, 'good');
}

function loadGame(data) {
  const next = data ? E.deserialize(data) : null;
  if (!next) {
    ui.toast('😢 저장 파일을 읽을 수 없어요 — 이 게임에서 저장한 파일이 맞는지 확인해 주세요', 'bad');
    return false;
  }
  gameOverToken++;                     // 예약된 게임오버 연출이 불러온 판을 덮지 않게
  state = next;
  if (Number.isFinite(data.grade) && data.grade >= 3 && data.grade <= 6) {
    grade = data.grade;
    ui.setGradeActive(grade);
  }
  store.diff = state.difficulty;
  selBench = null;
  selHero = null;
  streak = 0;
  overHandled = false;
  sellMode = false;
  sellSel.clear();
  renderer.setPlacementMode(false);
  renderer.setSelectedHero(null);
  renderer.setHover(null);
  ui.hideOver();
  refreshAll();
  music.setWave(state.wave);
  SFX.tap();
  ui.toast(`📂 불러왔어요! ${state.wave}웨이브 준비부터 이어서 시작해요`, 'good');
  autoSave();                          // 이어하기도 이 지점을 가리키게
  return true;
}

/* ---------- 자동 저장 ----------
 * 웨이브가 끝날 때마다 준비 단계 스냅샷을 브라우저(localStorage)에 남긴다.
 * 직렬화는 그 순간(상태가 확실한 준비 단계일 때) 바로 하고, 실제 쓰기는
 * 한가할 때로 미뤄 웨이브 클리어 연출 프레임을 방해하지 않는다.
 * 단 requestIdleCallback은 숨은 탭에서 무기한 미뤄질 수 있어 timeout을 걸고,
 * 탭이 가려지거나 닫힐 때는 그 자리에서 flush한다 — "곧 쓸게"가 유실이 되면 안 된다.
 * 성이 함락되면 슬롯을 지운다 — 끝난 판은 이어하기 대상이 아니다. */
const idle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 400 })
  : (fn) => setTimeout(fn, 60);
let pendingAutosave = null;
function flushAutosave() {
  if (!pendingAutosave) return;
  store.autosave = pendingAutosave;
  pendingAutosave = null;
}
function autoSave() {
  if (state.phase !== 'prep') return;
  const data = E.serialize(state);
  data.grade = grade;
  data.savedAt = Date.now();
  pendingAutosave = data;
  idle(flushAutosave);
}
window.addEventListener('pagehide', flushAutosave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushAutosave();
});

function handleEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'enemyHit':
        if (ev.kind === 'hit') SFX.hit(ev.x);
        else if (ev.kind === 'crit') SFX.crit(ev.x);
        break;
      case 'block': SFX.block(ev.x); break;
      case 'kill':
        if (ev.boss) {
          SFX.bossDown(true);
          ui.toast(`🎉 대보스 ${ev.name}를 물리쳤어요!! 💰${ev.gold}`, 'good');
        } else if (ev.midBoss) {
          SFX.bossDown(false);
          ui.toast(`👊 중간보스 ${ev.name} 격파! 💰${ev.gold}`, 'good');
        } else {
          SFX.kill(ev.x); SFX.coin();
        }
        if (ev.mul > 1 && (ev.combo === D.COMBO.x2At || ev.combo === D.COMBO.x3At)) SFX.combo(ev.mul);
        break;
      case 'shoot':
        if (ev.kind === 'arrow') SFX.shoot(ev.x);
        else if (ev.kind === 'orb') SFX.orb(ev.x);
        else SFX.bolt(ev.x);
        break;
      case 'explode': SFX.explode(ev.x); break;
      case 'castleHit':
        if (state.castleHp > 0 && state.castleHp / state.castleMax <= 0.3) {
          setTimeout(() => { if (state.phase !== 'over') playStory('castleHurt'); }, 400);
        }
        SFX.castleHit();
        ui.flashHit();
        break;
      case 'bossWarn':
        SFX.bossWarn(ev.tier === 'great');
        ui.bossWarn(ev.tier, ev.name, ev.emoji);
        break;
      case 'bossSpawn':
        if (ev.tier === 'great') SFX.bossRoar();
        else SFX.midBossRoar();
        ui.showBossBanner(ev.tier, ev.name, ev.emoji);
        break;
      case 'bossEnrage':
        SFX.bossEnrage();
        ui.showEnrage(ev.name);
        break;
      case 'waveEnd':
        SFX.waveClear();
        ui.toast(`🎉 ${ev.wave}웨이브 클리어! 보너스 💰${ev.bonus}`, 'good');
        autoSave();                      // 매 웨이브가 이어하기 지점이 된다
        refreshAll();
        /* 클리어 토스트/효과음과 겹치지 않게 살짝 늦춘다. 준비 단계라 시뮬레이션 손실은 없다 */
        {
          const key = Story.beatForWave(ev.wave);
          if (key) setTimeout(() => playStory(key), 700);
        }
        break;
      case 'gameOver': onGameOver(); break;
    }
  }
}

let gameOverToken = 0;
function onGameOver() {
  if (overHandled) return;
  overHandled = true;
  SFX.gameOver();
  music.stop();
  pendingAutosave = null;              // 쓰기 대기 중이던 스냅샷도 되살아나면 안 된다
  store.autosave = null;               // 함락된 판은 이어하기에서 지운다
  store.shards = store.shards + state.shardsEarned;
  const best = store.best(state.difficulty);
  if (state.wave > best) store.setBest(state.difficulty, state.wave);
  /* 900ms 연출 대기 중에 사용자가 Enter로 새 게임을 시작할 수 있다.
   * 가드가 없으면 새 판 위에 게임오버 화면이 뒤늦게 덮인다. */
  const overToken = ++gameOverToken;
  setTimeout(() => {
    if (overToken !== gameOverToken || state.phase !== 'over') return;
    SFX.shard();
    ui.showOver(state);
    ui.updateHud(state, store.shards, store.best(state.difficulty));
  }, 900);
}

/* ---------- UI 바인딩 ---------- */
const handlers = {
  onWaveStart() { tryStartWave(); },
  onSummon: doSummon,
  onCombine(action) { openMath('combine', action); },
  /* 조합 재료가 모자랄 때 "그 용사 뽑으러 가기" — 소환은 무작위라 약속은 못 하지만,
   * 적어도 무엇을 해야 하는지는 분명해진다. */
  onNeedHero(cls) {
    const C = D.CLASSES[cls];
    if (state.gold < D.SUMMON_COST) {
      ui.toast(`${C.emoji} ${C.name}를 뽑으려면 💰${D.SUMMON_COST}이 필요해요 — 몬스터를 잡아 모아요 ⚔️`, 'bad');
      return;
    }
    ui.showTab('bench');
    ui.toast(`${C.emoji} ${C.name}를 노려요! S키(또는 소환 버튼)로 뽑아 보세요`, '');
    doSummon();
  },
  onSpeed() {
    speed = speed === 1 ? 2 : 1;
    ui.setSpeedLabel(speed);
    SFX.tap();
  },
  onToggleSfx() {
    toggleSfx();
    ui.setSoundLabels(isSfxMuted(), isMusicMuted());
    if (!isSfxMuted()) SFX.tap();
  },
  onToggleBgm() {
    toggleMusic();
    ui.setSoundLabels(isSfxMuted(), isMusicMuted());
    music.sync();
  },
  onGrade(g) { grade = g; SFX.tap(); },
  onDiff(d) {
    if (!(state.phase === 'prep' && state.wave === 1)) return;
    store.diff = d;
    newGame(d);
    ui.toast(`${D.DIFFICULTIES[d].emoji} ${D.DIFFICULTIES[d].name} 난이도로 시작!`);
  },
  onBenchSelect(id) {
    SFX.tap();
    if (selBench === id) {
      selBench = null;
      selHero = null;
      renderer.setPlacementMode(false);
      ui.restoreTab();
    } else {
      ui.showHeroTab();
      selBench = id;
      selHero = id;
      const hero = state.bench.find(h => h.id === id);
      /* 세 번째 인자 = 교환 모드: 찬 자리도 후보(파랑)로 표시된다 */
      renderer.setPlacementMode(true, hero ? D.CLASSES[hero.cls].range : 0, true);
      renderer.setSelectedHero(null);
    }
    ui.renderBench(state, selBench);
    ui.renderHeroPanel(state, selHero);
  },
  /* 배치된 용사를 고른 뒤 —
   *   빈 발판 클릭    → 회수 없이 이동
   *   다른 용사 클릭  → 두 용사의 자리 교환 (끌어다 놓기와 같은 결과)
   *   같은 용사 클릭  → 선택 해제
   * 다른 용사의 정보만 보고 싶을 땐 마우스를 올리면 툴팁이 뜬다. */
  onSceneClick(cx, cy) {
    const pad = renderer.screenToPad(cx, cy);
    if (pad == null) { deselectAll(); return; }
    if (selBench != null) { doPlace(pad); return; }
    const hero = E.padOccupant(state, pad);
    const onField = selHero != null && state.field.some(h => h.id === selHero);
    if (onField) {
      if (hero && hero.id === selHero) { deselectAll(); return; }
      doMove(pad);
      return;
    }
    selectField(hero);
  },
  onSceneRightClick(cx, cy) {
    const pad = renderer.screenToPad(cx, cy);
    if (pad == null) return;
    const hero = E.padOccupant(state, pad);
    if (!hero) return;
    doRecall(hero.id);
  },
  onSceneMove(cx, cy) {
    if (cx == null) { renderer.setHover(null); ui.hideTooltip(); return; }
    const pad = renderer.screenToPad(cx, cy);
    renderer.setHover(pad);
    /* 배치된 용사에 마우스를 올리면 상세 정보 */
    const hero = pad == null ? null : E.padOccupant(state, pad);
    if (hero) {
      if (hoverHeroId !== hero.id) {
        hoverHeroId = hero.id;
        ui.showTooltip(hero, state, cx, cy);
      } else ui.moveTooltip(cx, cy);
    } else if (hoverHeroId != null) {
      hoverHeroId = null;
      ui.hideTooltip();
    }
  },
  onHint() {
    if (!modal.prob || ui.isAnswered()) return;   // 이미 답이 나온 뒤엔 힌트가 의미가 없다 — 골드만 날아간다
    /* ★ 두 번 틀리면 힌트가 공짜다 (mathgate.js 참고).
     * 막힌 사람에게 남은 선택지가 "포기"뿐이면 포기한다 — 그보다 나은 출구를 연다.
     * 힌트를 보면 환급은 여전히 줄지만, 끝까지 푼 값(refundPersist)은 그대로 받는다. */
    if ((modal.fails || 0) >= D.FREE_HINT_AFTER) {
      modal.usedHint = true;
      SFX.tap();
      ui.showHint(modal.prob.hint);
      ui.toast('💡 두 번 틀렸으니 힌트는 공짜예요 — 포기하지 말고 끝까지!', 'good');
      return;
    }
    /* 힌트를 사서 조합 골드가 모자라지면, 정답을 맞히고도 아무것도 못 얻는다.
     * 문제를 다 풀고 나서야 "골드가 부족해요"를 보는 건 제일 나쁜 결말이라 미리 막는다. */
    const need = modal.info ? modal.info.cost : 0;
    if (need && state.gold - D.HINT_GOLD < need) {
      ui.toast(`힌트(💰${D.HINT_GOLD})를 사면 조합 골드가 모자라요 — 조합에 💰${need} 필요 (지금 💰${state.gold})`, 'bad');
      return;
    }
    const r = E.useHint(state);
    if (!r.ok) { ui.toast(`힌트에는 💰${r.cost}이 필요해요!`, 'bad'); return; }
    modal.usedHint = true;
    SFX.tap();
    ui.showHint(modal.prob.hint);
    ui.toast(`💡 힌트를 봤어요 (💰-${r.cost}) — 환급은 없어요`, 'bad');
    refreshAll();
  },
  onRecall() { doRecall(selHero); },
  onSell() {
    const r = E.sellHero(state, selHero);
    if (!r.ok) return;
    SFX.coin();
    ui.toast(`용사를 보내주고 💰${r.price}을 받았어요.`);
    selHero = null;
    renderer.setSelectedHero(null);
    refreshAll();
  },
  /* --- 여러 명 판매 --- */
  onSellMode() { setSellMode(!sellMode); SFX.tap(); },
  onSellToggle(id) {
    if (!sellSel.delete(id)) sellSel.add(id);
    SFX.tap();
    ui.renderBench(state, null, sellSel);
    ui.renderSellBar(state, true, sellSel);
  },
  onSellAll() {
    const all = state.bench.length > 0 && state.bench.every(h => sellSel.has(h.id));
    sellSel.clear();
    if (!all) for (const h of state.bench) sellSel.add(h.id);
    SFX.tap();
    ui.renderBench(state, null, sellSel);
    ui.renderSellBar(state, true, sellSel);
  },
  onSellGo() {
    const picked = state.bench.filter(h => sellSel.has(h.id));
    if (!picked.length) { ui.toast('팔 용사를 골라 주세요 — 카드를 누르면 선택돼요', 'bad'); return; }
    let total = 0;
    for (const h of picked) {
      const r = E.sellHero(state, h.id);
      if (r.ok) total += r.price;
    }
    sellSel.clear();
    SFX.coin();
    ui.toast(`💰 용사 ${picked.length}명을 보내주고 ${total} 골드를 받았어요.`, 'good');
    if (!state.bench.length) setSellMode(false);   // 다 팔았으면 모드도 끝
    refreshAll();
  },
  onSave: saveGame,
  onLoad: loadGame,
  /* --- 시작 메뉴 (자동 저장이 있을 때만 뜬다) --- */
  onContinue() {
    ui.hideStart();
    SFX.tap();
    /* 자동 저장이 깨져 있으면 이미 준비된 새 게임을 그대로 진행한다 */
    if (!loadGame(store.autosave)) playStory('prologue');
  },
  onStartNew() {
    ui.hideStart();
    SFX.tap();
    playStory('prologue');             // 새 게임은 boot에서 이미 만들어져 있다
  },
  onCastle(key) {
    const r = E.castleUpgrade(state, key);
    if (!r.ok) {
      if (r.reason === 'gold') ui.toast('골드가 부족해요!', 'bad');
      return;
    }
    SFX.upgrade();
    /* 강화한 순간을 눈으로 보여 준다 — 숫자만 오르면 뭐가 달라졌는지 모른다 */
    if (key !== 'repair') renderer.castleUpgradeFx(key);
    const lv = key === 'repair' ? 0 : state.castle[key];
    const NOTE = {
      fortify: ['성벽이 높아졌어요!', '흉벽이 늘었어요!', '방어 말뚝을 박았어요!', '성문이 강철문이 됐어요!', '성벽이 대리석으로 빛나요!'],
      tower: ['마법 포탑이 솟았어요!', '포탑이 하나 더!', '마법진이 성을 감쌌어요!'],
    };
    const note = NOTE[key] && NOTE[key][lv - 1];
    ui.toast(`${D.CASTLE_UPGRADES[key].emoji} ${D.CASTLE_UPGRADES[key].name} 완료!${note ? ' ' + note : ''}`, 'good');
    refreshAll();
  },
  onMetaOpen() {
    ui.renderMeta(store.shards, store.meta);
    ui.showMeta();
    SFX.tap();
  },
  onMetaBuy(key) {
    const M = D.META_UPGRADES[key];
    const levels = store.meta;
    const lv = levels[key] || 0;
    if (lv >= M.max) return;
    const cost = M.cost(lv);
    if (store.shards < cost) return;
    store.shards = store.shards - cost;
    levels[key] = lv + 1;
    store.meta = levels;
    SFX.shard();
    ui.toast(`🌟 ${M.name} Lv${lv + 1}! 다음 게임부터 적용돼요.`, 'good');
    ui.renderMeta(store.shards, store.meta);
    ui.updateHud(state, store.shards, store.best(state.difficulty));
  },
  onRestart() {
    SFX.tap();
    newGame(store.diff);
  },
  onShare() { ui.makeShareCard(state, store.best(state.difficulty)); },
  onDragStart, onDragMove, onDragEnd,
  onMathSubmit: submitMath,
  onMathNext: advanceMath,
  onMathClose: giveUpMath,
  onDemoToggle() { demo.toggle(); SFX.tap(); },
  onStoryClose: closeStory,
  onStoryOff() { store.storyOff = true; ui.toast('이야기를 끄었어요. 다시 보려면 새로고침 후 설정에서…', 'bad'); closeStory(); },
  onRevealClose: closeReveal,
};
ui.bind(handlers);

/* ---------- 키보드 조작 (전 기능) ---------- */
let kbPad = null;                     // 키보드 배치 커서

/* ←→로 훑을 발판 목록 — 자기 자리만 빼고 전부다.
 * 빈 발판에서 Enter는 배치/이동, 찬 발판에서 Enter는 자리 교환이 된다.
 * 빈 곳만 훑게 하면 "저 자리랑 바꾸고 싶다"는 조작을 키보드로는 못 하게 된다. */
function padCandidates() {
  const self = selBench == null && selHero != null
    ? state.field.find(h => h.id === selHero)
    : null;
  const all = D.PADS.map((_, i) => i);
  return self ? all.filter(i => i !== self.padIndex) : all;
}

function cyclePad(dir) {
  const cand = padCandidates();
  if (!cand.length) return;
  if (kbPad == null || !cand.includes(kbPad)) kbPad = cand[0];
  else kbPad = cand[(cand.indexOf(kbPad) + dir + cand.length) % cand.length];
  renderer.setHover(kbPad);
}

function cycleBench(dir) {
  if (!state.bench.length) { ui.toast('벤치가 비어 있어요. S키로 소환해 보세요!', 'bad'); return; }
  setSellMode(false);                  // Tab으로 배치를 시작하면 판매 모드는 끝
  let idx = state.bench.findIndex(h => h.id === selBench);
  idx = (idx + dir + state.bench.length) % state.bench.length;
  const hero = state.bench[idx];
  selBench = hero.id;
  selHero = hero.id;
  renderer.setPlacementMode(true, D.CLASSES[hero.cls].range, true);
  renderer.setSelectedHero(null);
  if (kbPad == null) cyclePad(1);
  else renderer.setHover(kbPad);
  ui.renderBench(state, selBench);
  ui.renderHeroPanel(state, selHero);
  SFX.tap();
}

function deselectAll() {
  selBench = null;
  selHero = null;
  kbPad = null;
  renderer.setPlacementMode(false);
  renderer.setSelectedHero(null);
  renderer.setHover(null);
  ui.renderBench(state, selBench, sellMode ? sellSel : null);
  ui.renderHeroPanel(state, null);
  ui.restoreTab();
}

/* 필드 용사 순환 선택 (F키) — 회수 없이 이동/강화 대상 고르기 */
function cycleField(dir) {
  if (!state.field.length) { ui.toast('배치된 용사가 없어요.', 'bad'); return; }
  const sorted = [...state.field].sort((a, b) => a.padIndex - b.padIndex);
  let idx = sorted.findIndex(h => h.id === selHero);
  idx = (idx + dir + sorted.length) % sorted.length;
  selectField(sorted[idx]);
  kbPad = null;
}

function setGradeKey(g) {
  grade = g;
  ui.setGradeActive(g);
  SFX.tap();
}

function tryStartWave() {
  if (ui.isStoryOpen() || ui.isRevealOpen()) return;   // 연출 중에 웨이브가 몰래 시작되지 않게
  const quip = store.storyOff ? null : Story.waveQuip(state.wave);
  if (quip) setTimeout(() => ui.toast(`📣 ${quip}`), 260);
  const r = E.startWave(state);
  if (!r.ok) return;
  SFX.waveStart();
  music.setWave(state.wave);
  ui.toast(`🌊 ${state.wave}웨이브 시작! 몬스터를 막아요!`);
  if (r.boss) ui.toast('⚠️ 대보스가 지름길로 돌진하는 웨이브예요!', 'bad');
  ui.setWaveUI(state);
}

/* 버튼 클릭 후 Space가 그 버튼을 다시 누르지 않도록 포커스 해제 */
document.addEventListener('click', (ev) => {
  if (ev.target instanceof HTMLButtonElement) ev.target.blur();
});

/* 한글 IME 상태에서도 단축키가 통하도록 매핑 */
const KO = { 'ㄴ': 's', 'ㅔ': 'p', 'ㅊ': 'c', 'ㅂ': 'q', 'ㄱ': 'r', 'ㅌ': 'x', 'ㅗ': 'h', 'ㅡ': 'm', 'ㄹ': 'f' };

document.addEventListener('keydown', (ev) => {
  let key = ev.key;
  if (KO[key]) key = KO[key];
  const lower = key.length === 1 ? key.toLowerCase() : key;

  /* --- 시작 메뉴 (이어하기 / 처음부터) --- */
  if (ui.isStartOpen()) {
    if (key === 'Escape') { ev.preventDefault(); ui.el.newGameBtn.click(); }
    return;               // Enter/Space는 포커스된 버튼이 알아서 처리한다
  }

  /* --- 전설·신화 연출: 아무 키나 눌러 넘긴다 (수학 모달보다 위) --- */
  if (ui.isRevealOpen()) {
    ev.preventDefault();
    closeReveal();
    return;
  }

  /* --- 막간 이야기 --- */
  if (ui.isStoryOpen()) {
    if (key === 'Escape' || key === 'Enter' || key === ' ') { ev.preventDefault(); closeStory(); }
    return;                       // 나머지 키는 삼킨다 — 뒤에서 웨이브가 몰래 시작되면 안 된다
  }

  /* --- 수학 모달 --- */
  if (ui.isMathOpen()) {
    if (key === 'Escape') { ev.preventDefault(); giveUpMath(); return; }
    if (ui.isAnswered() && (key === 'Enter' || key === ' ')) {
      ev.preventDefault();
      /* 자동 진행을 기다리는 중이면 Enter는 "기다리지 말고 지금" 이라는 뜻이다 */
      const canAdvance = autoNextPending || !ui.el.mNext.classList.contains('hidden');
      if (canAdvance) advanceMath();
      else closeMathAll();
      return;
    }
    /* 아직 답을 안 냈는데 Enter가 여기까지 왔다 = 포커스가 입력창 밖에 있다는 뜻.
     * (확인 버튼·힌트 버튼을 클릭했거나 모달 배경을 눌렀을 때 그렇게 된다)
     * 예전엔 여기서 그냥 return 해서 "답을 썼는데 Enter가 안 먹는" 상태가 됐다.
     * 입력창이 이벤트를 먼저 처리했다면 stopPropagation 때문에 여기 오지 않으므로 중복 제출도 없다.
     * isComposing: 한글 IME 조합을 확정하는 Enter는 제출이 아니다. */
    if (!ui.isAnswered() && key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      submitMath(ui.el.mInput.value);
      ui.el.mInput.focus();
      return;
    }
    /* 문제창은 효과음이 제일 많이 나는 화면이다 — 여기서 소리를 못 끄면 끌 방법이 없다.
     * 입력창에 답을 쓰는 중에는 'm'이 글자일 수 있으니 입력이 비었을 때만 받는다. */
    if (lower === 'm' && (document.activeElement !== ui.el.mInput || ui.el.mInput.value === '')) {
      ev.preventDefault();
      const off = toggleAll();
      ui.setSoundLabels(isSfxMuted(), isMusicMuted());
      ui.toast(off ? '🔇 소리를 모두 껐어요 (M)' : '🔊 소리를 다시 켰어요 (M)');
      return;
    }
    if (lower === 'h' && !ui.isAnswered() && !ui.el.mHintBtn.disabled) {
      if (document.activeElement !== ui.el.mInput || ui.el.mInput.value === '') {
        ev.preventDefault();
        ui.el.mHintBtn.click();
      }
    }
    return;   // 나머지 키는 입력창으로
  }

  /* --- 별의 축복 모달 --- */
  if (ui.isMetaOpen()) {
    if (key === 'Escape' || key === 'Enter') { ev.preventDefault(); ui.hideMeta(); return; }
    const n = Number(key);
    if (n >= 1 && n <= 4) {
      const btns = ui.el.metaRows.querySelectorAll('button');
      if (btns[n - 1] && !btns[n - 1].disabled) btns[n - 1].click();
    }
    return;
  }

  /* --- 게임 오버 --- */
  if (state.phase === 'over') {
    if (key === 'Enter' || key === ' ') { ev.preventDefault(); SFX.tap(); newGame(store.diff); }
    return;
  }

  /* --- 게임 화면 --- */
  switch (key) {
    case ' ':
    case 'Enter': {
      ev.preventDefault();
      const onField = selHero != null && state.field.some(h => h.id === selHero);
      if (selBench != null && kbPad != null) {
        const pad = kbPad;
        kbPad = null;
        renderer.setHover(null);
        doPlace(pad);
      } else if (onField && kbPad != null) {
        doMove(kbPad);                      // 배치된 용사를 골라둔 발판으로 이동
      } else if (state.phase === 'prep') {
        tryStartWave();
      }
      return;
    }
    case 'Escape':
      if (sellMode) { setSellMode(false); return; }
      deselectAll();
      return;
    case 'Tab':
      ev.preventDefault();
      cycleBench(ev.shiftKey ? -1 : 1);
      return;
    case 'ArrowLeft':
    case 'ArrowUp':
      if (selBench != null || selHero != null) { ev.preventDefault(); cyclePad(-1); }
      return;
    case 'ArrowRight':
    case 'ArrowDown':
      if (selBench != null || selHero != null) { ev.preventDefault(); cyclePad(1); }
      return;
  }
  switch (lower) {
    case 's': doSummon(); return;
    case 'c': {
      const combo = chooseBestCombo();
      if (combo) openMath('combine', comboToAction(combo));
      else {
        const unpaid = E.listCombos(state).find(c => !c.affordable);
        ui.toast(unpaid
          ? `조합 골드가 부족해요! (💰${unpaid.cost} 필요) 몬스터를 잡아 모아 보세요 ⚔️`
          : '지금 가능한 조합이 없어요. 용사를 더 모아 보세요!', 'bad');
      }
      return;
    }
    case 'd': demo.toggle(); SFX.tap(); return;
    case 'm': {
      const off = toggleAll();
      ui.setSoundLabels(isSfxMuted(), isMusicMuted());
      music.sync();
      ui.toast(off ? '🔇 소리를 모두 껐어요 (M)' : '🔊 소리를 다시 켰어요 (M)');
      return;
    }
    case 'q':
      speed = speed === 1 ? 2 : 1;
      ui.setSpeedLabel(speed);
      SFX.tap();
      return;
    case 'f': cycleField(1); return;
    case 'r': if (selHero != null && !ui.el.recallBtn.classList.contains('hidden')) ui.el.recallBtn.click(); return;
    case 'x': if (selHero != null) ui.el.sellBtn.click(); return;
    case '3': case '4': case '5': case '6': setGradeKey(Number(lower)); return;
    case '7': ui.el.castleRows.querySelector('button[data-key="repair"]')?.click(); return;
    case '8': ui.el.castleRows.querySelector('button[data-key="fortify"]')?.click(); return;
    case '9': ui.el.castleRows.querySelector('button[data-key="tower"]')?.click(); return;
  }
});

/* ---------- 게임 루프 ---------- */
function isPaused() {
  /* 이야기는 준비 단계에만 뜨므로 멈출 게 없지만, 전설 연출은 전투 중에도 뜬다 */
  return ui.isMathOpen() || ui.isMetaOpen() || ui.isRevealOpen() || state.phase === 'over';
}

const STEP = 1 / 60;          // 고정 시뮬레이션 타임스텝
const MAX_STEPS = 8;          // 프레임당 최대 캐치업 (낮은 fps 대비)
let lastT = performance.now();
let simAcc = 0;
let bootT = performance.now();
let frameCount = 0;
/* 폰은 lite 로 이미 결정된 것으로 친다 — 실측해서 high 로 올릴 이유가 없다 */
let gfxDecided = store.gfx != null || urlGfx != null || isMobile;

function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min((now - lastT) / 1000, 0.5);
  lastT = now;
  frameCount++;

  /* 그래픽 자동 품질: 시작 4초 후부터 3초간 실측 fps */
  if (!gfxDecided) {
    const elapsed = (now - bootT) / 1000;
    if (elapsed > 4) {
      if (!frame._fpsStart) { frame._fpsStart = now; frame._fpsFrames = 0; }
      frame._fpsFrames++;
      const win = (now - frame._fpsStart) / 1000;
      if (win > 3) {
        gfxDecided = true;
        const avg = frame._fpsFrames / win;
        const q = avg < 45 ? 'lite' : 'high';
        store.gfx = q;
        if (q === 'lite') { renderer.setQuality('lite'); ui.toast('⚙️ 부드러운 화면을 위해 그래픽을 조절했어요.'); }
        /* lite 로 낮춰도 안 되는 기기: 배경 장식까지 접는다.
         * 지형과 카메라가 같이 바뀌는 일이라 실행 중엔 못 바꾸고 다음 실행부터다. */
        if (avg < 26 && renderer.decor) {
          store.decorOff = true;
          ui.toast('⚙️ 다음에 켤 때는 배경을 더 가볍게 할게요.');
        }
      }
    }
  }

  /* 제한 시간 — 전투는 멈춰 있어도 시계는 흐른다. 문제창의 유일한 압박 장치.
   * 카드를 고르는 동안은 흐르지 않는다: 고르는 시간까지 재면 안 읽고 찍게 된다. */
  if (ui.isMathOpen() && modal.prob && !ui.isAnswered()) {
    const prev = modal.time;
    modal.time = Math.max(0, modal.time - realDt);
    ui.setTimer(modal.time, modal.timeMax);
    if (modal.time <= 10 && Math.ceil(modal.time) !== Math.ceil(prev)) SFX.tick(modal.time <= 3);
    if (modal.time <= 0) timeUp();
  }

  /* 데모는 시뮬레이션이 멈춰 있어도 돌아야 문제창을 처리할 수 있다 */
  if (demo.active) demo.step(realDt);

  if (!isPaused()) {
    /* 고정 타임스텝: fps가 낮아도 게임 속도는 유지 */
    simAcc = Math.min(simAcc + realDt * speed, STEP * MAX_STEPS);
    while (simAcc >= STEP) {
      simAcc -= STEP;
      const events = E.tick(state, STEP);
      if (events.length) {
        renderer.onEvents(state, events);
        handleEvents(events);
      }
      if (isPaused()) { simAcc = 0; break; }
    }
    /* 저체력 심장박동 */
    const ratio = state.castleMax ? state.castleHp / state.castleMax : 1;
    if (ratio < 0.3 && state.phase === 'wave') {
      ui.setLowHp(true);
      heartbeatT -= realDt * speed;
      if (heartbeatT <= 0) { heartbeatT = 1.0; SFX.heartbeat(); }
    } else {
      ui.setLowHp(false);
    }
  }

  /* 보스 상태 → 음악/분위기/체력바 */
  const greatBoss = state.enemies.find(e => e.boss && !e.dead);
  const midBoss = greatBoss ? null : state.enemies.find(e => e.midBoss && !e.dead);
  const bossLevel = greatBoss ? 2 : (midBoss ? 1 : 0);
  renderer.setBossMode(bossLevel);
  ui.setBossAtmosphere(state.phase === 'wave' ? bossLevel : 0);

  if (!isMusicMuted()) {
    if (state.phase === 'wave') {
      music.setTrack(greatBoss ? 'boss' : (midBoss ? 'midboss' : 'battle'));
    } else if (state.phase === 'prep') music.setTrack('prep');
  }

  /* UI 갱신 */
  ui.updateHud(state, store.shards, store.best(state.difficulty));
  ui.setWaveUI(state);
  ui.comboChip(state.combo.count, state.combo.count >= D.COMBO.x3At ? 3 : state.combo.count >= D.COMBO.x2At ? 2 : 1);
  const barBoss = greatBoss || midBoss;
  ui.setBossBar(barBoss ? {
    ratio: barBoss.hp / barBoss.maxHp,
    name: barBoss.name,
    emoji: D.ENEMY_TYPES[barBoss.type].emoji,
    great: !!barBoss.boss,
    enraged: !!barBoss.enraged,
  } : null);
  panelT += realDt;
  if (panelT > 0.35) {           // 골드 변동에 따른 버튼 활성화 갱신
    panelT = 0;
    ui.renderCastlePanel(state);
    if (selHero != null) ui.renderHeroPanel(state, selHero);
  }

  renderer.sync(state);
  renderer.frame(isPaused() ? 0 : realDt * speed, state);
}

/* ---------- 시작 ----------
 * 자동 저장이 있으면 "이어하기 / 처음부터"를 먼저 묻는다.
 * 데모 링크(?demo=)는 구경이 목적이니 메뉴 없이 바로 시작한다. */
const bootSave = (() => {
  if (urlParams.has('demo')) return null;
  const s = store.autosave;
  return s && Number.isFinite(s.wave) && Array.isArray(s.bench) ? s : null;
})();
newGame(store.diff, { holdStory: !!bootSave });
if (bootSave) ui.showStart(bootSave);
ui.setSoundLabels(isSfxMuted(), isMusicMuted());
ui.setSpeedLabel(speed);
ui.coachChip();
requestAnimationFrame(frame);

/* 첫 사용자 입력에서 오디오 잠금 해제 */
window.addEventListener('pointerdown', () => { music.sync(); }, { once: true });

/* 폰트를 미리 받아 둔다.
 * 브라우저는 "화면에 실제로 그려질 때"만 폰트를 내려받는다. 그냥 두면 ① 첫 문제창이 열리는
 * 순간 기본 폰트로 그려졌다가 바뀌고(아이가 문제를 읽는 바로 그 타이밍에 깜빡인다)
 * ② 3D 캔버스에 그리는 글자는 아예 폴백 폰트로 구워져 텍스처에 박힌다. */
if (document.fonts && document.fonts.load) {
  Promise.all([
    document.fonts.load('16px Jua', '용사 수학 디펜스'),
    document.fonts.load('700 27px Gaegu', '0123456789 문제'),
  ]).catch(() => {});
}

/* ---------- 데모 배선 ----------
 * 데모에게 게임 내부를 열어 주지 않는다. 사람이 누르는 것과 같은 함수만 넘긴다 —
 * 그래야 "데모에서만 되는" 또는 "데모에서만 안 되는" 버그가 안 생긴다. */
demo.attach({
  getState: () => state,
  isStoryOpen: () => ui.isStoryOpen(),
  isRevealOpen: () => ui.isRevealOpen(),
  isMathOpen: () => ui.isMathOpen(),
  isAnswered: () => ui.isAnswered(),
  getProblem: () => modal.prob,
  closeStory,
  summon: doSummon,
  place(heroId, pad) { selBench = heroId; doPlace(pad); },
  openCombine(action) { openMath('combine', action); },
  castle(key) { handlers.onCastle(key); },
  startWave: tryStartWave,
  newGame: () => newGame(store.diff),
  typeAnswer(v) { ui.el.mInput.value = v; submitMath(v); },
  comboLabel: (c) => (c.kind === 'rankup'
    ? `${D.CLASSES[c.cls].name} ${D.TIERS[c.resultTier].name}`
    : `${D.CLASSES[c.result].name}`),
  heroLabel: (h) => `${D.TIERS[h.tier].name} ${D.CLASSES[h.cls].name}`,
  onCaption: (text) => ui.setDemoCaption(text),
  /* 프로필마다 푸는 학년이 다르다(초보 3 · 고수 6). 데모가 끝나면 사람이 고른 학년으로 되돌린다 */
  onStart(profile, P) {
    if (P && P.grade) {
      if (gradeBeforeDemo == null) gradeBeforeDemo = grade;
      grade = P.grade;
      ui.setGradeActive(grade);
    }
    ui.setDemoMode(true, profile);
    setSellMode(false);
    deselectAll();
    ui.restoreTab();
  },
  onStop() {
    if (gradeBeforeDemo != null) {
      grade = gradeBeforeDemo;
      gradeBeforeDemo = null;
      ui.setGradeActive(grade);
    }
    ui.setDemoMode(false);
    setSellMode(false);
    deselectAll();
  },
});

/* ?demo=고수 로 열면 바로 시작. 콘솔에서는 __game.demo.start('보통') */
if (urlParams.has('demo')) {
  setTimeout(() => demo.start(urlParams.get('demo') || '고수'), 900);
}

/* 디버그 훅 (자동 검증/테스트용) */
window.__game = {
  get state() { return state; },
  get modal() { return modal; },
  E, D, renderer, ui, MathGen, SFX, demo,
  env: { isMobile, decor: useDecor, quality: renderer.quality },
  sfxCore: { getAc, getMaster, isSfxMuted, isMusicMuted },
  refresh: refreshAll,
  selectHero(id) { selHero = id; renderer.setSelectedHero(id); ui.renderHeroPanel(state, id); },
  gold(n) { state.gold += n; refreshAll(); },
  jump(w) { state.wave = w; refreshAll(); },
  hurt(n) { state.castleHp = Math.max(0, state.castleHp - n); if (state.castleHp <= 0) { state.phase = 'over'; state.shardsEarned = D.shardReward(state.wave, state.bossKills); onGameOver(); } },
};
