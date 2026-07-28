/* =====================================================
 * 전장 지오메트리 — 길·발판·좌표 유틸
 * 게임 본체 / 렌더러 / 밸런스 봇이 모두 공유하는 순수 기하.
 * 수치를 바꾸면 맵이 바뀐다(밸런스가 아니라 레벨 디자인).
 * ===================================================== */

/* ---------- 전장 (논리 좌표 700×408, y=0이 위) ---------- */
export const FIELD_W = 700;
export const FIELD_H = 408;

/* 세 갈래 길: 아래 포탈에서 올라와 갈림길에서 좌/중/우로 갈라진 뒤
 * 성문 앞에서 다시 만난다. 가운데는 짧은 "지름길"(위험!). */
export const ROUTES = [
  /* 왼쪽 길 */
  [[350, 430], [350, 338], [128, 338], [128, 210], [238, 210], [238, 120], [350, 120], [350, 58]],
  /* 가운데 지름길 (그래도 짧다 — 몬스터가 덜 오지만 보스가 온다!) */
  [[350, 430], [350, 338], [280, 280], [420, 220], [300, 160], [350, 120], [350, 58]],
  /* 오른쪽 길 */
  [[350, 430], [350, 338], [572, 338], [572, 210], [462, 210], [462, 120], [350, 120], [350, 58]],
];
export const ROUTE_WEIGHTS = [0.4, 0.2, 0.4];
export const BOSS_ROUTE = 1;              // 보스는 지름길로 돌진!
export const ROAD_HALF = 22;

/* 용사 배치 발판 (갈래 사이 포켓) */
export const PADS = [
  { x: 280, y: 395 }, { x: 420, y: 395 },           // 입구 양옆 (공유 구간)
  { x: 230, y: 282 }, { x: 470, y: 282 },           // 갈림길 양옆
  { x: 185, y: 270 }, { x: 515, y: 270 },           // 좌/우 루프 안쪽
  { x: 180, y: 120 }, { x: 520, y: 120 },           // 상단 좌/우
  { x: 262, y: 75 },  { x: 438, y: 75 },            // 성문 앞 (합류 지점)
  { x: 135, y: 395 }, { x: 565, y: 395 },           // 외곽 코너
];
export const PAD_RADIUS = 26;

/* ---------- 길 유틸 (엔진/렌더러/봇 공용) ---------- */
function buildSegs(points) {
  const segs = [];
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    segs.push({ x1, y1, x2, y2, len, start: acc });
    acc += len;
  }
  return segs;
}
export const ROUTE_SEGS = ROUTES.map(buildSegs);
export const ROUTE_LENS = ROUTE_SEGS.map(segs => segs.reduce((a, s) => a + s.len, 0));

/* 진행도 s → 좌표 + 방향 */
export function routePoint(route, s) {
  const segs = ROUTE_SEGS[route];
  if (s <= 0) {
    const g = segs[0];
    return { x: g.x1, y: g.y1, dx: (g.x2 - g.x1) / g.len, dy: (g.y2 - g.y1) / g.len };
  }
  for (const seg of segs) {
    if (s <= seg.start + seg.len) {
      const t = (s - seg.start) / seg.len;
      return {
        x: seg.x1 + (seg.x2 - seg.x1) * t,
        y: seg.y1 + (seg.y2 - seg.y1) * t,
        dx: (seg.x2 - seg.x1) / seg.len,
        dy: (seg.y2 - seg.y1) / seg.len,
      };
    }
  }
  const last = segs[segs.length - 1];
  return { x: last.x2, y: last.y2, dx: (last.x2 - last.x1) / last.len, dy: (last.y2 - last.y1) / last.len };
}

/* 한 점에서 모든 길까지의 최단 거리 */
export function distToPath(x, y) {
  let best = Infinity;
  for (const segs of ROUTE_SEGS) {
    for (const seg of segs) {
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const t = Math.max(0, Math.min(1, ((x - seg.x1) * dx + (y - seg.y1) * dy) / (seg.len * seg.len)));
      const px = seg.x1 + dx * t, py = seg.y1 + dy * t;
      const d = Math.hypot(x - px, y - py);
      if (d < best) best = d;
    }
  }
  return best;
}

/* 패드가 사거리로 덮는 길의 총량 (루트 가중치 반영, 봇 배치 정책용) */
export function padCoverage(pad, range) {
  let cover = 0;
  const step = 8;
  for (let r = 0; r < ROUTES.length; r++) {
    for (let s = 0; s < ROUTE_LENS[r]; s += step) {
      const p = routePoint(r, s);
      if (Math.hypot(p.x - pad.x, p.y - pad.y) <= range) cover += step * ROUTE_WEIGHTS[r] * 2.5;
    }
  }
  return cover;
}
