/* =====================================================
 * 밸런스 회귀 게이트 (재시도 래퍼)
 *
 * 왜 래퍼가 필요한가: 이 환경(Node v24 / Windows)에서 봇 프로세스가
 * 게임 데이터와 무관하게 간헐적으로 죽는다(0xC0000005 액세스 위반).
 *   - 같은 시드를 60번 반복해도 죽는 판 번호가 매번 다르다 → 데이터 문제 아님
 *   - 순수 CPU 루프는 90초를 멀쩡히 돈다 → 단순 과부하 아님
 *   - JIT 티어(--max-opt)를 바꿔도 재현이 들쭉날쭉 → 엔진 코드 문제 아님
 * 원인이 게임 밖에 있으니 게이트는 크래시를 "실패"가 아니라 "재시도"로 다룬다.
 * 재시도를 다 쓰고도 못 끝내면 그때는 진짜 실패다.
 *
 *   node scripts/balance-check.mjs [판수=60] [재시도=4]
 * ===================================================== */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bot = join(here, 'balance-bot.mjs');
const runs = Number(process.argv[2]) || 60;
const maxTry = Number(process.argv[3]) || 6;
const DIFFS = ['easy', 'normal', 'hard'];
const PROFS = ['초보', '보통', '고수'];
/* 프로세스 하나가 오래 돌수록 크래시 확률이 올라간다.
 * 난이도×프로필로 9조각을 내면 조각당 작업량이 1/9이라 성공률이 크게 오른다. */

let failed = false;
let crashes = 0;

for (const d of DIFFS) {
  for (const p of PROFS) {
    let ok = false;
    for (let t = 1; t <= maxTry && !ok; t++) {
      const r = spawnSync(process.execPath, [bot, String(runs), d, p, 'check'], { encoding: 'utf8' });
      if (r.status === 0 || r.status === 1) {
        const line = (r.stdout || '').split(/\r?\n/).find((l) => l.trim().startsWith('['));
        if (line) console.log(line);
        if (r.status === 1) failed = true;
        ok = true;
      } else {
        crashes++;
      }
    }
    if (!ok) {
      console.log(`  ✗ [${d}/${p}] ${maxTry}번 모두 크래시 — 검증 불가`);
      failed = true;
    }
  }
  console.log('');
}

console.log(crashes ? `\n(참고: 크래시 ${crashes}회를 재시도로 흡수했습니다)` : '');
console.log(failed ? '❌ 밸런스 게이트 실패' : '✅ 밸런스 게이트 통과');
process.exit(failed ? 1 : 0);
