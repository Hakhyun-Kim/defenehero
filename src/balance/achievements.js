/* =====================================================
 * 업적 — 세션을 넘는 목표. 달성하면 별조각을 주고, 일부는 옷장을 연다.
 *
 * check(c)의 c = { state, codex, mathLog, bestWave }
 *   state   : 지금 판 (없으면 null — 판 밖에서도 평가할 수 있게 방어)
 *   codex   : 기기 누적 도감 { heroes: {"cls:tier":n}, kills: {type:n} }
 *   mathLog : 기기 누적 수학 기록 { total, correct, clean, types }
 *   bestWave: 모든 난이도를 통틀어 가장 멀리 간 웨이브
 *
 * 규칙: 한 번 달성하면 영원히 남는다(기기 저장). 조건은 전부 "숫자 비교"라
 * 아무 때나 다시 평가해도 싸다 — 언제 부를지는 main이 정한다.
 * ===================================================== */
import { CLASSES, CLASS_KEYS, minTierOf, MAX_TIER } from './heroes.js';
import { ENEMY_TYPES } from './enemies.js';

/* 도감 칸 수 — 태어날 수 있는 (직업, 등급) 조합만 센다 */
export const CODEX_HERO_CELLS = CLASS_KEYS.reduce((s, k) => s + (MAX_TIER + 1 - minTierOf(k)), 0);
export const CODEX_ENEMY_CELLS = Object.keys(ENEMY_TYPES).length;

const heroCellsFilled = (codex) =>
  Object.keys(codex.heroes).filter(k => codex.heroes[k] > 0).length;
const madeClass = (codex, cls) =>
  Object.keys(codex.heroes).some(k => k.startsWith(cls + ':') && codex.heroes[k] > 0);
const madeTier = (codex, tier) =>
  Object.keys(codex.heroes).some(k => Number(k.split(':')[1]) >= tier && codex.heroes[k] > 0);

export const ACHIEVEMENTS = [
  { key: 'firstCombine', emoji: '⚗️', name: '첫 조합',
    desc: '용사 조합에 처음 성공하기', shards: 2,
    check: (c) => !!c.state && c.state.combos >= 1 },
  { key: 'firstSpecial', emoji: '✨', name: '새 직업의 탄생',
    desc: '특수 용사를 처음 만들기', shards: 3,
    check: (c) => CLASS_KEYS.some(k => CLASSES[k].special && madeClass(c.codex, k)) },
  { key: 'firstLegend', emoji: '👑', name: '전설의 시작',
    desc: '전설 등급 용사 만들기', shards: 5,
    unlocks: { axis: 'hair', key: 'pink' },
    check: (c) => madeTier(c.codex, 3) },
  { key: 'firstMythic', emoji: '🌌', name: '신화의 문',
    desc: '신화 등급 용사 만들기', shards: 10,
    unlocks: { axis: 'star', key: 'violet' },
    check: (c) => madeTier(c.codex, 4) },
  { key: 'mythicTrio', emoji: '⚡', name: '신화 삼총사',
    desc: '검성·대마도사·수호천사를 모두 만들어 보기', shards: 15,
    unlocks: { axis: 'outfit', key: 'snow' },
    check: (c) => ['swordsaint', 'archmage', 'seraph'].every(k => madeClass(c.codex, k)) },

  { key: 'wave10', emoji: '🌊', name: '열 번째 밤',
    desc: '10웨이브 클리어', shards: 5,
    check: (c) => c.bestWave >= 10 },
  { key: 'wave20', emoji: '🌊', name: '스무 번째 밤',
    desc: '20웨이브 클리어', shards: 10,
    unlocks: { axis: 'hair', key: 'sky' },
    check: (c) => c.bestWave >= 20 },
  { key: 'victory', emoji: '🌅', name: '서른 번째 아침',
    desc: '30웨이브를 클리어하고 아침을 맞기', shards: 20,
    unlocks: { axis: 'outfit', key: 'sunset' },
    check: (c) => c.victories >= 1 },
  { key: 'trial', emoji: '🌟', name: '별의 시련',
    desc: '시련(2회차 이상)에서 다시 서른 번째 아침 맞기', shards: 30,
    unlocks: { axis: 'star', key: 'lime' },
    check: (c) => c.trialClears >= 1 },

  { key: 'perfect3', emoji: '🛡️', name: '철벽 수비',
    desc: '한 판에서 완벽 방어 3번 (성 무피해)', shards: 6,
    check: (c) => !!c.state && c.state.perfectWaves >= 3 },
  { key: 'streak5', emoji: '🔥', name: '지혜 5연승',
    desc: '수학 문제를 다섯 번 연달아 한 번에 맞히기', shards: 5,
    unlocks: { axis: 'hair', key: 'gold' },
    check: (c) => !!c.state && c.state.bestStreak >= 5 },
  { key: 'persist3', emoji: '💪', name: '포기를 모르는',
    desc: '한 판에서 틀렸다가 끝내 맞히기 3번', shards: 6,
    check: (c) => !!c.state && (c.state.persisted || 0) >= 3 },
  { key: 'boss3', emoji: '🐉', name: '용 사냥꾼',
    desc: '한 판에서 대보스 3마리 처치', shards: 8,
    check: (c) => !!c.state && c.state.bossKills >= 3 },
  { key: 'champ10', emoji: '🌠', name: '빛나는 별지기',
    desc: '별지기 레벨 10 달성', shards: 6,
    unlocks: { axis: 'weapon', key: 'dual' },
    check: (c) => !!c.state && !!c.state.champ && c.state.champ.level >= 10 },
  { key: 'feast3', emoji: '🎉', name: '잔치의 달인',
    desc: '한 판에서 잔치 3번 벌이기', shards: 4,
    check: (c) => !!c.state && (c.state.feasts || 0) >= 3 },

  { key: 'math100', emoji: '🧮', name: '백 문제의 현자',
    desc: '수학 문제 100개 풀기 (누적)', shards: 10,
    unlocks: { axis: 'weapon', key: 'staff' },
    check: (c) => c.mathLog.total >= 100 },
  { key: 'clean50', emoji: '✏️', name: '한 번에 쉰 문제',
    desc: '한 번에·힌트 없이 맞히기 50번 (누적)', shards: 10,
    check: (c) => c.mathLog.clean >= 50 },

  { key: 'codexHalf', emoji: '📖', name: '도감 절반',
    desc: `용사 도감 절반 채우기 (${Math.ceil(CODEX_HERO_CELLS / 2)}칸)`, shards: 10,
    unlocks: { axis: 'outfit', key: 'rose' },
    check: (c) => heroCellsFilled(c.codex) >= Math.ceil(CODEX_HERO_CELLS / 2) },
  { key: 'codexFull', emoji: '🏆', name: '도감 완성',
    desc: `용사 도감 전부 채우기 (${CODEX_HERO_CELLS}칸)`, shards: 30,
    check: (c) => heroCellsFilled(c.codex) >= CODEX_HERO_CELLS },
  { key: 'monsterDoc', emoji: '👾', name: '몬스터 박사',
    desc: '모든 종류의 몬스터 물리치기', shards: 8,
    unlocks: { axis: 'star', key: 'sky' },
    check: (c) => Object.keys(ENEMY_TYPES).every(t => (c.codex.kills[t] || 0) > 0) },
];

/* 옷장 잠금표: axis → key → 여는 업적. 기본 선택지(각 축의 앞쪽)는 잠그지 않는다 —
 * 기존 플레이어가 이미 입은 옷이 잠기는 일이 없도록 main이 "지금 입은 옷"도 열린 것으로 친다. */
export const WARDROBE_LOCKS = {};
for (const a of ACHIEVEMENTS) {
  if (!a.unlocks) continue;
  (WARDROBE_LOCKS[a.unlocks.axis] || (WARDROBE_LOCKS[a.unlocks.axis] = {}))[a.unlocks.key] = a;
}
