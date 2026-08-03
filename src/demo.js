/* =====================================================
 * 데모 모드 — AI가 게임을 실제로 플레이하는 것을 구경한다
 *
 * dungeon100의 시연은 하드코딩된 각본이지만, 이 게임은 이미
 * 밸런스 봇이라는 "제대로 판단하는 뇌"를 갖고 있다. 그래서 데모는
 * 각본을 따르지 않고 **봇의 판단(src/bot.js)을 그대로 써서 진짜로 논다.**
 * 덕분에 각본을 유지보수할 필요가 없고, 게임이 바뀌면 데모도 따라 바뀐다.
 *
 * 조작은 전부 사람이 쓰는 경로로 흘린다(doSummon·doPlace·openMath·submitMath…).
 * 데모 전용 지름길을 만들면 데모에서만 되는 버그가 생긴다.
 * ===================================================== */
import * as Bot from './bot.js';

/* 사람이 보기 좋은 속도. 너무 빠르면 뭘 하는지 안 보이고, 느리면 지루하다 */
const PACE = {
  prep: 0.55,        // 준비 단계 행동 사이 (초)
  answer: 1.5,       // 문제가 뜨고 답을 넣기까지 — 문제를 읽을 시간
  afterWave: 1.2,    // 웨이브를 깬 뒤 숨 고르기
  restart: 4.0,      // 게임오버 후 다시 시작까지
};

export const demo = {
  active: false,
  profileName: '고수',
  t: 0,              // 다음 행동까지 남은 시간
  midT: 0,           // 전투 중 판단 주기
  api: null,
  caption: '',

  /* main.js가 자기 함수들을 넘겨 준다 — 데모는 게임 내부를 직접 만지지 않는다 */
  attach(api) { this.api = api; },

  /* 링크로 공유될 때 한글이 인코딩돼 깨질 수 있으니 영문 별칭도 받는다 */
  resolveProfile(name) {
    if (!name) return null;
    if (Bot.PROFILES[name]) return name;
    const alias = { novice: '초보', beginner: '초보', easy: '초보',
                    normal: '보통', mid: '보통',
                    expert: '고수', pro: '고수', hard: '고수' };
    return alias[String(name).toLowerCase()] || null;
  },

  start(profileName) {
    if (!this.api) return false;
    const p = this.resolveProfile(profileName);
    if (p) this.profileName = p;
    this.active = true;
    this.t = 0.6;
    this.midT = 0;
    this.api.onStart(this.profileName, Bot.PROFILES[this.profileName]);
    this.say(`🎬 데모 — ${this.profileName} 플레이어가 대신 플레이합니다`);
    return true;
  },

  stop() {
    if (!this.active) return;
    this.active = false;
    this.api.onStop();
  },

  toggle(profileName) { this.active ? this.stop() : this.start(profileName); },

  say(text) {
    this.caption = text;
    if (this.api) this.api.onCaption(text);
  },

  /* 매 프레임 호출된다. 게임 시뮬레이션이 모달로 멈춰 있어도 이건 돌아야
   * 문제창을 처리할 수 있다 — 그래서 main.js의 isPaused() 바깥에 붙는다. */
  step(dt) {
    if (!this.active || !this.api) return;
    const A = this.api;
    const state = A.getState();
    const P = Bot.PROFILES[this.profileName];
    this.t -= dt;

    /* ① 막간 이야기가 떠 있으면 읽고 넘긴다 (이야기가 열려 있으면 웨이브가 시작되지 않는다) */
    if (A.isStoryOpen()) {
      if (this.t <= 0) { A.closeStory(); this.t = 0.5; }
      return;
    }
    /* ② 전설·신화 연출은 스스로 닫히므로 기다리기만 한다 */
    if (A.isRevealOpen()) return;

    /* ③ 문제창 — 답을 넣는다. 봇은 동전을 던지지만 여기선 실제 정답을 타이핑한다 */
    if (A.isMathOpen()) {
      if (A.isAnswered()) return;              // 채점 결과 표시 중 (자동으로 다음으로 간다)
      /* ③-1 카드 세 장 중 하나를 고른다 — 사람이 누르는 그 버튼을 그대로 누른다 */
      if (A.isCardOpen()) {
        if (this.t <= 0) {
          const cards = A.getCards();
          const i = Bot.pickCardIndex(P, cards.length || 3, state.rng || Math.random);
          const c = cards[i];
          this.say(`🃏 ${c ? `${c.label} (${c.lv}단계)` : '문제'} 카드를 고릅니다`);
          A.pickCard(i);
          this.t = PACE.answer;
        }
        return;
      }
      if (this.t <= 0) {
        const prob = A.getProblem();
        if (prob) {
          const ans = Bot.answerFor(prob, P, state.rng || Math.random);
          A.typeAnswer(ans);
          this.t = PACE.answer;
        } else {
          this.t = 0.3;
        }
      }
      return;
    }

    /* ④ 게임오버 — 잠깐 보여 주고 새 판 */
    if (state.phase === 'over') {
      if (this.t <= 0) {
        this.say(`🎬 ${state.wave}웨이브에서 성이 무너졌어요 — 다시 시작합니다`);
        A.newGame();
        this.t = 1.0;
      } else if (this.t > PACE.restart) {
        this.t = PACE.restart;
      }
      return;
    }

    /* ⑤ 준비 단계 — 봇의 판단을 하나씩 소비한다 */
    if (state.phase === 'prep') {
      if (this.t > 0) return;
      const act = Bot.nextPrepAction(state, P, state.rng || Math.random);
      if (!act) {
        this.say(`⚔️ ${state.wave}웨이브 시작!`);
        A.startWave();
        this.t = 0.8;
        return;
      }
      this.doAction(act, state);
      this.t = PACE.prep;
      return;
    }

    /* ⑥ 전투 중 — 여유 골드로 소환·배치 (고수 프로필만) */
    this.midT -= dt;
    if (this.midT <= 0) {
      this.midT = 2;
      const act = Bot.midWaveAction(state, P);
      if (act) this.doAction(act, state);
      else {
        const h = Bot.benchOrder(state)[0];
        if (h) {
          const pad = Bot.pickPad(state, h, P.sloppy || 0, state.rng || Math.random);
          if (pad != null) this.doAction({ type: 'place', heroId: h.id, pad, hero: h }, state);
        }
      }
    }
  },

  doAction(act, state) {
    const A = this.api;
    switch (act.type) {
      case 'summon':
        this.say('🎲 용사를 소환합니다');
        A.summon();
        break;
      case 'combine': {
        const name = A.comboLabel(act.combo);
        this.say(`⚗️ ${name} 조합 — 수학 문제를 풉니다`);
        A.openCombine(act.action);
        break;
      }
      case 'place':
        this.say(`📍 ${A.heroLabel(act.hero)}를 좋은 자리에 배치`);
        A.place(act.heroId, act.pad);
        break;
      case 'castle':
        this.say(`🏰 성을 강화합니다 (${act.key})`);
        A.castle(act.key);
        break;
    }
  },
};
