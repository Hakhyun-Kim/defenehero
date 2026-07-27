/* =====================================================
 * 개발용 정적 서버
 * 포트는 PORT 환경변수를 따른다(없으면 8642). 하드코딩하지 않는 이유는
 * 같은 프로젝트를 여러 세션에서 동시에 열 때 포트가 겹치기 때문이다.
 *   node scripts/serve.mjs
 * ===================================================== */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 8642;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';

    /* 루트 밖으로 나가는 경로는 거부한다 (../ 트래버설) */
    const full = normalize(join(root, rel));
    if (full !== root && !full.startsWith(root + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    const info = await stat(full);
    const body = await readFile(info.isDirectory() ? join(full, 'index.html') : full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full).toLowerCase()] || 'application/octet-stream',
      /* 개발 중에는 항상 최신 파일을 본다 — 캐시된 번들 때문에 헛디버깅하는 일이 잦다 */
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`용사 수학 디펜스 → http://localhost:${port}/`);
});
