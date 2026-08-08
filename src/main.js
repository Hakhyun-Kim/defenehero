/* =====================================================
 * 메인 컨트롤러: 엔진 + 3D 렌더러 + UI + 사운드 배선
 * ===================================================== */
import * as D from './data.js';
import * as E from './engine.js';
import * as MathGen from './math.js';
import { Renderer3D } from './gfx/renderer.js';
import { heroPortrait, champPortrait } from './gfx/units3d.js';
import { UI } from './ui.js';
import { SFX, toggleSfx, toggleMusic, toggleAll, isSfxMuted, isMusicMuted, forceMute, getAc, getMaster, registerDucker, updateAudioFlow } from './sfx.js';
import { music } from './music.js';
import * as Story from './story.js';
import { demo } from './demo.js';
import {
  store, heroName,
  codex, mathLog, earned, codexAddHero, codexAddKill, mathAdd, flushRecords, markDirty,
} from './app/store.js';
import { createMathFlow } from './app/mathflow.js';
import { useAppLayout, applyAppLayout } from './app/layout.js';
import { SplashScreen } from '@capacitor/splash-screen';
import Analytics from './analytics.js';

registerDucker((amt, dur) => music.duck(amt, dur));

/* ---------- 초기화 ---------- */
const ui = new UI();
Analytics.init();
if (typeof window !== 'undefined') {
  const hideSplash = () => { SplashScreen.hide().catch(() => {}); };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => setTimeout(hideSplash, 300));
  } else {
    setTimeout(hideSplash, 300);
  }
}
/* URL로 강제 지정 가능: ?gfx=high|lite|min (min은 테스트/초저사양용) */
const urlParams = new URLSearchParams(location.search);
const urlGfx = urlParams.get('gfx');

/* 손안 화면(앱 · 폰/태블릿 브라우저)에서만 설정 모달 + 4탭 배치로 접는다 —
 * 넓은 화면은 예전 그대로 펼쳐 둔다.
 * ui.bind() 전에 불러야 새로 만든 소환 탭 버튼에도 클릭이 붙는다. */
const appLayout = useAppLayout(urlParams);
if (appLayout) {
  ui.defaultTab = applyAppLayout();
  ui.showTab(ui.defaultTab);   // 벤치가 탭이 됐으니 첫 화면도 벤치로
}
/* 자동화로 열었거나 ?mute를 붙였으면 소리 없이 시작한다.
 * 검증을 돌릴 때마다 옆에서 효과음이 터지면 사람이 못 견딘다.
 * (설정을 저장하지 않으므로 사용자가 평소 쓰던 소리 설정은 그대로 남는다) */
if (urlParams.has('mute') || urlParams.has('rafshim')) forceMute();

/* ---------- 모바일이면 배경 장식을 끈다 ----------
 * 잔디 14,000장 · 픽셀마다 도는 파도 셰이더 · 하늘 밴드는 데스크톱 GPU 기준으로
 * 만든 것들이라 폰에서는 프레임을 그대로 먹는다. 게다가 작은 화면에서는
 * 하늘에 내줬던 19%가 아깝다 — 끄면 그만큼 전장이 커져 발판을 누르기 쉬워진다.
 * ?decor=on 으로 폰에서도 켜 볼 수 있고, ?decor=off 로 데스크톱에서 꺼 볼 수 있다. */
function detectMobile() {
  /* ?mobile=1 은 폰 없이 이 경로를 확인하려고 둔다. 데스크톱 브라우저는
   * 창을 줄여도 pointer:coarse 로 안 바뀌어서 그냥은 검증이 안 된다. */
  const forced = urlParams.get('mobile');
  if (forced != null) return !/^(0|off|no|false)$/i.test(forced);
  try {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true;
  } catch { /* matchMedia 없는 환경 */ }
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent || '');
}
const urlDecor = urlParams.get('decor');
const isMobile = detectMobile();
const useDecor = urlDecor != null ? !/^(0|off|no|false)$/i.test(urlDecor)
                                  : (!isMobile && !store.decorOff);

const renderer = new Renderer3D(ui.el.scene3d, {
  /* 폰은 처음부터 lite 로 시작한다. high 로 켰다가 7초 뒤에 떨어뜨리면
   * 그 7초가 하필 제일 버벅이는 구간(첫인상)이 된다. */
  quality: urlGfx || (store.gfx === 'lite' || (isMobile && store.gfx == null) ? 'lite' : 'high'),
  preserve: urlParams.has('rafshim') || urlGfx === 'min',
  decor: useDecor,
  touch: isMobile,
});

/* Capacitor 안드로이드 뒤로가기 버튼 처리 */
if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  try {
    window.Capacitor.Plugins.App.addListener('backButton', () => {
      const openModals = document.querySelectorAll('.modal:not(.hidden)');
      if (openModals.length > 0) {
        openModals.forEach(m => m.classList.add('hidden'));
      }
    });
  } catch (e) { /* 웹 환경 예외 무시 */ }
}

let state = null;
let grade = 3;
let gradeBeforeDemo = null;   // 데모가 프로필 학년으로 바꾸기 전의 값
let speed = 1;
let selBench = null;      // 배치 대기 중인 벤치 용사
let selHero = null;       // 정보 패널에 표시 중인 용사 (벤치/필드)
let hoverHeroId = null;   // 툴팁 표시 중인 필드 용사
let overHandled = false;
let heartbeatT = 0;
let panelT = 0;
let sellMode = false;         // 여러 명 판매 모드 (벤치 카드가 체크박스가 된다)
const sellSel = new Set();    // 판매하려고 고른 용사 id

/* 수학 관문 흐름 (app/mathflow.js) — state는 새 게임/불러오기로 갈아끼워지므로 getter로 넘긴다 */
const flow = createMathFlow({
  getState: () => state, getGrade: () => grade,
  ui, renderer, store,
  refreshAll: (...a) => refreshAll(...a),
  playStory: (...a) => playStory(...a),
  playReveal: (...a) => playReveal(...a),
  /* 수학 성장 기록 — 데모(봇)의 풀이는 아이의 기록이 아니다 */
  onMathDone: (g, label, ok, clean) => {
    if (demo.active) return;
    mathAdd(g, label, ok, clean);
    checkAchievements();
    Analytics.trackMathResult(g, label, ok, clean);
  },
  onHeroBorn: (hero) => recordHeroBorn(hero),
});

/* ---------- 도감 · 업적 ----------
 * 조건은 전부 값 비교라 아무 때나 다시 평가해도 싸다. 언제 부르는지가 전부다:
 * 용사 탄생 · 수학 풀이 · 웨이브 종료 · 레벨 업 · 게임 오버 · 승리.
 * 데모(봇)가 딴 업적은 업적이 아니므로 데모 중엔 기록도 평가도 멈춘다. */
function recordHeroBorn(hero) {
  if (demo.active || !hero) return;
  codexAddHero(hero.cls, hero.tier);
  checkAchievements();
}

function checkAchievements() {
  if (demo.active) return;
  const bestStored = Math.max(0, ...Object.keys(D.DIFFICULTIES).map(d => store.best(d)));
  const ctx = {
    state, codex, mathLog,
    /* 진행 중엔 "치른 웨이브"(wave-1)도 인정 — 기록 갱신은 게임 오버 때라 늦다 */
    bestWave: Math.max(bestStored, state ? state.wave - 1 : 0),
    victories: store.victories,
    trialClears: store.trialClears,
  };
  for (const a of D.ACHIEVEMENTS) {
    if (earned[a.key]) continue;
    let ok = false;
    try { ok = !!a.check(ctx); } catch { ok = false; }
    if (!ok) continue;
    earned[a.key] = 1;
    markDirty();
    store.shards = store.shards + a.shards;
    SFX.shard();
    ui.toast(`🏅 업적 달성! [${a.emoji} ${a.name}] ✨별조각 +${a.shards}`, 'good');
    if (a.unlocks) {
      const A = D.CHAMP_WARDROBE[a.unlocks.axis];
      ui.toast(`🪞 옷장이 열렸어요! ${A.emoji} ${A.name}: ${A.options[a.unlocks.key].name}`, 'good');
    }
    ui.pingBook();
  }
}

/* 옷장 잠금 — 업적으로 열린다. 단 지금 입고 있는 옷은 잠그지 않는다
 * (해금 기능이 나중에 생겼으므로, 이미 입은 옷이 잠기면 뺏는 셈이 된다) */
function closetLock(axis, key) {
  const lock = D.WARDROBE_LOCKS[axis] && D.WARDROBE_LOCKS[axis][key];
  if (!lock || earned[lock.key]) return null;
  if (D.champLookOf(store.champCfg.look)[axis] === key) return null;
  return lock;
}

/* 새 판 공통 리셋 — 새 게임·불러오기·별의 시련이 같은 정리를 밟는다 */
function resetSession() {
  selBench = null;
  selHero = null;
  flow.resetStreak();
  overHandled = false;
  sellMode = false;
  sellSel.clear();
  renderer.setPlacementMode(false);
  renderer.setSelectedHero(null);
  renderer.setHover(null);
}

/* 시작 용사 두 명 — 빈 벤치는 "뭘 해야 하지"가 된다. 도감도 여기서 첫 칸이 채워진다 */
function giveStarters() {
  for (const cls of ['knight', 'archer']) {
    const h = E.makeHero(state, cls, 0);
    state.bench.push(h);
    recordHeroBorn(h);
  }
}

function newGame(difficulty, opts = {}) {
  gameOverToken++;                 // 게임오버 연출 예약이 새 판을 덮지 않게
  state = E.createGame({ difficulty, metaLevels: store.meta });
  Analytics.trackGameStart(difficulty, state.loop || 0);
  giveStarters();
  resetSession();
  refreshAll();
  ui.hideOver();
  music.setWave(1);
  /* 이어하기 메뉴를 띄울 때는 프롤로그를 잠시 미룬다 — 메뉴 위에 이야기가 겹치면 안 된다 */
  if (!opts.holdStory) playStory('prologue', () => playStory('champIntro'));
}

/* ---------- 별의 시련 — 승리 후 다음 회차 ----------
 * 별지기의 성장은 그대로, 용사·골드·성은 처음부터, 몬스터는 회차만큼 세게. */
function startTrial() {
  if (!state || state.phase === 'over') return;
  gameOverToken++;
  state = E.nextLoop(state);
  giveStarters();
  resetSession();
  ui.hideVictory();
  refreshAll();
  music.setWave(1);
  SFX.waveStart();
  const run = (state.loop || 0) + 1;
  ui.toast(`🌟 별의 시련 ${run}회차! 몬스터 체력 ×${D.loopHpMul(state.loop).toFixed(2)} — ${heroName()}의 성장은 그대로예요`, 'good');
  autoSave();                      // 시련의 첫 준비 단계가 곧 이어하기 지점
  checkAchievements();
}

/* 판매 모드에 들어가면 배치/이동 선택은 모두 풀어 한 번에 한 가지만 하게 한다 */
function setSellMode(on) {
  if (sellMode === !!on) return;
  sellMode = !!on;
  sellSel.clear();
  if (sellMode) {
    selBench = null;
    selHero = null;
    kbPad = null;
    renderer.setPlacementMode(false);
    renderer.setSelectedHero(null);
    renderer.setHover(null);
    ui.restoreTab();
  }
  refreshPanels();
}

function refreshPanels() {
  /* 조합 등으로 사라진 용사가 판매 선택에 남지 않게 정리 */
  if (sellSel.size) {
    for (const id of [...sellSel]) if (!state.bench.some(h => h.id === id)) sellSel.delete(id);
  }
  ui.renderBench(state, selBench, sellMode ? sellSel : null);
  ui.renderSellBar(state, sellMode, sellSel);
  ui.renderCombine(state);
  ui.renderCastlePanel(state);
  ui.renderHeroPanel(state, selHero);
}
function refreshAll() {
  refreshPanels();
  ui.updateHud(state, store.shards, store.best(state.difficulty));
  ui.setWaveUI(state);
  ui.renderWavePreview(state, E.waveSummary(state));
}

/* ---------- 막간 이야기 ----------
 * 매 웨이브 띄우면 "스킵을 누르는 게임"이 된다. 초반에 몰고 뒤로 갈수록 성글게,
 * 한 판에 최대 열댓 번. 이미 본 것은 state.seenStory로 걸러진다. */
let storyResume = null;
function playStory(key, onDone = null) {
  if (store.storyOff || !Story.BEATS[key]) { if (onDone) onDone(); return false; }
  if (!state.seenStory) state.seenStory = new Set();
  if (state.seenStory.has(key)) { if (onDone) onDone(); return false; }
  state.seenStory.add(key);
  storyResume = onDone;
  /* {name} = 옷장에서 지은 별지기 이름 — 이야기가 그 이름을 부른다 */
  const beat = Story.BEATS[key];
  ui.showStory({ ...beat, lines: beat.lines.map(l => l.replace(/\{name\}/g, heroName())) });
  SFX.tap();
  return true;
}
function closeStory() {
  ui.hideStory();
  const fn = storyResume;
  storyResume = null;
  if (fn) fn();
}

/* ---------- 전설·신화 탄생 연출 ----------
 * 수학 모달이 아직 열려 있는 상태에서 그 위에 덮인다.
 * 예약된 자동 진행을 반드시 끄고, 닫힐 때 원래 흐름을 이어 준다. */
let revealResume = null;
function playReveal(hero, onDone) {
  if (store.storyOff) { onDone(); return; }
  if (!state.revealed) state.revealed = new Set();
  const key = `${hero.cls}:${hero.tier}`;
  const short = state.revealed.has(key);       // 두 번째부터는 짧게
  state.revealed.add(key);
  const C = D.CLASSES[hero.cls];
  const T = D.TIERS[hero.tier];
  const ab = hero.tier >= 4 ? (D.MYTHIC_ABILITIES && D.MYTHIC_ABILITIES[hero.cls])
                            : (D.LEGEND_ABILITIES && D.LEGEND_ABILITIES[hero.cls]);
  revealResume = onDone;
  ui.showReveal({
    tierName: T.name, tierColor: T.color, name: C.name, emoji: C.emoji,
    desc: ab ? `[${ab.name}] ${ab.desc}` : C.desc,
    art: heroPortrait(hero.cls, hero.tier), short,
  });
  SFX.summon(hero.tier);
  renderer.celebrate(hero.tier >= 4 ? 0xd8b4ff : 0xffd93d, true);
  clearTimeout(revealTimer);
  revealTimer = setTimeout(closeReveal, short ? 1200 : 3200);
}
let revealTimer = null;
function closeReveal() {
  clearTimeout(revealTimer);
  if (!ui.isRevealOpen()) return;
  ui.hideReveal();
  const fn = revealResume;
  revealResume = null;
  if (fn) fn();
}

/* ---------- 별지기 액션 ----------
 * 마법은 별지기의 것 — 쓰러져 있으면 못 쓴다. 실패 이유는 반드시 말해 준다. */
function doSpell() {
  const r = E.castStar(state);
  if (!r.ok) {
    if (r.reason === 'phase') ui.toast('☄️ 별똥별은 전투 중에만! 웨이브를 시작해 보세요', 'bad');
    else if (r.reason === 'ko') ui.toast(`😵 ${heroName()}가 쓰러져 있어요 — 다음 웨이브에 돌아와요`, 'bad');
    else if (r.reason === 'cd') ui.toast(`☄️ 별이 아직 오는 중이에요 (${Math.ceil(r.left)}초)`, 'bad');
    else if (r.reason === 'none') ui.toast('☄️ 지금은 떨어뜨릴 곳이 없어요 — 몬스터가 오면 눌러요!');
    return;
  }
  SFX.starfall(D.FIELD_W / 2);
  renderer.onEvents(state, r.events);
  handleEvents(r.events);
  refreshAll();
}
function doUlt() {
  const r = E.castUlt(state);
  if (!r.ok) {
    if (r.reason === 'phase') ui.toast('🌌 은하수는 전투 중에만 쏟아부을 수 있어요', 'bad');
    else if (r.reason === 'ko') ui.toast(`😵 ${heroName()}가 쓰러져 있어요 — 다음 웨이브에 돌아와요`, 'bad');
    else if (r.reason === 'charge') ui.toast(`🌌 은하수 충전 ${Math.round((r.ult || 0) * 100)}% — 몬스터를 잡으면 차올라요`, 'bad');
    else if (r.reason === 'none') ui.toast('🌌 지금은 쏟아부을 곳이 없어요 — 몬스터가 오면 눌러요!');
    return;
  }
  SFX.ultimate();
  ui.flashScreen('mythic');
  renderer.onEvents(state, r.events);
  handleEvents(r.events);
  refreshAll();
}
function openSkills() {
  if (state.phase === 'over') return;
  ui.renderSkills(state);
  ui.showSkills();
  SFX.tap();
}

/* ---------- 별지기의 옷장 ----------
 * 미리보기는 초상 렌더러가 실시간으로 굽는다 — 고르는 즉시 갈아입은 모습이 보인다.
 * 저장을 눌러야 진짜로 입는다: 닫으면 원래대로. */
let closetDraft = null;
function openCloset() {
  const cfg = store.champCfg;
  closetDraft = { look: D.champLookOf(cfg.look) };
  ui.renderCloset(closetDraft.look, D.champNameOf(cfg.name), closetLock);
  ui.setClosetPreview(champPortrait(closetDraft.look));
  ui.showCloset();
  SFX.tap();
}
function pickCloset(axis, key) {
  if (!closetDraft || !D.CHAMP_WARDROBE[axis] || !D.CHAMP_WARDROBE[axis].options[key]) return;
  /* 잠긴 옷 — 버튼은 눌리지 않지만(disabled) 다른 경로도 막아 둔다 */
  const lock = closetLock(axis, key);
  if (lock) { ui.toast(`🔒 업적 [${lock.emoji} ${lock.name}]을 달성하면 열려요 — ${lock.desc}`, 'bad'); return; }
  closetDraft.look = { ...closetDraft.look, [axis]: key };
  ui.renderCloset(closetDraft.look, ui.readClosetName(), closetLock);
  ui.setClosetPreview(champPortrait(closetDraft.look));
  SFX.tap();
}
function saveCloset() {
  if (!closetDraft) return;
  const name = D.champNameOf(ui.readClosetName());
  store.champCfg = { name, look: closetDraft.look };
  renderer.setChampLook(closetDraft.look);
  ui.setChampFace(champPortrait(closetDraft.look));
  ui.setChampName(name);
  ui.hideCloset();
  closetDraft = null;
  SFX.upgrade();
  ui.toast(`🪞 ${name}, 새 모습으로 변신! 길에서 확인해 보세요`, 'good');
}
function closeCloset() {
  ui.hideCloset();
  closetDraft = null;
}

/* ---------- 잔치 ---------- */
function doFeast() {
  const r = E.holdFeast(state);
  if (!r.ok) {
    if (r.reason === 'phase') ui.toast('🎉 잔치는 준비 단계에만! 전투가 끝나면 벌여요', 'bad');
    else if (r.reason === 'done') ui.toast('🎉 이번 준비엔 벌써 즐겼어요 — 다음 웨이브에 또!', 'bad');
    else if (r.reason === 'gold') ui.toast(`잔치에는 💰${r.cost}이 필요해요 — 몬스터를 잡아 모아요 ⚔️`, 'bad');
    else if (r.reason === 'none') ui.toast('전원 신화! 승급할 용사가 없어요 — 최강 군단이에요 🌌', 'good');
    return;
  }
  SFX.feast();
  recordHeroBorn(r.hero);              // 잔치 승급도 도감의 새 칸이 될 수 있다
  const C = D.CLASSES[r.hero.cls];
  ui.toast(`🎉 잔치! ${C.emoji} ${C.name}가 신나게 먹고 ${D.TIERS[r.hero.tier].name}(으)로 승급! (💰-${r.cost})`, 'good');
  if (r.hero.tier >= 3) ui.flashCombine(r.hero.tier);
  renderer.onEvents(state, r.events);
  handleEvents(r.events);
  refreshAll();
}

/* ---------- 액션 ---------- */
function doSummon() {
  const r = E.summon(state);
  if (!r.ok) {
    if (r.reason === 'gold') ui.toast('골드가 부족해요! 몬스터를 잡으면 골드가 들어와요 ⚔️', 'bad');
    else if (r.reason === 'bench') ui.toast('벤치가 가득 찼어요! 배치하거나 조합해 보세요.', 'bad');
    return;
  }
  SFX.summon(r.hero.tier);
  recordHeroBorn(r.hero);
  const C = D.CLASSES[r.hero.cls], T = D.TIERS[r.hero.tier];
  /* 등급이 높을수록 화려하게 */
  renderer.summonBurst(r.hero.tier);
  ui.summonReveal(r.hero, r.hero.tier);
  ui.toast(`${T.name} 등급 ${C.name} ${C.emoji} 등장!`, r.hero.tier >= 2 ? 'good' : '');
  if (r.hero.tier === 3) ui.toast(`👑 전설! [${D.LEGEND_ABILITIES[r.hero.cls].name}] ${D.LEGEND_ABILITIES[r.hero.cls].desc}`, 'good');
  refreshAll();
}

function doPlace(padIndex) {
  /* 이미 용사가 있는 자리를 골랐다면 "거기 놓고 싶다"는 뜻이다 — 거절하지 말고 자리를 바꾼다.
   * 벤치 ↔ 필드 교환이라 벤치 수가 그대로여서 벤치가 가득 차 있어도 항상 된다. */
  const occ = E.padOccupant(state, padIndex);
  if (occ) {
    const s = E.swapBenchWithPad(state, selBench, padIndex);
    if (!s.ok) return;
    SFX.place();
    padFx(s.placed, 0x9fdcff);
    ui.toast(`🔀 ${D.CLASSES[s.placed.cls].name} 배치 · ${D.CLASSES[s.benched.cls].name}은 벤치로!`);
    deselectAll();      // 배치가 끝나면 선택도 끝 — 다음 클릭이 또 뭔가를 옮기지 않게
    refreshAll();
    return;
  }
  const r = E.placeHero(state, selBench, padIndex);
  if (!r.ok) return;
  SFX.place();
  renderer.burst((r.hero.x - D.FIELD_W / 2) / 36, 0.5, (r.hero.y - D.FIELD_H / 2) / 36, 0x7fff9e, 10, 2.2);
  deselectAll();
  refreshAll();
}

/* 배치된 용사 선택 — 선택하면 빈 발판(초록)과 다른 용사 자리(파랑)가 함께 빛난다 */
function selectField(hero) {
  if (hero) setSellMode(false);        // 배치/이동을 시작하면 판매 모드는 끝
  selBench = null;
  selHero = hero ? hero.id : null;
  renderer.setSelectedHero(selHero);
  renderer.setPlacementMode(!!hero, hero ? D.CLASSES[hero.cls].range : 0, true);
  ui.renderBench(state, null, sellMode ? sellSel : null);
  ui.renderHeroPanel(state, selHero);
  if (hero) { ui.showHeroTab(); SFX.tap(); }
  else ui.restoreTab();
  resetAutoDeselectTimer();
}

const padFx = (h, color) =>
  renderer.burst((h.x - D.FIELD_W / 2) / 36, 0.5, (h.y - D.FIELD_H / 2) / 36, color, 8, 2);

/* 이동 — 목적지에 용사가 있으면 "자리 교환"이 된다 (회수 없이 진형만 바꾼다).
 * 한 번 움직이면 선택을 푼다 — 선택이 남아 있으면 다음 클릭이
 * 의도치 않은 이동/교환이 돼서 "누를 때마다 자리가 바뀌는" 불편이 생긴다. */
function doMove(padIndex) {
  const occ = E.padOccupant(state, padIndex);
  if (occ && occ.id !== selHero) {
    const r = E.swapHeroes(state, selHero, occ.id);
    if (!r.ok) return;
    SFX.place();
    padFx(r.a, 0x9fdcff);
    padFx(r.b, 0x9fdcff);
    ui.toast(`🔀 ${D.CLASSES[r.a.cls].name} ↔ ${D.CLASSES[r.b.cls].name} 자리를 바꿨어요!`);
    deselectAll();
    refreshAll();
    return;
  }
  const r = E.moveHero(state, selHero, padIndex);
  if (!r.ok) return;
  SFX.place();
  padFx(r.hero, 0x9fdcff);
  deselectAll();
  refreshAll();
}

/* ---------- 끌어서 옮기기 / 자리 바꾸기 ---------- */
let dragId = null;
function onDragStart(cx, cy) {
  if (state.phase === 'over') return false;
  const pad = renderer.screenToPad(cx, cy);
  if (pad == null) return false;
  const hero = E.padOccupant(state, pad);
  if (!hero) return false;
  dragId = hero.id;
  selectField(hero);
  return true;
}
function onDragMove(cx, cy) {
  renderer.setHover(renderer.screenToPad(cx, cy));
}
function onDragEnd(cx, cy) {
  const id = dragId;
  dragId = null;
  renderer.setHover(null);
  if (id == null || selHero !== id || cx == null) return;   // cx == null: 드래그 취소
  const pad = renderer.screenToPad(cx, cy);
  const hero = state.field.find(h => h.id === id);
  if (pad == null || !hero || pad === hero.padIndex) return;   // 제자리에 놓으면 그냥 선택만
  doMove(pad);
}

function doRecall(heroId) {
  const r = E.recallHero(state, heroId);
  if (!r.ok) { ui.toast('벤치가 가득 차서 회수할 수 없어요!', 'bad'); return; }
  SFX.tap();
  if (selHero === heroId) { selHero = null; renderer.setSelectedHero(null); renderer.setPlacementMode(false); }
  ui.toast('↩ 용사를 벤치로 회수했어요.');
  refreshAll();
}

/* ---------- 저장 / 불러오기 (간단한 파일 하나) ----------
 * 저장 = 준비 단계 스냅샷을 JSON으로 내려받기, 불러오기 = 그 파일을 다시 열기.
 * 별조각·최고 기록은 원래 localStorage에 있으니 파일에는 "이번 판"만 담는다. */
function saveGame() {
  if (state.phase === 'wave') {
    ui.toast('⚔️ 전투 중에는 저장할 수 없어요 — 웨이브를 끝내고 눌러 주세요!', 'bad');
    return;
  }
  if (state.phase === 'over') {
    ui.toast('끝난 판은 저장할 수 없어요 — 새로 시작한 뒤에 저장해요', 'bad');
    return;
  }
  const data = E.serialize(state);
  data.grade = grade;                  // 문제 학년은 화면 설정이라 엔진 밖에서 얹는다
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `용사수학디펜스_${state.wave}웨이브_${D.DIFFICULTIES[state.difficulty].name}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  SFX.tap();
  ui.toast(`💾 ${state.wave}웨이브 준비 상태를 파일로 저장했어요!`, 'good');
}

function loadGame(data) {
  const next = data ? E.deserialize(data) : null;
  if (!next) {
    ui.toast('😢 저장 파일을 읽을 수 없어요 — 이 게임에서 저장한 파일이 맞는지 확인해 주세요', 'bad');
    return false;
  }
  gameOverToken++;                     // 예약된 게임오버 연출이 불러온 판을 덮지 않게
  state = next;
  if (Number.isFinite(data.grade) && data.grade >= 3 && data.grade <= 6) {
    grade = data.grade;
    ui.setGradeActive(grade);
  }
  store.diff = state.difficulty;
  resetSession();
  ui.hideOver();
  refreshAll();
  music.setWave(state.wave);
  SFX.tap();
  ui.toast(`📂 불러왔어요! ${state.wave}웨이브 준비부터 이어서 시작해요`, 'good');
  autoSave();                          // 이어하기도 이 지점을 가리키게
  return true;
}

/* ---------- 자동 저장 ----------
 * 웨이브가 끝날 때마다 준비 단계 스냅샷을 브라우저(localStorage)에 남긴다.
 * 직렬화는 그 순간(상태가 확실한 준비 단계일 때) 바로 하고, 실제 쓰기는
 * 한가할 때로 미뤄 웨이브 클리어 연출 프레임을 방해하지 않는다.
 * 단 requestIdleCallback은 숨은 탭에서 무기한 미뤄질 수 있어 timeout을 걸고,
 * 탭이 가려지거나 닫힐 때는 그 자리에서 flush한다 — "곧 쓸게"가 유실이 되면 안 된다.
 * 성이 함락되면 슬롯을 지운다 — 끝난 판은 이어하기 대상이 아니다. */
const idle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 400 })
  : (fn) => setTimeout(fn, 60);
let pendingAutosave = null;
function flushAutosave() {
  if (!pendingAutosave) return;
  store.autosave = pendingAutosave;
  pendingAutosave = null;
}
function autoSave() {
  if (state.phase !== 'prep') return;
  const data = E.serialize(state);
  data.grade = grade;
  data.savedAt = Date.now();
  pendingAutosave = data;
  idle(() => { flushAutosave(); flushRecords(); });
}
window.addEventListener('pagehide', () => { flushAutosave(); flushRecords(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { flushAutosave(); flushRecords(); }
});

function handleEvents(events) {
  /* 승리(서른 번째 아침)가 낀 배치에서는 waveEnd의 이야기 예약을 승리 쪽이 가져간다 —
   * 둘이 따로 w30 이야기를 걸면 모달이 겹친다 */
  const hasVictory = events.some(e => e.type === 'victory');
  for (const ev of events) {
    switch (ev.type) {
      case 'enemyHit':
        if (ev.kind === 'hit') SFX.hit(ev.x);
        else if (ev.kind === 'crit') SFX.crit(ev.x);
        break;
      case 'block': SFX.block(ev.x); break;
      case 'kill':
        if (!demo.active) codexAddKill(ev.etype);   // 몬스터 도감 — 봇의 사냥은 세지 않는다
        if (ev.boss) {
          SFX.bossDown(true);
          ui.toast(`🎉 대보스 ${ev.name}를 물리쳤어요!! 💰${ev.gold}`, 'good');
        } else if (ev.midBoss) {
          SFX.bossDown(false);
          ui.toast(`👊 중간보스 ${ev.name} 격파! 💰${ev.gold}`, 'good');
        } else {
          SFX.kill(ev.x); SFX.coin();
        }
        if (ev.mul > 1 && (ev.combo === D.COMBO.x2At || ev.combo === D.COMBO.x3At)) SFX.combo(ev.mul);
        break;
      case 'shoot':
        if (ev.kind === 'arrow') SFX.shoot(ev.x);
        else if (ev.kind === 'orb') SFX.orb(ev.x);
        else SFX.bolt(ev.x);
        break;
      case 'explode': SFX.explode(ev.x); break;
      case 'castleHit':
        if (state.castleHp > 0 && state.castleHp / state.castleMax <= 0.3) {
          setTimeout(() => { if (state.phase !== 'over') playStory('castleHurt'); }, 400);
        }
        SFX.castleHit();
        ui.flashHit();
        break;
      case 'bossWarn':
        SFX.bossWarn(ev.tier === 'great');
        ui.bossWarn(ev.tier, ev.name, ev.emoji);
        break;
      case 'bossSpawn':
        if (ev.tier === 'great') SFX.bossRoar();
        else SFX.midBossRoar();
        ui.showBossBanner(ev.tier, ev.name, ev.emoji);
        break;
      case 'bossEnrage':
        SFX.bossEnrage();
        ui.showEnrage(ev.name);
        break;
      case 'waveEnd':
        SFX.waveClear();
        ui.toast(`🎉 ${ev.wave}웨이브 클리어! 보너스 💰${ev.bonus}`, 'good');
        autoSave();                      // 매 웨이브가 이어하기 지점이 된다
        checkAchievements();
        Analytics.trackWaveComplete(ev.wave, state.difficulty, ev.bonus || 0);
        refreshAll();
        /* 클리어 토스트/효과음과 겹치지 않게 살짝 늦춘다. 준비 단계라 시뮬레이션 손실은 없다 */
        if (!hasVictory) {
          const key = Story.beatForWave(ev.wave);
          if (key) setTimeout(() => playStory(key), 700);
        }
        break;
      case 'gameOver': onGameOver(); break;

      /* ---------- 서른 번째 아침 ----------
       * 엔진은 알렸고, 여기서 갚는다: 별조각·기록·연출·다음 회차 제안.
       * w30 이야기를 먼저 보여 주고(2회차부터는 이미 봐서 건너뜀) 승리 화면을 연다. */
      case 'victory': {
        store.victories = store.victories + 1;
        if ((ev.loop || 0) >= 1) store.trialClears = store.trialClears + 1;
        store.shards = store.shards + ev.shards;
        checkAchievements();
        flushRecords();
        Analytics.trackGameVictory(state.difficulty, ev.loop || 0, ev.shards || 0);
        const vLoop = ev.loop || 0, vShards = ev.shards;
        setTimeout(() => playStory('w30', () => {
          if (state.phase === 'over') return;      // 그 사이 함락됐다면(있을 수 없지만) 겹치지 않게
          SFX.shard();
          ui.flashScreen('mythic');
          renderer.celebrate(0xffd93d, true);
          ui.showVictory({ loop: vLoop, shards: vShards, state });
          ui.updateHud(state, store.shards, store.best(state.difficulty));
        }), 700);
        break;
      }

      /* ---------- 별지기 ---------- */
      case 'champHurt': SFX.heroHurt(ev.x); break;
      case 'champKo':
        SFX.heroDead();
        ui.toast(`😵 별지기 ${heroName()}가 쓰러졌어요! 다음 웨이브 준비 때 다시 일어나요`, 'bad');
        break;
      case 'champLevel':
        SFX.levelUp();
        ui.toast(`🌠 ${heroName()} 레벨 업! Lv ${ev.level} — 스킬 포인트 +1 (V키로 별자리를 이어요)`, 'good');
        checkAchievements();
        break;
      case 'ultReady':
        SFX.shard();
        ui.toast('🌌 은하수가 가득 찼어요! E키로 쏟아부어요!', 'good');
        break;
      case 'starfall': SFX.starfall(ev.x); break;
      case 'starAuto':
        ui.toast('☄️ 루나가 스스로 별똥별을 던졌어요 — A키로 직접 부를 수도 있어요!');
        break;
      case 'ultCast': SFX.ultimate(); break;
      case 'champWave':
        if (ev.perfect) {
          store.shards = store.shards + ev.shard;
          SFX.shard();
          ui.toast(`🛡️ 완벽 방어! 성이 무피해예요 — ✨별조각 +${ev.shard} · ${heroName()} 경험치 +${ev.xp}`, 'good');
        } else if (ev.revived) {
          ui.toast(`🌠 ${heroName()}가 다시 일어났어요! 체력이 가득 찼어요`);
        }
        break;
    }
  }
}

let gameOverToken = 0;
function onGameOver() {
  if (overHandled) return;
  overHandled = true;
  Analytics.trackGameFail(state.wave, state.difficulty, state.shardsEarned || 0);
  SFX.gameOver();
  music.stop();
  pendingAutosave = null;              // 쓰기 대기 중이던 스냅샷도 되살아나면 안 된다
  store.autosave = null;               // 함락된 판은 이어하기에서 지운다
  store.shards = store.shards + state.shardsEarned;
  checkAchievements();
  flushRecords();                      // 게임 오버는 확실한 저장 시점 — 도감·수학 기록을 남긴다
  const best = store.best(state.difficulty);
  if (state.wave > best) store.setBest(state.difficulty, state.wave);
  /* 900ms 연출 대기 중에 사용자가 Enter로 새 게임을 시작할 수 있다.
   * 가드가 없으면 새 판 위에 게임오버 화면이 뒤늦게 덮인다. */
  const overToken = ++gameOverToken;
  setTimeout(() => {
    if (overToken !== gameOverToken || state.phase !== 'over') return;
    SFX.shard();
    ui.showOver(state);
    ui.updateHud(state, store.shards, store.best(state.difficulty));
  }, 900);
}

/* ---------- UI 바인딩 ---------- */
const handlers = {
  onWaveStart() { tryStartWave(); },
  onSummon: doSummon,
  onCombine(action) { flow.openMath('combine', action); },
  /* 조합 재료가 모자랄 때 "그 용사 뽑으러 가기" — 소환은 무작위라 약속은 못 하지만,
   * 적어도 무엇을 해야 하는지는 분명해진다. */
  onNeedHero(cls) {
    const C = D.CLASSES[cls];
    if (state.gold < D.SUMMON_COST) {
      ui.toast(`${C.emoji} ${C.name}를 뽑으려면 💰${D.SUMMON_COST}이 필요해요 — 몬스터를 잡아 모아요 ⚔️`, 'bad');
      return;
    }
    ui.focusBench();
    ui.toast(`${C.emoji} ${C.name}를 노려요! S키(또는 소환 버튼)로 뽑아 보세요`, '');
    doSummon();
  },
  onSpeed() {
    speed = speed === 1 ? 2 : 1;
    ui.setSpeedLabel(speed);
    SFX.tap();
  },
  onToggleSfx() {
    toggleSfx();
    ui.setSoundLabels(isSfxMuted(), isMusicMuted());
    if (!isSfxMuted()) SFX.tap();
  },
  onToggleBgm() {
    toggleMusic();
    ui.setSoundLabels(isSfxMuted(), isMusicMuted());
    music.sync();
  },
  onGrade(g) { grade = g; SFX.tap(); },
  onDiff(d) {
    if (!(state.phase === 'prep' && state.wave === 1)) return;
    store.diff = d;
    newGame(d);
    ui.toast(`${D.DIFFICULTIES[d].emoji} ${D.DIFFICULTIES[d].name} 난이도로 시작!`);
  },
  onCancelPlace() { SFX.tap(); deselectAll(); },
  onBenchSelect(id) {
    SFX.tap();
    if (selBench === id) {
      selBench = null;
      selHero = null;
      renderer.setPlacementMode(false);
      ui.restoreTab();
    } else {
      ui.showHeroTab();
      selBench = id;
      selHero = id;
      const hero = state.bench.find(h => h.id === id);
      /* 세 번째 인자 = 교환 모드: 찬 자리도 후보(파랑)로 표시된다 */
      renderer.setPlacementMode(true, hero ? D.CLASSES[hero.cls].range : 0, true);
      renderer.setSelectedHero(null);
    }
    ui.renderBench(state, selBench);
    ui.renderHeroPanel(state, selHero);
    resetAutoDeselectTimer();
  },
  /* 배치된 용사를 고른 뒤 —
   *   빈 발판 클릭    → 회수 없이 이동
   *   다른 용사 클릭  → 두 용사의 자리 교환 (끌어다 놓기와 같은 결과)
   *   같은 용사 클릭  → 선택 해제
   * 다른 용사의 정보만 보고 싶을 땐 마우스를 올리면 툴팁이 뜬다. */
  onSceneClick(cx, cy) {
    const pad = renderer.screenToPad(cx, cy);
    if (pad == null) { deselectAll(); return; }
    if (selBench != null) { doPlace(pad); return; }
    const hero = E.padOccupant(state, pad);
    const onField = selHero != null && state.field.some(h => h.id === selHero);
    if (onField) {
      if (hero && hero.id === selHero) { deselectAll(); return; }
      doMove(pad);
      return;
    }
    selectField(hero);
  },
  onSceneRightClick(cx, cy) {
    const pad = renderer.screenToPad(cx, cy);
    if (pad == null) return;
    const hero = E.padOccupant(state, pad);
    if (!hero) return;
    doRecall(hero.id);
  },
  onSceneMove(cx, cy) {
    if (cx == null) { renderer.setHover(null); ui.hideTooltip(); return; }
    const pad = renderer.screenToPad(cx, cy);
    renderer.setHover(pad);
    /* 배치된 용사에 마우스를 올리면 상세 정보 */
    const hero = pad == null ? null : E.padOccupant(state, pad);
    if (hero) {
      if (hoverHeroId !== hero.id) {
        hoverHeroId = hero.id;
        ui.showTooltip(hero, state, cx, cy);
      } else ui.moveTooltip(cx, cy);
    } else if (hoverHeroId != null) {
      hoverHeroId = null;
      ui.hideTooltip();
    }
  },
  onHint: () => flow.hint(),
  onRecall() { doRecall(selHero); },
  onSell() {
    const r = E.sellHero(state, selHero);
    if (!r.ok) return;
    SFX.coin();
    ui.toast(`용사를 보내주고 💰${r.price}을 받았어요.`);
    selHero = null;
    renderer.setSelectedHero(null);
    refreshAll();
  },
  /* --- 여러 명 판매 --- */
  onSellMode() { setSellMode(!sellMode); SFX.tap(); },
  onSellToggle(id) {
    if (!sellSel.delete(id)) sellSel.add(id);
    SFX.tap();
    ui.renderBench(state, null, sellSel);
    ui.renderSellBar(state, true, sellSel);
  },
  onSellAll() {
    const all = state.bench.length > 0 && state.bench.every(h => sellSel.has(h.id));
    sellSel.clear();
    if (!all) for (const h of state.bench) sellSel.add(h.id);
    SFX.tap();
    ui.renderBench(state, null, sellSel);
    ui.renderSellBar(state, true, sellSel);
  },
  onSellGo() {
    const picked = state.bench.filter(h => sellSel.has(h.id));
    if (!picked.length) { ui.toast('팔 용사를 골라 주세요 — 카드를 누르면 선택돼요', 'bad'); return; }
    let total = 0;
    for (const h of picked) {
      const r = E.sellHero(state, h.id);
      if (r.ok) total += r.price;
    }
    sellSel.clear();
    SFX.coin();
    ui.toast(`💰 용사 ${picked.length}명을 보내주고 ${total} 골드를 받았어요.`, 'good');
    if (!state.bench.length) setSellMode(false);   // 다 팔았으면 모드도 끝
    refreshAll();
  },
  onSave: saveGame,
  onLoad: loadGame,
  /* --- 별지기 --- */
  onSpell: doSpell,
  onUlt: doUlt,
  onSkillOpen: openSkills,
  onClosetOpen: openCloset,
  onClosetPick: pickCloset,
  onClosetSave: saveCloset,
  onClosetClose: closeCloset,
  onFeast: doFeast,
  onSkillPick(key) {
    const r = E.takeSkill(state, key);
    if (!r.ok) {
      if (r.reason === 'sp') ui.toast('스킬 포인트가 없어요 — 레벨 업으로 얻어요! (몬스터 처치·웨이브 클리어)', 'bad');
      else if (r.reason === 'need') ui.toast(`🔒 이 별자리에 먼저 ${r.need}포인트를 써야 열려요 (지금 ${r.spent})`, 'bad');
      return;
    }
    SFX.upgrade();
    const SK = r.skill;
    ui.toast(`✨ [${SK.name}] ${r.rank}단계! ${SK.per}`, 'good');
    ui.renderSkills(state);
    ui.updateChampChip(state);
  },
  /* --- 시작 메뉴 (자동 저장이 있을 때만 뜬다) --- */
  onContinue() {
    ui.hideStart();
    SFX.tap();
    /* 자동 저장이 깨져 있으면 이미 준비된 새 게임을 그대로 진행한다 */
    if (!loadGame(store.autosave)) playStory('prologue', () => playStory('champIntro'));
  },
  onStartNew() {
    ui.hideStart();
    SFX.tap();
    playStory('prologue', () => playStory('champIntro'));   // 새 게임은 boot에서 이미 만들어져 있다
  },
  onCastle(key) {
    const r = E.castleUpgrade(state, key);
    if (!r.ok) {
      if (r.reason === 'gold') ui.toast('골드가 부족해요!', 'bad');
      return;
    }
    SFX.upgrade();
    /* 강화한 순간을 눈으로 보여 준다 — 숫자만 오르면 뭐가 달라졌는지 모른다 */
    if (key !== 'repair') renderer.castleUpgradeFx(key);
    const lv = key === 'repair' ? 0 : state.castle[key];
    const NOTE = {
      fortify: ['성벽이 높아졌어요!', '흉벽이 늘었어요!', '방어 말뚝을 박았어요!', '성문이 강철문이 됐어요!', '성벽이 대리석으로 빛나요!'],
      tower: ['마법 포탑이 솟았어요!', '포탑이 하나 더!', '마법진이 성을 감쌌어요!'],
    };
    const note = NOTE[key] && NOTE[key][lv - 1];
    ui.toast(`${D.CASTLE_UPGRADES[key].emoji} ${D.CASTLE_UPGRADES[key].name} 완료!${note ? ' ' + note : ''}`, 'good');
    refreshAll();
  },
  onMetaOpen() {
    ui.renderMeta(store.shards, store.meta);
    ui.showMeta();
    SFX.tap();
  },
  /* --- 도감 · 기록 --- */
  onBookOpen() {
    ui.renderBook({ state, codex, mathLog, earned });
    ui.showBook();
    SFX.tap();
  },
  /* --- 서른 번째 아침 --- */
  onTrial() { SFX.tap(); startTrial(); },
  onVictoryContinue() {
    ui.hideVictory();
    SFX.tap();
    ui.toast('▶ 끝없는 밤을 계속 지켜요 — 몬스터는 계속 세져요!', 'good');
  },
  onMetaBuy(key) {
    const M = D.META_UPGRADES[key];
    const levels = store.meta;
    const lv = levels[key] || 0;
    if (lv >= M.max) return;
    const cost = M.cost(lv);
    if (store.shards < cost) return;
    store.shards = store.shards - cost;
    levels[key] = lv + 1;
    store.meta = levels;
    SFX.shard();
    ui.toast(`🌟 ${M.name} Lv${lv + 1}! 다음 게임부터 적용돼요.`, 'good');
    ui.renderMeta(store.shards, store.meta);
    ui.updateHud(state, store.shards, store.best(state.difficulty));
  },
  onRestart() {
    SFX.tap();
    newGame(store.diff);
  },
  onShare() { ui.makeShareCard(state, store.best(state.difficulty)); },
  onDragStart, onDragMove, onDragEnd,
  onMathSubmit: flow.submitMath,
  onMathNext: flow.advanceMath,
  onMathClose: flow.giveUpMath,
  onDemoToggle() { demo.toggle(); SFX.tap(); },
  onStoryClose: closeStory,
  onStoryOff() { store.storyOff = true; ui.toast('이야기를 끄었어요. 다시 보려면 새로고침 후 설정에서…', 'bad'); closeStory(); },
  onRevealClose: closeReveal,
};
ui.bind(handlers);

/* ---------- 키보드 조작 (전 기능) ---------- */
let kbPad = null;                     // 키보드 배치 커서

/* ←→로 훑을 발판 목록 — 자기 자리만 빼고 전부다.
 * 빈 발판에서 Enter는 배치/이동, 찬 발판에서 Enter는 자리 교환이 된다.
 * 빈 곳만 훑게 하면 "저 자리랑 바꾸고 싶다"는 조작을 키보드로는 못 하게 된다. */
function padCandidates() {
  const self = selBench == null && selHero != null
    ? state.field.find(h => h.id === selHero)
    : null;
  const all = D.PADS.map((_, i) => i);
  return self ? all.filter(i => i !== self.padIndex) : all;
}

function cyclePad(dir) {
  const cand = padCandidates();
  if (!cand.length) return;
  if (kbPad == null || !cand.includes(kbPad)) kbPad = cand[0];
  else kbPad = cand[(cand.indexOf(kbPad) + dir + cand.length) % cand.length];
  renderer.setHover(kbPad);
}

function cycleBench(dir) {
  if (!state.bench.length) { ui.toast('벤치가 비어 있어요. S키로 소환해 보세요!', 'bad'); return; }
  setSellMode(false);                  // Tab으로 배치를 시작하면 판매 모드는 끝
  let idx = state.bench.findIndex(h => h.id === selBench);
  idx = (idx + dir + state.bench.length) % state.bench.length;
  const hero = state.bench[idx];
  selBench = hero.id;
  selHero = hero.id;
  renderer.setPlacementMode(true, D.CLASSES[hero.cls].range, true);
  renderer.setSelectedHero(null);
  if (kbPad == null) cyclePad(1);
  else renderer.setHover(kbPad);
  ui.renderBench(state, selBench);
  ui.renderHeroPanel(state, selHero);
  SFX.tap();
}

/* ---------- 배치 중 표시 ----------
 * 선택을 바꾸는 자리가 열 군데가 넘는다(카드 · 발판 · 키보드 · 판매 모드 · 조합 …).
 * 그 전부에 호출을 심으면 반드시 하나를 빠뜨린다 — 안내 바가 남아 있는 버그가
 * 제일 흔하다. 그래서 매 프레임 "지금 상태"에서 다시 계산하고, 바뀔 때만 DOM 을
 * 건드린다. 문자열 비교 한 번이라 비용은 없는 셈. */
let placeLabelCache = null;
function syncPlaceBar() {
  let label = null;
  if (state && !sellMode) {
    if (selBench != null) {
      const h = state.bench.find(x => x.id === selBench);
      if (h) label = `${D.CLASSES[h.cls].emoji} ${D.TIERS[h.tier].name} ${D.CLASSES[h.cls].name} — 빈 발판을 눌러 배치!`;
    } else if (selHero != null && state.field.some(x => x.id === selHero)) {
      const h = state.field.find(x => x.id === selHero);
      if (h) label = `${D.CLASSES[h.cls].emoji} ${D.CLASSES[h.cls].name} — 갈 곳을 누르세요 (용사를 누르면 자리 교환)`;
    }
  }
  if (label === placeLabelCache) return;
  placeLabelCache = label;
  ui.setPlacing(label, label || '');
}

/* 고른 채로 손을 뗀 지 5초면 선택을 푼다.
 * 폰에서는 "취소"를 누를 자리가 마땅치 않아 고른 상태로 갇히기 쉬워서 넣은 안전장치인데,
 * 마우스에서는 반대로 방해가 된다 — 카드를 고르고 발판을 고민하는 사이에 풀려 버린다.
 * 그래서 손안 화면에서만 돈다. */
let autoDeselectTimer = null;
function resetAutoDeselectTimer() {
  if (autoDeselectTimer) {
    clearTimeout(autoDeselectTimer);
    autoDeselectTimer = null;
  }
  if (!appLayout) return;
  if (selHero != null || selBench != null) {
    autoDeselectTimer = setTimeout(() => {
      deselectAll();
    }, 5000);
  }
}

function deselectAll() {
  if (autoDeselectTimer) {
    clearTimeout(autoDeselectTimer);
    autoDeselectTimer = null;
  }
  selBench = null;
  selHero = null;
  kbPad = null;
  renderer.setPlacementMode(false);
  renderer.setSelectedHero(null);
  renderer.setHover(null);
  ui.renderBench(state, selBench, sellMode ? sellSel : null);
  ui.renderHeroPanel(state, null);
  ui.restoreTab();
}

/* 필드 용사 순환 선택 (F키) — 회수 없이 이동/강화 대상 고르기 */
function cycleField(dir) {
  if (!state.field.length) { ui.toast('배치된 용사가 없어요.', 'bad'); return; }
  const sorted = [...state.field].sort((a, b) => a.padIndex - b.padIndex);
  let idx = sorted.findIndex(h => h.id === selHero);
  idx = (idx + dir + sorted.length) % sorted.length;
  selectField(sorted[idx]);
  kbPad = null;
}

function setGradeKey(g) {
  grade = g;
  ui.setGradeActive(g);
  SFX.tap();
}

function tryStartWave() {
  if (ui.isStoryOpen() || ui.isRevealOpen()) return;   // 연출 중에 웨이브가 몰래 시작되지 않게
  const quip = store.storyOff ? null : Story.waveQuip(state.wave);
  if (quip) setTimeout(() => ui.toast(`📣 ${quip}`), 260);
  const r = E.startWave(state);
  if (!r.ok) return;
  Analytics.trackWaveStart(state.wave, state.difficulty);
  SFX.waveStart();
  music.setWave(state.wave);
  ui.toast(`🌊 ${state.wave}웨이브 시작! 몬스터를 막아요!`);
  if (r.boss) ui.toast('⚠️ 대보스가 지름길로 돌진하는 웨이브예요!', 'bad');
  ui.setWaveUI(state);
}

/* 버튼 클릭 후 Space가 그 버튼을 다시 누르지 않도록 포커스 해제 */
document.addEventListener('click', (ev) => {
  if (ev.target instanceof HTMLButtonElement) ev.target.blur();
});

/* 한글 IME 상태에서도 단축키가 통하도록 매핑 */
const KO = { 'ㄴ': 's', 'ㅔ': 'p', 'ㅊ': 'c', 'ㅂ': 'q', 'ㄱ': 'r', 'ㅌ': 'x', 'ㅗ': 'h', 'ㅡ': 'm', 'ㄹ': 'f',
             'ㅁ': 'a', 'ㄷ': 'e', 'ㅍ': 'v', 'ㅠ': 'b' };

document.addEventListener('keydown', (ev) => {
  let key = ev.key;
  if (KO[key]) key = KO[key];
  const lower = key.length === 1 ? key.toLowerCase() : key;

  /* --- 시작 메뉴 (이어하기 / 처음부터) --- */
  if (ui.isStartOpen()) {
    if (key === 'Escape') { ev.preventDefault(); ui.el.newGameBtn.click(); }
    return;               // Enter/Space는 포커스된 버튼이 알아서 처리한다
  }

  /* --- 전설·신화 연출: 아무 키나 눌러 넘긴다 (수학 모달보다 위) --- */
  if (ui.isRevealOpen()) {
    ev.preventDefault();
    closeReveal();
    return;
  }

  /* --- 막간 이야기 --- */
  if (ui.isStoryOpen()) {
    if (key === 'Escape' || key === 'Enter' || key === ' ') { ev.preventDefault(); closeStory(); }
    return;                       // 나머지 키는 삼킨다 — 뒤에서 웨이브가 몰래 시작되면 안 된다
  }

  /* --- 서른 번째 아침 (승리) — Enter/Esc = 계속 지키기. 시련은 마우스로만(실수 방지) --- */
  if (ui.isVictoryOpen()) {
    if (key === 'Escape' || key === 'Enter' || key === ' ') { ev.preventDefault(); handlers.onVictoryContinue(); }
    return;
  }

  /* --- 도감 · 기록 --- */
  if (ui.isBookOpen()) {
    if (key === 'Escape' || key === 'Enter' || lower === 'b') { ev.preventDefault(); ui.hideBook(); }
    return;
  }

  /* --- 수학 모달 --- */
  if (ui.isMathOpen()) {
    if (key === 'Escape') { ev.preventDefault(); flow.giveUpMath(); return; }
    if (ui.isAnswered() && (key === 'Enter' || key === ' ')) {
      ev.preventDefault();
      /* 자동 진행을 기다리는 중이면 Enter는 "기다리지 말고 지금" 이라는 뜻이다 */
      const canAdvance = flow.autoPending() || !ui.el.mNext.classList.contains('hidden');
      if (canAdvance) flow.advanceMath();
      else flow.closeMathAll();
      return;
    }
    /* 아직 답을 안 냈는데 Enter가 여기까지 왔다 = 포커스가 입력창 밖에 있다는 뜻.
     * (확인 버튼·힌트 버튼을 클릭했거나 모달 배경을 눌렀을 때 그렇게 된다)
     * 예전엔 여기서 그냥 return 해서 "답을 썼는데 Enter가 안 먹는" 상태가 됐다.
     * 입력창이 이벤트를 먼저 처리했다면 stopPropagation 때문에 여기 오지 않으므로 중복 제출도 없다.
     * isComposing: 한글 IME 조합을 확정하는 Enter는 제출이 아니다. */
    if (!ui.isAnswered() && key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      flow.submitMath(ui.el.mInput.value);
      ui.el.mInput.focus();
      return;
    }
    /* 문제창은 효과음이 제일 많이 나는 화면이다 — 여기서 소리를 못 끄면 끌 방법이 없다.
     * 입력창에 답을 쓰는 중에는 'm'이 글자일 수 있으니 입력이 비었을 때만 받는다. */
    if (lower === 'm' && (document.activeElement !== ui.el.mInput || ui.el.mInput.value === '')) {
      ev.preventDefault();
      const off = toggleAll();
      ui.setSoundLabels(isSfxMuted(), isMusicMuted());
      ui.toast(off ? '🔇 소리를 모두 껐어요 (M)' : '🔊 소리를 다시 켰어요 (M)');
      return;
    }
    if (lower === 'h' && !ui.isAnswered() && !ui.el.mHintBtn.disabled) {
      if (document.activeElement !== ui.el.mInput || ui.el.mInput.value === '') {
        ev.preventDefault();
        ui.el.mHintBtn.click();
      }
    }
    return;   // 나머지 키는 입력창으로
  }

  /* --- 옷장 모달 (이름 입력창의 키는 여기까지 안 온다 — Esc만 온다) --- */
  if (ui.isClosetOpen()) {
    if (key === 'Escape') { ev.preventDefault(); closeCloset(); }
    else if (key === 'Enter') { ev.preventDefault(); saveCloset(); }
    return;
  }

  /* --- 별자리(스킬트리) 모달 --- */
  if (ui.isSkillOpen()) {
    if (key === 'Escape' || key === 'Enter' || lower === 'v') { ev.preventDefault(); ui.hideSkills(); }
    return;
  }

  /* --- 별의 축복 모달 --- */
  if (ui.isMetaOpen()) {
    if (key === 'Escape' || key === 'Enter') { ev.preventDefault(); ui.hideMeta(); return; }
    const n = Number(key);
    if (n >= 1 && n <= 4) {
      const btns = ui.el.metaRows.querySelectorAll('button');
      if (btns[n - 1] && !btns[n - 1].disabled) btns[n - 1].click();
    }
    return;
  }

  /* --- 게임 오버 --- */
  if (state.phase === 'over') {
    if (key === 'Enter' || key === ' ') { ev.preventDefault(); SFX.tap(); newGame(store.diff); }
    return;
  }

  /* --- 게임 화면 --- */
  switch (key) {
    case ' ':
    case 'Enter': {
      ev.preventDefault();
      const onField = selHero != null && state.field.some(h => h.id === selHero);
      if (selBench != null && kbPad != null) {
        const pad = kbPad;
        kbPad = null;
        renderer.setHover(null);
        doPlace(pad);
      } else if (onField && kbPad != null) {
        doMove(kbPad);                      // 배치된 용사를 골라둔 발판으로 이동
      } else if (state.phase === 'prep') {
        tryStartWave();
      }
      return;
    }
    case 'Escape':
      if (ui.el.optModal && !ui.el.optModal.classList.contains('hidden')) { ui.hideOpt(); return; }
      if (sellMode) { setSellMode(false); return; }
      deselectAll();
      return;
    case 'Tab':
      ev.preventDefault();
      cycleBench(ev.shiftKey ? -1 : 1);
      return;
    case 'ArrowLeft':
    case 'ArrowUp':
      if (selBench != null || selHero != null) { ev.preventDefault(); cyclePad(-1); }
      return;
    case 'ArrowRight':
    case 'ArrowDown':
      if (selBench != null || selHero != null) { ev.preventDefault(); cyclePad(1); }
      return;
  }
  switch (lower) {
    case 'a': doSpell(); return;
    case 'e': doUlt(); return;
    case 'v': openSkills(); return;
    case 'b': handlers.onBookOpen(); return;
    case 's': doSummon(); return;
    case 'c': {
      const combo = E.bestCombo(state);
      if (combo) flow.openMath('combine', E.comboToAction(combo));
      else {
        const unpaid = E.listCombos(state).find(c => !c.affordable);
        ui.toast(unpaid
          ? `조합 골드가 부족해요! (💰${unpaid.cost} 필요) 몬스터를 잡아 모아 보세요 ⚔️`
          : '지금 가능한 조합이 없어요. 용사를 더 모아 보세요!', 'bad');
      }
      return;
    }
    case 'd': demo.toggle(); SFX.tap(); return;
    case 'm': {
      const off = toggleAll();
      ui.setSoundLabels(isSfxMuted(), isMusicMuted());
      music.sync();
      ui.toast(off ? '🔇 소리를 모두 껐어요 (M)' : '🔊 소리를 다시 켰어요 (M)');
      return;
    }
    case 'q':
      speed = speed === 1 ? 2 : 1;
      ui.setSpeedLabel(speed);
      SFX.tap();
      return;
    case 'f': cycleField(1); return;
    case 'r': if (selHero != null && !ui.el.recallBtn.classList.contains('hidden')) ui.el.recallBtn.click(); return;
    case 'x': if (selHero != null) ui.el.sellBtn.click(); return;
    case '3': case '4': case '5': case '6': setGradeKey(Number(lower)); return;
    case '7': ui.el.castleRows.querySelector('button[data-key="repair"]')?.click(); return;
    case '8': ui.el.castleRows.querySelector('button[data-key="fortify"]')?.click(); return;
    case '9': ui.el.castleRows.querySelector('button[data-key="tower"]')?.click(); return;
  }
});

/* ---------- 게임 루프 ---------- */
function isPaused() {
  /* 이야기는 준비 단계에만 뜨므로 멈출 게 없지만, 전설 연출은 전투 중에도 뜬다.
   * 별자리(스킬)·옷장·도감·승리 화면도 멈춘다 — 열어 놓고 고민할 시간을 준다 */
  return ui.isMathOpen() || ui.isMetaOpen() || ui.isSkillOpen() || ui.isClosetOpen()
    || ui.isRevealOpen() || ui.isBookOpen() || ui.isVictoryOpen() || state.phase === 'over';
}

const STEP = 1 / 60;          // 고정 시뮬레이션 타임스텝
const MAX_STEPS = 8;          // 프레임당 최대 캐치업 (낮은 fps 대비)
let lastT = performance.now();
let simAcc = 0;
let bootT = performance.now();
let frameCount = 0;
/* 폰은 lite 로 이미 결정된 것으로 친다 — 실측해서 high 로 올릴 이유가 없다 */
let gfxDecided = store.gfx != null || urlGfx != null || isMobile;

function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min((now - lastT) / 1000, 0.5);
  lastT = now;
  frameCount++;
  syncPlaceBar();

  /* 그래픽 자동 품질: 시작 4초 후부터 3초간 실측 fps */
  if (!gfxDecided) {
    const elapsed = (now - bootT) / 1000;
    if (elapsed > 4) {
      if (!frame._fpsStart) { frame._fpsStart = now; frame._fpsFrames = 0; }
      frame._fpsFrames++;
      const win = (now - frame._fpsStart) / 1000;
      if (win > 3) {
        gfxDecided = true;
        const avg = frame._fpsFrames / win;
        const q = avg < 45 ? 'lite' : 'high';
        store.gfx = q;
        if (q === 'lite') { renderer.setQuality('lite'); ui.toast('⚙️ 부드러운 화면을 위해 그래픽을 조절했어요.'); }
        /* lite 로 낮춰도 안 되는 기기: 배경 장식까지 접는다.
         * 지형과 카메라가 같이 바뀌는 일이라 실행 중엔 못 바꾸고 다음 실행부터다. */
        if (avg < 26 && renderer.decor) {
          store.decorOff = true;
          ui.toast('⚙️ 다음에 켤 때는 배경을 더 가볍게 할게요.');
        }
      }
    }
  }

  flow.tickTimer(realDt);      // 문제 제한 시간 — 전투가 멈춰 있어도 시계는 흐른다

  /* 데모는 시뮬레이션이 멈춰 있어도 돌아야 문제창을 처리할 수 있다 */
  if (demo.active) demo.step(realDt);

  if (!isPaused()) {
    /* 고정 타임스텝: fps가 낮아도 게임 속도는 유지 */
    simAcc = Math.min(simAcc + realDt * speed, STEP * MAX_STEPS);
    while (simAcc >= STEP) {
      simAcc -= STEP;
      const events = E.tick(state, STEP);
      if (events.length) {
        renderer.onEvents(state, events);
        handleEvents(events);
      }
      if (isPaused()) { simAcc = 0; break; }
    }
    /* 저체력 심장박동 & Audio Lowpass Flow */
    const ratio = state.castleMax ? state.castleHp / state.castleMax : 1;
    updateAudioFlow(ratio);
    if (ratio < 0.3 && state.phase === 'wave') {
      ui.setLowHp(true);
      heartbeatT -= realDt * speed;
      if (heartbeatT <= 0) { heartbeatT = 1.0; SFX.heartbeat(); }
    } else {
      ui.setLowHp(false);
    }
  }

  /* 보스 상태 → 음악/분위기/체력바 */
  const greatBoss = state.enemies.find(e => e.boss && !e.dead);
  const midBoss = greatBoss ? null : state.enemies.find(e => e.midBoss && !e.dead);
  const bossLevel = greatBoss ? 2 : (midBoss ? 1 : 0);
  renderer.setBossMode(bossLevel);
  ui.setBossAtmosphere(state.phase === 'wave' ? bossLevel : 0);

  if (!isMusicMuted()) {
    if (state.phase === 'wave') {
      music.setTrack(greatBoss ? 'boss' : (midBoss ? 'midboss' : 'battle'));
    } else if (state.phase === 'prep') music.setTrack('prep');
  }

  /* UI 갱신 */
  ui.updateHud(state, store.shards, store.best(state.difficulty));
  ui.updateChampChip(state);
  ui.setWaveUI(state);
  ui.comboChip(state.combo.count, state.combo.count >= D.COMBO.x3At ? 3 : state.combo.count >= D.COMBO.x2At ? 2 : 1);
  const barBoss = greatBoss || midBoss;
  ui.setBossBar(barBoss ? {
    ratio: barBoss.hp / barBoss.maxHp,
    name: barBoss.name,
    emoji: D.ENEMY_TYPES[barBoss.type].emoji,
    great: !!barBoss.boss,
    enraged: !!barBoss.enraged,
  } : null);
  panelT += realDt;
  if (panelT > 0.35) {           // 골드 변동에 따른 버튼 활성화 갱신
    panelT = 0;
    ui.renderCastlePanel(state);
    if (selHero != null) ui.renderHeroPanel(state, selHero);
  }

  renderer.sync(state);
  renderer.frame(isPaused() ? 0 : realDt * speed, state);
}

/* ---------- 시작 ----------
 * 자동 저장이 있으면 "이어하기 / 처음부터"를 먼저 묻는다.
 * 데모 링크(?demo=)는 구경이 목적이니 메뉴 없이 바로 시작한다. */
const bootSave = (() => {
  if (urlParams.has('demo')) return null;
  const s = store.autosave;
  return s && Number.isFinite(s.wave) && Array.isArray(s.bench) ? s : null;
})();
newGame(store.diff, { holdStory: !!bootSave });
if (bootSave) ui.showStart(bootSave);
/* 별지기 꾸미기 적용 — 옷장에서 고른 모습·이름으로 시작한다 (초상 실패 시 이모지) */
{
  const cfg = store.champCfg;
  renderer.setChampLook(cfg.look);
  ui.setChampFace(champPortrait(cfg.look));
  ui.setChampName(D.champNameOf(cfg.name));
}
ui.setSoundLabels(isSfxMuted(), isMusicMuted());
ui.setSpeedLabel(speed);
ui.coachChip();
requestAnimationFrame(frame);

/* 첫 사용자 입력에서 오디오 잠금 해제 */
window.addEventListener('pointerdown', () => { music.sync(); }, { once: true });

/* 폰트를 미리 받아 둔다.
 * 브라우저는 "화면에 실제로 그려질 때"만 폰트를 내려받는다. 그냥 두면 ① 첫 문제창이 열리는
 * 순간 기본 폰트로 그려졌다가 바뀌고(아이가 문제를 읽는 바로 그 타이밍에 깜빡인다)
 * ② 3D 캔버스에 그리는 글자는 아예 폴백 폰트로 구워져 텍스처에 박힌다. */
if (document.fonts && document.fonts.load) {
  Promise.all([
    document.fonts.load('16px Jua', '용사 수학 디펜스'),
    document.fonts.load('700 27px Gaegu', '0123456789 문제'),
  ]).catch(() => {});
}

/* ---------- 데모 배선 ----------
 * 데모에게 게임 내부를 열어 주지 않는다. 사람이 누르는 것과 같은 함수만 넘긴다 —
 * 그래야 "데모에서만 되는" 또는 "데모에서만 안 되는" 버그가 안 생긴다. */
demo.attach({
  getState: () => state,
  isStoryOpen: () => ui.isStoryOpen(),
  isRevealOpen: () => ui.isRevealOpen(),
  isMathOpen: () => ui.isMathOpen(),
  isAnswered: () => ui.isAnswered(),
  getProblem: () => flow.modal.prob,
  closeStory,
  summon: doSummon,
  place(heroId, pad) { selBench = heroId; doPlace(pad); },
  openCombine(action) { flow.openMath('combine', action); },
  castle(key) { handlers.onCastle(key); },
  spell: doSpell,
  ult: doUlt,
  skill(key) { handlers.onSkillPick(key); },
  feast: doFeast,
  startWave: tryStartWave,
  newGame: () => newGame(store.diff),
  typeAnswer(v) { ui.el.mInput.value = v; flow.submitMath(v); },
  comboLabel: (c) => (c.kind === 'rankup'
    ? `${D.CLASSES[c.cls].name} ${D.TIERS[c.resultTier].name}`
    : `${D.CLASSES[c.result].name}`),
  heroLabel: (h) => `${D.TIERS[h.tier].name} ${D.CLASSES[h.cls].name}`,
  onCaption: (text) => ui.setDemoCaption(text),
  /* 프로필마다 푸는 학년이 다르다(초보 3 · 고수 6). 데모가 끝나면 사람이 고른 학년으로 되돌린다 */
  onStart(profile, P) {
    if (P && P.grade) {
      if (gradeBeforeDemo == null) gradeBeforeDemo = grade;
      grade = P.grade;
      ui.setGradeActive(grade);
    }
    ui.setDemoMode(true, profile);
    setSellMode(false);
    deselectAll();
    ui.restoreTab();
  },
  onStop() {
    if (gradeBeforeDemo != null) {
      grade = gradeBeforeDemo;
      gradeBeforeDemo = null;
      ui.setGradeActive(grade);
    }
    ui.setDemoMode(false);
    setSellMode(false);
    deselectAll();
  },
});

/* ?demo=고수 로 열면 바로 시작. 콘솔에서는 __game.demo.start('보통') */
if (urlParams.has('demo')) {
  setTimeout(() => demo.start(urlParams.get('demo') || '고수'), 900);
}

/* 디버그 훅 (자동 검증/테스트용) */
window.__game = {
  get state() { return state; },
  get modal() { return flow.modal; },
  E, D, renderer, ui, MathGen, SFX, demo,
  env: { isMobile, decor: useDecor, quality: renderer.quality },
  sfxCore: { getAc, getMaster, isSfxMuted, isMusicMuted },
  records: { codex, mathLog, earned },
  refresh: refreshAll,
  selectHero(id) { selHero = id; renderer.setSelectedHero(id); ui.renderHeroPanel(state, id); },
  gold(n) { state.gold += n; refreshAll(); },
  jump(w) { state.wave = w; refreshAll(); },
  hurt(n) { state.castleHp = Math.max(0, state.castleHp - n); if (state.castleHp <= 0) { state.phase = 'over'; state.shardsEarned = D.shardReward(state.wave, state.bossKills); onGameOver(); } },
};
