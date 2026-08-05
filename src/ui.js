/* =====================================================
 * UI (DOM 패널/모달) — 상태를 그리고, 입력을 핸들러로 전달
 * ===================================================== */
import * as D from './data.js';
import * as E from './engine.js';

const $ = (id) => document.getElementById(id);

/* 사거리 등급 라벨 — 숫자만으론 감이 안 오니 말로도 알려준다 */
function rangeLabel(range) {
  if (range >= 240) return { text: '초장거리', cls: 'r4' };
  if (range >= 180) return { text: '장거리', cls: 'r3' };
  if (range >= 140) return { text: '중거리', cls: 'r2' };
  return { text: '근접', cls: 'r1' };
}

/* 조합 결과 미리보기용 가상 용사 (상태를 바꾸지 않는다) */
function previewHero(cls, tier, state) {
  const s = D.heroStats(cls, tier);
  return {
    id: -1, cls, tier, padIndex: -1,
    dmg: Math.round(s.dmg * (state ? state.dmgMul : 1)),
  };
}

/* 용사 상세 정보(툴팁/패널 공용) */
export function describeHero(hero, state, preview) {
  const C = D.CLASSES[hero.cls];
  const T = D.TIERS[hero.tier];
  const m = E.heroMods(hero);
  const rl = rangeLabel(m.range);
  const rows = [];
  rows.push(`⚔ 공격력 <b>${hero.dmg}</b>${m.hits > 1 ? ` × ${m.hits}타` : ''}`);
  rows.push(`⏱ 공격속도 <b>${m.spd.toFixed(2)}</b>/초 · 초당 <b>${E.heroDps(hero)}</b>`);
  if (m.crit) rows.push(`💥 <b>치명타 ${Math.round(m.crit.chance * 100)}%</b> · 피해 <b>×${m.crit.mul}</b>`);
  if (m.block) rows.push(`🛡️ <b>방패 장벽</b>: ${m.block.period}초마다 사거리 안 적을 <b>${m.block.dur}초 정지</b>`);
  if (m.slowOnHit) rows.push(`❄ 맞은 적 <b>${Math.round((1 - m.slowOnHit.mul) * 100)}% 감속</b> ${m.slowOnHit.dur}초`);
  if (m.aura) rows.push(`❄ <b>결계</b>: 사거리 안 모든 적 상시 ${Math.round((1 - m.aura) * 100)}% 감속`);
  if (m.splash) rows.push(`💥 <b>범위 폭발</b> 반경 ${Math.round(m.splash)}`);
  if (m.splashSlow) rows.push(`🧊 폭발에 맞은 적 ${Math.round((1 - m.splashSlow.mul) * 100)}% 감속`);
  if (m.burn) rows.push(`🔥 <b>화상</b>: 초당 공격력의 ${Math.round(m.burn * 100)}% (${D.BURN_DUR}초)`);
  if (m.pierce > 1) rows.push(`🎯 <b>관통</b> ${m.pierce}명`);
  if (m.cleave) rows.push(`🌀 <b>회전베기</b>: 사거리 안 전부 타격`);
  if (m.healOnKill) rows.push(`💚 처치 시 성 회복 <b>+${m.healOnKill}</b>`);
  /* 수학을 빨리 풀어 얻은 힘 — 어디서 온 공격력인지 보여야 다음에도 서두를 이유가 된다 */
  if (hero.spark > 0) rows.push(`⚡ <b>빠른 풀이 +${Math.round(hero.spark * 100)}%</b> (수학을 빨리 맞혀 얻은 힘)`);

  let ability = '';
  const MA = hero.tier >= 4 ? D.MYTHIC_ABILITIES[hero.cls] : null;
  const LA = D.LEGEND_ABILITIES[hero.cls];
  if (MA) ability = `<div class="tt-mythic">🌌 ${MA.name} — ${MA.desc}</div>`;
  else if (hero.tier === 3 && LA) ability = `<div class="tt-legend">⭐ ${LA.name} — ${LA.desc}</div>`;
  let recipe = '';
  if (C.recipe) {
    const [a, b] = C.recipe;
    const label = C.mythic ? '🌌 신화 조합 전용' : '✨ 조합 전용 특수 용사';
    recipe = `<div class="tt-recipe">${label} (${D.CLASSES[a].emoji}+${D.CLASSES[b].emoji})</div>`;
  }
  const barPct = Math.round((m.range / D.RANGE_MAX) * 100);
  const onField = hero.padIndex >= 0;
  const cap = D.maxTierOf(hero.cls);
  const capNote = hero.tier >= cap
    ? `🔒 최고 등급(${D.TIERS[cap].name})`
    : `⬆ ${D.TIERS[cap].name}까지 성장 가능`;
  const foot = preview
    ? '🔮 조합하면 이렇게 나와요 (미리보기)'
    : `${onField ? '배치됨 · 발판 클릭으로 이동(다른 용사면 교환) · 우클릭 회수' : '벤치 · 발판을 눌러 배치(찬 자리면 교환)'} · ${capNote}`;

  return `
    <div class="tt-head">
      ${preview ? '<span class="tt-preview">미리보기</span>' : ''}
      <span class="tt-emoji">${C.emoji}</span>
      <span class="tt-name">${C.name}</span>
      <span class="tt-tier" style="background:${T.color}">${T.name}</span>
    </div>
    <div class="tt-range">
      <span class="tt-rlabel ${rl.cls}">${rl.text}</span>
      <span class="tt-rnum">🎯 사거리 ${m.range}</span>
      <div class="tt-rbar"><div class="tt-rfill ${rl.cls}" style="width:${barPct}%"></div></div>
    </div>
    <div class="tt-rows">${rows.map(r => `<div>${r}</div>`).join('')}</div>
    ${ability}${recipe}
    <div class="tt-desc">${C.desc}</div>
    <div class="tt-foot">${foot}</div>
  `;
}

export class UI {
  constructor() {
    this.el = {};
    [
      'bestWave', 'shards', 'metaBtn', 'castleText', 'castleFill', 'castleGhost',
      'scene3d', 'hitFlash', 'lowHpVignette', 'bossBanner', 'comboChip', 'waveInfo', 'remainN',
      'waveBtn', 'coachChip', 'toasts', 'gold', 'waveNo', 'speedBtn', 
      'grades', 'summonBtn', 'benchHint', 'bench', 'combineRows', 'sfxBtn', 'bgmBtn',
      'castleRows', 'heroPanel', 'hpTitle', 'hpInfo', 'recallBtn', 'sellBtn', 'moveHint',
      'diffRow', 'mathModal', 'mTitle', 'mGrade', 'mProblem', 'mInput', 'mSubmit', 'mFeedback', 'mNext', 'mClose',
      'storyModal', 'storyIcon', 'storyTitle', 'storyLines', 'storyNext', 'storyOff',
      'demoBtn', 'demoBar', 'demoCaption', 'demoExit',
      'revealModal', 'revealCard', 'revealTier', 'revealArt', 'revealName', 'revealDesc',
      'mHintBtn', 'mHint', 'mDiff', 'mSteps', 'mStreak', 'mTimer', 'mTimerFill', 'mTimerText',
      'mQuiz', 'mVert', 'mTries',
      'wavePreview', 'bossBar', 'bossBarFill', 'bossBarName', 'bossWarnBanner',
      'saveBtn', 'loadBtn', 'loadFile',
      'sellModeBtn', 'sellInfo', 'sellAllBtn', 'sellGoBtn',
      'startModal', 'continueInfo', 'continueBtn', 'newGameBtn',
      'overModal', 'overStats', 'overShards', 'restartBtn', 'shareBtn', 'overMetaBtn',
      'metaModal', 'metaShards', 'metaRows', 'metaClose', 'tooltip',
      'revealCard', 'rarityFlash',
      'tabs', 'heroDot', 'combineDot', 'helpBtn', 'helpBox',
      'champChip', 'champFace', 'champLv', 'champKoTag', 'champHpFill', 'champXpFill',
      'spellBtn', 'spellCdFill', 'ultBtn', 'ultFill', 'skillBtn', 'spBadge',
      'skillModal', 'skillPts', 'skillCols', 'skillClose',
    ].forEach(id => this.el[id] = $(id));
    this._lastKnow = -1;
    this._lastProbSig = '';
    this._tab = 'combine';
    this._tabBefore = null;
  }

  /* ---------- 오른쪽 패널 탭 ----------
   * 세 패널을 세로로 쌓으면 화면 두 배 길이가 된다 — 한 번에 하나만 보여 준다. */
  showTab(name) {
    this._tab = name;
    this.el.tabs.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.tabbody .pane').forEach(p =>
      p.classList.toggle('hidden', p.dataset.pane !== name));
    if (name === 'hero') this.el.heroDot.classList.add('hidden');
    if (name === 'combine') this.el.combineDot.classList.add('hidden');
  }
  /* 용사를 고르면 잠깐 용사 탭으로 넘어갔다가, 선택을 풀면 원래 보던 탭으로 돌아온다 */
  showHeroTab() {
    if (this._tab === 'hero') return;
    this._tabBefore = this._tab;
    this.showTab('hero');
  }
  restoreTab() {
    if (this._tab !== 'hero') return;
    this.showTab(this._tabBefore || 'combine');
    this._tabBefore = null;
  }

  bind(h) {
    this.h = h;
    const el = this.el;
    el.waveBtn.addEventListener('click', h.onWaveStart);
    el.summonBtn.addEventListener('click', h.onSummon);
    el.speedBtn.addEventListener('click', h.onSpeed);
    el.sfxBtn.addEventListener('click', h.onToggleSfx);
    el.bgmBtn.addEventListener('click', h.onToggleBgm);
    el.metaBtn.addEventListener('click', h.onMetaOpen);
    el.overMetaBtn.addEventListener('click', h.onMetaOpen);
    el.metaClose.addEventListener('click', () => this.hideMeta());
    el.restartBtn.addEventListener('click', h.onRestart);
    el.shareBtn.addEventListener('click', h.onShare);
    el.recallBtn.addEventListener('click', () => h.onRecall());
    el.sellBtn.addEventListener('click', () => h.onSell());
    /* 저장/불러오기 — "간단한 파일" 하나로 오간다 */
    el.saveBtn.addEventListener('click', () => h.onSave());
    el.loadBtn.addEventListener('click', () => el.loadFile.click());
    el.loadFile.addEventListener('change', () => {
      const f = el.loadFile.files && el.loadFile.files[0];
      el.loadFile.value = '';               // 같은 파일을 다시 골라도 change가 오게
      if (!f) return;
      f.text()
        .then(t => { let d = null; try { d = JSON.parse(t); } catch { /* 형식 오류 */ } h.onLoad(d); })
        .catch(() => h.onLoad(null));
    });
    /* 여러 명 판매 */
    el.sellModeBtn.addEventListener('click', () => h.onSellMode());
    el.sellAllBtn.addEventListener('click', () => h.onSellAll());
    el.sellGoBtn.addEventListener('click', () => h.onSellGo());
    /* 시작 메뉴 (이어하기 / 처음부터) */
    el.continueBtn.addEventListener('click', () => h.onContinue());
    el.newGameBtn.addEventListener('click', () => h.onStartNew());
    /* 별지기 */
    el.spellBtn.addEventListener('click', () => h.onSpell());
    el.ultBtn.addEventListener('click', () => h.onUlt());
    el.skillBtn.addEventListener('click', () => h.onSkillOpen());
    el.skillClose.addEventListener('click', () => this.hideSkills());
    el.mSubmit.addEventListener('click', () => h.onMathSubmit(el.mInput.value));
    el.mNext.addEventListener('click', h.onMathNext);
    el.mClose.addEventListener('click', h.onMathClose);
    el.mHintBtn.addEventListener('click', h.onHint);
    el.demoBtn.addEventListener('click', h.onDemoToggle);
    el.demoExit.addEventListener('click', h.onDemoToggle);
    el.storyNext.addEventListener('click', h.onStoryClose);
    el.storyOff.addEventListener('click', h.onStoryOff);
    el.revealModal.addEventListener('click', h.onRevealClose);
    /* 모달 아무 데나 누르면 입력창으로 포커스를 되돌린다.
     * 버튼이나 배경을 한 번 클릭하면 포커스가 거기 남아서, 답을 쓰고 Enter를 눌러도
     * 입력창 핸들러가 안 돌던 문제가 있었다. */
    el.mathModal.addEventListener('mousedown', (ev) => {
      if (this._answered || ev.target.closest('button')) return;
      setTimeout(() => el.mInput.focus(), 0);
    });
    el.mInput.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.stopPropagation();   // 같은 Enter가 전역 핸들러로 흘러가 이중 동작하는 것 방지
      if (!this._answered) h.onMathSubmit(el.mInput.value);
    });
    el.grades.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        h.onGrade(Number(b.dataset.g));
        el.grades.querySelectorAll('button').forEach(v => v.classList.toggle('on', v === b));
      });
    });
    el.diffRow.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => h.onDiff(b.dataset.d));
    });
    el.tabs.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => { this._tabBefore = null; this.showTab(b.dataset.tab); });
    });
    /* 조작법은 접어 둔다 — 필요할 때만 펼치고, 평소엔 전장이 그만큼 커진다 */
    el.helpBtn.addEventListener('click', () => {
      const open = el.helpBox.classList.toggle('hidden');
      el.helpBtn.classList.toggle('on', !open);
    });

    /* 3D 씬 입력 */
    const scene = el.scene3d;
    scene.addEventListener('click', (ev) => {
      /* 드래그를 끝낸 직후에도 click이 한 번 더 온다 — 그건 무시한다 */
      if (this._afterDrag) return;
      h.onSceneClick(ev.clientX, ev.clientY);
    });
    scene.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();                 // 우클릭 = 즉시 회수
      h.onSceneRightClick(ev.clientX, ev.clientY);
    });
    scene.addEventListener('mousemove', (ev) => {
      if (this._drag) return;              // 드래그 중에는 onDragMove가 담당
      h.onSceneMove(ev.clientX, ev.clientY);
    });
    scene.addEventListener('mouseleave', () => { if (!this._drag) h.onSceneMove(null, null); });

    /* --- 끌어서 옮기기 / 자리 바꾸기 ---
     * 배치된 용사를 집어서 다른 발판에 놓으면 이동하고, 이미 용사가 있으면 서로 자리를 바꾼다.
     * pointer 이벤트라 마우스·터치·펜이 모두 같은 코드로 동작한다. */
    scene.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      this._down = { x: ev.clientX, y: ev.clientY, ok: false, moved: false };
    });
    window.addEventListener('pointermove', (ev) => {
      const d = this._down;
      if (!d) return;
      if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6) {
        d.moved = true;
        d.ok = h.onDragStart(d.x, d.y);    // 집은 지점 기준으로 판정
        if (d.ok) { this._drag = true; scene.classList.add('dragging'); this.hideTooltip(); }
      }
      if (d.ok) h.onDragMove(ev.clientX, ev.clientY);
    });
    window.addEventListener('pointerup', (ev) => {
      const d = this._down;
      this._down = null;
      if (!d || !d.ok) return;
      this._drag = false;
      scene.classList.remove('dragging');
      h.onDragEnd(ev.clientX, ev.clientY);
      /* 이어서 날아오는 click 한 번만 삼킨다 */
      this._afterDrag = true;
      setTimeout(() => { this._afterDrag = false; }, 0);
    });
    /* 창 밖으로 나가거나 터치가 취소돼도 "잡은 채로" 남지 않게 */
    window.addEventListener('pointercancel', () => {
      if (!this._down) return;
      this._down = null;
      this._drag = false;
      scene.classList.remove('dragging');
      h.onDragEnd(null, null);
    });
  }

  /* ---------- HUD ---------- */
  updateHud(state, shards, best) {
    const el = this.el;
    el.gold.textContent = state.gold;
    el.waveNo.textContent = state.wave;
    el.shards.textContent = shards;
    el.bestWave.textContent = best || '-';
    el.castleText.textContent = `${state.castleHp} / ${state.castleMax}`;
    const pct = state.castleMax ? (state.castleHp / state.castleMax) * 100 : 0;
    el.castleFill.style.width = `${pct}%`;
    el.castleGhost.style.width = `${pct}%`;
    /* 소환 버튼도 "왜 안 눌리는지"를 버튼 얼굴에 적는다 — 회색이 된 이유가 돈인지 자리인지 보이게 */
    const canPay = state.gold >= D.SUMMON_COST;
    const benchFull = state.bench.length >= D.BENCH_MAX;
    el.summonBtn.disabled = !canPay || benchFull || state.phase === 'over';
    el.summonBtn.classList.toggle('lack', !canPay && !benchFull);
    el.summonBtn.textContent = benchFull
      ? '🧺 벤치가 가득 찼어요 — 배치하거나 팔아요'
      : canPay ? `🎲 용사 소환 (💰 ${D.SUMMON_COST} · S)`
        : `💰${D.SUMMON_COST - state.gold} 더 모으면 소환! (💰${D.SUMMON_COST} 필요 · 지금 💰${state.gold})`;

  }

  setWaveUI(state) {
    const el = this.el;
    if (state.phase === 'prep') {
      el.waveBtn.textContent = `▶ ${state.wave}웨이브 시작!${D.isBossWave(state.wave) ? ' 🐉' : ''} (Space)`;
      el.waveBtn.classList.remove('hidden');
      el.waveInfo.classList.add('hidden');
    } else if (state.phase === 'wave') {
      el.waveBtn.classList.add('hidden');
      el.wavePreview.classList.add('hidden');
      el.waveInfo.classList.remove('hidden');
      el.remainN.textContent = `남은 몬스터 ${E.remainingEnemies(state)}`;
    } else {
      el.waveBtn.classList.add('hidden');
      el.wavePreview.classList.add('hidden');
      el.waveInfo.classList.add('hidden');
    }
    /* 난이도는 게임 시작 전(1웨이브 준비)에만 변경 가능 */
    const canDiff = state.phase === 'prep' && state.wave === 1;
    this.el.diffRow.querySelectorAll('button').forEach(b => {
      b.disabled = !canDiff;
      b.classList.toggle('on', b.dataset.d === state.difficulty);
    });
  }

  /* 콤보 칩 — 매 프레임 호출되므로 "값이 바뀔 때만" 다시 그린다.
   * (전에는 프레임마다 pop 애니메이션을 재시작해 글자가 계속 떨려 보였다) */
  comboChip(count, mul) {
    const el = this.el.comboChip;
    if (count >= 2) {
      if (this._comboCount !== count || this._comboMul !== mul) {
        this._comboCount = count;
        this._comboMul = mul;
        el.textContent = mul > 1 ? `🔥 콤보 ${count} · 골드 ${mul}배!` : `🔥 콤보 ${count}`;
        el.classList.remove('hidden');
        el.classList.toggle('boost', mul > 1);
        /* 배율이 올라가는 순간에만 튀어오르게 */
        if (this._comboMul !== this._popMul) {
          this._popMul = this._comboMul;
          el.classList.remove('pop');
          void el.offsetWidth;
          el.classList.add('pop');
        }
      }
    } else if (this._comboCount != null) {
      this._comboCount = null;
      this._comboMul = null;
      this._popMul = null;
      el.classList.add('hidden');
      el.classList.remove('pop', 'boost');
    }
  }

  /* ---------- 벤치 ----------
   * sell(Set)이 오면 판매 모드: 카드가 체크박스가 된다 — 가격을 크게, 고르면 ✓ */
  renderBench(state, selId, sell = null) {
    const el = this.el.bench;
    if (!state.bench.length) {
      el.innerHTML = '<div class="empty-msg">벤치가 비어 있어요.<br>용사를 소환해 보세요!</div>';
      this.el.benchHint.classList.add('hidden');
      return;
    }
    el.innerHTML = '';
    for (const hero of state.bench) {
      const C = D.CLASSES[hero.cls], T = D.TIERS[hero.tier];
      const d = document.createElement('div');
      const selling = !!sell && sell.has(hero.id);
      d.className = `hcard t${hero.tier}` + (selId === hero.id ? ' sel' : '') + (C.special ? ' sp' : '')
        + (sell ? ' sellable' : '') + (selling ? ' sellsel' : '');
      const m = E.heroMods(hero);
      const rl = rangeLabel(m.range);
      /* 사거리를 카드에 직접 표시 — 배치 판단의 핵심 정보 */
      const badges = [
        m.crit ? '<span class="bdg">💥</span>' : '',
        m.block ? '<span class="bdg">🛡️</span>' : '',
        m.splash ? '<span class="bdg">✹</span>' : '',
        /* 빨리 푼 문제로 태어난 용사 — 카드에서 바로 알아보게 */
        hero.spark > 0 ? '<span class="bdg spark" title="빠른 풀이 +' + Math.round(hero.spark * 100) + '%">⚡</span>' : '',
      ].join('');
      d.innerHTML =
        `<div class="em">${C.emoji}${badges ? `<span class="bdgs">${badges}</span>` : ''}</div>` +
        `<div class="nm">${C.name}</div>` +
        (sell
          ? `<div class="sellprice">💰${D.SELL_PRICE[hero.tier]}</div>`
          : `<div class="rg ${rl.cls}">🎯${m.range}</div>`) +
        `<div class="tr">${T.name}</div>` +
        (selling ? '<div class="sellcheck">✓</div>' : '');
      d.addEventListener('click', () =>
        sell ? this.h.onSellToggle(hero.id) : this.h.onBenchSelect(hero.id));
      d.addEventListener('mouseenter', (ev) => this.showTooltip(hero, state, ev.clientX, ev.clientY));
      d.addEventListener('mousemove', (ev) => this.moveTooltip(ev.clientX, ev.clientY));
      d.addEventListener('mouseleave', () => this.hideTooltip());
      el.appendChild(d);
    }
    this.el.benchHint.classList.toggle('hidden', sell != null || selId == null);
  }

  /* 판매 모드 바 — 고른 인원과 받을 골드를 항상 보여 준다 */
  renderSellBar(state, on, sel) {
    const el = this.el;
    el.sellModeBtn.textContent = on ? '✕ 판매 끝내기 (Esc)' : '💰 여러 명 판매';
    el.sellModeBtn.classList.toggle('on', on);
    el.sellInfo.classList.toggle('hidden', !on);
    el.sellAllBtn.classList.toggle('hidden', !on);
    el.sellGoBtn.classList.toggle('hidden', !on);
    if (!on) return;
    const picked = state.bench.filter(h => sel.has(h.id));
    const total = picked.reduce((s, h) => s + D.SELL_PRICE[h.tier], 0);
    el.sellInfo.textContent = picked.length
      ? `${picked.length}명 선택 · 💰${total}`
      : '카드를 눌러 골라요';
    const allPicked = state.bench.length > 0 && picked.length === state.bench.length;
    el.sellAllBtn.textContent = allPicked ? '전체 해제' : '전체 선택';
    el.sellGoBtn.textContent = picked.length ? `💰${total} 받고 팔기` : '팔기';
    el.sellGoBtn.disabled = !picked.length;
  }

  /* 부족한 재료가 "조합으로만 나오는 직업"일 때, 그 레시피 줄로 데려다 준다.
   * 말로 "마검사부터 만드세요"라고 쓰는 것보다 눈으로 짚어 주는 편이 확실하다. */
  gotoRecipe(cls) {
    const row = [...this.el.combineRows.querySelectorAll('.combine-row.recipe')]
      .find(el => { const p = el.querySelector('.peek'); return p && p.dataset.cls === cls; });
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
  }

  /* ---------- 조합 (3세대 도감: 등급업 / 특수 / 신화) ---------- */
  renderCombine(state) {
    const combos = E.listCombos(state);
    /* 다른 탭을 보고 있어도 "지금 조합할 수 있다"를 놓치지 않게 점을 찍는다 */
    this.el.combineDot.classList.toggle('hidden',
      this._tab === 'combine' || !combos.some(c => c.affordable && !c.locked));
    const byResult = new Map(combos.filter(c => c.kind === 'recipe').map(c => [c.result, c]));
    let html = '';

    /* 지금 당장 되는 것을 맨 위에 모은다 — 아이는 스크롤하지 않는다.
     * "확실히 알고, 되면 착착"의 핵심이라 규칙 안내보다도 위에 둔다. */
    /* 포기했거나 세 번 틀린 조합은 "지금 바로"에서 빠진다 — 눌러도 안 되는 버튼을 위에 두면 안 된다 */
    const ready = combos.filter(c => c.affordable && !c.locked);
    if (ready.length) {
      html += `<div class="combine-now"><div class="now-title">⚡ 지금 바로 조합!</div>`;
      for (const c of ready) {
        const R = D.CLASSES[c.result];
        const what = c.kind === 'rankup'
          ? `${D.CLASSES[c.cls].emoji} ${D.CLASSES[c.cls].name} ${D.TIERS[c.tier].name}×2`
          : `${D.CLASSES[c.a].emoji}+${D.CLASSES[c.b].emoji}`;
        html += `<button class="now-btn" data-kind="${c.kind}"
          ${c.kind === 'rankup' ? `data-cls="${c.cls}" data-tier="${c.tier}"` : `data-result="${c.result}"`}
          style="border-color:${D.TIERS[c.resultTier].color}">
          <span class="now-what">${what}</span>
          <span class="now-arrow">→</span>
          <span class="now-res" style="color:${D.TIERS[c.resultTier].color}">${R.emoji} ${D.TIERS[c.resultTier].name} ${R.name}</span>
          <span class="now-cost">💰${c.cost}</span>
        </button>`;
      }
      html += `</div>`;
    }

    /* 규칙을 화면에 못 박아 둔다 — 헷갈리면 조합을 안 하게 된다 */
    html += `<div class="combine-rule">
      <b>규칙</b> 조합은 <b>같은 등급 2명</b>끼리만! ① 같은 직업 = 등급 UP ② 다른 직업 = 새 직업(등급 UP)<br>
      기본·특수 용사는 <b>전설</b>이 최고 · <b>신화</b> 등급은 <b>신화 용사</b>만 (⚡😇🌌)<br>
      <b>⭐ 표시</b> = 그 조합에서 나올 <b>수학 문제 난이도</b>. 센 용사일수록 문제도 세요!<br>
      문제 난이도는 관문마다 <b>조금씩 흔들려요</b> (🟢순한 · 🔵보통 · 🔴센) — 센 문제가 나올수록 환급이 커요
    </div>`;

    /* 돈이 모자란 줄이 "지금 된다"처럼 보이면 안 된다.
     * 얼마가 모자란지 동전으로 적어 주고(버튼 옆), 버튼은 아예 잠근다 —
     * 눌러 봤자 토스트만 뜨는 버튼은 "되는 줄 알았는데"라는 실망만 남긴다. */
    const shortBadge = (cost) => state.gold >= cost ? ''
      : `<span class="gshort" title="골드가 💰${cost - state.gold} 모자라요 (필요 💰${cost} · 지금 💰${state.gold})">💰${cost - state.gold} 부족</span>`;

    /* 조합 난이도 = 카드 3장의 한가운데. 누르기 전에 미리 보여 준다.
     * 적응형 보정까지 얹어야 미리보기와 실제 관문이 어긋나지 않는다. */
    const adapt = D.adaptOffset(state.mathWindow);
    const lvBadge = (c) => {
      const raw = D.mathLevel(c.resultTier, c.kind === 'recipe', !!D.CLASSES[c.result].mythic);
      const lv = Math.max(1, Math.min(5, raw + adapt));
      const L = D.MATH_LEVELS[lv];
      const [lo, , hi] = D.cardLevels(lv);
      return `<span class="mlv" style="background:${L.color}" title="수학 난이도: ${L.name} — 룰렛으로 ${D.MATH_LEVELS[lo].name}~${D.MATH_LEVELS[hi].name} 중 하나가 걸려요">${L.stars}</span>`;
    };

    /* ① 등급업 — 같은 용사 2명 */
    const rankups = combos.filter(c => c.kind === 'rankup');
    html += `<div class="combine-sub">⬆ 등급업 <span class="cnt">같은 용사·같은 등급 2명 (배치된 용사도 재료 OK)</span></div>`;
    if (!rankups.length) {
      html += `<div class="combine-empty">같은 직업·같은 등급 용사 2명을 모아 보세요</div>`;
    }
    /* 전설에서 막힌 용사가 있으면 왜 막혔는지 알려준다 */
    const capped = [...new Set([...state.bench, ...state.field]
      .filter(h => h.tier >= D.maxTierOf(h.cls) && !D.CLASSES[h.cls].mythic)
      .map(h => h.cls))];
    if (capped.length) {
      html += `<div class="combine-empty">${capped.map(c => D.CLASSES[c].emoji).join('')} 전설은 최고 등급이에요 —
        <b>신화</b>가 되려면 아래 <b>신화 조합</b>으로 신화 용사를 만들어야 해요</div>`;
    }
    for (const c of rankups) {
      const C = D.CLASSES[c.cls];
      html += `<div class="combine-row${c.locked ? ' locked' : c.affordable ? ' ready' : ' broke'}">
        <span class="peek" data-cls="${c.cls}" data-rtier="${c.resultTier}">${C.emoji}</span> ${C.name}
        <span class="cnt" style="color:${D.TIERS[c.tier].color}">${D.TIERS[c.tier].name}×2</span>
        ${lvBadge(c)}${shortBadge(c.cost)}
        <button data-kind="rankup" data-cls="${c.cls}" data-tier="${c.tier}"
          class="${c.locked || !c.affordable ? 'lack' : ''}" ${c.locked || !c.affordable ? 'disabled' : ''}
          title="${c.locked ? '이번 웨이브엔 못 해요 — 웨이브를 치르면 다시 열려요' : ''}">${c.locked ? '🔒 이번 웨이브엔 못 해요' : `⚗ ${D.TIERS[c.resultTier].name} 💰${c.cost}`}</button>
      </div>`;
    }

    /* ②③ 레시피 도감 — 특수(2세대) / 신화(3세대)
     * "재료 하나 더"라고만 쓰면 무엇이 모자란지 알 수가 없다.
     * 부족한 재료를 크게 그리고, 그 자리에서 바로 할 행동(소환/선행 조합)을 준다. */
    const RECIPE_STATE_LABEL = {
      ready: '', gold: '골드 부족', material: '재료 필요', cap: '등급 천장', gap: '등급 안 맞음',
    };
    const renderRecipes = (gen) => {
      let out = '';
      for (const r of D.RECIPES.filter(x => x.gen === gen)) {
        const A = D.CLASSES[r.a], B = D.CLASSES[r.b], R = D.CLASSES[r.result];
        const c = byResult.get(r.result);
        const made = state.discovered && state.discovered.has(r.result);
        const st = E.recipeStatus(state, r, c ? c.cost : null);
        const rtier = c ? c.resultTier : (st.resultTier != null ? st.resultTier : (gen === 3 ? 3 : 1));
        const ta = st.ta, tb = st.tb;

        let right;
        if (st.state === 'ready' || st.state === 'gold') {
          /* 골드가 모자라면 얼마가 모자란지 적고 버튼을 잠근다 — 재료는 다 모았다는 표시(초록 재료)는 그대로다 */
          const broke = st.state === 'gold';
          right = `${c ? lvBadge(c) : ''}${shortBadge(st.cost)}<button data-kind="recipe" data-result="${r.result}"
            class="${broke ? 'lack' : ''}" ${broke ? 'disabled' : ''}>⚗ ${D.TIERS[rtier].name} 💰${st.cost}</button>`;
        } else if (st.state === 'cap') {
          right = `<span class="cnt need">더 안 올라요 — 🌌 신화 조합으로</span>`;
        } else if (st.state === 'gap') {
          /* 두 직업 다 있는데 같은 등급 짝이 없다 — 무엇의 등급을 맞추면 되는지 알려준다 */
          const L = D.CLASSES[st.low];
          right = `<span class="cnt need" title="조합은 같은 등급 2명끼리만 돼요 — 등급을 맞춰 주세요">
            ⚖️ 같은 등급끼리만! ${L.emoji} ${L.name} 등급을 맞춰요</span>`;
        } else {
          /* 부족한 재료를 어떻게 구하는가로 버튼이 갈린다:
           *   기본 4직업 → 소환하면 나온다 · 조합으로만 나오는 직업 → 그 레시피로 보낸다 */
          const need = st.missing[0];
          const N = D.CLASSES[need];
          const byCombine = D.RECIPES.some(x => x.result === need);
          /* 소환도 돈이 든다 — 뽑을 돈이 없으면 "뽑으러 가기"도 잠근다 */
          const canSummon = state.gold >= D.SUMMON_COST;
          right = byCombine
            ? `<button data-goto="${need}" class="need">${N.emoji} ${N.name}부터 만들기</button>`
            : `${shortBadge(D.SUMMON_COST)}<button data-need="${need}"
                class="need${canSummon ? '' : ' lack'}" ${canSummon ? '' : 'disabled'}>🎲 ${N.emoji} ${N.name} 뽑으러 가기</button>`;
        }

        /* 재료 등급을 배지로 — 조합이 되는 줄은 "실제로 쓸 재료", 아니면 "보유 최고" */
        const usedNow = st.state === 'ready' || st.state === 'gold';
        const tierBadge = (t) => t == null || t < 0 ? ''
          : `<span class="ingt" style="background:${D.TIERS[t].color}">${D.TIERS[t].name[0]}</span>`;
        const ing = (cls, C, t) => {
          const have = t >= 0;
          const note = have
            ? ` (${usedNow ? '재료로 쓸 등급' : '보유 최고'}: ${D.TIERS[t].name})`
            : ' — 아직 없어요';
          return `<span class="ing${have ? ' have' : ' lack'}" title="${C.name}${note}">${C.emoji}${have ? tierBadge(t) : '<span class="ingx">?</span>'}</span>`;
        };
        out += `<div class="combine-row recipe s-${st.state}${gen === 3 ? ' mythic' : ''}">
          ${ing(r.a, A, ta)}+${ing(r.b, B, tb)}
          <span class="rarrow">→</span>
          <span class="peek" data-cls="${r.result}" data-rtier="${rtier}">${R.emoji} <b>${R.name}</b>${made ? ' <span class="found">✓</span>' : ''}</span>
          ${right}
        </div>`;
      }
      return out;
    };

    html += `<div class="combine-sub">✨ 특수 조합 <span class="cnt">서로 다른 두 직업 · 같은 등급 2명 → 등급 +1</span></div>`;
    html += renderRecipes(2);
    html += `<div class="combine-sub mythic">🌌 신화 조합 <span class="cnt">특수 2종 → 신화 용사 · 재료가 <b>전설</b>이면 결과가 <b>신화</b>!</span></div>`;
    html += renderRecipes(3);

    this.el.combineRows.innerHTML = html;
    /* 버튼은 세 종류다 — 조합(data-kind) / 소환하러(data-need) / 선행 조합으로(data-goto).
     * 셀렉터를 좁히지 않으면 새 버튼이 onCombine으로 잘못 흘러가 아무 일도 안 일어난다. */
    this.el.combineRows.querySelectorAll('button[data-kind]').forEach(b => {
      b.addEventListener('click', () => this.h.onCombine({ ...b.dataset }));
    });
    this.el.combineRows.querySelectorAll('button[data-need]').forEach(b => {
      b.addEventListener('click', () => this.h.onNeedHero(b.dataset.need));
    });
    this.el.combineRows.querySelectorAll('button[data-goto]').forEach(b => {
      b.addEventListener('click', () => this.gotoRecipe(b.dataset.goto));
    });
    /* 결과 캐릭터에 커서를 올리면 "무엇이 나올지" 미리 보여준다 */
    this.el.combineRows.querySelectorAll('.peek').forEach(sp => {
      const cls = sp.dataset.cls;
      const tier = Number(sp.dataset.rtier);
      sp.addEventListener('mouseenter', (ev) =>
        this.showTooltip(previewHero(cls, tier, state), state, ev.clientX, ev.clientY, true));
      sp.addEventListener('mousemove', (ev) => this.moveTooltip(ev.clientX, ev.clientY));
      sp.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  /* ---------- 성 업그레이드 ---------- */
  renderCastlePanel(state) {
    let html = '';
    const hotkeys = { repair: '7', fortify: '8', tower: '9' };
    for (const [key, U] of Object.entries(D.CASTLE_UPGRADES)) {
      const n = key === 'repair' ? 0 : state.castle[key];
      const maxed = U.max && n >= U.max;
      const cost = U.cost(n);
      const full = key === 'repair' && state.castleHp >= state.castleMax;
      /* 못 누르는 이유가 셋이다 — MAX / 이미 가득 / 돈 부족.
       * 회색 버튼만 두면 셋이 구분이 안 되니 돈 부족은 동전으로 따로 적어 준다. */
      const broke = !maxed && !full && state.gold < cost;
      const disabled = maxed || full || broke || state.phase === 'over';
      const lvLabel = U.max && key !== 'repair' ? ` <span class="cnt">${n}/${U.max}</span>` : '';
      html += `<div class="combine-row${broke ? ' broke' : ''}">
        <span>${U.emoji}</span> ${U.name}<span class="kbd">${hotkeys[key]}</span>${lvLabel}
        <span class="cdesc">${U.desc}</span>
        ${broke ? `<span class="gshort" title="골드가 💰${cost - state.gold} 모자라요 (필요 💰${cost} · 지금 💰${state.gold})">💰${cost - state.gold} 부족</span>` : ''}
        <button data-key="${key}" class="${broke ? 'lack' : ''}" ${disabled ? 'disabled' : ''}>${maxed ? 'MAX' : full ? '가득' : `💰${cost}`}</button>
      </div>`;
    }
    this.el.castleRows.innerHTML = html;
    this.el.castleRows.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.h.onCastle(b.dataset.key));
    });
  }

  /* ---------- 용사 패널 (벤치/필드 공용) ---------- */
  renderHeroPanel(state, heroId) {
    const el = this.el;
    const hero = state.field.find(v => v.id === heroId) || state.bench.find(v => v.id === heroId);
    /* 탭 안에 있으므로 패널 자체는 숨기지 않는다 — 고른 용사가 없으면 안내만 띄운다 */
    if (!hero) {
      el.heroDot.classList.add('hidden');
      el.hpTitle.textContent = '🧍 선택한 용사';
      el.hpInfo.innerHTML = '<div class="empty-msg">전장의 용사나 벤치 카드를 클릭하면<br>자세한 정보가 여기 나와요.</div>';
      el.moveHint.classList.add('hidden');
      el.recallBtn.classList.add('hidden');
      el.sellBtn.classList.add('hidden');
      return;
    }
    el.sellBtn.classList.remove('hidden');
    if (this._tab !== 'hero') el.heroDot.classList.remove('hidden');
    const C = D.CLASSES[hero.cls], T = D.TIERS[hero.tier];
    const onField = hero.padIndex >= 0;
    el.hpTitle.textContent = onField ? '🧍 선택한 용사 (배치됨)' : '🧍 선택한 용사 (벤치)';
    el.hpInfo.innerHTML = describeHero(hero, state);
    el.recallBtn.textContent = '↩ 회수 (R / 우클릭)';
    el.recallBtn.classList.toggle('hidden', !onField);
    el.sellBtn.textContent = `💰 판매 +${D.SELL_PRICE[hero.tier]} (X)`;
    el.moveHint.classList.toggle('hidden', !onField);
  }

  /* ---------- 상세 정보 툴팁 ---------- */
  showTooltip(hero, state, cx, cy, preview) {
    const tt = this.el.tooltip;
    tt.innerHTML = describeHero(hero, state, preview);
    tt.classList.toggle('preview', !!preview);
    tt.classList.remove('hidden');
    this.moveTooltip(cx, cy);
  }
  moveTooltip(cx, cy) {
    const tt = this.el.tooltip;
    if (tt.classList.contains('hidden')) return;
    const r = tt.getBoundingClientRect();
    let x = cx + 16, y = cy + 14;
    if (x + r.width > window.innerWidth - 8) x = cx - r.width - 16;
    if (y + r.height > window.innerHeight - 8) y = Math.max(8, cy - r.height - 14);
    tt.style.left = `${Math.max(8, x)}px`;
    tt.style.top = `${Math.max(8, y)}px`;
  }
  hideTooltip() { this.el.tooltip.classList.add('hidden'); }

  /* ---------- 다음 웨이브 미리보기 ---------- */
  renderWavePreview(state, counts) {
    const el = this.el.wavePreview;
    if (state.phase !== 'prep') { el.classList.add('hidden'); return; }
    const chips = Object.entries(counts)
      .map(([type, n]) => {
        const T = D.ENEMY_TYPES[type];
        const cls = T.boss ? ' boss' : (T.midBoss ? ' midboss' : '');
        return `<span class="wchip${cls}">${T.emoji}×${n}</span>`;
      })
      .join('');
    /* 신화 용사를 데리고 있으면 몬스터가 그만큼 단단해진다 — 시작 전에 알려 준다.
     * 말없이 체력만 올리면 "왜 갑자기 안 죽지?"가 되고, 그건 버그처럼 느껴진다. */
    const press = E.mythicCount(state);
    const warn = press > 0
      ? `<span class="wchip myth" title="신화 용사 ${press}명 — 몬스터 체력 +${Math.round((D.mythicHpMul(press) - 1) * 100)}% · 골드 +${Math.round((D.mythicGoldMul(press) - 1) * 100)}%">🌌 체력 +${Math.round((D.mythicHpMul(press) - 1) * 100)}% · 💰 +${Math.round((D.mythicGoldMul(press) - 1) * 100)}%</span>`
      : '';
    el.innerHTML = `<span class="wlabel">다음 웨이브</span>${chips}${warn}`;
    el.classList.remove('hidden');
  }

  /* ---------- 보스 체력바 (이름 + 등급별 색) ---------- */
  setBossBar(info) {
    const el = this.el.bossBar;
    if (!info) { el.classList.add('hidden'); this._bossBarKey = null; return; }
    el.classList.remove('hidden');
    const key = `${info.name}|${info.great}`;
    if (this._bossBarKey !== key) {
      this._bossBarKey = key;
      this.el.bossBarName.textContent = `${info.emoji} ${info.name}`;
      el.classList.toggle('great', !!info.great);
      el.classList.toggle('mid', !info.great);
    }
    el.classList.toggle('enraged', !!info.enraged);
    this.el.bossBarFill.style.width = `${Math.max(0, info.ratio * 100)}%`;
  }

  /* 등장 경고 배너 */
  bossWarn(tier, name, emoji) {
    const el = this.el.bossWarnBanner;
    const great = tier === 'great';
    el.textContent = great ? `⚠️ 대보스 ${emoji} ${name} 접근!!` : `⚠️ 중간보스 ${emoji} ${name} 접근!`;
    el.classList.toggle('great', great);
    el.classList.remove('hidden');
    clearTimeout(this._warnT);
    this._warnT = setTimeout(() => el.classList.add('hidden'), 2600);
    /* 화면 가장자리 붉은 경고 점멸 */
    const stage = this.el.scene3d.parentElement;
    stage.classList.add('warning');
    clearTimeout(this._warnStageT);
    this._warnStageT = setTimeout(() => stage.classList.remove('warning'), 2600);
  }

  /* 보스 등장/분노 배너 */
  showBossBanner(tier, name, emoji) {
    const el = this.el.bossBanner;
    const great = tier === 'great';
    el.textContent = great ? `${emoji} ${name} 등장!!` : `${emoji} ${name} 등장!`;
    el.classList.toggle('mid', !great);
    el.classList.remove('hidden');
    clearTimeout(this._bossT);
    this._bossT = setTimeout(() => el.classList.add('hidden'), 2400);
  }
  showEnrage(name) {
    const el = this.el.bossBanner;
    el.textContent = `🔥 ${name} 분노!! 더 빨라졌어요!`;
    el.classList.remove('mid');
    el.classList.remove('hidden');
    clearTimeout(this._bossT);
    this._bossT = setTimeout(() => el.classList.add('hidden'), 2200);
  }
  /* 보스 전투 중 화면 분위기 */
  setBossAtmosphere(level) {
    const stage = this.el.scene3d.parentElement;
    stage.classList.toggle('boss-mid', level === 1);
    stage.classList.toggle('boss-great', level === 2);
  }

  /* ---------- 별의 축복 (메타) ---------- */
  renderMeta(shards, levels) {
    this.el.metaShards.textContent = shards;
    let html = '';
    for (const [key, M] of Object.entries(D.META_UPGRADES)) {
      const lv = levels[key] || 0;
      const maxed = lv >= M.max;
      const cost = M.cost(lv);
      html += `<div class="meta-row">
        <span class="memoji">${M.emoji}</span>
        <div class="minfo"><b>${M.name}</b> <span class="cnt">Lv ${lv}/${M.max}</span><br>
        <span class="cdesc">레벨당 ${M.per}</span></div>
        <button data-key="${key}" ${maxed || shards < cost ? 'disabled' : ''}>${maxed ? 'MAX' : `✨${cost}`}</button>
      </div>`;
    }
    this.el.metaRows.innerHTML = html;
    this.el.metaRows.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.h.onMetaBuy(b.dataset.key));
    });
  }
  showMeta() { this.el.metaModal.classList.remove('hidden'); }
  hideMeta() { this.el.metaModal.classList.add('hidden'); }

  /* ---------- 별지기 칩 ----------
   * 매 프레임 불리므로 "값이 바뀔 때만" DOM을 만진다 (comboChip과 같은 규칙). */
  setChampFace(url) {
    if (!url) return;                      // 초상 생성 실패 → 이모지 그대로
    this.el.champFace.innerHTML = `<img src="${url}" alt="별지기 루나">`;
  }
  updateChampChip(state) {
    const c = state.champ;
    const el = this.el;
    if (!c) { el.champChip.classList.add('hidden'); return; }
    const S = E.champStats(state);
    const wave = state.phase === 'wave';

    if (this._chLv !== c.level) {
      this._chLv = c.level;
      el.champLv.textContent = `Lv ${c.level}`;
      el.champLv.classList.remove('pop');
      void el.champLv.offsetWidth;
      el.champLv.classList.add('pop');
    }
    if (this._chKo !== c.ko) {
      this._chKo = c.ko;
      el.champChip.classList.toggle('ko', c.ko);
      el.champKoTag.classList.toggle('hidden', !c.ko);
    }
    const hpPct = Math.round(c.maxHp ? (c.hp / c.maxHp) * 100 : 0);
    if (this._chHp !== hpPct) {
      this._chHp = hpPct;
      el.champHpFill.style.width = `${hpPct}%`;
      el.champHpFill.className = hpPct < 30 ? 'low' : hpPct < 60 ? 'mid' : '';
    }
    const need = D.champXpNeed(c.level);
    const xpPct = c.level >= D.CHAMP_XP.maxLevel ? 100 : Math.min(100, Math.round((c.xp / need) * 100));
    if (this._chXp !== xpPct) {
      this._chXp = xpPct;
      el.champXpFill.style.width = `${xpPct}%`;
    }
    /* 별똥별 — 쿨다운이 차오르는 게이지 (가득 = 준비 완료) */
    const cdPct = Math.round(c.spellCd > 0 ? (1 - c.spellCd / S.starCd) * 100 : 100);
    const spellSig = `${cdPct}|${wave}|${c.ko}`;
    if (this._chSpell !== spellSig) {
      this._chSpell = spellSig;
      el.spellCdFill.style.height = `${100 - cdPct}%`;
      el.spellBtn.disabled = !wave || c.ko || c.spellCd > 0;
      el.spellBtn.classList.toggle('ready', wave && !c.ko && c.spellCd <= 0);
    }
    const ultPct = Math.round(c.ult * 100);
    const ultSig = `${ultPct}|${wave}|${c.ko}`;
    if (this._chUlt !== ultSig) {
      this._chUlt = ultSig;
      el.ultFill.style.height = `${ultPct}%`;
      el.ultBtn.disabled = !wave || c.ko || c.ult < 1;
      el.ultBtn.classList.toggle('full', c.ult >= 1 && !c.ko);
      el.ultBtn.title = c.ult >= 1
        ? '은하수 — 지금이에요! 모든 적을 때리고 얼려요 (E)'
        : `은하수 — 충전 ${ultPct}% (처치할수록 차요)`;
    }
    if (this._chSp !== c.sp) {
      this._chSp = c.sp;
      el.spBadge.textContent = c.sp;
      el.spBadge.classList.toggle('hidden', c.sp <= 0);
      el.skillBtn.classList.toggle('has-sp', c.sp > 0);
    }
  }

  /* ---------- 별자리 (스킬트리) ---------- */
  renderSkills(state) {
    const c = state.champ;
    this.el.skillPts.textContent = c.sp;
    let html = '';
    for (const [bk, B] of Object.entries(D.CHAMP_BRANCHES)) {
      html += `<div class="skill-branch"><h3>${B.emoji} ${B.name}</h3>`;
      for (const [key, SK] of Object.entries(D.CHAMP_SKILLS)) {
        if (SK.branch !== bk) continue;
        const rank = c.skills[key] || 0;
        const spent = E.branchSpent(c, bk);
        const locked = spent < SK.need;
        const maxed = rank >= SK.max;
        const can = !locked && !maxed && c.sp > 0;
        const pips = '★'.repeat(rank) + '☆'.repeat(SK.max - rank);
        html += `<button class="skill-node${maxed ? ' maxed' : ''}${locked ? ' locked' : ''}${can ? ' can' : ''}"
            data-key="${key}" ${(!can) ? 'disabled' : ''} title="${SK.desc}">
          <span class="semoji">${SK.emoji}</span>
          <div class="sinfo">
            <div class="sname">${SK.name} <span class="spips">${pips}</span></div>
            <div class="sper">${maxed ? 'MAX! ' : ''}${SK.per}</div>
            ${locked ? `<div class="slock">🔒 ${B.name}에 ${SK.need}포인트 필요 (지금 ${spent})</div>` : ''}
          </div>
        </button>`;
      }
      html += `</div>`;
    }
    this.el.skillCols.innerHTML = html;
    this.el.skillCols.querySelectorAll('button[data-key]').forEach(b => {
      b.addEventListener('click', () => this.h.onSkillPick(b.dataset.key));
    });
  }
  showSkills() { this.el.skillModal.classList.remove('hidden'); }
  hideSkills() { this.el.skillModal.classList.add('hidden'); }
  isSkillOpen() { return !this.el.skillModal.classList.contains('hidden'); }
  /* ---------- 데모 ----------
   * 데모 중임을 항상 화면에 밝힌다. 사용자가 자기 조작이 안 먹는다고
   * 오해하지 않게 하고, 나가는 길도 늘 보이게 둔다. */
  setDemoMode(on, profile) {
    this.el.demoBar.classList.toggle('hidden', !on);
    this.el.demoBtn.classList.toggle('on', !!on);
    this.el.demoBtn.textContent = on ? '⏹ 데모 끝' : '🎬 데모';
    document.body.classList.toggle('demo-on', !!on);
    if (on && profile) this.setDemoCaption(`🎬 ${profile} 플레이어가 대신 플레이합니다`);
  }
  setDemoCaption(text) {
    const el = this.el.demoCaption;
    if (el.textContent === text) return;      // 같은 글자를 다시 넣어 애니메이션을 재시작하지 않는다
    el.textContent = text;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /* ---------- 막간 이야기 ---------- */
  showStory(beat) {
    const el = this.el;
    el.storyIcon.textContent = beat.icon || '📜';
    el.storyTitle.textContent = beat.title || '';
    el.storyLines.textContent = '';
    /* 줄을 하나씩 요소로 — 빈 줄이 문단 간격이 된다 (타이핑 연출은 넣지 않는다: 아이는 안 기다린다) */
    for (const line of beat.lines) {
      const d = document.createElement('div');
      d.className = line ? 'story-line' : 'story-gap';
      d.textContent = line;
      el.storyLines.appendChild(d);
    }
    el.storyModal.classList.remove('hidden');
    setTimeout(() => el.storyNext.focus(), 30);
  }
  hideStory() { this.el.storyModal.classList.add('hidden'); }
  isStoryOpen() { return !this.el.storyModal.classList.contains('hidden'); }

  /* ---------- 전설·신화 탄생 연출 ---------- */
  showReveal({ tierName, tierColor, name, emoji, desc, art, short }) {
    const el = this.el;
    el.revealTier.textContent = tierName;
    el.revealTier.style.color = tierColor;
    el.revealCard.style.setProperty('--tier', tierColor);
    el.revealName.textContent = name;
    el.revealDesc.textContent = short ? '' : (desc || '');
    el.revealArt.innerHTML = '';
    if (art) {
      const img = document.createElement('img');
      img.src = art;
      img.alt = name;
      el.revealArt.appendChild(img);
    } else {
      el.revealArt.textContent = emoji;      // 초상 생성 실패 시 이모지로
    }
    el.revealCard.classList.toggle('short', !!short);
    el.revealModal.classList.remove('hidden');
    el.revealCard.classList.remove('pop');
    void el.revealCard.offsetWidth;
    el.revealCard.classList.add('pop');
  }
  hideReveal() { this.el.revealModal.classList.add('hidden'); }
  isRevealOpen() { return !this.el.revealModal.classList.contains('hidden'); }

  isMetaOpen() { return !this.el.metaModal.classList.contains('hidden'); }

  /* ---------- 시작 메뉴 (자동 저장이 있을 때: 이어하기 / 처음부터) ---------- */
  showStart(save) {
    const el = this.el;
    const heroes = (Array.isArray(save.bench) ? save.bench.length : 0)
      + (Array.isArray(save.field) ? save.field.length : 0);
    const diff = D.DIFFICULTIES[save.difficulty];
    el.continueInfo.innerHTML =
      `지난 모험이 자동 저장돼 있어요<br><b>${save.wave}웨이브</b> · ${diff ? diff.emoji + ' ' + diff.name : '⚔️ 보통'} 난이도 · 🧍 용사 ${heroes}명`;
    el.continueBtn.textContent = `⏩ 이어하기 — ${save.wave}웨이브부터 (Enter)`;
    el.startModal.classList.remove('hidden');
    setTimeout(() => el.continueBtn.focus(), 30);
  }
  hideStart() { this.el.startModal.classList.add('hidden'); }
  isStartOpen() { return !this.el.startModal.classList.contains('hidden'); }

  /* ---------- 수학 모달 ---------- */
  showMath(title, lv) {
    this.el.mTitle.textContent = title;
    this.setMathTone(lv);
    this.el.mathModal.classList.remove('hidden');
  }
  /* 난이도가 창 전체의 분위기를 바꾼다 — 열리는 순간 "센 문제"임을 알아챈다.
   * 난이도는 창이 열린 뒤에 뽑히므로 따로 부를 수 있게 떼어 놨다. */
  setMathTone(lv) {
    const card = this.el.mathModal.querySelector('.modal-card');
    card.className = `modal-card lv${Math.max(1, Math.min(D.MAX_MATH_LV, lv || 1))}`;
  }

  /* ---------- 세로셈 칸 ----------
   * 문제집의 계산 칸을 그대로 옮긴 것. 자리를 맞춰 쓰지 않으면 받아올림에서 틀리는데,
   * 화면에서는 종이처럼 자리를 맞출 데가 없어서 큰 수가 나오면 손도 못 댄다.
   * 처음부터 띄우면 답을 바로 아는 아이에게 방해가 되므로 **몇 초 지나야** 나온다.
   *
   * v: { op: '+'|'−'|'×', a, b }            두 항 (기존 형태)
   *    { terms: [{v}, {v, op}, {v, op}] }   세 항 이상 — 한 판에 모아서 보여 준다
   *
   * ▸ 자리 맞추기 규칙 (여기가 이 함수의 전부다)
   *   ① 부호는 **맨 왼쪽 제 칸**에 놓는다. 예전엔 "숫자 바로 왼쪽"에 놨는데,
   *      136 × 6 처럼 두 수의 길이가 다르면 ×가 윗줄 3 밑에 박혀서
   *      6이 십의 자리처럼 보였다 — 자리를 알려 주랬더니 자리를 헷갈리게 했다.
   *   ② 소수는 **소수점 기준**으로 맞춘다. 오른쪽 끝으로 맞추면 8.41과 2.7의
   *      소수점이 어긋난다. 정수부·소수부 폭을 따로 재서 점을 한 줄로 세운다.
   *   ③ 받아올림 줄은 덧셈·뺄셈뿐 아니라 곱셈에도 준다. 곱셈이야말로 받아올림이 많다. */
  _buildVert(v) {
    const el = this.el.mVert;
    el.textContent = '';
    if (!v) return false;

    /* 두 형태를 한 모양으로 정규화: [{sign, int, frac}] */
    const raw = v.terms
      ? v.terms.map((t, i) => ({ sign: i === 0 ? '' : (t.op || '+'), s: String(t.v) }))
      : [{ sign: '', s: String(v.a) }, { sign: v.op, s: String(v.b) }];
    const isMul = !v.terms && v.op === '×';
    const rows = raw.map(r => {
      const dot = r.s.indexOf('.');
      return {
        sign: r.sign,
        int: dot < 0 ? r.s : r.s.slice(0, dot),
        frac: dot < 0 ? '' : r.s.slice(dot + 1),
      };
    });

    const intW = Math.max(...rows.map(r => r.int.length));
    const fracW = Math.max(...rows.map(r => r.frac.length));
    /* 정수부 폭: 곱셈은 부분곱·답이 자릿수 합만큼 길어진다. 덧셈·뺄셈은 받아올림 한 칸 */
    const bodyInt = isMul
      ? rows.reduce((a, r) => a + r.int.length, 0)
      : intW + 1;
    const SIGN = 1;                                  // 맨 왼쪽 부호 칸
    const dotCol = SIGN + bodyInt;                   // 소수점이 놓이는 칸
    const cols = SIGN + bodyInt + (fracW ? 1 + fracW : 0);

    const grid = document.createElement('div');
    grid.className = 'mv-grid';
    grid.style.setProperty('--cols', String(cols));

    /* 한 줄 그리기: 정수부는 소수점 왼쪽에 오른쪽 맞춤, 소수부는 오른쪽에 왼쪽 맞춤 */
    const row = (r, cls = '') => {
      const start = dotCol - r.int.length;
      for (let i = 0; i < cols; i++) {
        const c = document.createElement('div');
        c.className = `mv-c ${cls}`;
        if (i === 0 && r.sign) { c.textContent = r.sign; c.classList.add('mv-sign'); }
        else if (fracW && i === dotCol) { if (r.int) { c.textContent = '.'; c.classList.add('mv-dot'); } }
        else if (i >= start && i < dotCol) c.textContent = r.int[i - start];
        else if (fracW && i > dotCol) {
          const k = i - dotCol - 1;
          if (k < r.frac.length) c.textContent = r.frac[k];
        }
        grid.append(c);
      }
    };
    const rule = () => {
      const r = document.createElement('div');
      r.className = 'mv-rule';
      grid.append(r);
    };
    const blanks = (cls) => row({ sign: '', int: '', frac: '' }, cls);

    blanks('mv-carry');                    // 받아올림/받아내림 적는 줄 (곱셈에도 준다)
    for (const r of rows) row(r);
    rule();
    if (isMul && rows[1].int.length > 1) {
      /* 곱하는 수의 자릿수만큼 부분곱 줄, 그 아래 합계 줄 */
      for (let i = 0; i < rows[1].int.length; i++) blanks('mv-blank');
      rule();
    }
    blanks('mv-blank');

    const title = document.createElement('div');
    title.className = 'mv-title';
    title.textContent = rows.length > 2
      ? '✏️ 한 번에 세로로 더하고 빼 보세요'
      : '✏️ 자리를 맞춰 계산해 보세요';
    el.append(title, grid);
    return true;
  }
  /* 몇 초 지나야 나온다 — 바로 아는 문제까지 칸으로 덮으면 방해가 된다 */
  _armVert(v) {
    clearTimeout(this._vertT);
    this.el.mVert.classList.add('hidden');
    if (!this._buildVert(v)) return;
    this._vertT = setTimeout(() => {
      if (this._answered) return;
      this.el.mVert.classList.remove('hidden');
      this.el.mVert.classList.remove('pop');
      void this.el.mVert.offsetWidth;
      this.el.mVert.classList.add('pop');
    }, D.VERT_DELAY_MS);
  }

  /* 문제·힌트 안의 {a/b} 를 세로 분수로 그린다.
   * "15 ÷ 3/6" 처럼 한 줄로 쓰면 15÷3÷6 으로도 읽혀서 아이가 헷갈린다.
   * (문자열을 그대로 넣지 않고 DOM으로 조립한다 — innerHTML을 쓸 이유가 없다) */
  _writeMath(el, text) {
    el.textContent = '';
    const re = /\{(-?\d+)\/(\d+)\}/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) el.append(text.slice(last, m.index));
      const f = document.createElement('span');
      f.className = 'frac';
      const n = document.createElement('b'); n.textContent = m[1];
      const d = document.createElement('i'); d.textContent = m[2];
      f.append(n, d);
      el.append(f);
      last = m.index + m[0].length;
    }
    if (last < text.length) el.append(text.slice(last));
  }

  /* o: { grade, lv, text, round, rounds, time, streak, reward } */
  setProblem(o) {
    const el = this.el;
    const L = D.MATH_LEVELS[Math.max(1, Math.min(D.MAX_MATH_LV, o.lv))];
    this._answered = false;
    el.mGrade.textContent = `${o.grade}학년`;
    el.mDiff.textContent = `${L.stars} ${L.name}${o.label ? ` · ${o.label}` : ''}`;
    el.mDiff.style.background = L.color;
    el.mSteps.classList.add('hidden');       // 한 관문 = 한 문제 (다단계 관문은 없앴다)
    /* 틀렸을 때 재도전에 얼마가 드는지 — 답을 넣기 전에 알아야 판돈이 된다.
     * 낼 수 없으면 붉게: "이번 한 번이 마지막"이라는 신호 */
    if (o.retry) {
      el.mTries.textContent = o.retry.afford
        ? `🔁 틀리면 재도전 💰${o.retry.price}`
        : `⚠ 틀리면 여기까지 (재도전 💰${o.retry.price} 부족)`;
      el.mTries.classList.remove('hidden');
      el.mTries.classList.toggle('last', !o.retry.afford);
    } else {
      el.mTries.classList.add('hidden');
    }
    el.mStreak.textContent = `🔥 ${o.streak}연승`;
    el.mStreak.classList.toggle('hidden', !o.streak || o.streak < 2);
    this._writeMath(el.mProblem, o.text);
    /* 전술 문제는 판을 옮겨 적느라 길다(용사 네 명의 초당 피해 나열 등).
     * 27px 그대로 두면 낮은 화면에서 입력칸이 밀려 나간다 — 길면 글자를 줄인다. */
    const lines = String(o.text).split('\n').length;
    el.mProblem.classList.toggle('long', lines >= 4 || o.text.length > 78);
    el.mInput.value = '';
    el.mInput.disabled = false;
    el.mSubmit.disabled = false;
    el.mFeedback.textContent = o.reward;
    el.mFeedback.className = 'mfeedback';
    el.mNext.classList.add('hidden');
    el.mHint.classList.add('hidden');
    el.mHint.textContent = '';
    el.mHintBtn.disabled = false;
    /* 힌트는 두 단계 — 첫 단계는 "풀이 방법", 둘째가 "정답 실마리".
     * 어려운 문제일수록 값이 싸고, 두 번 틀리면 아예 공짜다 (mathgate.js) */
    el.mHintBtn.textContent = o.freeHint
      ? '💡 풀이 방법 보기 (무료! · H)'
      : `💡 풀이 방법 보기 (💰${o.hintPrice} · H)`;
    el.mHintBtn.classList.toggle('free', !!o.freeHint);
    this.setTimer(o.time, o.time);
    /* 문제가 바뀔 때마다 카드를 한 번 튕겨 준다 — 새 문제가 왔다는 신호.
     * o.pop이 오면 난이도 배지도 같이 튕긴다 = "이번엔 이게 걸렸다"는 뿅. */
    const bounce = (node) => {
      node.classList.remove('pop');
      void node.offsetWidth;
      node.classList.add('pop');
    };
    bounce(el.mProblem);
    if (o.pop) bounce(el.mDiff);
    this._armVert(o.vert);
    /* 포기에 대가가 따르는지에 따라 버튼 문구가 달라진다 — 누르기 전에 알아야 한다.
     * 재도전에 이미 돈을 썼다면 그 액수까지 적는다: 끝까지 풀면 절반이 돌아오는데
     * 지금 포기하면 전부 사라진다는 걸 버튼 위에서 보여 주는 게 가장 정직하다. */
    const lost = o.giveUp && o.giveUp.lost;
    el.mClose.textContent = !o.canGiveUp ? '닫기 (Esc)'
      : (lost ? `🏳 포기 (💰${lost} 날아감)` : '🏳 포기 (Esc)');
    el.mClose.classList.toggle('giveup', !!o.canGiveUp);
    setTimeout(() => el.mInput.focus(), 30);
  }
  /* 남은 시간 바 — 매 프레임 호출되므로 바뀔 때만 DOM을 만진다 */
  setTimer(left, max) {
    const el = this.el;
    const ratio = max > 0 ? Math.max(0, left / max) : 0;
    el.mTimerFill.style.width = `${ratio * 100}%`;
    const sec = Math.max(0, Math.ceil(left));
    if (this._timerSec !== sec) {
      this._timerSec = sec;
      el.mTimerText.textContent = `⏳ ${sec}초`;
    }
    const warn = ratio <= D.TIME_WARN && ratio > 0;
    if (this._timerWarn !== warn) {
      this._timerWarn = warn;
      el.mTimer.classList.toggle('warn', warn);
    }
  }
  /* 힌트는 단계별로 쌓아서 보여 준다 — 산 것이 사라지면 안 된다.
   * more: 아직 살 수 있는 단계가 남았는가 */
  showHint(steps, next) {
    const list = Array.isArray(steps) ? steps : [steps];
    this._writeMath(this.el.mHint, list.map((t, i) => `💡 ${list.length > 1 ? `${i + 1}. ` : ''}${t}`).join('\n'));
    this.el.mHint.classList.remove('hidden');
    this.el.mHintBtn.disabled = !next;
    if (!next) {
      this.el.mHintBtn.textContent = '💡 힌트 다 봤어요';
      this.el.mHintBtn.classList.remove('free');
    } else {
      /* 다음 단계가 무엇인지 밝힌다 — "정답 실마리"는 환급을 잃는 선택이라 알고 눌러야 한다 */
      this.el.mHintBtn.textContent = next.free
        ? '🔎 정답 실마리 (무료! · H)'
        : `🔎 정답 실마리 (💰${next.price} · H)`;
    }
    this.el.mInput.focus();
  }
  mathFeedback(ok, text, nextLabel) {
    const el = this.el;
    this._answered = true;
    clearTimeout(this._vertT);              // 답이 나온 뒤에 계산 칸이 뒤늦게 뜨지 않게
    el.mTimer.classList.remove('warn');     // 답을 낸 순간 시계는 멈춘다
    this._timerWarn = false;
    el.mInput.disabled = true;
    el.mSubmit.disabled = true;
    el.mFeedback.textContent = text;
    el.mFeedback.className = `mfeedback ${ok ? 'ok' : 'no'}`;
    if (nextLabel) {
      el.mNext.textContent = nextLabel;
      el.mNext.classList.remove('hidden');
    } else {
      el.mNext.classList.add('hidden');
    }
  }
  hideMath() {
    clearTimeout(this._vertT);
    this.el.mVert.classList.add('hidden');
    this.el.mathModal.classList.add('hidden');
  }
  isMathOpen() { return !this.el.mathModal.classList.contains('hidden'); }
  isAnswered() { return !!this._answered; }
  setGradeActive(g) {
    this.el.grades.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', Number(b.dataset.g) === g));
  }

  /* ---------- 게임 오버 ---------- */
  showOver(state) {
    const rate = state.solved ? Math.round((state.correct / state.solved) * 100) : 0;
    this.el.overStats.innerHTML =
      `🌊 도달한 웨이브: <b>${state.wave}웨이브</b> (${D.DIFFICULTIES[state.difficulty].name})<br>
       👾 물리친 몬스터: <b>${state.kills}마리</b>${state.midBossKills ? ` · 👿 중간보스 ${state.midBossKills}` : ''}${state.bossKills ? ` · 🐉 대보스 ${state.bossKills}` : ''}<br>
       🎲 소환 <b>${state.summons}</b> · ⚗️ 조합 <b>${state.combos}</b> · ✨ 특수 <b>${state.specialsMade}</b> · 🌌 신화 <b>${state.mythicsMade}</b><br>
       🧮 수학 문제: <b>${state.solved}문제 중 ${state.correct}개 정답 (${rate}%)</b>${state.hints ? ` · 💡 힌트 ${state.hints}회` : ''}${state.retries ? ` · 🔁 재도전 ${state.retries}회 (💰${state.retryGold})` : ''}<br>
       ${state.persisted ? `💪 포기하지 않고 끝내 푼 문제: <b>${state.persisted}개</b><br>` : ''}
       🔥 최고 연승: <b>${state.bestStreak || 0}연속</b> (한 번에 맞히기)${state.timeOuts ? ` · ⏰ 시간 초과 ${state.timeOuts}회` : ''}${state.mathShards ? `<br>🔴 센 문제를 뚫고 번 별조각: <b>✨${state.mathShards}</b>` : ''}
       ${state.champ ? `<br>🌠 별지기 루나: <b>Lv ${state.champ.level}</b> · 직접 처치 <b>${state.champKills || 0}</b> · ☄️ 별똥별 ${state.starCasts || 0}회${state.ultCasts ? ` · 🌌 은하수 ${state.ultCasts}회` : ''}${state.perfectWaves ? ` · 🛡️ 완벽 방어 ${state.perfectWaves}번` : ''}` : ''}`;
    this.el.overShards.textContent = `✨ 별조각 +${state.shardsEarned} 획득!`;
    this.el.overModal.classList.remove('hidden');
  }
  hideOver() { this.el.overModal.classList.add('hidden'); }

  /* ---------- 소환/조합 연출 ---------- */
  summonReveal(hero, tier) {
    const C = D.CLASSES[hero.cls], T = D.TIERS[tier];
    const el = this.el.revealCard;
    el.className = `reveal t${tier}`;
    el.innerHTML =
      `<div class="rv-em">${C.emoji}</div>` +
      `<div class="rv-tier" style="color:${T.color}">${T.name}</div>` +
      `<div class="rv-name">${C.name}</div>`;
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.classList.add('pop');
    clearTimeout(this._revealT);
    this._revealT = setTimeout(() => { el.classList.add('hidden'); el.classList.remove('pop'); },
      tier >= 3 ? 1800 : tier >= 2 ? 1500 : 900);
    if (tier >= 2) this.flashScreen(tier >= 4 ? 'mythic' : tier === 3 ? 'legend' : 'hero');
  }

  flashCombine(tier) { this.flashScreen(tier >= 4 ? 'mythic' : tier === 3 ? 'legend' : 'hero'); }

  flashScreen(kind) {
    const el = this.el.rarityFlash;
    el.className = kind;
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => el.classList.remove('on'), 900);
  }

  /* ---------- 연출 ---------- */
  toast(msg, kind = '') {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 2700);
  }
  flashHit() {
    const el = this.el.hitFlash;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }
  setLowHp(on) { this.el.lowHpVignette.classList.toggle('on', on); }
  coachChip() {
    if (localStorage.getItem('mathdef_coach')) return;
    localStorage.setItem('mathdef_coach', '1');
    const el = this.el.coachChip;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 9000);
  }
  setSpeedLabel(s) { this.el.speedBtn.textContent = `⏩ x${s} (Q)`; }
  /* 음소거 버튼 상태 — 꺼진 건 한눈에 보이게 (아이콘 + 회색 처리) */
  setSoundLabels(sfxOff, bgmOff) {
    this.el.sfxBtn.textContent = sfxOff ? '🔇 효과음' : '🔊 효과음';
    this.el.sfxBtn.classList.toggle('off', sfxOff);
    this.el.bgmBtn.textContent = bgmOff ? '🔇 배경음' : '🎵 배경음';
    this.el.bgmBtn.classList.toggle('off', bgmOff);
  }

  /* ---------- 기록 카드 (공유용 PNG) ---------- */
  makeShareCard(state, best) {
    const c = document.createElement('canvas');
    c.width = 720; c.height = 960;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 960);
    bg.addColorStop(0, '#1c2b4a'); bg.addColorStop(1, '#2b4a72');
    g.fillStyle = bg;
    g.fillRect(0, 0, 720, 960);
    g.textAlign = 'center';
    g.font = '64px "Segoe UI Emoji"';
    g.fillText('🏰', 360, 150);
    g.fillStyle = '#ffd93d';
    g.font = 'bold 52px "Malgun Gothic", sans-serif';
    g.fillText('용사 수학 디펜스', 360, 240);
    g.fillStyle = '#ffffff';
    g.font = 'bold 88px "Malgun Gothic", sans-serif';
    g.fillText(`${state.wave}웨이브 도달!`, 360, 400);
    g.font = '34px "Malgun Gothic", sans-serif';
    g.fillStyle = '#cfe3ff';
    const rate = state.solved ? Math.round((state.correct / state.solved) * 100) : 0;
    const lines = [
      `난이도: ${D.DIFFICULTIES[state.difficulty].name}`,
      `물리친 몬스터 ${state.kills}마리`,
      `수학 ${state.solved}문제 중 ${state.correct}개 정답 (${rate}%)`,
      `최고 기록 ${best}웨이브`,
    ];
    lines.forEach((s, i) => g.fillText(s, 360, 520 + i * 60));
    g.font = '28px "Malgun Gothic", sans-serif';
    g.fillStyle = '#8fb4e8';
    g.fillText(new Date().toLocaleDateString('ko-KR'), 360, 860);
    const a = document.createElement('a');
    a.download = `수학디펜스_${state.wave}웨이브.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  }
}
