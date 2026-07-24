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
      'castleRows', 'heroPanel', 'hpTitle', 'hpInfo', 'upgradeBtn', 'recallBtn', 'sellBtn',
      'diffRow', 'mathModal', 'mTitle', 'mGrade', 'mProblem', 'mInput', 'mSubmit', 'mFeedback', 'mNext', 'mClose',
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
    el.mInput.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      if (this._answered) {
        if (!el.mNext.classList.contains('hidden')) h.onMathNext();
        else h.onMathClose();
      } else h.onMathSubmit(el.mInput.value);
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
      el.waveBtn.textContent = `▶ ${state.wave}웨이브 시작!${D.isBossWave(state.wave) ? ' 🐉' : ''}`;
      el.waveBtn.classList.remove('hidden');
      el.waveInfo.classList.add('hidden');
    } else if (state.phase === 'wave') {
      el.waveBtn.classList.add('hidden');
      el.waveInfo.classList.remove('hidden');
      el.remainN.textContent = `남은 몬스터 ${E.remainingEnemies(state)}`;
    } else {
      el.waveBtn.classList.add('hidden');
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
      d.className = `hcard t${hero.tier}` + (selId === hero.id ? ' sel' : '');
      d.innerHTML = `<div class="em">${C.emoji}</div><div class="nm">${C.name}</div>` +
        `<div class="tr">${T.name}${hero.level > 1 ? ` <span class="lv">Lv${hero.level}</span>` : ''}</div>`;
      d.title = `${T.name} ${C.name}\n공격력 ${hero.dmg} · 체력 ${hero.maxHp}`;
      d.addEventListener('click', () => this.h.onBenchSelect(hero.id));
      el.appendChild(d);
    }
    this.el.benchHint.classList.toggle('hidden', selId == null);
  }

  /* ---------- 조합 ---------- */
  renderCombine(state) {
    let html = '';
    for (let t = 0; t < 3; t++) {
      const n = E.benchCountByTier(state, t);
      html += `<div class="combine-row">
        <span class="tier-dot" style="background:${D.TIERS[t].color}"></span>
        ${D.TIERS[t].name} <span class="cnt">×${n}</span>
        <button data-tier="${t}" ${n < 2 ? 'disabled' : ''}>⚗ 2명 → ${D.TIERS[t + 1].name}</button>
      </div>`;
    }
    const legends = E.benchCountByTier(state, 3) + state.field.filter(h => h.tier === 3).length;
    html += `<div class="combine-row">
      <span class="tier-dot" style="background:${D.TIERS[3].color}"></span>
      전설 <span class="cnt">×${legends}</span> <span class="cnt">👑 특수능력 보유!</span>
    </div>`;
    this.el.combineRows.innerHTML = html;
    this.el.combineRows.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.h.onCombine(Number(b.dataset.tier)));
    });
  }

  /* ---------- 성 업그레이드 ---------- */
  renderCastlePanel(state) {
    let html = '';
    for (const [key, U] of Object.entries(D.CASTLE_UPGRADES)) {
      const n = key === 'repair' ? 0 : state.castle[key];
      const maxed = U.max && n >= U.max;
      const cost = U.cost(n);
      const full = key === 'repair' && state.castleHp >= state.castleMax;
      const disabled = maxed || full || state.gold < cost || state.phase === 'over';
      const lvLabel = U.max && key !== 'repair' ? ` <span class="cnt">${n}/${U.max}</span>` : '';
      html += `<div class="combine-row">
        <span>${U.emoji}</span> ${U.name}${lvLabel}
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
    const onField = hero.row >= 0;
    el.heroPanel.classList.remove('hidden');
    el.hpTitle.textContent = onField ? '🧍 선택한 용사 (필드)' : '🧍 선택한 용사 (벤치)';
    let abilityHtml = '';
    if (hero.tier === 3) {
      const A = D.LEGEND_ABILITIES[hero.cls];
      abilityHtml = `<div class="ability">⭐ ${A.name}: ${A.desc}</div>`;
    }
    el.hpInfo.innerHTML =
      `<b style="color:${T.color}">[${T.name}]</b> ${C.emoji} <b>${C.name}</b> <span class="lv">Lv${hero.level}</span><br>
       ⚔ 공격력 ${hero.dmg} · ❤ 체력 ${hero.hp}/${hero.maxHp}<br>
       <span class="cdesc">${C.desc}</span>${abilityHtml}`;
    if (hero.level >= D.HERO_LEVEL_MAX) {
      el.upgradeBtn.textContent = '⬆ 최고 레벨!';
      el.upgradeBtn.disabled = true;
    } else {
      const cost = D.levelCost(hero.tier, hero.level);
      el.upgradeBtn.textContent = `⬆ 강화 Lv${hero.level + 1} (💰${cost})`;
      el.upgradeBtn.disabled = state.gold < cost;
    }
    el.recallBtn.classList.toggle('hidden', !onField);
    el.sellBtn.textContent = `💰 판매 (+${D.SELL_PRICE[hero.tier]})`;
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
    setTimeout(() => el.mInput.focus(), 30);
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

  /* ---------- 게임 오버 ---------- */
  showOver(state) {
    const rate = state.solved ? Math.round((state.correct / state.solved) * 100) : 0;
    this.el.overStats.innerHTML =
      `🌊 도달한 웨이브: <b>${state.wave}웨이브</b> (${D.DIFFICULTIES[state.difficulty].name})<br>
       👾 물리친 몬스터: <b>${state.kills}마리</b> ${state.bossKills ? `· 🐉 보스 ${state.bossKills}` : ''}<br>
       🎲 소환 <b>${state.summons}</b> · ⚗️ 조합 <b>${state.combos}</b> · ⬆ 강화 <b>${state.upgrades}</b><br>
       🧮 수학 문제: <b>${state.solved}문제 중 ${state.correct}개 정답 (${rate}%)</b>`;
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
  showBossBanner() {
    const el = this.el.bossBanner;
    el.classList.remove('hidden');
    clearTimeout(this._bossT);
    this._bossT = setTimeout(() => el.classList.add('hidden'), 2600);
  }
  coachChip() {
    if (localStorage.getItem('mathdef_coach')) return;
    localStorage.setItem('mathdef_coach', '1');
    const el = this.el.coachChip;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 9000);
  }
  setSpeedLabel(s) { this.el.speedBtn.textContent = `⏩ x${s}`; }
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
