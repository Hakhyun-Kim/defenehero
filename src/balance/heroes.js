/* =====================================================
 * 용사 — 등급 사다리 / 직업 정의 / 조합 레시피 그래프
 *
 * 이 파일은 "구조"에 가깝다: CLASSES와 RECIPES가 만드는 3세대 조합 그래프는
 * 게임의 정체성이라 타깃(어린이/성인)이 달라져도 대부분 그대로 간다.
 * 반대로 dmg/spd/range 같은 개별 수치는 밸런스 봇으로 흔드는 대상이다.
 * ===================================================== */

/* 소환 확률(%) — 고정. 전설은 소환으로 거의 안 나오고 조합으로 얻는 게 정석 */
export const SUMMON_PROBS = [64, 26.5, 8, 1.5];

/* 등급 사다리. 레벨 개념은 없다 — 강해지는 길은 오직 "조합". */
export const TIERS = [
  { name: '일반', color: '#8a97a8', mult: 1 },
  { name: '희귀', color: '#3b82f6', mult: 2.8 },
  { name: '영웅', color: '#a855f7', mult: 7.2 },
  { name: '전설', color: '#f59e0b', mult: 13 },
  { name: '신화', color: '#ff4d9d', mult: 14 },
];
export const MAX_TIER = 4;
/* ★ 등급 천장은 이제 하나다: **모든 직업이 신화(4)까지.**
 * 예전엔 기본·특수 용사가 전설(3)에서 끝났는데, 후반에 전설이 쌓이면
 * 조합 재료도 못 되고 팔기도 아까운 "끝난 카드"가 됐다 — 제일 재미있어야 할
 * 구간에서 할 일이 사라졌다. 이제 규칙은 한 줄이다:
 *   같은 등급 2명 = 등급 UP, 천장은 모두 신화.
 * 신화 용사(검성/대마도사/수호천사)의 정점 자리는 그대로다 — 기본 수치가
 * 두 배쯤 높아서, 같은 신화 등급이라도 급이 다르다. */
export const maxTierOf = () => MAX_TIER;

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

/* 신화 등급 특수능력 이름 — 이제 모든 직업이 신화가 되므로 전원 몫이 있다.
 * 내용은 MYTHIC_OVERRIDES가 실제로 바꾸는 것과 일치해야 한다(과장 금지). */
export const MYTHIC_ABILITIES = {
  knight:       { name: '섬광 회전베기', desc: '사거리 안 전부 베고, 치명타 45%·3.4배!' },
  guard:        { name: '절대 결계',     desc: '결계가 더 짙어지고 장벽이 더 자주·더 길게!' },
  archer:       { name: '폭풍 관통',     desc: '화살이 일직선의 적 4명을 꿰뚫는다!' },
  mage:         { name: '초신성',        desc: '폭발이 최대로 커지고 더 뜨겁게 불태운다!' },
  spellblade:   { name: '겁화의 검무',   desc: '화상이 극에 달하고, 주변 전부를 벤다!' },
  windblade:    { name: '사연격',        desc: '한 번에 4번 벤다!' },
  paladin:      { name: '성역',          desc: '처치마다 성이 5 회복! 장벽도 더 강하게' },
  frostmage:    { name: '영겁의 빙하',   desc: '폭발이 커지고 적이 거의 멈출 만큼 얼린다!' },
  sentinel:     { name: '삼중 저격',     desc: '화살이 3명을 꿰뚫는다!' },
  spiritarcher: { name: '별의 폭우',     desc: '폭발이 최대로 커지고 적을 불태운다!' },
  swordsaint:   { name: '천검난무',   desc: '사거리 안 모든 적을 3번씩 베고 강하게 불태운다!' },
  archmage:     { name: '별의 종말',  desc: '폭발이 최대로 커지고 얼리며 불태운다!' },
  seraph:       { name: '천상의 심판', desc: '적 3명 관통 + 장벽 + 처치마다 성 회복 4!' },
};

export const PIERCE_WIDTH = 46;
export const BURN_DUR = 3;
/* 등급업 조합 시 "럭키!" 확률: 한 번에 두 등급 점프 (럭키 디펜스 참고).
 * 단, 전설은 럭키로 건너뛸 수 없다 — 정규 비용을 치러야 한다. */
export const LUCKY_JUMP = 0.05;
export const LUCKY_MAX_TIER = 2;

/* ---------- 용사 능력치 ----------
 * 레벨 개념 없음 — 강해지는 유일한 길은 조합(등급 상승 / 상위 직업). */
export function heroStats(cls, tier) {
  const C = CLASSES[cls];
  return { dmg: Math.round(C.dmg * TIERS[tier].mult) };
}

/* 투사체 속도 */
export const ARROW_SPEED = 540;
export const ORB_SPEED = 300;
