/* =====================================================
 * GameAnalytics 통합 모듈
 * =====================================================
 * 대시보드(https://gameanalytics.com)에서 발급받은 Game Key와 Secret Key를 아래 세팅하십시오.
 * 키를 세팅하지 않아도 테스트 모드로 콘솔 로깅되며 게임이 멈추지 않습니다.
 * ===================================================== */
import GameAnalytics from 'gameanalytics';
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
        console.warn('[Analytics] GameAnalytics Key가 설정되지 않았습니다. src/analytics.js 의 GA_CONFIG 에 키를 입력하면 실제 데이터가 전송됩니다.');
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
        GameAnalytics.EGAProgressionStatus.Start,
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
        GameAnalytics.EGAProgressionStatus.Start,
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
        GameAnalytics.EGAProgressionStatus.Complete,
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
        GameAnalytics.EGAProgressionStatus.Fail,
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
        GameAnalytics.EGAProgressionStatus.Complete,
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
        debug: GameAnalytics.EGAErrorSeverity.Debug,
        info: GameAnalytics.EGAErrorSeverity.Info,
        warning: GameAnalytics.EGAErrorSeverity.Warning,
        error: GameAnalytics.EGAErrorSeverity.Error,
        critical: GameAnalytics.EGAErrorSeverity.Critical,
      }[severity] || GameAnalytics.EGAErrorSeverity.Error;

      GameAnalytics.addErrorEvent(gaSeverity, message);
    }
  }
};

export default Analytics;
