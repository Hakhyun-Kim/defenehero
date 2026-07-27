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

/* ---------- 경제 ----------
 * 판매는 확실히 손해: 소환가 50 대비 일반 12(-76%).
 * 조합으로 올린 등급도 되팔면 투입 골드의 절반 이하만 회수된다. */
export const START_GOLD = 150;
export const SUMMON_COST = 50;
export const BENCH_MAX = 12;
export const SELL_PRICE = [12, 30, 70, 160];
/* 수학 문제로 골드를 벌던 창구가 없어졌으니 전투 보상이 주 수입원 */
export const WAVE_BONUS = (w) => 30 + w * 9;

/* ---------- 수학 (조합 전용) ----------
 * 수학 문제는 "조합의 관문"으로만 등장한다 — 따로 풀 이유를 억지로 만들지 않고,
 * 게임 진행에 반드시 필요한 순간에만 자연스럽게 만난다.
 * 첫 시도에 맞히면 조합 비용의 일부를 환급해 정확도를 보상한다. */
/* 첫 시도 정답 환급률 — 높은 학년 문제를 고르면 크게 돌려받는다
 * (3학년 15% … 6학년 45%) → 어려운 수학에 도전할 이유가 생긴다 */
export const refundRatio = (grade) => 0.15 + (Math.max(3, Math.min(6, grade)) - 3) * 0.10;
export const HINT_GOLD = 30;          // 힌트는 골드로 산다

/* ---------- 수학 난이도 (조합 난이도와 1:1로 묶인다) ----------
 * 핵심 규칙: **만들기 어려운 용사일수록 문제도 어렵고 시간도 빠듯하다.**
 * 등급업 희귀(⭐) … 신화 조합(⭐⭐⭐⭐⭐)까지 5단계.
 * 덕분에 "전설·신화를 만드는 순간"이 게임 안에서 가장 긴장되는 장면이 된다. */
export const MATH_LEVELS = [
  null,
  { name: '쉬움',   stars: '⭐',          color: '#3aa76d', time: 45 },
  { name: '보통',   stars: '⭐⭐',        color: '#2478e0', time: 50 },
  { name: '어려움', stars: '⭐⭐⭐',      color: '#a855f7', time: 62 },
  { name: '고난도', stars: '⭐⭐⭐⭐',    color: '#f59e0b', time: 78 },
  { name: '극한',   stars: '⭐⭐⭐⭐⭐',  color: '#ff4d9d', time: 95 },
];
/* 결과 등급(1~4) + 레시피/신화 프리미엄 → 1~5 */
export const mathLevel = (resultTier, isRecipe, isMythic) => {
  const base = [1, 1, 2, 3, 5][Math.max(0, Math.min(4, resultTier))];
  return Math.max(1, Math.min(5, base + (isRecipe ? 1 : 0) + (isMythic ? 1 : 0)));
};
/* 학년이 높으면 계산량 자체가 많으니 시간을 조금 더 준다 */
export const mathTime = (lv, grade) =>
  MATH_LEVELS[Math.max(1, Math.min(5, lv))].time + (Math.max(3, Math.min(6, grade)) - 3) * 8;
/* 최고 난이도(신화 조합)는 "2문제 연속 정답" 관문 — 한 번 틀리면 1단계부터 */
export const mathRounds = (lv) => (lv >= 5 ? 2 : 1);
export const TIME_WARN = 0.3;          // 남은 시간 30% 이하 = 긴박 연출
/* 빨리 풀수록 환급이 커진다 (남은 시간 비율 × 최대 60%) */
export const SPEED_BONUS_MAX = 0.6;
/* 지혜 연승: 한 번에 맞힌 문제가 연달아 쌓이면 환급 배수가 오른다 (최대 2배) */
export const streakMul = (n) => 1 + Math.min(4, Math.max(0, n - 1)) * 0.25;
export const STREAK_MAX = 5;

/* 소환 확률(%) — 고정. 전설은 소환으로 거의 안 나오고 조합으로 얻는 게 정석 */
export const SUMMON_PROBS = [64, 26.5, 8, 1.5];

/* ---------- 용사 ----------
 * 등급 사다리. 레벨 개념은 없다 — 강해지는 길은 오직 "조합".
 * 신화(4)는 **조합 레시피로만** 도달할 수 있다(등급업으로는 전설이 천장). */
export const TIERS = [
  { name: '일반', color: '#8a97a8', mult: 1 },
  { name: '희귀', color: '#3b82f6', mult: 2.8 },
  { name: '영웅', color: '#a855f7', mult: 7.2 },
  { name: '전설', color: '#f59e0b', mult: 13 },
  { name: '신화', color: '#ff4d9d', mult: 14 },
];
export const MAX_TIER = 4;
/* 등급 천장은 "직업 세대"로 정해진다 — 규칙이 하나라 헷갈리지 않는다:
 *   기본·특수 용사 → 전설(3)이 최고
 *   신화 용사(검성/대마도사/수호천사) → 신화(4)까지
 * 즉 신화 등급은 "신화 용사"만 될 수 있다. 신화 용사는
 *   ① 특수 2종 조합(전설 재료면 곧바로 신화)  ② 전설 신화용사 2명 등급업
 * 두 경로 모두로 만들 수 있다. */
export const maxTierOf = (cls) => (CLASSES[cls] && CLASSES[cls].mythic ? 4 : 3);

/* 직업 정의 — 기본 4종(소환으로만 등장) + 특수 6종(레시피 조합으로만 탄생)
 * atk: melee(근접 즉시) | arrow(화살 투사체) | orb(구슬 투사체)
 * 수정자: hits(다단타), burn(화상 비율), slowOnHit, splash, splashSlow, healOnKill, pierce */
/* 사거리가 짧을수록 "확실한 기술"로 보상한다:
 *  - 검사 계열 → 치명타(crit): 압도적 순간 화력
 *  - 수호병 계열 → 방패 장벽(block): 적을 잠시 완전히 멈춘다 (킹덤러시식 길막)
 *  - 성기사 = 둘 다 가진 프리미엄 근접 */
export const CLASSES = {
  /* --- 기본 --- */
  knight: {
    name: '검사', emoji: '⚔️', atk: 'melee', dmg: 15, spd: 1.1, range: 100,
    crit: { chance: 0.3, mul: 2.5 },
    desc: '짧은 사거리 대신 압도적 한 방! 치명타로 크게 벱니다',
  },
  guard: {
    name: '수호병', emoji: '🛡️', atk: 'melee', dmg: 8, spd: 0.9, range: 105,
    slowOnHit: { mul: 0.55, dur: 1.6 },
    block: { period: 5.5, dur: 1.3 },
    desc: '방패 장벽으로 적을 잠시 멈춰 세워요! 때린 적은 느려집니다',
  },
  archer: { name: '궁수',   emoji: '🏹', atk: 'arrow', dmg: 9,  spd: 1.6, range: 200, desc: '멀리까지 화살을 쏘아요' },
  mage:   { name: '마법사', emoji: '🔮', atk: 'orb',   dmg: 14, spd: 0.7, range: 155, splash: 62, desc: '폭발 마법으로 여럿을 공격해요' },

  /* --- 특수 (레시피 조합 전용) --- */
  spellblade: {
    name: '마검사', emoji: '🗡️', special: true, recipe: ['knight', 'mage'],
    atk: 'melee', dmg: 15, spd: 1.0, range: 105, burn: 0.22,
    crit: { chance: 0.22, mul: 2.2 },
    desc: '불타는 검! 벤 적이 계속 불타고, 치명타도 터져요',
  },
  windblade: {
    name: '질풍검객', emoji: '🌪️', special: true, recipe: ['knight', 'archer'],
    atk: 'melee', dmg: 8, spd: 1.4, range: 105, hits: 2,
    crit: { chance: 0.25, mul: 2.0 },
    desc: '2연속 베기! 각 타격마다 치명타 기회',
  },
  paladin: {
    name: '성기사', emoji: '⚜️', special: true, recipe: ['knight', 'guard'],
    atk: 'melee', dmg: 12, spd: 0.95, range: 105, healOnKill: 1,
    crit: { chance: 0.25, mul: 2.2 },
    block: { period: 7, dur: 1.0 },
    desc: '치명타 + 방패 장벽 + 처치 시 성 회복까지! 최강 근접',
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

  /* --- 신화 (특수 + 특수 = 3세대 조합의 정점) --- */
  swordsaint: {
    name: '검성', emoji: '⚡', mythic: true, recipe: ['spellblade', 'windblade'],
    atk: 'melee', dmg: 20, spd: 1.3, range: 115, hits: 2, burn: 0.3,
    crit: { chance: 0.35, mul: 2.6 }, cleave: true,
    desc: '사거리 안 모든 적을 2번씩 베고 불태운다! 치명타 35%',
  },
  archmage: {
    name: '대마도사', emoji: '🌌', mythic: true, recipe: ['frostmage', 'spiritarcher'],
    atk: 'orb', dmg: 22, spd: 0.85, range: 205, splash: 95,
    splashSlow: { mul: 0.5, dur: 1.8 }, burn: 0.2,
    desc: '거대한 별의 폭발 — 얼리고 불태우며 광범위를 쓸어버린다',
  },
  seraph: {
    name: '수호천사', emoji: '😇', mythic: true, recipe: ['paladin', 'sentinel'],
    atk: 'arrow', dmg: 24, spd: 0.95, range: 250,
    slowOnHit: { mul: 0.55, dur: 1.5 }, block: { period: 4.5, dur: 1.5 },
    healOnKill: 2, crit: { chance: 0.25, mul: 2.2 },
    desc: '초장거리 저격 + 방패 장벽 + 처치마다 성 회복 2 — 완전체',
  },
};

/* 정지(길막) 관련 */
export const STUN_BOSS_MUL = 0.35;      // 보스는 정지에 강하게 저항
/* 한 번 멈춘 적은 잠시 면역 — 수호병을 여러 명 겹쳐 영구 정지시키는 것을 막는다 */
export const STUN_IMMUNE = 2.6;
export const RANGE_MAX = 260;           // UI 사거리 바의 기준(최댓값)
export const CLASS_KEYS = Object.keys(CLASSES);
/* 소환으로는 기본 4종만 — 특수·신화는 조합으로만 얻는다 */
export const GACHA_KEYS = CLASS_KEYS.filter(k => !CLASSES[k].special && !CLASSES[k].mythic);

/* 레시피 목록 (UI 도감·봇 공용). gen 2 = 특수, gen 3 = 신화 */
export const RECIPES = CLASS_KEYS
  .filter(k => CLASSES[k].recipe)
  .map(k => ({
    result: k,
    a: CLASSES[k].recipe[0],
    b: CLASSES[k].recipe[1],
    gen: CLASSES[k].mythic ? 3 : 2,
  }));

export function findRecipe(clsA, clsB) {
  return RECIPES.find(r => (r.a === clsA && r.b === clsB) || (r.a === clsB && r.b === clsA)) || null;
}

/* 전설 등급 특수능력: 수치가 아니라 "행동"이 바뀐다 */
export const LEGEND_ABILITIES = {
  knight:       { name: '회전베기',   desc: '사거리 안 모든 적을 한 번에 벤다! 치명타 40%·3배' },
  guard:        { name: '서리 결계',  desc: '주변이 계속 느려지고, 방패 장벽이 더 자주·더 길게!' },
  archer:       { name: '관통 화살',  desc: '화살이 일직선의 적 3명을 꿰뚫는다!' },
  mage:         { name: '화염 폭발',  desc: '폭발이 커지고 적을 3초간 불태운다!' },
  spellblade:   { name: '화염 폭풍',  desc: '화상이 두 배로 강해진다!' },
  windblade:    { name: '삼연격',     desc: '한 번에 3번 벤다!' },
  paladin:      { name: '축복',       desc: '처치할 때마다 성이 3 회복! 장벽도 더 강하게' },
  frostmage:    { name: '절대영도',   desc: '폭발이 커지고 더 강하게 얼린다!' },
  sentinel:     { name: '이중 저격',  desc: '화살이 2명을 꿰뚫는다!' },
  spiritarcher: { name: '유성우',     desc: '폭발이 커지고 적을 불태운다!' },
};

/* 전설이 되면 덮어씌워지는 수정자 */
export const LEGEND_OVERRIDES = {
  knight:       { cleave: true, crit: { chance: 0.4, mul: 3 } },
  guard:        { aura: 0.5, block: { period: 4, dur: 1.9 } },
  archer:       { pierce: 3 },
  mage:         { splashMul: 1.5, burn: 0.25 },
  spellblade:   { burn: 0.45 },
  windblade:    { hits: 3 },
  paladin:      { healOnKill: 3, block: { period: 5, dur: 1.5 } },
  frostmage:    { splashMul: 1.3, splashSlow: { mul: 0.45, dur: 2.0 } },
  sentinel:     { pierce: 2 },
  spiritarcher: { splashMul: 1.6, burn: 0.15 },
  /* 신화 클래스가 전설 등급일 때 (신화 등급 전 단계) */
  swordsaint:   { crit: { chance: 0.4, mul: 2.8 } },
  archmage:     { splashMul: 1.15 },
  seraph:       { pierce: 2 },
};

/* 신화(4) 등급에서 추가로 덮어씌워지는 수정자 — 등급 자체가 능력을 준다 */
export const MYTHIC_OVERRIDES = {
  knight:       { crit: { chance: 0.45, mul: 3.4 } },
  guard:        { aura: 0.42, block: { period: 3.4, dur: 2.2 } },
  archer:       { pierce: 4 },
  mage:         { splashMul: 1.8, burn: 0.32 },
  spellblade:   { burn: 0.6, cleave: true },
  windblade:    { hits: 4 },
  paladin:      { healOnKill: 5, block: { period: 4, dur: 1.9 } },
  frostmage:    { splashMul: 1.6, splashSlow: { mul: 0.38, dur: 2.4 } },
  sentinel:     { pierce: 3 },
  spiritarcher: { splashMul: 1.9, burn: 0.25 },
  swordsaint:   { hits: 3, crit: { chance: 0.45, mul: 3 }, burn: 0.45 },
  archmage:     { splashMul: 1.35, burn: 0.3, splashSlow: { mul: 0.4, dur: 2.2 } },
  seraph:       { pierce: 3, healOnKill: 4, block: { period: 3.8, dur: 1.9 } },
};

export const MYTHIC_ABILITIES = {
  swordsaint:   { name: '천검난무',   desc: '사거리 안 모든 적을 3번씩 베고 강하게 불태운다!' },
  archmage:     { name: '별의 종말',  desc: '폭발이 최대로 커지고 얼리며 불태운다!' },
  seraph:       { name: '천상의 심판', desc: '적 3명 관통 + 장벽 + 처치마다 성 회복 4!' },
};

export const PIERCE_WIDTH = 46;
export const BURN_DUR = 3;
export const COMBO = { window: 3, x2At: 6, x3At: 12 };
/* 등급업 조합 시 "럭키!" 확률: 한 번에 두 등급 점프 (럭키 디펜스 참고).
 * 단, 전설은 럭키로 건너뛸 수 없다 — 정규 비용을 치러야 한다. */
export const LUCKY_JUMP = 0.05;
export const LUCKY_MAX_TIER = 2;

/* ---------- 조합 비용 ----------
 * 결과 등급이 높을수록 급격히 비싸진다. 인덱스 = 결과 등급 */
export const COMBINE_COST = [0, 60, 300, 1200, 2800];
/* 특수 레시피는 25% 프리미엄 (강력한 대신 값비싸다) */
export const RECIPE_COST_MUL = 1.25;
export const combineCost = (resultTier, isRecipe) =>
  Math.round(COMBINE_COST[resultTier] * (isRecipe ? RECIPE_COST_MUL : 1));

/* ---------- 용사 능력치 ----------
 * 레벨 개념 없음 — 강해지는 유일한 길은 조합(등급 상승 / 상위 직업). */
export function heroStats(cls, tier) {
  const C = CLASSES[cls];
  return { dmg: Math.round(C.dmg * TIERS[tier].mult) };
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

/* ---------- 몬스터 ----------
 * 일반 / 중간보스(매 웨이브) / 대보스(5웨이브마다) 3층 구조 */
export const ENEMY_TYPES = {
  goblin:  { name: '고블린',     emoji: '👺', hp: 40,   spd: 62,  gold: 8,   castleDmg: 5,  size: 30 },
  wolf:    { name: '늑대',       emoji: '🐺', hp: 26,   spd: 105, gold: 10,  castleDmg: 4,  size: 30 },
  orc:     { name: '오크',       emoji: '👹', hp: 115,  spd: 44,  gold: 16,  castleDmg: 8,  size: 34 },
  troll:   { name: '트롤',       emoji: '🧌', hp: 270,  spd: 32,  gold: 32,  castleDmg: 12, size: 40 },
  shaman:  { name: '주술사',     emoji: '🧙', hp: 90,   spd: 38,  gold: 24,  castleDmg: 8,  size: 32, heal: 18, healPeriod: 1.6, healRange: 130 },

  /* 중간보스 — 매 웨이브 마지막에 등장, 3종이 순환 (일반 몬스터의 2~3배 체력) */
  ogrelord:    { name: '오우거 군주', emoji: '👿', hp: 780, spd: 30, gold: 90, castleDmg: 22, size: 50, midBoss: true },
  bonelord:    { name: '해골 장군',   emoji: '💀', hp: 600, spd: 42, gold: 85, castleDmg: 18, size: 47, midBoss: true },
  spiderqueen: { name: '거미 여왕',   emoji: '🕷️', hp: 680, spd: 36, gold: 95, castleDmg: 20, size: 48, midBoss: true,
                 heal: 22, healPeriod: 1.8, healRange: 160 },

  /* 대보스 — 5웨이브마다, 체력 절반에서 분노 */
  boss:  { name: '보스 드래곤',   emoji: '🐉', hp: 2000, spd: 26, gold: 260, castleDmg: 45, size: 58, boss: true,
           enrageAt: 0.5, enrageSpd: 1.45 },
  boss2: { name: '고대 파괴자',   emoji: '🦖', hp: 2350, spd: 23, gold: 300, castleDmg: 50, size: 60, boss: true,
           enrageAt: 0.5, enrageSpd: 1.4 },
};

/* 중간보스는 매 웨이브, 대보스는 5웨이브마다 (두 종류가 번갈아) */
export const MIDBOSS_CYCLE = ['ogrelord', 'bonelord', 'spiderqueen'];
export const midBossType = (w) => MIDBOSS_CYCLE[(w - 1) % MIDBOSS_CYCLE.length];
export const GREAT_BOSS_CYCLE = ['boss', 'boss2'];
export const greatBossType = (w) => GREAT_BOSS_CYCLE[(Math.floor(w / 5) - 1) % GREAT_BOSS_CYCLE.length];
/* 보스 등장 몇 초 전에 경고 */
export const BOSS_WARN_LEAD = 2.6;
/* 초반 중간보스는 약하게 시작해 5웨이브에 제 위력 (입문자 배려) */
export const midBossRamp = (w) => Math.min(1, 0.45 + w * 0.12);

/* ---------- 난이도 ---------- */
export const DIFFICULTIES = {
  easy:   { name: '쉬움',   emoji: '🌱', hpMul: 0.75, countMul: 0.8,  goldMul: 1.15 },
  normal: { name: '보통',   emoji: '⚔️', hpMul: 1.0,  countMul: 1.0,  goldMul: 1.0 },
  hard:   { name: '어려움', emoji: '🔥', hpMul: 1.3,  countMul: 1.15, goldMul: 0.95 },
};

/* 마릿수가 늘어난 만큼 개체 체력 곡선은 완화 — "많이 몰려오지만 하나하나는 잡힌다"
 * + 12웨이브 이후 가속: 장기전(고수)만 조이고 초반은 건드리지 않는다 */
export const hpScale = (w) =>
  1 + 0.18 * (w - 1) + 0.04 * (w - 1) * (w - 1) + 0.075 * Math.pow(Math.max(0, w - 12), 2);
export const enemyGoldScale = (w) => 1 + 0.03 * w;
/* 마릿수: 초반부터 넉넉하게, 뒤로 갈수록 크게 증가 (타격감 + 압박) */
export const waveCount = (w) => 8 + Math.round(w * 1.9);
export const castleDmgScale = (w) => 1 + Math.max(0, w - 15) * 0.08;

/* ---------- 분대(스쿼드) 스폰 ----------
 * 한 마리씩 찔끔 나오지 않고 2~6마리가 한 덩어리로 몰려온다.
 * 분대 안 간격은 촘촘(0.18s), 분대 사이는 넉넉(정비 시간). */
export const squadSize = (w) => {
  const base = 3 + Math.floor(w / 3);              // w1~2:3, w3~5:4, w6~8:5 …
  return Math.min(7, base);
};
export const SQUAD_INNER_GAP = 0.18;               // 분대 내부 간격(초)
export const squadGap = (w) => Math.max(2.5, 4.6 - w * 0.1);   // 분대 사이 간격(초)

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
