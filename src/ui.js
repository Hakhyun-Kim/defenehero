/* =====================================================
 * UI (DOM 패널/모달) — 상태를 그리고, 입력을 핸들러로 전달
 * ===================================================== */
import * as D from './data.js';
import * as E from './engine.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {};
    [
      'bestWave', 'shards', 'metaBtn', 'castleText', 'castleFill', 'castleGhost',
      'scene3d', 'hitFlash', 'lowHpVignette', 'bossBanner', 'comboChip', 'waveInfo', 'remainN',
      'waveBtn', 'coachChip', 'toasts', 'gold', 'waveNo', 'know', 'speedBtn', 'muteBtn',
      'grades', 'practiceBtn', 'probs', 'summonBtn', 'benchHint', 'bench', 'combineRows',
      'castleRows', 'heroPanel', 'hpTitle', 'hpInfo', 'upgradeBtn', 'recallBtn', 'sellBtn', 'moveHint',
      'diffRow', 'mathModal', 'mTitle', 'mGrade', 'mProblem', 'mInput', 'mSubmit', 'mFeedback', 'mNext', 'mClose',
      'mHintBtn', 'mHint',
      'wavePreview', 'bossBar', 'bossBarFill', 'bossBarName', 'bossWarnBanner',
      'overModal', 'overStats', 'overShards', 'restartBtn', 'shareBtn', 'overMetaBtn',
      'metaModal', 'metaShards', 'metaRows', 'metaClose',
    ].forEach(id => this.el[id] = $(id));
    this._lastKnow = -1;
    this._lastProbSig = '';
  }

  bind(h) {
    this.h = h;
    const el = this.el;
    el.waveBtn.addEventListener('click', h.onWaveStart);
    el.summonBtn.addEventListener('click', h.onSummon);
    el.practiceBtn.addEventListener('click', h.onPractice);
    el.speedBtn.addEventListener('click', h.onSpeed);
    el.muteBtn.addEventListener('click', h.onMute);
    el.metaBtn.addEventListener('click', h.onMetaOpen);
    el.overMetaBtn.addEventListener('click', h.onMetaOpen);
    el.metaClose.addEventListener('click', () => this.hideMeta());
    el.restartBtn.addEventListener('click', h.onRestart);
    el.shareBtn.addEventListener('click', h.onShare);
    el.upgradeBtn.addEventListener('click', () => h.onUpgrade());
    el.recallBtn.addEventListener('click', () => h.onRecall());
    el.sellBtn.addEventListener('click', () => h.onSell());
    el.mSubmit.addEventListener('click', () => h.onMathSubmit(el.mInput.value));
    el.mNext.addEventListener('click', h.onMathNext);
    el.mClose.addEventListener('click', h.onMathClose);
    el.mHintBtn.addEventListener('click', h.onHint);
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

    /* 3D 씬 입력 */
    const scene = el.scene3d;
    scene.addEventListener('click', (ev) => h.onSceneClick(ev.clientX, ev.clientY));
    scene.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();                 // 우클릭 = 즉시 회수
      h.onSceneRightClick(ev.clientX, ev.clientY);
    });
    scene.addEventListener('mousemove', (ev) => h.onSceneMove(ev.clientX, ev.clientY));
    scene.addEventListener('mouseleave', () => h.onSceneMove(null, null));
  }

  /* ---------- HUD ---------- */
  updateHud(state, shards, best) {
    const el = this.el;
    el.gold.textContent = state.gold;
    el.waveNo.textContent = state.wave;
    el.know.textContent = state.knowledge;
    el.shards.textContent = shards;
    el.bestWave.textContent = best || '-';
    el.castleText.textContent = `${state.castleHp} / ${state.castleMax}`;
    const pct = state.castleMax ? (state.castleHp / state.castleMax) * 100 : 0;
    el.castleFill.style.width = `${pct}%`;
    el.castleGhost.style.width = `${pct}%`;
    el.summonBtn.disabled = state.gold < D.SUMMON_COST || state.bench.length >= D.BENCH_MAX || state.phase === 'over';

    if (this._lastKnow !== state.knowledge) {
      this._lastKnow = state.knowledge;
      const p = D.tierProbs(state.knowledge);
      el.probs.innerHTML = D.TIERS.map((t, i) =>
        `<div class="prob t${i}">${t.name}<small>${p[i].toFixed(1).replace(/\.0$/, '')}%</small></div>`
      ).join('');
    }
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

  comboChip(count, mul) {
    const el = this.el.comboChip;
    if (count >= 2) {
      el.textContent = mul > 1 ? `🔥 ${count}연속 처치! 골드 x${mul}` : `🔥 ${count}연속 처치!`;
      el.classList.remove('hidden');
      el.classList.remove('pop');
      void el.offsetWidth;      // 애니메이션 재시작
      el.classList.add('pop');
      this._comboShown = true;
    } else if (this._comboShown) {
      el.classList.add('hidden');
      this._comboShown = false;
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
      d.innerHTML = `<div class="em">${C.emoji}</div><div class="nm">${C.name}</div>` +
        `<div class="tr">${T.name}${hero.level > 1 ? ` <span class="lv">Lv${hero.level}</span>` : ''}</div>`;
      d.title = `${T.name} ${C.name}\n공격력 ${hero.dmg} · 체력 ${hero.maxHp}`;
      d.addEventListener('click', () => this.h.onBenchSelect(hero.id));
      el.appendChild(d);
    }
    this.el.benchHint.classList.toggle('hidden', selId == null);
  }

  /* ---------- 조합 (등급업 + 레시피 도감) ---------- */
  renderCombine(state) {
    let html = '';

    /* ① 등급업: 같은 용사 2명 → 등급+1 (가능한 것만 표시) */
    const rankups = E.listCombos(state).filter(c => c.kind === 'rankup');
    html += `<div class="combine-sub">⬆ 등급업 <span class="cnt">같은 용사 2명 + 골드 · 배치된 용사도 재료 OK</span></div>`;
    if (!rankups.length) {
      html += `<div class="combine-empty">같은 직업·같은 등급 용사 2명을 모아 보세요</div>`;
    }
    for (const c of rankups) {
      const C = D.CLASSES[c.cls];
      html += `<div class="combine-row${c.affordable ? ' ready' : ''}">
        <span>${C.emoji}</span> ${C.name}
        <span class="cnt" style="color:${D.TIERS[c.tier].color}">${D.TIERS[c.tier].name}×2</span>
        <button data-kind="rankup" data-cls="${c.cls}" data-tier="${c.tier}"
          ${c.affordable ? '' : 'disabled'}>⚗ ${D.TIERS[c.resultTier].name} 💰${c.cost}</button>
      </div>`;
    }

    /* ② 특수 레시피 도감: 항상 전부 표시 + 재료 보유 표시 */
    html += `<div class="combine-sub">✨ 특수 조합법 <span class="cnt">서로 다른 두 용사(같은 등급)</span></div>`;
    for (const r of D.RECIPES) {
      const A = D.CLASSES[r.a], B = D.CLASSES[r.b], R = D.CLASSES[r.result];
      let readyTier = -1;
      for (let t = 0; t <= 2; t++) {
        if (E.unitsOf(state, r.a, t).length >= 1 && E.unitsOf(state, r.b, t).length >= 1) { readyTier = t; break; }
      }
      const all = [...state.bench, ...state.field];
      const hasA = all.some(h => h.cls === r.a);
      const hasB = all.some(h => h.cls === r.b);
      const ready = readyTier >= 0;
      const cost = ready ? D.combineCost(readyTier + 1, true) : 0;
      const canPay = ready && state.gold >= cost;
      html += `<div class="combine-row recipe${canPay ? ' ready' : ''}">
        <span class="ing${hasA ? ' have' : ''}">${A.emoji}</span>+<span class="ing${hasB ? ' have' : ''}">${B.emoji}</span>
        <span class="rarrow">→</span> <span>${R.emoji}</span> <b>${R.name}</b>
        ${ready
          ? `<button data-kind="recipe" data-result="${r.result}" data-tier="${readyTier}"
               ${canPay ? '' : 'disabled'}>⚗ ${D.TIERS[readyTier + 1].name} 💰${cost}</button>`
          : `<span class="cnt need">${hasA || hasB ? '같은 등급 필요' : '재료 모으기'}</span>`}
      </div>`;
    }

    this.el.combineRows.innerHTML = html;
    this.el.combineRows.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.h.onCombine({ ...b.dataset }));
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
    if (!hero) { el.heroPanel.classList.add('hidden'); return; }
    const C = D.CLASSES[hero.cls], T = D.TIERS[hero.tier];
    const onField = hero.padIndex >= 0;
    el.heroPanel.classList.remove('hidden');
    el.hpTitle.textContent = onField ? '🧍 선택한 용사 (배치됨)' : '🧍 선택한 용사 (벤치)';
    let abilityHtml = '';
    if (hero.tier === 3) {
      const A = D.LEGEND_ABILITIES[hero.cls];
      abilityHtml = `<div class="ability">⭐ ${A.name}: ${A.desc}</div>`;
    }
    let specialHtml = '';
    if (C.special) {
      const [a, b] = C.recipe;
      specialHtml = `<div class="ability sp">✨ 특수 용사 (${D.CLASSES[a].emoji}+${D.CLASSES[b].emoji} 조합으로만 탄생)</div>`;
    }
    const extra = C.slowOnHit ? ` · ❄ 감속 ${Math.round((1 - C.slowOnHit.mul) * 100)}%` : '';
    el.hpInfo.innerHTML =
      `<b style="color:${T.color}">[${T.name}]</b> ${C.emoji} <b>${C.name}</b> <span class="lv">Lv${hero.level}</span><br>
       ⚔ 공격력 ${hero.dmg} · 🎯 사거리 ${C.range}${extra}<br>
       <span class="cdesc">${C.desc}</span>${specialHtml}${abilityHtml}`;
    if (hero.level >= D.HERO_LEVEL_MAX) {
      el.upgradeBtn.textContent = '⬆ 최고 레벨!';
      el.upgradeBtn.disabled = true;
    } else {
      const cost = D.levelCost(hero.tier, hero.level);
      el.upgradeBtn.textContent = `⬆ 강화 Lv${hero.level + 1} (💰${cost} · U)`;
      el.upgradeBtn.disabled = state.gold < cost;
    }
    el.recallBtn.textContent = '↩ 회수 (R / 우클릭)';
    el.recallBtn.classList.toggle('hidden', !onField);
    el.sellBtn.textContent = `💰 판매 +${D.SELL_PRICE[hero.tier]} (X)`;
    el.moveHint.classList.toggle('hidden', !onField);
  }

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
  showMath(title) {
    this.el.mTitle.textContent = title;
    this.el.mathModal.classList.remove('hidden');
  }
  setProblem(grade, text, rewardLabel) {
    const el = this.el;
    this._answered = false;
    el.mGrade.textContent = `${grade}학년 문제`;
    el.mProblem.textContent = text;
    el.mInput.value = '';
    el.mInput.disabled = false;
    el.mSubmit.disabled = false;
    el.mFeedback.textContent = rewardLabel;
    el.mFeedback.className = 'mfeedback';
    el.mNext.classList.add('hidden');
    el.mHint.classList.add('hidden');
    el.mHint.textContent = '';
    el.mHintBtn.disabled = false;
    el.mHintBtn.textContent = `💡 힌트 (🧠 -${D.HINT_COST} · H)`;
    setTimeout(() => el.mInput.focus(), 30);
  }
  showHint(text) {
    this.el.mHint.textContent = `💡 ${text}`;
    this.el.mHint.classList.remove('hidden');
    this.el.mHintBtn.disabled = true;
    this.el.mHintBtn.textContent = '💡 힌트 사용함';
    this.el.mInput.focus();
  }
  mathFeedback(ok, text, nextLabel) {
    const el = this.el;
    this._answered = true;
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
       🎲 소환 <b>${state.summons}</b> · ⚗️ 조합 <b>${state.combos}</b> · ⬆ 강화 <b>${state.upgrades}</b><br>
       🧮 수학 문제: <b>${state.solved}문제 중 ${state.correct}개 정답 (${rate}%)</b>${state.hints ? ` · 💡 힌트 ${state.hints}회` : ''}`;
    this.el.overShards.textContent = `✨ 별조각 +${state.shardsEarned} 획득!`;
    this.el.overModal.classList.remove('hidden');
  }
  hideOver() { this.el.overModal.classList.add('hidden'); }

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
  setMuteLabel(m) { this.el.muteBtn.textContent = m ? '🔇' : '🔊'; }

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
