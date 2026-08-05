/* =====================================================
 * 경제 — 골드 수입 / 소환·판매 / 조합 비용 / 메타 진행
 *
 * 조합 비용 곡선(COMBINE_COST)이 "언제 상위 등급에 도달하는가"를 결정하고,
 * 그게 곧 성장 곡선이다. 적 체력 곡선(enemies.js)과 짝을 이루는 축.
 * ===================================================== */

import { CASTLE_HP } from './castle.js';
import { champHpMul, champDmgMul, champUltMul } from './champion.js';

/* ---------- 경제 ----------
 * 판매는 확실히 손해: 소환가 50 대비 일반 12(-76%).
 * 조합으로 올린 등급도 되팔면 투입 골드의 절반 이하만 회수된다. */
export const START_GOLD = 150;
export const SUMMON_COST = 50;
export const BENCH_MAX = 12;
export const SELL_PRICE = [12, 30, 70, 160];
/* 수학 문제로 골드를 벌던 창구가 없어졌으니 전투 보상이 주 수입원 */
export const WAVE_BONUS = (w) => 30 + w * 9;

/* 연속 처치 콤보 → 골드 배율 */
export const COMBO = { window: 3, x2At: 6, x3At: 12 };

/* ---------- 조합 비용 ----------
 * 결과 등급이 높을수록 급격히 비싸진다. 인덱스 = 결과 등급 */
export const COMBINE_COST = [0, 60, 300, 1200, 2800];
/* 특수 레시피는 25% 프리미엄 (강력한 대신 값비싸다) */
export const RECIPE_COST_MUL = 1.25;
export const combineCost = (resultTier, isRecipe) =>
  Math.round(COMBINE_COST[resultTier] * (isRecipe ? RECIPE_COST_MUL : 1));

/* ---------- 잔치 ----------
 * 돈 소비 콘텐츠: 준비 단계에 한 번, 골드를 태워 잔치를 벌이면 용사 하나가 랜덤 승급한다.
 * 같은 등급업을 조합으로 하면 더 싸고 원하는 용사를 고를 수 있다 — 잔치는 수학 관문을
 * 우회하는 지름길이 아니라, 넘치는 골드를 태우는 사치이자 복권이다.
 * 낮은 등급일수록 잘 뽑힌다: 잔치는 막내부터 챙긴다. */
export const feastCost = (w) => 300 + w * 35;
export const feastTierWeight = (tier) => 1 / (1 + tier * tier);
export const feastChampXp = (w) => 15 + w * 2;

/* ---------- 메타 진행 ---------- */
export const shardReward = (wave, bossKills) => Math.max(1, (wave - 1) * 2 + bossKills * 5);
export const META_UPGRADES = {
  startGold: { name: '시작 골드',   emoji: '💰', max: 5,  cost: (lv) => 8 + lv * 6,  per: '+30G', apply: (lv) => START_GOLD + lv * 30 },
  castleHp:  { name: '성 체력',     emoji: '🏰', max: 5,  cost: (lv) => 8 + lv * 6,  per: '+20',  apply: (lv) => CASTLE_HP + lv * 20 },
  heroDmg:   { name: '용사 공격력', emoji: '⚔️', max: 10, cost: (lv) => 10 + lv * 8, per: '+5%',  apply: (lv) => 1 + lv * 0.05 },
  mathBonus: { name: '수학 보상',   emoji: '🧮', max: 5,  cost: (lv) => 6 + lv * 5,  per: '+20%', apply: (lv) => 1 + lv * 0.2 },
  /* 별지기 축복 — 완벽 방어가 별조각을 주니, 별조각은 다시 별지기를 키운다 (순환) */
  champHp:   { name: '별지기 체력',   emoji: '💖', max: 5, cost: (lv) => 7 + lv * 5, per: '+12%', apply: champHpMul },
  champDmg:  { name: '별지기 공격력', emoji: '🌠', max: 5, cost: (lv) => 7 + lv * 5, per: '+10%', apply: champDmgMul },
  champUlt:  { name: '은하수 충전',   emoji: '🌌', max: 3, cost: (lv) => 8 + lv * 6, per: '+12%', apply: champUltMul },
};
