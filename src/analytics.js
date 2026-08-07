/* =====================================================
 * GameAnalytics 통합 모듈
 * =====================================================
 * 키는 GitHub Secrets(GA_GAME_KEY / GA_SECRET_KEY)에 두고 CI가 analytics.config.js 로 주입한다.
 * 로컬 config 는 키를 비워 둔다 — 채우면 커밋 대상인 dist/game.js 에 키가 박힌다.
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

    try {
      GameAnalytics.configureBuild(GA_CONFIG.build);

      // 키가 입력되어 있으면 실제 GA 서비스로 수집, 없으면 개발/개발자용 로깅 안내
      if (GA_CONFIG.gameKey && GA_CONFIG.secretKey) {
        GameAnalytics.initialize(GA_CONFIG.gameKey, GA_CONFIG.secretKey);
        initialized = true;
        console.log('[Analytics] GameAnalytics initialized successfully!');
      } else {
        console.warn('[Analytics] Key 없음 — 콘솔 로깅만 합니다. 실제 수집은 CI 빌드(GitHub Secrets)에서 이뤄집니다.');
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
