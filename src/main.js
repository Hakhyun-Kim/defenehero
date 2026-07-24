/* =====================================================
 * 메인 컨트롤러: 엔진 + 3D 렌더러 + UI + 사운드 배선
 * ===================================================== */
import * as D from './data.js';
import * as E from './engine.js';
import * as MathGen from './math.js';
import { Renderer3D } from './render3d.js';
import { UI } from './ui.js';
import { SFX, toggleMute, isMuted } from './sfx.js';
import { music } from './music.js';

/* ---------- 저장 ---------- */
const store = {
  get shards() { return Number(localStorage.getItem('mathdef_shards') || 0); },
  set shards(v) { localStorage.setItem('mathdef_shards', String(v)); },
  get meta() { try { return JSON.parse(localStorage.getItem('mathdef_meta') || '{}'); } catch { return {}; } },
  set meta(v) { localStorage.setItem('mathdef_meta', JSON.stringify(v)); },
  get diff() { return localStorage.getItem('mathdef_diff') || 'normal'; },
  set diff(v) { localStorage.setItem('mathdef_diff', v); },
  best(diff) { return Number(localStorage.getItem(`mathdef_best_${diff}`) || 0); },
  setBest(diff, w) { localStorage.setItem(`mathdef_best_${diff}`, String(w)); },
  get gfx() { return localStorage.getItem('mathdef_gfx'); },
  set gfx(v) { localStorage.setItem('mathdef_gfx', v); },
};

/* ---------- 초기화 ---------- */
const ui = new UI();
/* URL로 강제 지정 가능: ?gfx=high|lite|min (min은 테스트/초저사양용) */
const urlParams = new URLSearchParams(location.search);
const urlGfx = urlParams.get('gfx');
const renderer = new Renderer3D(ui.el.scene3d, {
  quality: urlGfx || (store.gfx === 'lite' ? 'lite' : 'high'),
  preserve: urlParams.has('rafshim') || urlGfx === 'min',
});

let state = null;
let grade = 3;
let speed = 1;
let selBench = null;      // 배치 대기 중인 벤치 용사
let selHero = null;       // 정보 패널에 표시 중인 용사 (벤치/필드)
let overHandled = false;
let heartbeatT = 0;
let panelT = 0;
const modal = { mode: null, tier: 0, prob: null };

function newGame(difficulty) {
  state = E.createGame({ difficulty, metaLevels: store.meta });
  state.bench.push(E.makeHero(state, 'knight', 0));
  state.bench.push(E.makeHero(state, 'archer', 0));
  selBench = null;
  selHero = null;
  overHandled = false;
  renderer.setPlacementMode(false);
  renderer.setSelectedHero(null);
  refreshAll();
  ui.hideOver();
  music.setWave(1);
}

function refreshPanels() {
  ui.renderBench(state, selBench);
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

/* ---------- 수학 모달 ---------- */
function openMath(mode, tier = 0) {
  if (state.phase === 'over') return;
  modal.mode = mode;
  modal.tier = tier;
  ui.showMath(mode === 'combine'
    ? `⚗️ 조합 시험! (${D.TIERS[tier].name} 2명 → ${D.TIERS[tier + 1].name})`
    : '✏️ 지혜의 시험!');
  newProblem();
}
function newProblem() {
  modal.prob = MathGen.gen(grade);
  const goldReward = Math.round(modal.prob.gold * state.mathMul);
  ui.setProblem(grade, modal.prob.text,
    modal.mode === 'combine' ? '맞히면 조합 성공!' : `맞히면 💰${goldReward} + 🧠지식 ${modal.prob.kp} UP!`);
}
function submitMath(value) {
  if (!modal.prob || !String(value).trim()) return;
  const ok = MathGen.check(value, modal.prob.answer);
  const res = E.applyMathResult(state, ok, grade);
  if (ok) {
    SFX.correct();
    if (modal.mode === 'combine') {
      const r = E.combine(state, modal.tier);
      if (r.ok) {
        SFX.combine();
        const more = E.benchCountByTier(state, modal.tier) >= 2;
        ui.mathFeedback(true,
          `🎉 정답! ${D.TIERS[r.hero.tier].name} ${D.CLASSES[r.hero.cls].name} ${D.CLASSES[r.hero.cls].emoji} 탄생!`,
          more ? '⚗ 한 번 더 조합!' : null);
        if (r.hero.tier === 3) ui.toast(`👑 전설 용사 탄생! [${D.LEGEND_ABILITIES[r.hero.cls].name}] 능력 발동!`, 'good');
      } else {
        ui.mathFeedback(true, '정답! 그런데 조합할 용사가 부족해요…', null);
      }
    } else {
      ui.mathFeedback(true, `🎉 정답! 💰+${res.gold} · 🧠 지식+${res.kp}`, '➡ 다음 문제');
    }
  } else {
    SFX.wrong();
    ui.mathFeedback(false, `😢 아쉬워요! 정답은 ${modal.prob.answer} 이에요. (지식 -1)`,
      modal.mode === 'combine' ? '🔁 다시 도전!' : '➡ 다음 문제');
  }
  refreshAll();
}

/* ---------- 액션 ---------- */
function doSummon() {
  const r = E.summon(state);
  if (!r.ok) {
    if (r.reason === 'gold') ui.toast('골드가 부족해요! 수학 문제로 골드를 벌 수 있어요 ✏️', 'bad');
    else if (r.reason === 'bench') ui.toast('벤치가 가득 찼어요! 배치하거나 조합해 보세요.', 'bad');
    return;
  }
  SFX.summon(r.hero.tier);
  const C = D.CLASSES[r.hero.cls], T = D.TIERS[r.hero.tier];
  ui.toast(`${T.name} 등급 ${C.name} ${C.emoji} 등장!`, r.hero.tier >= 2 ? 'good' : '');
  if (r.hero.tier === 3) ui.toast(`👑 전설! [${D.LEGEND_ABILITIES[r.hero.cls].name}] ${D.LEGEND_ABILITIES[r.hero.cls].desc}`, 'good');
  refreshAll();
}

function doPlace(padIndex) {
  const r = E.placeHero(state, selBench, padIndex);
  if (!r.ok) {
    if (r.reason === 'occupied') ui.toast('그 발판에는 이미 용사가 있어요!', 'bad');
    return;
  }
  SFX.place();
  renderer.burst((r.hero.x - D.FIELD_W / 2) / 36, 0.5, (r.hero.y - D.FIELD_H / 2) / 36, 0x7fff9e, 10, 2.2);
  selHero = r.hero.id;
  selBench = null;
  renderer.setPlacementMode(false);
  renderer.setSelectedHero(selHero);
  refreshAll();
}

function handleEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'enemyHit': if (ev.kind === 'hit') SFX.hit(); break;
      case 'kill':
        SFX.kill(); SFX.coin();
        if (ev.mul > 1 && (ev.combo === D.COMBO.x2At || ev.combo === D.COMBO.x3At)) SFX.combo(ev.mul);
        if (ev.boss) ui.toast('🐉 보스를 물리쳤어요!!', 'good');
        break;
      case 'shoot':
        if (ev.kind === 'arrow') SFX.shoot();
        else if (ev.kind === 'orb') SFX.orb();
        else SFX.bolt();
        break;
      case 'explode': SFX.explode(); break;
      case 'castleHit':
        SFX.castleHit();
        ui.flashHit();
        break;
      case 'bossSpawn':
        SFX.bossRoar();
        ui.showBossBanner();
        break;
      case 'waveEnd':
        SFX.waveClear();
        ui.toast(`🎉 ${ev.wave}웨이브 클리어! 보너스 💰${ev.bonus}`, 'good');
        refreshAll();
        break;
      case 'gameOver': onGameOver(); break;
    }
  }
}

function onGameOver() {
  if (overHandled) return;
  overHandled = true;
  SFX.gameOver();
  music.stop();
  store.shards = store.shards + state.shardsEarned;
  const best = store.best(state.difficulty);
  if (state.wave > best) store.setBest(state.difficulty, state.wave);
  setTimeout(() => {
    SFX.shard();
    ui.showOver(state);
    ui.updateHud(state, store.shards, store.best(state.difficulty));
  }, 900);
}

/* ---------- UI 바인딩 ---------- */
ui.bind({
  onWaveStart() {
    const r = E.startWave(state);
    if (!r.ok) return;
    SFX.waveStart();
    music.setWave(state.wave);
    ui.toast(`🌊 ${state.wave}웨이브 시작! 몬스터를 막아요!`);
    if (r.boss) ui.toast('⚠️ 보스가 나타나는 웨이브예요!', 'bad');
    ui.setWaveUI(state);
  },
  onSummon: doSummon,
  onPractice() { openMath('practice'); },
  onCombine(tier) { openMath('combine', tier); },
  onSpeed() {
    speed = speed === 1 ? 2 : 1;
    ui.setSpeedLabel(speed);
    SFX.tap();
  },
  onMute() {
    ui.setMuteLabel(toggleMute());
    music.sync();
  },
  onGrade(g) { grade = g; SFX.tap(); },
  onDiff(d) {
    if (!(state.phase === 'prep' && state.wave === 1)) return;
    store.diff = d;
    newGame(d);
    ui.toast(`${D.DIFFICULTIES[d].emoji} ${D.DIFFICULTIES[d].name} 난이도로 시작!`);
  },
  onBenchSelect(id) {
    SFX.tap();
    if (selBench === id) {
      selBench = null;
      renderer.setPlacementMode(false);
    } else {
      selBench = id;
      selHero = id;
      const hero = state.bench.find(h => h.id === id);
      renderer.setPlacementMode(true, hero ? D.CLASSES[hero.cls].range : 0);
      renderer.setSelectedHero(null);
    }
    ui.renderBench(state, selBench);
    ui.renderHeroPanel(state, selHero);
  },
  onSceneClick(cx, cy) {
    const pad = renderer.screenToPad(cx, cy);
    if (pad == null) {
      selHero = null; renderer.setSelectedHero(null);
      ui.renderHeroPanel(state, null);
      return;
    }
    if (selBench != null) { doPlace(pad); return; }
    const hero = E.padOccupant(state, pad);
    selHero = hero ? hero.id : null;
    renderer.setSelectedHero(selHero);
    ui.renderHeroPanel(state, selHero);
    if (hero) SFX.tap();
  },
  onSceneMove(cx, cy) {
    if (cx == null) { renderer.setHover(null); return; }
    renderer.setHover(renderer.screenToPad(cx, cy));
  },
  onHint() {
    if (!modal.prob) return;
    E.useHint(state);
    SFX.tap();
    ui.showHint(modal.prob.hint);
    ui.toast(`💡 힌트! 대신 지식 레벨이 ${D.HINT_COST} 내려갔어요. (소환 확률 ↓)`, 'bad');
    ui.updateHud(state, store.shards, store.best(state.difficulty));
  },
  onUpgrade() {
    const r = E.upgradeHero(state, selHero);
    if (!r.ok) {
      if (r.reason === 'gold') ui.toast('골드가 부족해요!', 'bad');
      return;
    }
    SFX.upgrade();
    const h = r.hero;
    ui.toast(`⬆ ${D.CLASSES[h.cls].name} Lv${h.level} 강화! (공격 ${h.dmg})`, 'good');
    refreshAll();
  },
  onRecall() {
    const r = E.recallHero(state, selHero);
    if (!r.ok) { ui.toast('벤치가 가득 차서 회수할 수 없어요!', 'bad'); return; }
    SFX.tap();
    renderer.setSelectedHero(null);
    refreshAll();
  },
  onSell() {
    const r = E.sellHero(state, selHero);
    if (!r.ok) return;
    SFX.coin();
    ui.toast(`용사를 보내주고 💰${r.price}을 받았어요.`);
    selHero = null;
    renderer.setSelectedHero(null);
    refreshAll();
  },
  onCastle(key) {
    const r = E.castleUpgrade(state, key);
    if (!r.ok) {
      if (r.reason === 'gold') ui.toast('골드가 부족해요!', 'bad');
      return;
    }
    SFX.upgrade();
    ui.toast(`${D.CASTLE_UPGRADES[key].emoji} ${D.CASTLE_UPGRADES[key].name} 완료!`, 'good');
    refreshAll();
  },
  onMetaOpen() {
    ui.renderMeta(store.shards, store.meta);
    ui.showMeta();
    SFX.tap();
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
  onMathSubmit: submitMath,
  onMathNext() { newProblem(); },
  onMathClose() { ui.hideMath(); modal.mode = null; },
});

/* ---------- 게임 루프 ---------- */
function isPaused() {
  return ui.isMathOpen() || ui.isMetaOpen() || state.phase === 'over';
}

const STEP = 1 / 60;          // 고정 시뮬레이션 타임스텝
const MAX_STEPS = 8;          // 프레임당 최대 캐치업 (낮은 fps 대비)
let lastT = performance.now();
let simAcc = 0;
let bootT = performance.now();
let frameCount = 0;
let gfxDecided = store.gfx != null || urlGfx != null;

function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min((now - lastT) / 1000, 0.5);
  lastT = now;
  frameCount++;

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
      }
    }
  }

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
    /* 저체력 심장박동 */
    const ratio = state.castleMax ? state.castleHp / state.castleMax : 1;
    if (ratio < 0.3 && state.phase === 'wave') {
      ui.setLowHp(true);
      heartbeatT -= realDt * speed;
      if (heartbeatT <= 0) { heartbeatT = 1.0; SFX.heartbeat(); }
    } else {
      ui.setLowHp(false);
    }
  }

  /* 음악 트랙 */
  if (!isMuted()) {
    if (state.phase === 'wave') music.setTrack(D.isBossWave(state.wave) ? 'boss' : 'battle');
    else if (state.phase === 'prep') music.setTrack('prep');
  }

  /* UI 갱신 */
  ui.updateHud(state, store.shards, store.best(state.difficulty));
  ui.setWaveUI(state);
  ui.comboChip(state.combo.count, state.combo.count >= D.COMBO.x3At ? 3 : state.combo.count >= D.COMBO.x2At ? 2 : 1);
  const bossE = state.enemies.find(e => e.boss && !e.dead);
  ui.setBossBar(bossE ? bossE.hp / bossE.maxHp : null);
  panelT += realDt;
  if (panelT > 0.35) {           // 골드 변동에 따른 버튼 활성화 갱신
    panelT = 0;
    ui.renderCastlePanel(state);
    if (selHero != null) ui.renderHeroPanel(state, selHero);
  }

  renderer.sync(state);
  renderer.frame(isPaused() ? 0 : realDt * speed, state);
}

/* ---------- 시작 ---------- */
newGame(store.diff);
ui.setMuteLabel(isMuted());
ui.setSpeedLabel(speed);
ui.coachChip();
requestAnimationFrame(frame);

/* 첫 사용자 입력에서 오디오 잠금 해제 */
window.addEventListener('pointerdown', () => { music.sync(); }, { once: true });

/* 디버그 훅 (자동 검증/테스트용) */
window.__game = {
  get state() { return state; },
  E, D, renderer,
  refresh: refreshAll,
  selectHero(id) { selHero = id; renderer.setSelectedHero(id); ui.renderHeroPanel(state, id); },
  gold(n) { state.gold += n; refreshAll(); },
  jump(w) { state.wave = w; refreshAll(); },
  hurt(n) { state.castleHp = Math.max(0, state.castleHp - n); if (state.castleHp <= 0) { state.phase = 'over'; state.shardsEarned = D.shardReward(state.wave, state.bossKills); onGameOver(); } },
};
