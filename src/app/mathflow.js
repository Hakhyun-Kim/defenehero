/* =====================================================
 * 수학 관문 흐름 — 이 게임의 심장.
 * 문제 난이도는 "지금 하려는 조합"이 정한다:
 *   희귀 등급업(⭐) … 신화 조합(⭐⭐⭐⭐⭐).
 * 여기에 제한 시간 · 연승 · 난이도 뽑기(환급 배수)를 얹어 긴장감을 만든다.
 *
 * main.js가 createMathFlow(ctx)로 조립한다.
 *   ctx = { getState, getGrade, ui, renderer, store, refreshAll, playStory, playReveal,
 *           onMathDone?, onHeroBorn? }   ← 수학 성장 기록·도감·업적 훅 (main이 데모 여부를 거른다)
 * getState/getGrade가 함수인 이유: 새 게임/불러오기가 state를 통째로 갈아끼운다.
 * ===================================================== */
import * as D from '../data.js';
import * as E from '../engine.js';
import * as MathGen from '../math.js';
import { SFX } from '../sfx.js';

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

/* 환급 배수에 붙는 이름 — 슬롯 번호가 아니라 **배수 자체**를 설명한다. */
const mulName = (mul) => (mul > 1 ? '센 문제' : '순한 문제');

const CLOSE_MS = 1500;      // 닫기 — 결과(환급·별조각·공격력)를 읽을 만큼은 보여 준다
const RETRY_MS = 2600;      // 실패로 관문이 끝났을 때 — 정답을 읽을 시간
const RETRY_ARM_MS = 700;   // 오답 직후 이만큼은 재도전 버튼이 안 눌린다 (Enter 흘러듦 방지)

export function createMathFlow(ctx) {
  const { ui, renderer, store } = ctx;
  const modal = { mode: null, pending: null, prob: null };
  let streak = 0;               // 연속 "한 번에 정답" 횟수 (지혜 연승)
  let autoCloseToken = 0;
  let autoNextToken = 0;
  let autoNextPending = false;

  /* 지금 pending이 가리키는 조합의 실제 정보(비용/결과 등급)를 엔진에서 가져온다 */
  function comboInfo(pending) {
    if (!pending) return null;
    const combos = E.listCombos(ctx.getState());
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
    const state = ctx.getState();
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
    modal.grade = ctx.getGrade();
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
    startProblem(MathGen.gen(modal.grade, modal.lv, { ctx: ctx.getState() }), pop);
  }

  function startProblem(prob, pop = false) {
    const state = ctx.getState();
    modal.prob = prob;
    modal.tries = 0;
    modal.usedHint = false;                // 힌트는 문제마다 새로 산다
    modal.hintStep = 0;                    // 힌트 단계 (0 → 전략 → 실마리)
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
      hintPrice: D.hintCost(modal.lv),
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
      afford: D.canRetry(ctx.getState().gold, cost, nextFails),
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
    E.lockCombo(ctx.getState(), E.comboKey(p));
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
    ctx.refreshAll();
  }

  /* 오답·시간 초과 공통 뒤처리.
   * 재도전은 골드로 산다 — 그러니 **자동으로 넘어가지 않는다.** 돈이 나가는 행동을
   * 타이머가 대신 눌러 주면 안 된다. 낼 수 없으면 거기서 관문이 끝난다. */
  function afterMiss(msg) {
    streak = 0;
    modal.allClean = false;
    modal.fails = (modal.fails || 0) + 1;
    E.recordMathOutcome(ctx.getState(), false);
    const plan = retryPlan(modal.fails);
    if (modal.mode === 'combine' && modal.pending) {
      if (!plan || !plan.afford) {
        const why = plan
          ? `재도전에 💰${plan.price}이 필요한데 조합 골드(💰${modal.info.cost})까지는 모자라요`
          : '더 도전할 수 없어요';
        lockPending(why);
        ui.mathFeedback(false, `${msg} 여기까지! 이 조합은 이번 웨이브엔 못 해요.`, null);
        autoNext(RETRY_MS);                // 결과를 읽을 시간을 준 뒤 알아서 닫힌다
        ctx.refreshAll();
        return;
      }
      /* 답을 넣은 Enter가 그대로 흘러 재도전까지 사 버리지 않게 잠깐 잠가 둔다.
       * 골드가 나가는 버튼은 "손이 미끄러져서" 눌리면 안 된다. */
      modal.retryArmAt = performance.now() + RETRY_ARM_MS;
      ui.mathFeedback(false, `${msg} 다시 풀어 볼까요? (💰${plan.price})`,
        `🔁 다시 도전 (💰${plan.price} · Enter)`);
      ctx.refreshAll();
      return;
    }
    ui.mathFeedback(false, msg, '🔁 다시 도전 (Enter)');
    ctx.refreshAll();
  }

  /* 시간 초과 — 오답과 똑같이 도전 횟수를 깎는다.
   * 예전엔 시간이 지나도 무한히 새 문제가 나와서, 가만히 두는 게 전략이 될 수 있었다. */
  function timeUp() {
    if (!modal.prob || ui.isAnswered()) return;
    const state = ctx.getState();
    state.timeOuts++;
    E.applyMathResult(state, false);
    if (ctx.onMathDone) ctx.onMathDone(modal.grade, modal.prob.label, false, false);
    SFX.timeOut();
    ui.flashHit();
    afterMiss(`⏰ 시간 초과! 정답은 ${modal.prob.answer} 이에요.`);
  }

  function submitMath(value) {
    if (!modal.prob || ui.isAnswered() || !String(value).trim()) return;
    const state = ctx.getState();
    modal.tries = (modal.tries || 0) + 1;
    const ok = MathGen.check(value, modal.prob.answer, modal.prob.kind);
    E.applyMathResult(state, ok);
    if (ctx.onMathDone) {
      ctx.onMathDone(modal.grade, modal.prob.label, ok, ok && modal.tries === 1 && !modal.usedHint);
    }
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
          ctx.refreshAll();
          return;
        }
        if (r.ok) {
          SFX.combine();
          if (ctx.onHeroBorn) ctx.onHeroBorn(r.hero);
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
            ctx.playReveal(r.hero, () => ctx.playStory(storyKey, () => afterCorrect(msg)));
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
      afterMiss(`😢 아쉬워요! 정답은 ${modal.prob.answer} 이에요.`);
      return;
    }
    ctx.refreshAll();
  }

  /* 정답을 맞혔을 때 "다음" 버튼을 누르게 하지 않는다 — 결과만 잠깐 보여 주고 스스로 넘어간다.
   * 사용자가 먼저 Enter를 누르거나 창을 닫으면 토큰이 바뀌어 예약이 무효가 된다. */
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
  function afterCorrect(baseMsg) {
    const state = ctx.getState();
    /* 다음에 뭘 할 수 있는지만 한 줄 덧붙인다 — 자동으로 끌고 가지는 않는다 */
    const next = E.bestCombo(state);
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

  /* "다시 도전" — 유일하게 사람이 눌러야 하는 버튼이다. 골드가 나가기 때문이다. */
  function advanceMath() {
    if (modal.retryArmAt && performance.now() < modal.retryArmAt) return;
    autoCloseToken++;
    cancelAutoNext();          // 예약된 자동 진행이 한 번 더 터져 문제를 건너뛰는 일을 막는다
    if (modal.mode !== 'combine') { newProblem(); return; }
    if (!modal.pending) { closeMathAll(); return; }       // 이미 통과했거나 잠긴 관문
    const state = ctx.getState();
    const r = E.buyRetry(state, modal.info ? modal.info.cost : 0, modal.fails);
    if (!r.ok) {
      /* afterMiss가 미리 막지만, 그 사이 골드가 줄었을 수도 있다 (동시에 성 수리 등) */
      lockPending(`재도전에 💰${r.cost}이 필요해요`);
      ui.mathFeedback(false, '골드가 모자라 여기까지! 이 조합은 이번 웨이브엔 못 해요.', null);
      autoNext(RETRY_MS);
      ctx.refreshAll();
      return;
    }
    SFX.coin();
    modal.retrySpent = (modal.retrySpent || 0) + r.cost;
    /* 낸 돈이 "날아간 돈"이 아니라 "끝까지 풀면 돌아오는 보증금"임을 그 자리에서 말해 준다 —
     * 포기 버튼 앞에서 한 번 더 붙어 보게 만드는 건 이 한 줄이다 */
    ui.toast(`🔁 재도전 (💰-${r.cost}) — 끝내 맞히면 💰${Math.round(r.cost * D.RETRY_BACK)} 돌려받아요!`, 'bad');
    newProblem();
    ctx.refreshAll();
  }

  /* ---------- 힌트 ----------
   * ★ 두 단계로 판다: ① 전략만 ② 정답 실마리(자릿수·첫 숫자).
   *   한 덩어리로 주면 사는 순간 문제가 끝나 버려서, 힌트를 사는 게 곧 포기가 된다.
   *   값은 난이도가 오를수록 내려간다 — 어려운 문제일수록 도움이 싸야 한다.
   *   두 번 틀리면 남은 단계가 전부 공짜: 막힌 사람에게 포기 말고 다른 출구를 준다. */
  function hint() {
    if (!modal.prob || ui.isAnswered()) return;   // 이미 답이 나온 뒤엔 힌트가 의미가 없다 — 골드만 날아간다
    const state = ctx.getState();
    const steps = modal.prob.hintSteps || [modal.prob.hint];
    const step = modal.hintStep || 0;
    if (step >= steps.length) return;             // 더 줄 게 없다
    const free = (modal.fails || 0) >= D.FREE_HINT_AFTER;
    const price = D.hintCost(modal.lv);
    if (!free) {
      /* 힌트를 사서 조합 골드가 모자라지면, 정답을 맞히고도 아무것도 못 얻는다.
       * 문제를 다 풀고 나서야 "골드가 부족해요"를 보는 건 제일 나쁜 결말이라 미리 막는다. */
      const need = modal.info ? modal.info.cost : 0;
      if (need && state.gold - price < need) {
        ui.toast(`힌트(💰${price})를 사면 조합 골드가 모자라요 — 조합에 💰${need} 필요 (지금 💰${state.gold})`, 'bad');
        return;
      }
      const r = E.useHint(state, price);
      if (!r.ok) { ui.toast(`힌트에는 💰${r.cost}이 필요해요!`, 'bad'); return; }
    }
    modal.hintStep = step + 1;
    /* 실마리(2단계)까지 봤을 때만 "한 번에 맞힘" 자격을 잃는다 —
     * 전략만 보고 스스로 계산해 낸 것은 제 힘으로 푼 것이다. */
    if (step + 1 >= steps.length) modal.usedHint = true;
    SFX.tap();
    ui.showHint(steps.slice(0, step + 1),
      modal.hintStep < steps.length ? { free, price } : null);
    if (free) ui.toast('💡 두 번 틀렸으니 힌트는 공짜예요 — 포기하지 말고 끝까지!', 'good');
    else if (step === 0) ui.toast(`💡 풀이 방법을 봤어요 (💰-${price}) — 아직 환급은 살아 있어요!`);
    else ui.toast(`💡 정답 실마리까지 봤어요 (💰-${price}) — 환급은 없어요`, 'bad');
    ctx.refreshAll();
  }

  /* 제한 시간 — 전투는 멈춰 있어도 시계는 흐른다. 문제창의 유일한 압박 장치.
   * 카드를 고르는 동안은 흐르지 않는다: 고르는 시간까지 재면 안 읽고 찍게 된다.
   * (매 프레임 main의 루프가 부른다) */
  function tickTimer(realDt) {
    if (!ui.isMathOpen() || !modal.prob || ui.isAnswered()) return;
    const prev = modal.time;
    modal.time = Math.max(0, modal.time - realDt);
    ui.setTimer(modal.time, modal.timeMax);
    if (modal.time <= 10 && Math.ceil(modal.time) !== Math.ceil(prev)) SFX.tick(modal.time <= 3);
    if (modal.time <= 0) timeUp();
  }

  return {
    modal,
    openMath, submitMath, advanceMath, giveUpMath, closeMathAll,
    hint, tickTimer, cancelAutoNext,
    resetStreak: () => { streak = 0; },
    autoPending: () => autoNextPending,
  };
}
