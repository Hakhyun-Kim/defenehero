/* =====================================================
 * 게임 데이터 / 밸런스 정의 (게임 본체 + 밸런스 봇 공용)
 * 모든 수치 튜닝은 이 파일에서만 한다.
 *
 * v3: 일반적인 타워 디펜스 문법으로 개편
 *  - 몬스터는 S자 길을 따라 돌아서 성으로 들어온다
 *  - 용사는 길 옆의 "지정 배치 지점(패드)"에만 놓을 수 있다
 * ===================================================== */

/* ---------- 전장 (논리 좌표 700×408) ---------- */
export const FIELD_W = 700;
export const FIELD_H = 408;

/* 길: 오른쪽 포탈에서 나와 구불구불 돌아 왼쪽 성문으로 */
export const PATH = [
  [740, 84],    // 스폰 (화면 밖)
  [310, 84],
  [310, 196],
  [610, 196],
  [610, 324],
  [170, 324],
  [170, 204],
  [104, 204],   // 성문
];
export const ROAD_HALF = 22;          // 길 반폭(px)

/* 용사 배치 지점 (길 굽이 사이 포켓들) */
export const PADS = [
  { x: 250, y: 38 }, { x: 450, y: 38 }, { x: 620, y: 38 },
  { x: 240, y: 140 }, { x: 400, y: 140 }, { x: 540, y: 140 },
  { x: 340, y: 260 }, { x: 480, y: 260 }, { x: 655, y: 260 },
  { x: 300, y: 372 }, { x: 460, y: 372 },
  { x: 114, y: 270 },
];
export const PAD_RADIUS = 26;         // 클릭 판정 반경(px)

/* ---------- 경제 ---------- */
export const START_GOLD = 150;
export const SUMMON_COST = 50;
export const BENCH_MAX = 12;
export const SELL_PRICE = [15, 40, 100, 250];
export const WAVE_BONUS = (w) => 30 + w * 10;

/* ---------- 지식(수학) ---------- */
export const KNOW_MAX = 20;
export const MATH_GOLD = (grade) => grade * 8;
export const MATH_KP = (grade) => grade - 2;
export const WRONG_KP = -1;
export const HINT_COST = 2;           // 힌트를 보면 지식(=소환 희귀도) -2

/* 소환 확률(%): 지식 k(0~20)에 따라 상승 */
export function tierProbs(k) {
  return [60 - 2 * k, 30 + k, 9 + 0.7 * k, 1 + 0.3 * k];
}

/* ---------- 용사 ---------- */
export const TIERS = [
  { name: '일반', color: '#8a97a8', mult: 1 },
  { name: '희귀', color: '#3b82f6', mult: 2.2 },
  { name: '영웅', color: '#a855f7', mult: 5 },
  { name: '전설', color: '#f59e0b', mult: 12 },
];

/* TD 문법: 용사는 탑처럼 고정 배치, 사거리 안 최전방 적을 자동 공격 */
export const CLASSES = {
  knight: { name: '검사',   emoji: '⚔️', dmg: 14, spd: 1.1, range: 100, desc: '가까운 적을 강하게 벱니다' },
  guard:  { name: '수호병', emoji: '🛡️', dmg: 6,  spd: 0.9, range: 105, slow: 0.55, slowDur: 1.6, desc: '방패로 쳐서 적을 느리게 만들어요' },
  archer: { name: '궁수',   emoji: '🏹', dmg: 9,  spd: 1.6, range: 200, desc: '멀리까지 화살을 쏘아요' },
  mage:   { name: '마법사', emoji: '🔮', dmg: 14, spd: 0.7, range: 155, splash: 62, desc: '폭발 마법으로 여럿을 공격해요' },
};
export const CLASS_KEYS = Object.keys(CLASSES);

/* 전설 등급 특수능력: 수치가 아니라 "행동"이 바뀐다 */
export const LEGEND_ABILITIES = {
  knight: { name: '회전베기',   desc: '사거리 안 모든 적을 한 번에 벤다!' },
  guard:  { name: '서리 결계',  desc: '사거리 안 모든 적이 계속 느려진다!' },
  archer: { name: '관통 화살',  desc: '화살이 일직선의 적 3명을 꿰뚫는다!' },
  mage:   { name: '화염 폭발',  desc: '폭발이 커지고 적을 3초간 불태운다!' },
};
export const PIERCE_COUNT = 3;
export const PIERCE_WIDTH = 46;                    // 관통 판정 폭(px)
export const BURN = { ratio: 0.25, dur: 3 };
export const LEGEND_SPLASH_MUL = 1.5;
export const LEGEND_AURA_SLOW = 0.5;               // 서리 결계 감속 배율

/* 킬 콤보 */
export const COMBO = { window: 3, x2At: 6, x3At: 12 };

/* ---------- 용사 강화 (레벨) ---------- */
export const HERO_LEVEL_MAX = 5;
export const LEVEL_DMG_BONUS = 0.25;
export const LEVEL_COST_BASE = [30, 60, 140, 320];
export const levelCost = (tier, level) => LEVEL_COST_BASE[tier] * level;

export function heroStats(cls, tier, level = 1) {
  const C = CLASSES[cls];
  const m = TIERS[tier].mult;
  return { dmg: Math.round(C.dmg * m * (1 + LEVEL_DMG_BONUS * (level - 1))) };
}

/* ---------- 성 ---------- */
export const CASTLE_HP = 100;
export const CASTLE_POS = { x: 104, y: 204 };      // 성문(길 끝)
export const CASTLE_UPGRADES = {
  repair:  { name: '성 수리',    emoji: '🔨', cost: () => 40,             desc: '성 체력을 25 회복해요' },
  fortify: { name: '성벽 강화',  emoji: '🧱', cost: (n) => 60 + n * 40,   desc: '성 최대 체력 +30', max: 5 },
  tower:   { name: '마법 포탑',  emoji: '🗼', cost: (n) => 120 + n * 100, desc: '성이 스스로 마법 공격!', max: 3 },
};
export const TOWER_DMG = (lv) => 12 + lv * 10;
export const TOWER_PERIOD = (lv) => Math.max(0.8, 1.6 - lv * 0.25);
export const TOWER_RANGE = 300;

/* ---------- 몬스터 (속도는 길 기준으로 상향) ---------- */
export const ENEMY_TYPES = {
  goblin:  { name: '고블린',     emoji: '👺', hp: 40,   spd: 62,  dmg: 0, gold: 8,   castleDmg: 5,  size: 30 },
  wolf:    { name: '늑대',       emoji: '🐺', hp: 26,   spd: 105, dmg: 0, gold: 10,  castleDmg: 4,  size: 30 },
  orc:     { name: '오크',       emoji: '👹', hp: 115,  spd: 44,  dmg: 0, gold: 16,  castleDmg: 8,  size: 34 },
  troll:   { name: '트롤',       emoji: '🧌', hp: 270,  spd: 32,  dmg: 0, gold: 32,  castleDmg: 12, size: 40 },
  shaman:  { name: '주술사',     emoji: '🧙', hp: 90,   spd: 38,  dmg: 0, gold: 24,  castleDmg: 8,  size: 32, heal: 18, healPeriod: 1.6, healRange: 130 },
  boss:    { name: '보스 드래곤', emoji: '🐉', hp: 1600, spd: 27,  dmg: 0, gold: 200, castleDmg: 40, size: 54, boss: true },
};

/* ---------- 난이도 ---------- */
export const DIFFICULTIES = {
  easy:   { name: '쉬움',   emoji: '🌱', hpMul: 0.75, countMul: 0.8,  goldMul: 1.15 },
  normal: { name: '보통',   emoji: '⚔️', hpMul: 1.0,  countMul: 1.0,  goldMul: 1.0 },
  hard:   { name: '어려움', emoji: '🔥', hpMul: 1.3,  countMul: 1.15, goldMul: 0.95 },
};

/* 웨이브 스케일링 — "처음은 쉽게, 뒤로 갈수록 가파르게" */
export const hpScale = (w) => 1 + 0.26 * (w - 1) + 0.075 * (w - 1) * (w - 1);
export const enemyGoldScale = (w) => 1 + 0.03 * w;
export const waveCount = (w) => 6 + Math.round(w * 1.6);
export const waveInterval = (w) => Math.max(0.7, 1.5 - w * 0.03);
/* 스노볼 방지: 후반 웨이브에서 성이 받는 피해 가속 */
export const castleDmgScale = (w) => 1 + Math.max(0, w - 15) * 0.08;

/* 웨이브 구성 */
export function waveMix(w) {
  const mix = [{ type: 'goblin', weight: 10 }];
  if (w >= 2) mix.push({ type: 'orc', weight: Math.min(3 + w * 0.5, 9) });
  if (w >= 3) mix.push({ type: 'wolf', weight: Math.min(2 + w * 0.4, 6) });
  if (w >= 4) mix.push({ type: 'troll', weight: Math.min(1 + w * 0.35, 6) });
  if (w >= 6) mix.push({ type: 'shaman', weight: Math.min(1 + w * 0.25, 4) });
  return mix;
}
export const isBossWave = (w) => w % 5 === 0;

/* ---------- 투사체 ---------- */
export const ARROW_SPEED = 540;
export const ORB_SPEED = 300;

/* ---------- 메타 진행 (별의 축복) ---------- */
export const shardReward = (wave, bossKills) => Math.max(1, (wave - 1) * 2 + bossKills * 5);
export const META_UPGRADES = {
  startGold: { name: '시작 골드',   emoji: '💰', max: 5,  cost: (lv) => 8 + lv * 6,  per: '+30G', apply: (lv) => START_GOLD + lv * 30 },
  castleHp:  { name: '성 체력',     emoji: '🏰', max: 5,  cost: (lv) => 8 + lv * 6,  per: '+20',  apply: (lv) => CASTLE_HP + lv * 20 },
  heroDmg:   { name: '용사 공격력', emoji: '⚔️', max: 10, cost: (lv) => 10 + lv * 8, per: '+5%',  apply: (lv) => 1 + lv * 0.05 },
  mathBonus: { name: '수학 보상',   emoji: '🧮', max: 5,  cost: (lv) => 6 + lv * 5,  per: '+20%', apply: (lv) => 1 + lv * 0.2 },
};

/* ---------- 길 유틸 (엔진/렌더러/봇 공용) ---------- */
export const PATH_SEGS = (() => {
  const segs = [];
  let acc = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [x1, y1] = PATH[i], [x2, y2] = PATH[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    segs.push({ x1, y1, x2, y2, len, start: acc });
    acc += len;
  }
  return segs;
})();
export const PATH_LEN = PATH_SEGS.reduce((a, s) => a + s.len, 0);

/* 진행도 s(0~PATH_LEN) → 좌표 */
export function pathPoint(s) {
  if (s <= 0) { const g = PATH_SEGS[0]; return { x: g.x1, y: g.y1 }; }
  for (const seg of PATH_SEGS) {
    if (s <= seg.start + seg.len) {
      const t = (s - seg.start) / seg.len;
      return { x: seg.x1 + (seg.x2 - seg.x1) * t, y: seg.y1 + (seg.y2 - seg.y1) * t };
    }
  }
  const last = PATH_SEGS[PATH_SEGS.length - 1];
  return { x: last.x2, y: last.y2 };
}

/* 한 점에서 길까지의 최단 거리 (배치 판정/봇 커버리지용) */
export function distToPath(x, y) {
  let best = Infinity;
  for (const seg of PATH_SEGS) {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const t = Math.max(0, Math.min(1, ((x - seg.x1) * dx + (y - seg.y1) * dy) / (seg.len * seg.len)));
    const px = seg.x1 + dx * t, py = seg.y1 + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best) best = d;
  }
  return best;
}

/* 패드에서 특정 사거리로 커버할 수 있는 길의 길이 (봇 배치 정책용) */
export function padCoverage(pad, range) {
  let cover = 0;
  const step = 8;
  for (let s = 0; s < PATH_LEN; s += step) {
    const p = pathPoint(s);
    if (Math.hypot(p.x - pad.x, p.y - pad.y) <= range) cover += step;
  }
  return cover;
}
