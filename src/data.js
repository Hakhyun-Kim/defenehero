/* =====================================================
 * 게임 데이터 / 밸런스 정의 (게임 본체 + 밸런스 봇 공용)
 * 모든 수치 튜닝은 이 파일에서만 한다.
 * ===================================================== */

/* ---------- 전장 격자 ---------- */
export const COLS = 8;
export const ROWS = 5;
export const CELL = 72;              // 논리 좌표(px). 3D 렌더러가 월드 좌표로 변환한다.
export const GRID_X = 110;
export const GRID_Y = 24;
export const FIELD_W = GRID_X + COLS * CELL + 14;   // 700
export const FIELD_H = GRID_Y + ROWS * CELL + 24;   // 408
export const CASTLE_HIT_X = GRID_X - 6;

/* ---------- 경제 ---------- */
export const START_GOLD = 150;
export const SUMMON_COST = 50;
export const BENCH_MAX = 12;
export const SELL_PRICE = [15, 40, 100, 250];
export const WAVE_BONUS = (w) => 30 + w * 10;

/* ---------- 지식(수학) ---------- */
export const KNOW_MAX = 20;
export const MATH_GOLD = (grade) => grade * 8;      // 3학년 24G … 6학년 48G
export const MATH_KP = (grade) => grade - 2;        // 3학년 +1 … 6학년 +4
export const WRONG_KP = -1;

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

export const CLASSES = {
  knight: { name: '검사',   emoji: '⚔️', type: 'melee',  dmg: 12, spd: 1.0, hp: 130, desc: '가까운 적을 강하게 벱니다' },
  guard:  { name: '방패병', emoji: '🛡️', type: 'melee',  dmg: 6,  spd: 0.8, hp: 300, desc: '체력이 높아 앞을 든든하게 막아요' },
  archer: { name: '궁수',   emoji: '🏹', type: 'lane',   dmg: 9,  spd: 1.6, hp: 65,  desc: '같은 줄 멀리까지 화살을 쏘아요' },
  mage:   { name: '마법사', emoji: '🔮', type: 'radius', dmg: 14, spd: 0.7, hp: 75,  radius: 200, splash: 62, desc: '주변 적들에게 폭발 마법을 써요' },
};
export const CLASS_KEYS = Object.keys(CLASSES);

/* 전설 등급 특수능력: 수치가 아니라 "행동"이 바뀐다 */
export const LEGEND_ABILITIES = {
  knight: { name: '회전베기',   desc: '사거리 안 모든 적을 한 번에 벤다!' },
  guard:  { name: '가시 갑옷',  desc: '받은 피해의 40%를 되돌려준다!' },
  archer: { name: '관통 화살',  desc: '화살이 적 3명을 꿰뚫는다!' },
  mage:   { name: '화염 폭발',  desc: '폭발이 커지고 적을 3초간 불태운다!' },
};
export const THORNS_RATIO = 0.4;
export const PIERCE_COUNT = 3;
export const BURN = { ratio: 0.25, dur: 3 };          // 마법사 공격력의 25%/초, 3초
export const LEGEND_SPLASH_MUL = 1.5;

/* 킬 콤보: 3초 안에 연속 처치 시 골드 배율 */
export const COMBO = { window: 3, x2At: 6, x3At: 12 };

/* ---------- 용사 강화 (레벨) ---------- */
export const HERO_LEVEL_MAX = 5;
/* 레벨당 공격력 +25%, 체력 +20% (기본값 기준 가산) */
export const LEVEL_DMG_BONUS = 0.25;
export const LEVEL_HP_BONUS = 0.20;
/* 강화 비용: 등급 기본가 × 현재 레벨 */
export const LEVEL_COST_BASE = [30, 60, 140, 320];
export const levelCost = (tier, level) => LEVEL_COST_BASE[tier] * level;

export function heroStats(cls, tier, level = 1) {
  const C = CLASSES[cls];
  const m = TIERS[tier].mult;
  const lb = level - 1;
  return {
    dmg: Math.round(C.dmg * m * (1 + LEVEL_DMG_BONUS * lb)),
    hp: Math.round(C.hp * m * (1 + LEVEL_HP_BONUS * lb)),
  };
}

/* ---------- 성 ---------- */
export const CASTLE_HP = 100;
export const CASTLE_UPGRADES = {
  repair:  { name: '성 수리',    emoji: '🔨', cost: () => 40,                 desc: '성 체력을 25 회복해요' },
  fortify: { name: '성벽 강화',  emoji: '🧱', cost: (n) => 60 + n * 40,       desc: '성 최대 체력 +30', max: 5 },
  tower:   { name: '마법 포탑',  emoji: '🗼', cost: (n) => 120 + n * 100,     desc: '성이 스스로 마법 공격!', max: 3 },
};
/* 포탑: 레벨당 공격력/속도 */
export const TOWER_DMG = (lv) => 12 + lv * 10;       // lv1: 22
export const TOWER_PERIOD = (lv) => Math.max(0.8, 1.6 - lv * 0.25);
export const TOWER_RANGE = 320;

/* ---------- 몬스터 ---------- */
export const ENEMY_TYPES = {
  goblin:  { name: '고블린',     emoji: '👺', hp: 40,   spd: 50, dmg: 8,  gold: 8,   castleDmg: 5,  size: 30 },
  wolf:    { name: '늑대',       emoji: '🐺', hp: 26,   spd: 86, dmg: 6,  gold: 10,  castleDmg: 4,  size: 30 },
  orc:     { name: '오크',       emoji: '👹', hp: 115,  spd: 33, dmg: 15, gold: 16,  castleDmg: 8,  size: 34 },
  troll:   { name: '트롤',       emoji: '🧌', hp: 270,  spd: 23, dmg: 26, gold: 32,  castleDmg: 12, size: 40 },
  shaman:  { name: '주술사',     emoji: '🧙', hp: 90,   spd: 28, dmg: 10, gold: 24,  castleDmg: 8,  size: 32, heal: 18, healPeriod: 1.6, healRange: 130 },
  boss:    { name: '보스 드래곤', emoji: '🐉', hp: 1600, spd: 16, dmg: 70, gold: 200, castleDmg: 40, size: 54, boss: true },
};

/* ---------- 난이도 ---------- */
export const DIFFICULTIES = {
  easy:   { name: '쉬움',   emoji: '🌱', hpMul: 0.75, countMul: 0.8,  goldMul: 1.15 },
  normal: { name: '보통',   emoji: '⚔️', hpMul: 1.0,  countMul: 1.0,  goldMul: 1.0 },
  hard:   { name: '어려움', emoji: '🔥', hpMul: 1.3,  countMul: 1.15, goldMul: 0.95 },
};

/* 웨이브 스케일링 — "처음은 쉽게, 뒤로 갈수록 가파르게"
 * 초반(1~4)은 완만, 중반부터 2차항이 체감되도록. */
export const hpScale = (w) => 1 + 0.26 * (w - 1) + 0.075 * (w - 1) * (w - 1);
/* 후반은 몬스터 공격력(용사가 받는 피해)이 가속: 스노볼 빌드 견제 */
export const enemyDmgScale = (w) => 1 + 0.06 * (w - 1) + Math.max(0, w - 15) * 0.07;
export const enemyGoldScale = (w) => 1 + 0.03 * w;
export const waveCount = (w) => 6 + Math.round(w * 1.6);
export const waveInterval = (w) => Math.max(0.7, 1.5 - w * 0.03);
/* 스노볼 방지: 후반 웨이브에서 성이 받는 피해 가속 (dungeon100의 threat ramp) */
export const castleDmgScale = (w) => 1 + Math.max(0, w - 15) * 0.08;

/* 웨이브 구성: 어떤 몬스터가 어느 확률로 나오나 (w = 웨이브 번호) */
export function waveMix(w) {
  const mix = [{ type: 'goblin', weight: 10 }];
  if (w >= 2) mix.push({ type: 'orc', weight: Math.min(3 + w * 0.5, 9) });
  if (w >= 3) mix.push({ type: 'wolf', weight: Math.min(2 + w * 0.4, 6) });
  if (w >= 4) mix.push({ type: 'troll', weight: Math.min(1 + w * 0.35, 6) });
  if (w >= 6) mix.push({ type: 'shaman', weight: Math.min(1 + w * 0.25, 4) });
  return mix;
}
export const isBossWave = (w) => w % 5 === 0;

/* ---------- 전투 세부 ---------- */
export const MELEE_RANGE = 92;        // 근접 용사 사거리(px)
export const MELEE_BEHIND = 30;       // 등 뒤 허용
export const BLOCK_DIST = 38;         // 몬스터가 용사 앞에 멈추는 거리
export const ENEMY_ATK_PERIOD = 0.9;  // 몬스터 공격 주기(초)
export const ARROW_SPEED = 540;
export const ORB_SPEED = 300;

/* ---------- 메타 진행 (별의 축복: 게임 오버 후에도 유지) ---------- */
export const shardReward = (wave, bossKills) => Math.max(1, (wave - 1) * 2 + bossKills * 5);
export const META_UPGRADES = {
  startGold: { name: '시작 골드',   emoji: '💰', max: 5,  cost: (lv) => 8 + lv * 6,  per: '+30G',   apply: (lv) => START_GOLD + lv * 30 },
  castleHp:  { name: '성 체력',     emoji: '🏰', max: 5,  cost: (lv) => 8 + lv * 6,  per: '+20',    apply: (lv) => CASTLE_HP + lv * 20 },
  heroDmg:   { name: '용사 공격력', emoji: '⚔️', max: 10, cost: (lv) => 10 + lv * 8, per: '+5%',    apply: (lv) => 1 + lv * 0.05 },
  mathBonus: { name: '수학 보상',   emoji: '🧮', max: 5,  cost: (lv) => 6 + lv * 5,  per: '+20%',   apply: (lv) => 1 + lv * 0.2 },
};
