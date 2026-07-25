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
const modal = { mode: null, pending: null, prob: null };

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
function openMath(mode, pending = null) {
  if (state.phase === 'over') return;
  modal.mode = mode;
  modal.pending = pending;
  let title = '✏️ 지혜의 시험!';
  if (mode === 'combine' && pending) {
    if (pending.kind === 'rankup') {
      const C = D.CLASSES[pending.cls];
      title = `⚗️ 조합 시험! (${C.name} ${D.TIERS[pending.tier].name}×2)`;
    } else {
      const R = D.CLASSES[pending.result];
      title = `⚗️ 조합 시험! (${R.emoji} ${R.name} 만들기)`;
    }
  }
  ui.showMath(title);
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
    if (modal.mode === 'combine' && modal.pending) {
      const p = modal.pending;
      const r = p.kind === 'rankup'
        ? E.combineRankUp(state, p.cls, Number(p.tier))
        : E.combineRecipe(state, p.result, Number(p.tier));
      if (!r.ok && r.reason === 'gold') {
        ui.mathFeedback(true, `정답! 그런데 조합 골드가 부족해요 (💰${r.cost} 필요)`, null);
        refreshAll();
        return;
      }
      if (r.ok) {
        SFX.combine();
        const C = D.CLASSES[r.hero.cls];
        const more = !!chooseBestCombo();
        let msg = `🎉 정답! ${D.TIERS[r.hero.tier].name} ${C.name} ${C.emoji} 탄생! (💰-${r.cost})`;
        if (r.lucky) {
          msg = `🍀 럭키!! 두 등급 점프! ${D.TIERS[r.hero.tier].name} ${C.name} ${C.emoji} 탄생! (💰-${r.cost})`;
          renderer.celebrate(0x7fd45e, true);
          SFX.summon(3);
        }
        if (p.kind === 'recipe') {
          ui.toast(`✨ 특수 용사 [${C.name}] 탄생! ${C.desc}`, 'good');
          renderer.celebrate(0xd8b4ff, true);
        }
        modal.pending = null;
        /* 예측형 흐름: 더 조합할 게 있으면 Enter로 연쇄, 없으면 자동으로 닫힌다 */
        if (more) {
          ui.mathFeedback(true, msg, '⚗ 계속 조합 (Enter)');
        } else {
          ui.mathFeedback(true, `${msg} — 잠시 후 닫혀요`, null);
          const token = ++autoCloseToken;
          setTimeout(() => {
            if (token === autoCloseToken && ui.isMathOpen()) closeMathAll();
          }, 1400);
        }
        if (r.hero.tier === 3) ui.toast(`👑 전설! [${D.LEGEND_ABILITIES[r.hero.cls].name}] ${D.LEGEND_ABILITIES[r.hero.cls].desc}`, 'good');
      } else {
        ui.mathFeedback(true, '정답! 그런데 조합 재료가 부족해요…', null);
      }
    } else {
      ui.mathFeedback(true, `🎉 정답! 💰+${res.gold} · 🧠 지식+${res.kp}`, '➡ 다음 문제 (Enter)');
    }
  } else {
    SFX.wrong();
    ui.mathFeedback(false, `😢 아쉬워요! 정답은 ${modal.prob.answer} 이에요. (지식 -1)`,
      modal.mode === 'combine' ? '🔁 다시 도전 (Enter)' : '➡ 다음 문제 (Enter)');
  }
  refreshAll();
}

/* 응답 후 Enter/Space: 상황에 맞는 다음 행동 (연쇄 조합 → 자동 종료) */
let autoCloseToken = 0;
function closeMathAll() {
  autoCloseToken++;
  ui.hideMath();
  modal.mode = null;
  modal.pending = null;
}
function chooseBestCombo() {
  const combos = E.listCombos(state).filter(c => c.affordable);
  if (!combos.length) return null;
  /* 가장 높은 등급을 만들 수 있는 것 우선, 동급이면 특수 레시피 우선 */
  return combos.sort((a, b) =>
    b.resultTier - a.resultTier ||
    (b.kind === 'recipe' ? 1 : 0) - (a.kind === 'recipe' ? 1 : 0)
  )[0];
}
function comboToAction(c) {
  return c.kind === 'rankup'
    ? { kind: 'rankup', cls: c.cls, tier: String(c.tier) }
    : { kind: 'recipe', result: c.result, tier: String(c.tier) };
}
function advanceMath() {
  autoCloseToken++;
  if (modal.mode === 'combine') {
    if (modal.pending) { newProblem(); return; }        // 오답 재도전
    const next = chooseBestCombo();
    if (next) openMath('combine', comboToAction(next)); // 연쇄 조합
    else closeMathAll();
  } else {
    newProblem();
  }
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
  onWaveStart() { tryStartWave(); },
  onSummon: doSummon,
  onPractice() { openMath('practice'); },
  onCombine(action) { openMath('combine', action); },
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
  onMathNext: advanceMath,
  onMathClose: closeMathAll,
});

/* ---------- 키보드 조작 (전 기능) ---------- */
let kbPad = null;                     // 키보드 배치 커서

const freePads = () => D.PADS.map((_, i) => i).filter(i => !E.padOccupant(state, i));

function cyclePad(dir) {
  const free = freePads();
  if (!free.length) return;
  if (kbPad == null || !free.includes(kbPad)) kbPad = free[0];
  else kbPad = free[(free.indexOf(kbPad) + dir + free.length) % free.length];
  renderer.setHover(kbPad);
}

function cycleBench(dir) {
  if (!state.bench.length) { ui.toast('벤치가 비어 있어요. S키로 소환해 보세요!', 'bad'); return; }
  let idx = state.bench.findIndex(h => h.id === selBench);
  idx = (idx + dir + state.bench.length) % state.bench.length;
  const hero = state.bench[idx];
  selBench = hero.id;
  selHero = hero.id;
  renderer.setPlacementMode(true, D.CLASSES[hero.cls].range);
  renderer.setSelectedHero(null);
  if (kbPad == null) cyclePad(1);
  else renderer.setHover(kbPad);
  ui.renderBench(state, selBench);
  ui.renderHeroPanel(state, selHero);
  SFX.tap();
}

function deselectAll() {
  selBench = null;
  selHero = null;
  kbPad = null;
  renderer.setPlacementMode(false);
  renderer.setSelectedHero(null);
  renderer.setHover(null);
  ui.renderBench(state, selBench);
  ui.renderHeroPanel(state, null);
}

function setGradeKey(g) {
  grade = g;
  ui.setGradeActive(g);
  SFX.tap();
}

function tryStartWave() {
  const r = E.startWave(state);
  if (!r.ok) return;
  SFX.waveStart();
  music.setWave(state.wave);
  ui.toast(`🌊 ${state.wave}웨이브 시작! 몬스터를 막아요!`);
  if (r.boss) ui.toast('⚠️ 보스가 지름길로 돌진하는 웨이브예요!', 'bad');
  ui.setWaveUI(state);
}

/* 버튼 클릭 후 Space가 그 버튼을 다시 누르지 않도록 포커스 해제 */
document.addEventListener('click', (ev) => {
  if (ev.target instanceof HTMLButtonElement) ev.target.blur();
});

/* 한글 IME 상태에서도 단축키가 통하도록 매핑 */
const KO = { 'ㄴ': 's', 'ㅔ': 'p', 'ㅊ': 'c', 'ㅂ': 'q', 'ㅕ': 'u', 'ㄱ': 'r', 'ㅌ': 'x', 'ㅗ': 'h' };

document.addEventListener('keydown', (ev) => {
  let key = ev.key;
  if (KO[key]) key = KO[key];
  const lower = key.length === 1 ? key.toLowerCase() : key;

  /* --- 수학 모달 --- */
  if (ui.isMathOpen()) {
    if (key === 'Escape') { ev.preventDefault(); closeMathAll(); return; }
    if (ui.isAnswered() && (key === 'Enter' || key === ' ')) {
      ev.preventDefault();
      const canAdvance = !ui.el.mNext.classList.contains('hidden');
      if (canAdvance) advanceMath();
      else closeMathAll();
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
    case 'Enter':
      ev.preventDefault();
      if (selBench != null && kbPad != null) {
        const pad = kbPad;
        kbPad = null;
        renderer.setHover(null);
        doPlace(pad);
      } else if (state.phase === 'prep') {
        tryStartWave();
      }
      return;
    case 'Escape':
      deselectAll();
      return;
    case 'Tab':
      ev.preventDefault();
      cycleBench(ev.shiftKey ? -1 : 1);
      return;
    case 'ArrowLeft':
    case 'ArrowUp':
      if (selBench != null) { ev.preventDefault(); cyclePad(-1); }
      return;
    case 'ArrowRight':
    case 'ArrowDown':
      if (selBench != null) { ev.preventDefault(); cyclePad(1); }
      return;
  }
  switch (lower) {
    case 's': doSummon(); return;
    case 'p': openMath('practice'); return;
    case 'c': {
      const combo = chooseBestCombo();
      if (combo) openMath('combine', comboToAction(combo));
      else {
        const unpaid = E.listCombos(state).find(c => !c.affordable);
        ui.toast(unpaid
          ? `조합 골드가 부족해요! (💰${unpaid.cost} 필요) 수학 문제로 벌어 보세요 ✏️`
          : '지금 가능한 조합이 없어요. 용사를 더 모아 보세요!', 'bad');
      }
      return;
    }
    case 'q':
      speed = speed === 1 ? 2 : 1;
      ui.setSpeedLabel(speed);
      SFX.tap();
      return;
    case 'u': if (selHero != null) ui.el.upgradeBtn.click(); return;
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
  get modal() { return modal; },
  E, D, renderer,
  refresh: refreshAll,
  selectHero(id) { selHero = id; renderer.setSelectedHero(id); ui.renderHeroPanel(state, id); },
  gold(n) { state.gold += n; refreshAll(); },
  jump(w) { state.wave = w; refreshAll(); },
  hurt(n) { state.castleHp = Math.max(0, state.castleHp - n); if (state.castleHp <= 0) { state.phase = 'over'; state.shardsEarned = D.shardReward(state.wave, state.bossKills); onGameOver(); } },
};
