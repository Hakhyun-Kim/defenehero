/* =====================================================
 * 몬스터 — 종류 / 보스 사이클 / 난이도 곡선
 *
 * ★ 성인판에서 가장 먼저 손댈 파일.
 *   hpScale / waveCount / squadSize 가 "지수로 벌어지는 적 vs 다항으로 크는 나"라는
 *   게임의 수학적 진실을 결정한다. 이 곡선을 바꾸면 게임의 성격 자체가 바뀐다.
 * ===================================================== */

/* 일반 / 중간보스(매 웨이브) / 대보스(5웨이브마다) 3층 구조 */
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
