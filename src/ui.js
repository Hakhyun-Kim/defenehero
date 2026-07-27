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
      'mHintBtn', 'mHint', 'mDiff', 'mSteps', 'mStreak', 'mTimer', 'mTimerFill', 'mTimerText',
      'wavePreview', 'bossBar', 'bossBarFill', 'bossBarName', 'bossWarnBanner',
      'overModal', 'overStats', 'overShards', 'restartBtn', 'shareBtn', 'overMetaBtn',
      'metaModal', 'metaShards', 'metaRows', 'metaClose', 'tooltip',
      'revealCard', 'rarityFlash',
      'tabs', 'heroDot', 'combineDot', 'helpBtn', 'helpBox',
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
    el.mSubmit.addEventListener('click', () => h.onMathSubmit(el.mInput.value));
    el.mNext.addEventListener('click', h.onMathNext);
    el.mClose.addEventListener('click', h.onMathClose);
    el.mHintBtn.addEventListener('click', h.onHint);
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
    el.summonBtn.disabled = state.gold < D.SUMMON_COST || state.bench.length >= D.BENCH_MAX || state.phase === 'over';

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

  /* ---------- 벤치 ---------- */
  renderBench(state, selId) {
    const el = this.el.bench;
    if (!state.bench.length) {
      el.innerHTML = '<div class="empty-msg">벤치가 비어 있어요.<br>용사를 소환해 보세요!</div>';
      return;
    }
    el.innerHTML = '';
    for (const hero of state.bench) {
      const C = D.CLASSES[hero.cls], T = D.TIERS[hero.tier];
      const d = document.createElement('div');
      d.className = `hcard t${hero.tier}` + (selId === hero.id ? ' sel' : '') + (C.special ? ' sp' : '');
      const m = E.heroMods(hero);
      const rl = rangeLabel(m.range);
      /* 사거리를 카드에 직접 표시 — 배치 판단의 핵심 정보 */
      const badges = [
        m.crit ? '<span class="bdg">💥</span>' : '',
        m.block ? '<span class="bdg">🛡️</span>' : '',
        m.splash ? '<span class="bdg">✹</span>' : '',
      ].join('');
      d.innerHTML =
        `<div class="em">${C.emoji}${badges ? `<span class="bdgs">${badges}</span>` : ''}</div>` +
        `<div class="nm">${C.name}</div>` +
        `<div class="rg ${rl.cls}">🎯${m.range}</div>` +
        `<div class="tr">${T.name}</div>`;
      d.addEventListener('click', () => this.h.onBenchSelect(hero.id));
      d.addEventListener('mouseenter', (ev) => this.showTooltip(hero, state, ev.clientX, ev.clientY));
      d.addEventListener('mousemove', (ev) => this.moveTooltip(ev.clientX, ev.clientY));
      d.addEventListener('mouseleave', () => this.hideTooltip());
      el.appendChild(d);
    }
    this.el.benchHint.classList.toggle('hidden', selId == null);
  }

  /* ---------- 조합 (3세대 도감: 등급업 / 특수 / 신화) ---------- */
  renderCombine(state) {
    const combos = E.listCombos(state);
    /* 다른 탭을 보고 있어도 "지금 조합할 수 있다"를 놓치지 않게 점을 찍는다 */
    this.el.combineDot.classList.toggle('hidden',
      this._tab === 'combine' || !combos.some(c => c.affordable));
    const byResult = new Map(combos.filter(c => c.kind === 'recipe').map(c => [c.result, c]));
    let html = '';

    /* 규칙을 화면에 못 박아 둔다 — 헷갈리면 조합을 안 하게 된다 */
    html += `<div class="combine-rule">
      <b>규칙</b> ① 같은 용사 2명 = 등급 UP ② 다른 용사 2명 = 새 직업(등급 UP)<br>
      기본·특수 용사는 <b>전설</b>이 최고 · <b>신화</b> 등급은 <b>신화 용사</b>만 (⚡😇🌌)<br>
      <b>⭐ 표시</b> = 그 조합에서 나올 <b>수학 문제 난이도</b>. 센 용사일수록 문제도 세요!
    </div>`;

    /* 조합 난이도 = 문제 난이도. 누르기 전에 미리 보여 준다 */
    const lvBadge = (c) => {
      const lv = D.mathLevel(c.resultTier, c.kind === 'recipe', !!D.CLASSES[c.result].mythic);
      const L = D.MATH_LEVELS[lv];
      const gate = D.mathRounds(lv) > 1 ? ` ${D.mathRounds(lv)}문제` : '';
      return `<span class="mlv" style="background:${L.color}" title="수학 난이도: ${L.name}${gate}">${L.stars}${gate}</span>`;
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
      html += `<div class="combine-row${c.affordable ? ' ready' : ''}">
        <span class="peek" data-cls="${c.cls}" data-rtier="${c.resultTier}">${C.emoji}</span> ${C.name}
        <span class="cnt" style="color:${D.TIERS[c.tier].color}">${D.TIERS[c.tier].name}×2</span>
        ${lvBadge(c)}
        <button data-kind="rankup" data-cls="${c.cls}" data-tier="${c.tier}"
          ${c.affordable ? '' : 'disabled'}>⚗ ${D.TIERS[c.resultTier].name} 💰${c.cost}</button>
      </div>`;
    }

    /* ②③ 레시피 도감 — 특수(2세대) / 신화(3세대) */
    const all = [...state.bench, ...state.field];
    const has = (cls) => all.some(h => h.cls === cls);
    const renderRecipes = (gen) => {
      let out = '';
      for (const r of D.RECIPES.filter(x => x.gen === gen)) {
        const A = D.CLASSES[r.a], B = D.CLASSES[r.b], R = D.CLASSES[r.result];
        const c = byResult.get(r.result);
        const made = state.discovered && state.discovered.has(r.result);
        const canPay = !!(c && c.affordable);
        const rtier = c ? c.resultTier : (gen === 3 ? 3 : 1);
        let right;
        if (c) {
          right = `${lvBadge(c)}<button data-kind="recipe" data-result="${r.result}"
            ${canPay ? '' : 'disabled'}>⚗ ${D.TIERS[c.resultTier].name} 💰${c.cost}</button>`;
        } else {
          right = `<span class="cnt need">${has(r.a) || has(r.b) ? '재료 하나 더' : '재료 모으기'}</span>`;
        }
        /* 보유한 재료의 최고 등급을 배지로 — "왜 전설이 안 나오지?"를 없앤다 */
        const tierBadge = (cls, t) => t == null || t < 0 ? ''
          : `<span class="ingt" style="background:${D.TIERS[t].color}">${D.TIERS[t].name[0]}</span>`;
        const ta = c ? c.ta : null, tb = c ? c.tb : null;
        out += `<div class="combine-row recipe${canPay ? ' ready' : ''}${gen === 3 ? ' mythic' : ''}">
          <span class="ing${has(r.a) ? ' have' : ''}">${A.emoji}${tierBadge(r.a, ta)}</span>+<span class="ing${has(r.b) ? ' have' : ''}">${B.emoji}${tierBadge(r.b, tb)}</span>
          <span class="rarrow">→</span>
          <span class="peek" data-cls="${r.result}" data-rtier="${rtier}">${R.emoji} <b>${R.name}</b>${made ? ' <span class="found">✓</span>' : ''}</span>
          ${right}
        </div>`;
      }
      return out;
    };

    html += `<div class="combine-sub">✨ 특수 조합 <span class="cnt">서로 다른 두 용사 · 등급이 달라도 OK(낮은 쪽 +1)</span></div>`;
    html += renderRecipes(2);
    html += `<div class="combine-sub mythic">🌌 신화 조합 <span class="cnt">특수 2종 → 신화 용사 · 재료가 <b>전설</b>이면 결과가 <b>신화</b>!</span></div>`;
    html += renderRecipes(3);

    this.el.combineRows.innerHTML = html;
    this.el.combineRows.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.h.onCombine({ ...b.dataset }));
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
      const disabled = maxed || full || state.gold < cost || state.phase === 'over';
      const lvLabel = U.max && key !== 'repair' ? ` <span class="cnt">${n}/${U.max}</span>` : '';
      html += `<div class="combine-row">
        <span>${U.emoji}</span> ${U.name}<span class="kbd">${hotkeys[key]}</span>${lvLabel}
        <span class="cdesc">${U.desc}</span>
        <button data-key="${key}" ${disabled ? 'disabled' : ''}>${maxed ? 'MAX' : `💰${cost}`}</button>
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
    el.innerHTML = `<span class="wlabel">다음 웨이브</span>${chips}`;
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
  isMetaOpen() { return !this.el.metaModal.classList.contains('hidden'); }

  /* ---------- 수학 모달 ---------- */
  showMath(title, lv) {
    this.el.mTitle.textContent = title;
    /* 난이도가 카드 전체의 분위기를 바꾼다 — 열리는 순간 "센 문제"임을 알아챈다 */
    const card = this.el.mathModal.querySelector('.modal-card');
    card.className = `modal-card lv${Math.max(1, Math.min(5, lv || 1))}`;
    this.el.mathModal.classList.remove('hidden');
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
    const L = D.MATH_LEVELS[Math.max(1, Math.min(5, o.lv))];
    this._answered = false;
    el.mGrade.textContent = `${o.grade}학년`;
    el.mDiff.textContent = `${L.stars} ${L.name}`;
    el.mDiff.style.background = L.color;
    el.mSteps.textContent = `${o.round} / ${o.rounds}단계`;
    el.mSteps.classList.toggle('hidden', o.rounds < 2);
    el.mStreak.textContent = `🔥 ${o.streak}연승`;
    el.mStreak.classList.toggle('hidden', !o.streak || o.streak < 2);
    this._writeMath(el.mProblem, o.text);
    el.mInput.value = '';
    el.mInput.disabled = false;
    el.mSubmit.disabled = false;
    el.mFeedback.textContent = o.reward;
    el.mFeedback.className = 'mfeedback';
    el.mNext.classList.add('hidden');
    el.mHint.classList.add('hidden');
    el.mHint.textContent = '';
    el.mHintBtn.disabled = false;
    el.mHintBtn.textContent = `💡 힌트 (💰${D.HINT_GOLD} · H)`;
    this.setTimer(o.time, o.time);
    /* 문제가 바뀔 때마다 카드를 한 번 튕겨 준다 — 새 문제가 왔다는 신호 */
    el.mProblem.classList.remove('pop');
    void el.mProblem.offsetWidth;
    el.mProblem.classList.add('pop');
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
  showHint(text) {
    this._writeMath(this.el.mHint, `💡 ${text}`);
    this.el.mHint.classList.remove('hidden');
    this.el.mHintBtn.disabled = true;
    this.el.mHintBtn.textContent = '💡 힌트 사용함';
    this.el.mInput.focus();
  }
  mathFeedback(ok, text, nextLabel) {
    const el = this.el;
    this._answered = true;
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
  hideMath() { this.el.mathModal.classList.add('hidden'); }
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
       🧮 수학 문제: <b>${state.solved}문제 중 ${state.correct}개 정답 (${rate}%)</b>${state.hints ? ` · 💡 힌트 ${state.hints}회` : ''}<br>
       🔥 최고 연승: <b>${state.bestStreak || 0}연속</b> (한 번에 맞히기)${state.timeOuts ? ` · ⏰ 시간 초과 ${state.timeOuts}회` : ''}`;
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
