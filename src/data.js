/* =====================================================
 * 게임 데이터 / 밸런스 정의 (게임 본체 + 밸런스 봇 공용)
 * 모든 수치 튜닝은 이 파일에서만 한다.
 *
 * v4: 성이 위, 몬스터는 아래에서 위로 — 세 갈래 길
 *     + 레시피 조합(특수 직업 6종)
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
export const HINT_COST = 2;

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

/* 직업 정의 — 기본 4종(소환으로만 등장) + 특수 6종(레시피 조합으로만 탄생)
 * atk: melee(근접 즉시) | arrow(화살 투사체) | orb(구슬 투사체)
 * 수정자: hits(다단타), burn(화상 비율), slowOnHit, splash, splashSlow, healOnKill, pierce */
export const CLASSES = {
  /* --- 기본 --- */
  knight: { name: '검사',   emoji: '⚔️', atk: 'melee', dmg: 14, spd: 1.1, range: 100, desc: '가까운 적을 강하게 벱니다' },
  guard:  { name: '수호병', emoji: '🛡️', atk: 'melee', dmg: 6,  spd: 0.9, range: 105, slowOnHit: { mul: 0.55, dur: 1.6 }, desc: '방패로 쳐서 적을 느리게 만들어요' },
  archer: { name: '궁수',   emoji: '🏹', atk: 'arrow', dmg: 9,  spd: 1.6, range: 200, desc: '멀리까지 화살을 쏘아요' },
  mage:   { name: '마법사', emoji: '🔮', atk: 'orb',   dmg: 14, spd: 0.7, range: 155, splash: 62, desc: '폭발 마법으로 여럿을 공격해요' },

  /* --- 특수 (레시피 조합 전용) --- */
  spellblade: {
    name: '마검사', emoji: '🗡️', special: true, recipe: ['knight', 'mage'],
    atk: 'melee', dmg: 15, spd: 1.0, range: 105, burn: 0.22,
    desc: '불타는 검! 벤 적이 계속 불타요',
  },
  windblade: {
    name: '질풍검객', emoji: '🌪️', special: true, recipe: ['knight', 'archer'],
    atk: 'melee', dmg: 8, spd: 1.4, range: 100, hits: 2,
    desc: '바람처럼 빠른 2연속 베기!',
  },
  paladin: {
    name: '성기사', emoji: '⚜️', special: true, recipe: ['knight', 'guard'],
    atk: 'melee', dmg: 11, spd: 0.9, range: 100, healOnKill: 1,
    desc: '적을 물리칠 때마다 성을 회복해요',
  },
  frostmage: {
    name: '빙결사', emoji: '❄️', special: true, recipe: ['guard', 'mage'],
    atk: 'orb', dmg: 10, spd: 0.6, range: 150, splash: 62, splashSlow: { mul: 0.6, dur: 1.3 },
    desc: '얼음 폭발로 여럿을 얼려요',
  },
  sentinel: {
    name: '파수꾼', emoji: '🎯', special: true, recipe: ['guard', 'archer'],
    atk: 'arrow', dmg: 13, spd: 0.8, range: 260, slowOnHit: { mul: 0.65, dur: 1.2 },
    desc: '아주 멀리서 저격! 맞은 적은 느려져요',
  },
  spiritarcher: {
    name: '정령궁수', emoji: '💫', special: true, recipe: ['archer', 'mage'],
    atk: 'arrow', dmg: 10, spd: 1.4, range: 190, splash: 40,
    desc: '화살이 별빛으로 폭발해요',
  },
};
export const CLASS_KEYS = Object.keys(CLASSES);
export const GACHA_KEYS = CLASS_KEYS.filter(k => !CLASSES[k].special);

/* 레시피 목록 (UI 도감·봇 공용) */
export const RECIPES = CLASS_KEYS
  .filter(k => CLASSES[k].recipe)
  .map(k => ({ result: k, a: CLASSES[k].recipe[0], b: CLASSES[k].recipe[1] }));

export function findRecipe(clsA, clsB) {
  return RECIPES.find(r => (r.a === clsA && r.b === clsB) || (r.a === clsB && r.b === clsA)) || null;
}

/* 전설 등급 특수능력: 수치가 아니라 "행동"이 바뀐다 */
export const LEGEND_ABILITIES = {
  knight:       { name: '회전베기',   desc: '사거리 안 모든 적을 한 번에 벤다!' },
  guard:        { name: '서리 결계',  desc: '사거리 안 모든 적이 계속 느려진다!' },
  archer:       { name: '관통 화살',  desc: '화살이 일직선의 적 3명을 꿰뚫는다!' },
  mage:         { name: '화염 폭발',  desc: '폭발이 커지고 적을 3초간 불태운다!' },
  spellblade:   { name: '화염 폭풍',  desc: '화상이 두 배로 강해진다!' },
  windblade:    { name: '삼연격',     desc: '한 번에 3번 벤다!' },
  paladin:      { name: '축복',       desc: '처치할 때마다 성이 3 회복!' },
  frostmage:    { name: '절대영도',   desc: '폭발이 커지고 더 강하게 얼린다!' },
  sentinel:     { name: '이중 저격',  desc: '화살이 2명을 꿰뚫는다!' },
  spiritarcher: { name: '유성우',     desc: '폭발이 커지고 적을 불태운다!' },
};

/* 전설이 되면 덮어씌워지는 수정자 */
export const LEGEND_OVERRIDES = {
  knight:       { cleave: true },
  guard:        { aura: 0.5 },
  archer:       { pierce: 3 },
  mage:         { splashMul: 1.5, burn: 0.25 },
  spellblade:   { burn: 0.45 },
  windblade:    { hits: 3 },
  paladin:      { healOnKill: 3 },
  frostmage:    { splashMul: 1.3, splashSlow: { mul: 0.45, dur: 2.0 } },
  sentinel:     { pierce: 2 },
  spiritarcher: { splashMul: 1.6, burn: 0.15 },
};

export const PIERCE_WIDTH = 46;
export const BURN_DUR = 3;
export const COMBO = { window: 3, x2At: 6, x3At: 12 };
/* 등급업 조합 시 "럭키!" 확률: 한 번에 두 등급 점프 (럭키 디펜스 참고) */
export const LUCKY_JUMP = 0.08;

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

/* ---------- 성 (맵 위쪽) ---------- */
export const CASTLE_HP = 100;
export const CASTLE_POS = { x: 350, y: 58 };
export const CASTLE_UPGRADES = {
  repair:  { name: '성 수리',    emoji: '🔨', cost: () => 40,             desc: '성 체력을 25 회복해요' },
  fortify: { name: '성벽 강화',  emoji: '🧱', cost: (n) => 60 + n * 40,   desc: '성 최대 체력 +30', max: 5 },
  tower:   { name: '마법 포탑',  emoji: '🗼', cost: (n) => 120 + n * 100, desc: '성이 스스로 마법 공격!', max: 3 },
};
export const TOWER_DMG = (lv) => 12 + lv * 10;
export const TOWER_PERIOD = (lv) => Math.max(0.8, 1.6 - lv * 0.25);
export const TOWER_RANGE = 300;

/* ---------- 몬스터 ---------- */
export const ENEMY_TYPES = {
  goblin:  { name: '고블린',     emoji: '👺', hp: 40,   spd: 62,  gold: 8,   castleDmg: 5,  size: 30 },
  wolf:    { name: '늑대',       emoji: '🐺', hp: 26,   spd: 105, gold: 10,  castleDmg: 4,  size: 30 },
  orc:     { name: '오크',       emoji: '👹', hp: 115,  spd: 44,  gold: 16,  castleDmg: 8,  size: 34 },
  troll:   { name: '트롤',       emoji: '🧌', hp: 270,  spd: 32,  gold: 32,  castleDmg: 12, size: 40 },
  shaman:  { name: '주술사',     emoji: '🧙', hp: 90,   spd: 38,  gold: 24,  castleDmg: 8,  size: 32, heal: 18, healPeriod: 1.6, healRange: 130 },
  boss:    { name: '보스 드래곤', emoji: '🐉', hp: 1600, spd: 27,  gold: 200, castleDmg: 40, size: 54, boss: true },
};

/* ---------- 난이도 ---------- */
export const DIFFICULTIES = {
  easy:   { name: '쉬움',   emoji: '🌱', hpMul: 0.75, countMul: 0.8,  goldMul: 1.15 },
  normal: { name: '보통',   emoji: '⚔️', hpMul: 1.0,  countMul: 1.0,  goldMul: 1.0 },
  hard:   { name: '어려움', emoji: '🔥', hpMul: 1.3,  countMul: 1.15, goldMul: 0.95 },
};

export const hpScale = (w) => 1 + 0.22 * (w - 1) + 0.05 * (w - 1) * (w - 1);
export const enemyGoldScale = (w) => 1 + 0.03 * w;
export const waveCount = (w) => 6 + Math.round(w * 1.6);
export const waveInterval = (w) => Math.max(0.7, 1.5 - w * 0.03);
export const castleDmgScale = (w) => 1 + Math.max(0, w - 15) * 0.08;

export function waveMix(w) {
  const mix = [{ type: 'goblin', weight: 10 }];
  if (w >= 2) mix.push({ type: 'orc', weight: Math.min(3 + w * 0.5, 9) });
  if (w >= 3) mix.push({ type: 'wolf', weight: Math.min(2 + w * 0.4, 6) });
  if (w >= 4) mix.push({ type: 'troll', weight: Math.min(1 + w * 0.35, 6) });
  if (w >= 6) mix.push({ type: 'shaman', weight: Math.min(1 + w * 0.25, 4) });
  return mix;
}
export const isBossWave = (w) => w % 5 === 0;

export const ARROW_SPEED = 540;
export const ORB_SPEED = 300;

/* ---------- 메타 진행 ---------- */
export const shardReward = (wave, bossKills) => Math.max(1, (wave - 1) * 2 + bossKills * 5);
export const META_UPGRADES = {
  startGold: { name: '시작 골드',   emoji: '💰', max: 5,  cost: (lv) => 8 + lv * 6,  per: '+30G', apply: (lv) => START_GOLD + lv * 30 },
  castleHp:  { name: '성 체력',     emoji: '🏰', max: 5,  cost: (lv) => 8 + lv * 6,  per: '+20',  apply: (lv) => CASTLE_HP + lv * 20 },
  heroDmg:   { name: '용사 공격력', emoji: '⚔️', max: 10, cost: (lv) => 10 + lv * 8, per: '+5%',  apply: (lv) => 1 + lv * 0.05 },
  mathBonus: { name: '수학 보상',   emoji: '🧮', max: 5,  cost: (lv) => 6 + lv * 5,  per: '+20%', apply: (lv) => 1 + lv * 0.2 },
};

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
