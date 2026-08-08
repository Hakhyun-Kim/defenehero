/* =====================================================
 * 손안 화면 레이아웃 — 앱(안드로이드)과 폰 브라우저
 *
 * 폰 가로 화면은 세로가 360~420px 밖에 안 된다. 학년 선택·소리·난이도·조작법을
 * 화면에 펼쳐 두면 정작 벤치와 전장이 설 자리가 없어서, 여기서는 그것들을
 * ⚙️ 설정 모달로 접고 벤치를 탭 하나로 만든다.
 *
 * 이걸 전역으로 켰다가 데스크톱 웹까지 같이 접혀 버린 적이 있다 — 웹은 자리가
 * 남아도는데 두 번 눌러야 학년을 바꾸게 됐다. 그래서 켜는 조건을 둘로 못 박는다:
 *   ① Capacitor 네이티브        — 웹 빌드에도 window.Capacitor shim 이 있으므로
 *                                 존재 여부가 아니라 isNativePlatform() 을 봐야 한다
 *   ② 손가락 화면 + 작은 화면    — 터치 되는 24인치 모니터까지 폰 배치로 접히면
 *                                 방금 고친 문제가 그대로 돌아온다. 짧은 변으로 거른다
 *
 * 컨트롤을 복제하지 않고 "옮긴다"는 점이 중요하다. 같은 id 가 둘이면 UI 가 잡아
 * 둔 쪽과 사용자가 누르는 쪽이 갈려서, 눌러도 아무 일 없는 버튼이 생긴다.
 *
 * 세로/가로는 CSS 가 가른다 — 회전할 때마다 DOM 을 도로 옮기는 것보다,
 * 옮긴 채로 두고 화면만 미디어 쿼리로 바꾸는 쪽이 되돌릴 것이 없어 안전하다.
 * ===================================================== */

/* 짧은 변 기준. 폰은 가로로 눕혀도 360~430, 태블릿도 768 — 여기까지 손안 화면으로 본다.
 * 터치 노트북(1080)·터치 모니터는 걸러진다. */
const HANDHELD_MAX_SHORT_SIDE = 820;

export function isHandheld() {
  try {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const phoneUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent || '');
    if (!coarse && !phoneUA) return false;
    return Math.min(window.innerWidth, window.innerHeight) <= HANDHELD_MAX_SHORT_SIDE;
  } catch { return false; }
}

export function isNativeApp() {
  try {
    const C = typeof window !== 'undefined' ? window.Capacitor : null;
    return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  } catch { return false; }
}

/* ?applayout=1 은 폰 없이 이 경로를 확인하려고 둔다 (?mobile=1 과 같은 취지). */
export function useAppLayout(params) {
  const forced = params && params.get('applayout');
  if (forced != null) return !/^(0|off|no|false)$/i.test(forced);
  return isNativeApp() || isHandheld();
}

/* DOM 을 앱 배치로 재구성한다. UI 생성 직후 · bind() 전에 부른다 —
 * 소환 탭 버튼을 bind() 가 훑기 전에 만들어 둬야 클릭이 붙는다.
 * 앱의 기본 탭 이름을 돌려준다. */
export function applyAppLayout() {
  const doc = document;
  /* html 에도 붙인다 — 스크롤 잠금은 html 까지 걸어야 주소창이 따라 늘어나지 않는다 */
  doc.documentElement.classList.add('app-mobile');
  doc.body.classList.add('app-mobile');

  const q = (sel) => doc.querySelector(sel);
  const mount = (name) => q(`[data-mount="${name}"]`);
  const into = (name, ...nodes) => {
    const m = mount(name);
    if (!m) return;
    for (const n of nodes) if (n) m.appendChild(n);
  };

  into('grade', q('.gradebar'));
  into('mini', q('.minibtns'));
  into('diff', q('#diffRow'));
  into('help', q('#helpBtn'), q('#helpBox'));

  /* 알맹이를 다 옮긴 뒤 남는 빈 줄은 치운다 (여백만 잡아먹는다) */
  const under = q('.under-row');
  if (under && !under.children.length) under.remove();

  /* 벤치를 탭 하나로 — 세로로 쌓으면 전장이 손톱만 해진다 */
  const bench = q('#benchCard');
  const tabs = q('#tabs');
  const tabbody = q('.tabbody');
  if (bench && tabs && tabbody) {
    bench.classList.remove('fixed');
    bench.classList.add('pane');
    bench.dataset.pane = 'summon';
    tabbody.insertBefore(bench, tabbody.firstChild);
    const btn = doc.createElement('button');
    btn.dataset.tab = 'summon';
    btn.textContent = '🎲 소환';
    tabs.insertBefore(btn, tabs.firstChild);
  }

  return 'summon';
}
