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
  /* 뒤로 갈수록 같은 다섯 마리만 보여 지루해진다. 수치를 올리는 대신
     "배치를 다시 생각하게 만드는" 두 종류를 더한다. */
  bat:     { name: '박쥐떼',     emoji: '🦇', hp: 34,   spd: 150, gold: 12,  castleDmg: 3,  size: 26 },
  golem:   { name: '바위골렘',   emoji: '🗿', hp: 330,  spd: 22,  gold: 40,  castleDmg: 15, size: 42 },

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
  if (w >= 8) mix.push({ type: 'bat', weight: Math.min(1.5 + w * 0.2, 4) });
  if (w >= 11) mix.push({ type: 'golem', weight: Math.min(0.8 + (w - 10) * 0.2, 3) });
  return mix;
}
/* 엘리트 개체 — 몬스터 "등급"을 4단계로 나누면 아이가 못 읽는다(용사 등급 어휘와도 겹친다).
 * 대신 보통/특별 두 가지로만 나눈다. 금빛 테두리 하나면 즉시 알아본다. */
export const eliteChance = (w) => Math.min(0.11, Math.max(0, (w - 5) * 0.015));
export const ELITE = { hpMul: 2.2, goldMul: 2.5, sizeMul: 1.15, name: '성난' };

export const isBossWave = (w) => w % 5 === 0;

/* ---------- 신화의 압력 ----------
 * ★ 신화 용사가 나오면 게임이 갑자기 쉬워진다. 신화는 이 게임의 최종 목표라
 *   도달하는 순간 곡선이 꺾여서, 제일 재미있어야 할 구간이 제일 심심해졌다.
 *   그래서 몬스터도 같이 반응한다 — "신화의 기운을 느낀" 만큼 단단해지고,
 *   대신 잡으면 더 준다.
 *
 *   벌이 아니라 **판돈**이다. 세진 만큼 골드도 늘어서, 신화를 만든 보상은
 *   "쉬워짐"이 아니라 "더 큰 판에서 논다"가 된다.
 *   신화 4명이면 체력 +48% · 골드 +40%에서 멈춘다(무한히 조이면 벽이 된다). */
export const MYTHIC_PRESSURE_CAP = 4;
export const mythicHpMul = (n) => 1 + 0.12 * Math.min(MYTHIC_PRESSURE_CAP, Math.max(0, n));
export const mythicGoldMul = (n) => 1 + 0.10 * Math.min(MYTHIC_PRESSURE_CAP, Math.max(0, n));

/* ---------- 별의 시련 (회차) ----------
 * 30웨이브(서른 번째 아침)를 클리어하면 다음 회차를 시작할 수 있다.
 * 별지기의 성장은 그대로 이어지고, 용사·골드·성은 처음으로 돌아간다 —
 * 그래서 적은 회차마다 계단식으로 세져야 "같은 판의 재탕"이 되지 않는다.
 * 골드도 같이 올라간다: 신화의 압력과 같은 원리로, 벌이 아니라 판돈이다. */
export const VICTORY_WAVE = 30;
export const loopHpMul = (n) => Math.pow(1.45, Math.max(0, n || 0));
export const loopGoldMul = (n) => Math.pow(1.12, Math.max(0, n || 0));
export const loopCastleDmgMul = (n) => Math.pow(1.15, Math.max(0, n || 0));
/* 서른 번째 아침의 보상 — 회차가 깊을수록 크게 */
export const victoryShards = (loop) => 30 + (loop || 0) * 20;
