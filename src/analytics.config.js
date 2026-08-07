// GameAnalytics 키. 이 파일은 **커밋된다**.
//
// 왜 숨기지 않나: 웹 SDK 는 브라우저 안에서 이 키로 이벤트에 HMAC 서명을 만든다.
// 즉 배포본에 반드시 들어가야 하는 값이라 구조적으로 숨길 수 없다. 이 키로 할 수 있는
// 최악은 가짜 이벤트를 보내 통계를 오염시키는 것이고, 대시보드 열람이나 계정 변경은 안 된다.
//
// fork 가 내 대시보드로 데이터를 보내는 것은 analytics.js 의 COLLECT_HOSTS 게이트가 막는다.
// (키를 암호화해도 fork 는 복호화 코드까지 가져가므로 소용없다 — 실행 위치로 판단해야 한다.)
export const GA_CONFIG = {
  gameKey: "540e8f7405686c182800e191f35b599e",
  secretKey: "c5e73ca51d0ac3e4b39213cbf0d36ea8162777e3",
  build: "2.1.0",
  enabled: true,
};
