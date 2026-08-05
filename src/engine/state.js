/* =====================================================
 * 게임 상태 — 생성 · 저장 · 불러오기
 * ===================================================== */
import * as D from '../data.js';
import { champStats } from './champion.js';
import { makeHero, empowerHero, padOccupant, placeHero } from './roster.js';
import { buildWave } from './combat.js';

const riFor = (rng) => (a, b) => Math.floor(rng() * (b - a + 1)) + a;
const pickFor = (rng) => (arr) => arr[Math.floor(rng() * arr.length)];

export function createGame(opts = {}) {
  const rng = opts.rng || Math.random;
  const meta = Object.assign(
    { startGold: 0, castleHp: 0, heroDmg: 0, mathBonus: 0, champHp: 0, champDmg: 0, champUlt: 0 },
    opts.metaLevels);
  const diff = D.DIFFICULTIES[opts.difficulty] || D.DIFFICULTIES.normal;
  const castleMax = D.META_UPGRADES.castleHp.apply(meta.castleHp);
  const state = {
    rng, ri: riFor(rng), pick: pickFor(rng),
    difficulty: opts.difficulty || 'normal', diff,
    meta,
    /* 별의 시련 회차 — 0 = 첫 여정. 몬스터 체력·골드가 회차만큼 강해진다 (enemies.js) */
    loop: Math.max(0, Math.min(99, Math.round(opts.loop || 0))),
    dmgMul: D.META_UPGRADES.heroDmg.apply(meta.heroDmg),
    mathMul: D.META_UPGRADES.mathBonus.apply(meta.mathBonus),

    phase: 'prep',
    gold: D.META_UPGRADES.startGold.apply(meta.startGold),
    wave: 1,
    castleHp: castleMax, castleMax,
    castle: { fortify: 0, tower: 0 },
    towerCd: 0,

    nextId: 1,
    bench: [], field: [],
    enemies: [], projectiles: [],
    spawnQueue: [], waveT: 0,
    pendingWave: null,

    kills: 0, bossKills: 0, midBossKills: 0, summons: 0, combos: 0,
    solved: 0, correct: 0, goldEarned: 0, hints: 0, firstTryWins: 0, bestStreak: 0, timeOuts: 0,
    retries: 0, retryGold: 0, persisted: 0,
    specialsMade: 0, mythicsMade: 0,
    champKills: 0, starCasts: 0, ultCasts: 0, perfectWaves: 0,
    feasts: 0, feastWave: 0,
    shardsEarned: 0, mathShards: 0,
    mathWindow: [],             // 최근 "한 번에 맞힘" 기록 (적응형 난이도, mathgate.js)
    mathLocked: new Set(),      // 포기했거나 세 번 틀린 조합 — 이번 준비 단계 동안 잠긴다
    mythicPress: 0,             // 이번 웨이브가 반응하는 신화 용사 수 (enemies.js)
    combo: { count: 0, timer: 0 },
    discovered: new Set(),      // 이번 판에 만들어 본 조합 결과 (도감 ✓)
    time: 0,
  };
  /* 별지기 — 길을 순찰하는 메인 캐릭터. 은하수 충전 배율은 메타에서만 오므로 한 번만 계산 */
  state.champUltMul = D.champUltMul(meta.champUlt);
  state.champ = {
    level: 1, xp: 0, sp: 0, skills: {},
    x: D.CHAMP_HOME.x, y: D.CHAMP_HOME.y,
    hp: 1, maxHp: 1,
    ko: false, cd: 0, spellCd: 0, spellReadyT: 0, ult: 0,
    targetId: null, holdT: 0, hurtAcc: 0, moving: false,
    dirX: 0, dirY: 1,
  };
  state.champ.maxHp = champStats(state).maxHp;
  state.champ.hp = state.champ.maxHp;
  state.pendingWave = buildWave(state);
  return state;
}

/* ---------- 별의 시련 — 승리 후 다음 회차 ----------
 * 30웨이브를 클리어한 판에서 부른다. 별지기의 성장(레벨·경험치·스킬)은 이어지고
 * 용사·골드·성·웨이브는 처음으로 돌아간다. 적은 회차만큼 세진다(enemies.loopHpMul).
 * 은하수 충전은 0부터 — 이월되면 새 회차 첫 웨이브가 공짜로 지워진다.
 * 본 이야기·연출 기록도 들고 간다: 회차마다 같은 막간 이야기를 또 보면 스킵 게임이 된다. */
export function nextLoop(state) {
  const next = createGame({
    difficulty: state.difficulty,
    metaLevels: state.meta,
    rng: state.rng === Math.random ? undefined : state.rng,
    loop: (state.loop || 0) + 1,
  });
  const c = state.champ, n = next.champ;
  if (c && n) {
    n.level = c.level;
    n.xp = c.xp;
    n.sp = c.sp;
    n.skills = { ...c.skills };
    n.maxHp = champStats(next).maxHp;
    n.hp = n.maxHp;
  }
  next.seenStory = new Set(state.seenStory || []);
  next.revealed = new Set(state.revealed || []);
  /* 적응형 난이도는 판이 아니라 아이의 것 — 이어 간다 */
  next.mathWindow = [...(state.mathWindow || [])];
  return next;
}

/* ---------- 저장 / 불러오기 ----------
 * 저장은 "준비 단계 스냅샷"이다. 전투 중의 몬스터·투사체는 서로를 참조하는
 * 객체 그래프라 직렬화가 잘 깨지고, 전투 도중 복원을 허용하면 반쯤 이긴
 * 웨이브를 저장해 두고 골드만 불리는 꼼수가 생긴다. 그래서 웨이브 진행은
 * 담지 않고, 불러오면 그 웨이브의 준비 단계에서 다시 시작한다. */
export const SAVE_VERSION = 1;
const SAVE_STATS = [
  'kills', 'bossKills', 'midBossKills', 'summons', 'combos', 'solved', 'correct',
  'goldEarned', 'hints', 'firstTryWins', 'bestStreak', 'timeOuts', 'retries', 'retryGold', 'persisted',
  'specialsMade', 'mythicsMade', 'mathShards',
  'champKills', 'starCasts', 'ultCasts', 'perfectWaves', 'feasts',
];

export function serialize(state) {
  /* spark = 빠른 풀이 보너스. 안 담으면 불러올 때 공격력이 조용히 깎인다 */
  const hero = (h) => ({ cls: h.cls, tier: h.tier, pad: h.padIndex, spark: h.spark || 0 });
  const stats = {};
  for (const k of SAVE_STATS) stats[k] = state[k];
  return {
    game: 'defenehero', v: SAVE_VERSION,
    difficulty: state.difficulty,
    meta: { ...state.meta },
    loop: state.loop || 0,               // 별의 시련 회차 — 이어하기가 회차를 잊으면 안 된다
    wave: state.wave,
    gold: state.gold,
    feastWave: state.feastWave,          // 이번 준비에 잔치를 했는가 — 불러와도 다시 못 연다
    castleHp: state.castleHp,
    castleMax: state.castleMax,
    castle: { ...state.castle },
    bench: state.bench.map(hero),
    field: state.field.map(hero),
    /* 별지기 — 위치·체력은 준비 단계마다 리셋되니 성장만 담는다 */
    champ: state.champ ? {
      level: state.champ.level, xp: Math.round(state.champ.xp), sp: state.champ.sp,
      skills: { ...state.champ.skills },
      ult: Math.round(state.champ.ult * 100) / 100,
    } : null,
    stats,
    discovered: [...state.discovered],
    mathWindow: [...(state.mathWindow || [])],   // 적응형 난이도가 이어하기에서도 이어지게
    mathLocked: [...(state.mathLocked || [])],   // 저장했다 불러오는 것으로 잠금을 풀 수 없게
    seenStory: state.seenStory ? [...state.seenStory] : [],
    revealed: state.revealed ? [...state.revealed] : [],
  };
}

/* 저장 파일 → 새 게임 상태. 파일은 사용자가 고칠 수 있는 입력이라 값 하나하나를
 * 의심한다 — 이상한 수는 안전한 범위로 줄이고, 모르는 직업은 버리고, 겹친 발판의
 * 용사는 벤치로 대피시킨다(사라지는 것보단 낫다). 복원할 수 없는 구조면 null. */
export function deserialize(data, opts = {}) {
  if (!data || typeof data !== 'object') return null;
  if (!Array.isArray(data.bench) || !Array.isArray(data.field)) return null;
  const clamp = (v, lo, hi, dflt) =>
    (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt);
  const difficulty = D.DIFFICULTIES[data.difficulty] ? data.difficulty : 'normal';
  const meta = (data.meta && typeof data.meta === 'object') ? data.meta : {};
  const state = createGame({ difficulty, metaLevels: meta, rng: opts.rng, loop: data.loop });

  state.wave = clamp(data.wave, 1, 999, 1);
  state.gold = clamp(data.gold, 0, 1e9, state.gold);
  state.feastWave = clamp(data.feastWave, 0, 999, 0);
  state.castle.fortify = clamp(data.castle && data.castle.fortify, 0, D.CASTLE_UPGRADES.fortify.max, 0);
  state.castle.tower = clamp(data.castle && data.castle.tower, 0, D.CASTLE_UPGRADES.tower.max, 0);
  state.castleMax = clamp(data.castleMax, 1, 1e6, state.castleMax);
  state.castleHp = clamp(data.castleHp, 1, state.castleMax, state.castleMax);

  const revive = (rec, pad) => {
    if (!rec || !D.CLASSES[rec.cls]) return;
    if (state.bench.length >= D.BENCH_MAX) return;
    const h = makeHero(state, rec.cls, clamp(rec.tier, 0, D.maxTierOf(rec.cls), 0));
    empowerHero(h, clamp(rec.spark, 0, D.SPEED_POWER_MAX, 0));   // 빠른 풀이 보너스도 되살린다
    state.bench.push(h);
    if (Number.isInteger(pad) && pad >= 0 && pad < D.PADS.length && !padOccupant(state, pad)) {
      placeHero(state, h.id, pad);
    }
  };
  for (const rec of data.field.slice(0, D.PADS.length)) revive(rec, rec && rec.pad);
  for (const rec of data.bench.slice(0, D.BENCH_MAX)) revive(rec, null);

  /* 별지기 — 값 하나하나 의심한다. 모르는 스킬은 버리고, 랭크는 상한으로 자른다 */
  const cd = data.champ;
  if (cd && typeof cd === 'object' && state.champ) {
    const c = state.champ;
    c.level = clamp(cd.level, 1, D.CHAMP_XP.maxLevel, 1);
    c.xp = clamp(cd.xp, 0, 1e6, 0);
    c.sp = clamp(cd.sp, 0, 99, 0);
    c.skills = {};
    if (cd.skills && typeof cd.skills === 'object') {
      for (const [k, v] of Object.entries(cd.skills)) {
        const SK = D.CHAMP_SKILLS[k];
        if (SK) {
          const rank = clamp(v, 0, SK.max, 0);
          if (rank > 0) c.skills[k] = rank;
        }
      }
    }
    c.ult = Number.isFinite(cd.ult) ? Math.min(1, Math.max(0, cd.ult)) : 0;
    c.maxHp = champStats(state).maxHp;
    c.hp = c.maxHp;
  }

  const strings = (arr) => (Array.isArray(arr) ? arr.filter(v => typeof v === 'string') : []);
  for (const k of strings(data.discovered)) if (D.CLASSES[k]) state.discovered.add(k);
  state.seenStory = new Set(strings(data.seenStory));
  state.revealed = new Set(strings(data.revealed));
  const stats = (data.stats && typeof data.stats === 'object') ? data.stats : {};
  for (const k of SAVE_STATS) state[k] = clamp(stats[k], 0, 1e9, 0);
  /* 0/1만 남긴다 — 저장 파일은 사용자가 고칠 수 있는 입력이라 값을 그대로 믿지 않는다 */
  state.mathWindow = (Array.isArray(data.mathWindow) ? data.mathWindow : [])
    .filter(v => v === 0 || v === 1).slice(-D.ADAPT_WINDOW);
  state.mathLocked = new Set((Array.isArray(data.mathLocked) ? data.mathLocked : [])
    .filter(v => typeof v === 'string').slice(0, 64));

  state.pendingWave = buildWave(state);
  return state;
}
