/* =====================================================
 * GameAnalytics 통합 모듈
 * =====================================================
 * 키는 analytics.config.js 에 커밋해 둔다 (웹 SDK 특성상 배포본에 노출될 수밖에 없는 값).
 * 내 대시보드로 보낼지 말지는 아래 COLLECT_HOSTS 게이트가 실행 위치를 보고 정한다.
 * 키가 없어도 테스트 모드로 콘솔 로깅되며 게임이 멈추지 않습니다.
 * ===================================================== */
// default export 는 gaCommand — 문자열 명령을 받는 *함수*라서 .configureBuild 같은 메서드가 없다.
// 이걸 객체로 착각해 쓰면 첫 호출에서 TypeError 가 나고, catch 에 잡혀 조용히 수집이 꺼진다
// (에러는 콘솔에만 남고 게임은 멀쩡히 돌아가서 알아채기 어렵다). enum 은 클래스가 아니라
// 네임스페이스에 붙어 있으므로 GameAnalytics.EGA* 가 아니라 여기서 함께 꺼내 쓴다.
import { gameanalytics } from 'gameanalytics';
const { GameAnalytics, EGAProgressionStatus, EGAErrorSeverity } = gameanalytics;
import { GA_CONFIG } from './analytics.config.js';

export { GA_CONFIG };

/* 수집을 허용할 실행 위치.
 * fork 방어의 핵심 — 키를 숨기는 걸로는 fork 를 못 막는다. fork 는 복호화 코드까지
 * 통째로 가져가므로 난독화/암호화도 무의미하고, 막히는 건 스크래퍼뿐이다.
 * 반면 "어디서 돌고 있는가"는 fork 가 자기 도메인으로 옮기는 순간 반드시 달라진다.
 * 커스텀 도메인을 붙이면 여기에 추가할 것. */
const COLLECT_HOSTS = ['hakhyun-kim.github.io'];

/* 안드로이드 앱은 Capacitor 가 localhost 로 띄우므로 호스트명으로는 로컬 개발과
 * 구분되지 않는다. 그렇다고 window.Capacitor 존재 여부로 가르면 안 된다 —
 * Capacitor 코어는 웹 빌드에도 shim 을 심어서 브라우저에서도 객체가 존재한다
 * (getPlatform() === 'web'). 실제로 네이티브인지를 물어야 한다. */
function isCollectingOrigin() {
  if (typeof window === 'undefined') return false;
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
  return COLLECT_HOSTS.includes(window.location.hostname);
}

let initialized = false;

export const Analytics = {
  /**
   * GameAnalytics SDK를 초기화합니다.
   */
  init(customKeys = {}) {
    if (customKeys.gameKey) GA_CONFIG.gameKey = customKeys.gameKey;
    if (customKeys.secretKey) GA_CONFIG.secretKey = customKeys.secretKey;
    if (customKeys.build) GA_CONFIG.build = customKeys.build;

    if (!GA_CONFIG.enabled) return;

    // fork·미러·로컬 개발의 트래픽이 대시보드에 섞이지 않게 한다 (수집 자체를 시작하지 않는다)
    if (!isCollectingOrigin()) {
      console.log('[Analytics] 이 실행 위치는 수집 대상이 아닙니다 — 콘솔 로깅만 합니다.');
      return;
    }

    // 키를 붙여넣을 때 딸려 오는 공백 하나로 HMAC 서명이 틀려져 이벤트가 전부 거부된다.
    // 눈에 보이지 않고 콘솔에도 "초기화 성공"이 찍히므로 원인을 찾기 어렵다 — 여기서 막는다.
    GA_CONFIG.gameKey = (GA_CONFIG.gameKey || '').trim();
    GA_CONFIG.secretKey = (GA_CONFIG.secretKey || '').trim();

    try {
      GameAnalytics.configureBuild(GA_CONFIG.build);

      // 키가 입력되어 있으면 실제 GA 서비스로 수집, 없으면 개발/개발자용 로깅 안내
      if (GA_CONFIG.gameKey && GA_CONFIG.secretKey) {
        GameAnalytics.initialize(GA_CONFIG.gameKey, GA_CONFIG.secretKey);
        initialized = true;
        console.log('[Analytics] GameAnalytics initialized successfully!');
      } else {
        console.warn('[Analytics] Key 없음 — 콘솔 로깅만 합니다. src/analytics.config.js 에 키를 넣으세요.');
      }
    } catch (e) {
      console.error('[Analytics] Failed to initialize GameAnalytics:', e);
    }
  },

  /**
   * 새 게임 시작 추적
   */
  trackGameStart(difficulty = 'normal', loop = 0) {
    console.log(`[Analytics Event] GameStart - diff:${difficulty}, loop:${loop}`);
    if (initialized) {
      GameAnalytics.addProgressionEvent(
        EGAProgressionStatus.Start,
        `Difficulty_${difficulty}`,
        `Loop_${loop}`
      );
    }
  },

  /**
   * 웨이브 시작 추적
   */
  trackWaveStart(wave, difficulty = 'normal') {
    console.log(`[Analytics Event] WaveStart - Wave_${wave}`);
    if (initialized) {
      GameAnalytics.addProgressionEvent(
        EGAProgressionStatus.Start,
        `Difficulty_${difficulty}`,
        `Wave_${wave}`
      );
    }
  },

  /**
   * 웨이브 클리어 추적
   */
  trackWaveComplete(wave, difficulty = 'normal', score = 0) {
    console.log(`[Analytics Event] WaveComplete - Wave_${wave}, score:${score}`);
    if (initialized) {
      GameAnalytics.addProgressionEvent(
        EGAProgressionStatus.Complete,
        `Difficulty_${difficulty}`,
        `Wave_${wave}`,
        null,
        score
      );
    }
  },

  /**
   * 게임 실패 (게임 오버) 추적
   */
  trackGameFail(wave, difficulty = 'normal', score = 0) {
    console.log(`[Analytics Event] GameFail - Wave_${wave}, score:${score}`);
    if (initialized) {
      GameAnalytics.addProgressionEvent(
        EGAProgressionStatus.Fail,
        `Difficulty_${difficulty}`,
        `Wave_${wave}`,
        null,
        score
      );
    }
  },

  /**
   * 최종 승리 (30 웨이브 클리어)
   */
  trackGameVictory(difficulty = 'normal', loop = 0, shards = 0) {
    console.log(`[Analytics Event] GameVictory - diff:${difficulty}, loop:${loop}, shards:${shards}`);
    if (initialized) {
      GameAnalytics.addProgressionEvent(
        EGAProgressionStatus.Complete,
        `Difficulty_${difficulty}`,
        `Victory_Loop_${loop}`,
        null,
        shards
      );
    }
  },

  /**
   * 수학 문제 결과 추적
   * @param {number} grade 학년 (3~6)
   * @param {string} label 문제 유형 라벨 (예: "덧셈", "두 자릿수 곱셈")
   * @param {boolean} ok 정답 여부
   * @param {boolean} clean 한 번에 맞혔는지 여부
   */
  trackMathResult(grade, label, ok, clean) {
    const cleanLabel = (label || 'General').replace(/[^a-zA-Z0-9_]/g, '_');
    const outcome = ok ? (clean ? 'FirstTryCorrect' : 'Correct') : 'Wrong';
    const eventId = `Math:Grade_${grade}:${cleanLabel}:${outcome}`;

    console.log(`[Analytics Event] ${eventId}`);
    if (initialized) {
      GameAnalytics.addDesignEvent(eventId);
    }
  },

  /**
   * 커스텀 이벤트 (용사 조합, 소환, 성 강화 등)
   */
  trackDesignEvent(eventId, value) {
    console.log(`[Analytics Event] Design - ${eventId}${value !== undefined ? ` : ${value}` : ''}`);
    if (initialized) {
      if (value !== undefined) {
        GameAnalytics.addDesignEvent(eventId, value);
      } else {
        GameAnalytics.addDesignEvent(eventId);
      }
    }
  },

  /**
   * 에러 추적
   */
  trackError(severity, message) {
    if (initialized) {
      const gaSeverity = {
        debug: EGAErrorSeverity.Debug,
        info: EGAErrorSeverity.Info,
        warning: EGAErrorSeverity.Warning,
        error: EGAErrorSeverity.Error,
        critical: EGAErrorSeverity.Critical,
      }[severity] || EGAErrorSeverity.Error;

      GameAnalytics.addErrorEvent(gaSeverity, message);
    }
  }
};

export default Analytics;
