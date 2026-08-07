// CI에서 GameAnalytics 키를 src/analytics.config.js 로 주입한다.
// 키를 셸 스크립트 문자열에 끼워 넣지 않고 환경변수로 받는 이유:
// 키에 따옴표·$·백틱이 섞이면 heredoc이 조용히 깨지거나 셸이 확장해 버린다.
// 키가 없으면 아무것도 쓰지 않는다 — build-web.mjs가 example을 복사하는 경로로 넘어간다.
import fs from 'fs';

const gameKey = (process.env.GA_GAME_KEY || '').trim();
const secretKey = (process.env.GA_SECRET_KEY || '').trim();

if (!gameKey || !secretKey) {
  console.log('[analytics] Secret이 없다 — 수집 꺼진 예시 설정으로 빌드한다.');
  process.exit(0);
}

// build 버전은 package.json 하나만 고치면 따라오게 한다 (워크플로에 하드코딩하면 어긋난다)
const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const config = { gameKey, secretKey, build: version, enabled: true };

fs.writeFileSync(
  'src/analytics.config.js',
  `// CI가 생성한 파일 — 직접 고치지 말 것 (scripts/write-analytics-config.mjs)\n`
    + `export const GA_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
);

console.log(`[analytics] config 생성 완료 (build ${version})`);
