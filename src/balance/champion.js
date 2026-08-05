/* =====================================================
 * 별지기 — 메인 캐릭터 (길을 순찰하는 왕국 최후의 기사)
 *
 * ★ 왜 존재하나: 신화 도감을 다 채우면 "할 게" 없어지는데 게임은 계속
 *   어려워진다. 용사는 조합이 끝이지만 별지기는 레벨·스킬트리로 끝없이
 *   자라고, 별똥별·은하수는 "지금 이 순간" 누르는 내 손이다.
 *   후반 콘텐츠 = 조합이 아니라 별지기의 성장 + 마법의 판단.
 *
 * 규칙 요약:
 *   - 웨이브 중엔 가장 앞선 몬스터에게 달려가 교전한다 (일반 몬스터는 잠시 붙잡는다)
 *   - 체력이 다하면 그 웨이브는 아웃 — 다음 준비 단계에 다시 일어난다
 *   - 마법은 별지기의 것이라 쓰러져 있으면 못 쓴다 (지키는 이유가 생긴다)
 *   - 모든 처치가 경험치를 주고, 웨이브 클리어가 보너스, 완벽 방어면 별조각까지
 * ===================================================== */

export const CHAMP = {
  name: '별지기 루나', short: '루나', emoji: '🌠',
  baseHp: 70, hpPerLv: 12,
  baseDmg: 9, dmgPerLv: 2.4,
  spd: 1.15,                    // 초당 공격 횟수
  range: 48,                    // 교전(근접) 거리
  moveSpd: 95,                  // 이동 속도 (논리px/초 — 대부분의 몬스터보다 조금 빠르다)
  crit: { chance: 0.2, mul: 2.0 },
  /* 교전 반격: 상대 castleDmg × 비율 = 별지기가 받는 초당 피해.
   * 성 피해 곡선(castleDmgScale)을 그대로 곱해 후반 몬스터일수록 아프다. */
  contactRatio: 0.5,
  bossContactMul: 1.3,          // 보스와 맞붙는 건 원래 무모한 일이다
};
export const CHAMP_HOME = { x: 350, y: 96 };        // 성문 앞 광장 (웨이브 시작 위치)
/* 붙잡기(길막): 한 번에 한 명, 최대 6초 — 그 뒤엔 4초간 붙잡히지 않는다.
 * 상한이 없으면 "못 죽이는데 안 죽는" 교착이 생길 수 있다. 보스는 안 잡힌다. */
export const CHAMP_HOLD = { max: 6, immune: 4 };
export const CHAMP_AURA = { range: 95, mul: 0.8 };  // 수호 스킬 [별의 결계]

/* ---------- 경험치 ----------
 * 모든 처치가 조금씩 주고(지휘관은 전장을 본다), 직접 처치는 두 배.
 * 웨이브 클리어가 보너스, 성이 무피해면(완벽 방어) 더 크게 + 별조각 1. */
export const CHAMP_XP = {
  kill: 1, elite: 3, midBoss: 6, boss: 14,
  ownKillMul: 2,
  clear: (w) => 8 + w * 2,
  perfectMul: 1.6,
  maxLevel: 30,
};
export const champXpNeed = (lv) => Math.round(26 * Math.pow(1.18, lv - 1));

/* ---------- 마법 ----------
 * 별똥별: 무료·쿨다운. 보스가 있으면 보스에게, 없으면 성문에 제일 가까운 적에게.
 *   피해 = 고정 + 별지기 공격력 비례 + 대상 최대체력의 5% (보스전에서도 의미가 있게)
 * 은하수(궁극기): 처치로 충전, 가득 차면 화면의 모든 적을 때리고 얼린다.
 * 별똥별이 준비된 채 한참 놀고 있으면 별지기가 알아서 쓴다 —
 * 버튼을 잊은 아이의 화면에서도 별은 떨어져야 한다. */
export const STAR = {
  base: 26, dmgMul: 3.2, pctHp: 0.035,
  splash: 66, splashRatio: 0.5,
  cd: 9,
  autoAfter: 12,                // 준비된 채 이만큼 지나면 자동 시전
};
export const ULT = {
  dmgMul: 8, pctHp: 0.09,
  slow: { mul: 0.5, dur: 3.5 },
  /* 충전량 (처치당) */
  kill: 0.012, elite: 0.02, mid: 0.06, boss: 0.12, wave: 0.15,
};

/* ---------- 스킬트리 (별자리) ----------
 * 세 별자리 × 세 별. need = 같은 별자리에 먼저 쓴 포인트 수 (선행 조건).
 * 값은 "행동이 바뀌는 별"이 각 별자리의 끝에 오도록 배열했다 —
 * 숫자 스킬은 계단, 마지막 별은 보상. */
export const CHAMP_BRANCHES = {
  blade: { name: '별빛 검술', emoji: '⚔️' },
  star:  { name: '별똥별',   emoji: '☄️' },
  guard: { name: '수호 별자리', emoji: '🛡️' },
};
export const CHAMP_SKILLS = {
  blade1: { branch: 'blade', name: '별빛 검격', emoji: '⚔️', max: 3, need: 0, per: '공격력 +25%',        desc: '검이 별빛으로 벼려진다' },
  blade2: { branch: 'blade', name: '유성 검무', emoji: '💨', max: 2, need: 1, per: '공격속도 +18%',      desc: '유성처럼 빠르게 벤다' },
  blade3: { branch: 'blade', name: '회전 베기', emoji: '🌀', max: 1, need: 3, per: '주변 전체 타격',     desc: '한 번 벨 때 주변 모두를 벤다!' },
  star1:  { branch: 'star',  name: '큰 별똥별', emoji: '☄️', max: 3, need: 0, per: '별똥별 피해 +35%',   desc: '더 크고 뜨거운 별이 떨어진다' },
  star2:  { branch: 'star',  name: '빠른 부름', emoji: '⏱️', max: 2, need: 1, per: '별똥별 쿨다운 -20%', desc: '별이 부름에 빨리 응답한다' },
  star3:  { branch: 'star',  name: '세쌍둥이 별', emoji: '✨', max: 1, need: 3, per: '별똥별 3개',        desc: '별똥별이 세 개씩 떨어진다!' },
  guard1: { branch: 'guard', name: '별의 갑옷', emoji: '💖', max: 3, need: 0, per: '체력 +30%',          desc: '별빛이 갑옷이 된다' },
  guard2: { branch: 'guard', name: '수호의 빛', emoji: '🕯️', max: 2, need: 1, per: '처치 시 성 +1 회복', desc: '별지기의 승리가 성을 치유한다' },
  guard3: { branch: 'guard', name: '별의 결계', emoji: '❄️', max: 1, need: 3, per: '주변 적 20% 감속',   desc: '별지기 곁에서 적이 느려진다' },
};
/* 봇/데모가 찍는 순서 — 사람 없이도 그럴듯하게 자라야 밸런스 봇이 실제 플레이와 같아진다 */
export const SKILL_PLAN = ['blade1', 'guard1', 'star1', 'blade2', 'star2', 'blade3', 'guard2', 'star3', 'guard3'];

/* ---------- 별의 축복 (영구 성장) ----------
 * 별조각을 쓸 곳이 넷뿐이라 축복이 심심했다 — 별지기 세 줄이 여기에 얹힌다.
 * apply는 economy.js의 META_UPGRADES가 그대로 가져다 쓴다. */
export const champHpMul  = (lv) => 1 + 0.12 * (lv || 0);
export const champDmgMul = (lv) => 1 + 0.10 * (lv || 0);
export const champUltMul = (lv) => 1 + 0.12 * (lv || 0);
