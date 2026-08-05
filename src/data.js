/* =====================================================
 * 게임 데이터 / 밸런스 정의 — 배럴(barrel)
 *
 * 실제 내용은 src/balance/ 아래 6개 파일로 나뉘어 있다.
 * 이 파일은 경로와 이름을 그대로 유지하기 위한 재수출 지점일 뿐이다.
 *
 * ▸ 왜 이 파일이 남아 있나
 *   engine.js · render3d.js · ui.js · main.js 와 scripts/ 의 봇·진단 5종이
 *   전부 `import * as D from './data.js'` 형태로 이 경로를 보고 있다.
 *   배럴을 남겨두면 그 8개 파일이 한 줄도 바뀌지 않고,
 *   원본(defenehero)과의 cherry-pick / merge 충돌면이 최소화된다.
 *
 * ▸ 어디를 고쳐야 하나
 *   field.js    전장 지오메트리 (길·발판·좌표 유틸)      — 레벨 디자인
 *   heroes.js   등급·직업·조합 레시피 그래프              — 게임 정체성
 *   enemies.js  몬스터·보스·난이도 곡선                   ★ 성장 곡선의 축
 *   castle.js   성·포탑
 *   economy.js  골드·조합 비용·메타 진행                  ★ 성장 곡선의 축
 *   mathgate.js 수학 관문 규칙 (문제 자체는 src/mathgen/) ★ 성인판 재설계 대상
 * ===================================================== */

export * from './balance/field.js';
export * from './balance/heroes.js';
export * from './balance/enemies.js';
export * from './balance/castle.js';
export * from './balance/economy.js';
export * from './balance/mathgate.js';
export * from './balance/champion.js';
