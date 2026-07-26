/* =====================================================
 * 효과음 (Web Audio 합성, 음원 파일 0개)
 * tone() + noise() 두 가지 원시 도구로 모든 소리를 만든다.
 *
 * 외부 음원을 쓰지 않는 대신, 합성음이 "삑삑"거리지 않도록 세 가지를 건다:
 *   ① 마스터 리미터  — 전투 중 소리 20개가 겹쳐도 찢어지지 않는다
 *   ② 스테레오 패닝  — 적의 필드 x좌표를 좌우 위치로 옮긴다
 *   ③ 피치 랜덤화    — 같은 소리를 연타해도 기계적으로 들리지 않는다
 * ===================================================== */
let ctx = null;
let master = null;      // 음악 + 효과음이 함께 들어오는 지점
let sfxBus = null;      // 효과음 전용 (여기에만 살짝 공간감을 준다)
/* 효과음과 배경음을 따로 끌 수 있다 — 배경음만 끄고 싶은 요구가 가장 흔하다 */
let sfxMuted = localStorage.getItem('mathdef_mute_sfx') === '1';
let musicMuted = localStorage.getItem('mathdef_mute_bgm') === '1';

export function getAc() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      /* 리미터: 합성음이 동시에 터질 때 생기는 클리핑(찌직) 제거 */
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;

      /* 고역 셸빙: 사각파·톱니파의 날카로운 배음을 눌러 귀가 편하게 */
      const tame = ctx.createBiquadFilter();
      tame.type = 'highshelf';
      tame.frequency.value = 5200;
      tame.gain.value = -5;

      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(tame);
      tame.connect(limiter);
      limiter.connect(ctx.destination);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(master);
    } catch (e) { /* 오디오 미지원 */ }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const getMaster = () => { getAc(); return master; };

/* 필드 x좌표(0~700)를 좌우 위치로. 패너가 없는 브라우저면 그냥 통과 */
function panNode(pan) {
  const c = getAc();
  if (pan == null || !c || !c.createStereoPanner) return null;
  const p = c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  return p;
}
export const panOf = (x) => (x == null ? null : Math.max(-0.85, Math.min(0.85, ((x - 350) / 350) * 0.8)));

/* 랜덤 피치 흔들기: cents 단위 (100 = 반음) */
const wobble = (cents) => (cents ? Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200) : 1);

/* opts: { pan, cutoff, vary(cents) } */
export function tone(freq, start = 0, dur = 0.1, type = 'triangle', vol = 0.1, glideTo = 0, opts = {}) {
  if (sfxMuted) return;
  const c = getAc(); if (!c) return;
  const t0 = c.currentTime + start;
  const k = wobble(opts.vary);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq * k, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo * k), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  let node = g;
  if (opts.cutoff) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = opts.cutoff; f.Q.value = 0.7;
    node.connect(f); node = f;
  }
  const p = panNode(opts.pan);
  if (p) { node.connect(p); node = p; }
  node.connect(sfxBus);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export function noise(start = 0, dur = 0.08, vol = 0.1, freq = 1200, q = 0.8, opts = {}) {
  if (sfxMuted) return;
  const c = getAc(); if (!c) return;
  const t0 = c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq * wobble(opts.vary); f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g);
  let node = g;
  const p = panNode(opts.pan);
  if (p) { node.connect(p); node = p; }
  node.connect(sfxBus);
  src.start(t0);
}

/* ---------- 음소거 ---------- */
export function toggleSfx() {
  sfxMuted = !sfxMuted;
  localStorage.setItem('mathdef_mute_sfx', sfxMuted ? '1' : '0');
  return sfxMuted;
}
export function toggleMusic() {
  musicMuted = !musicMuted;
  localStorage.setItem('mathdef_mute_bgm', musicMuted ? '1' : '0');
  return musicMuted;
}
/* 전체 음소거 토글 (M키): 하나라도 켜져 있으면 둘 다 끈다 */
export function toggleAll() {
  const off = !(sfxMuted && musicMuted);
  sfxMuted = off; musicMuted = off;
  localStorage.setItem('mathdef_mute_sfx', off ? '1' : '0');
  localStorage.setItem('mathdef_mute_bgm', off ? '1' : '0');
  return off;
}
export const isSfxMuted = () => sfxMuted;
export const isMusicMuted = () => musicMuted;
export const isMuted = () => musicMuted;      // 하위 호환(BGM 기준)

/* ---------- 빈도 제한 ---------- */
const last = {};
function limit(key, ms) {
  const n = performance.now();
  if (last[key] && n - last[key] < ms) return true;
  last[key] = n;
  return false;
}

/* ---------- 효과음 레시피 ---------- */
export const SFX = {
  tap()        { tone(660, 0, 0.05, 'sine', 0.06); },

  summon(tier) {
    tone(330 + tier * 60, 0, 0.1, 'triangle', 0.09, 660 + tier * 120);
    if (tier >= 2) tone(880, 0.1, 0.14, 'triangle', 0.09, 1320);
    if (tier >= 3) { /* 전설 팡파레 */
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.16 + i * 0.09, 0.22, 'triangle', 0.1));
      noise(0.16, 0.5, 0.05, 5000, 0.4);
    }
  },
  combine() {
    [440, 554, 659, 880].forEach((f, i) => tone(f, i * 0.08, 0.12, 'triangle', 0.09));
    noise(0.3, 0.3, 0.04, 4000, 0.5);
  },
  place()      { tone(220, 0, 0.09, 'sine', 0.1, 110); noise(0, 0.06, 0.07, 700, 0.6); },
  upgrade()    { tone(392, 0, 0.08, 'square', 0.06); tone(523, 0.08, 0.08, 'square', 0.06); tone(659, 0.16, 0.14, 'square', 0.07); },

  correct() {   /* 상승 아르페지오: 기분 좋게 */
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.16, 'square', 0.07));
  },
  wrong() {     /* 하강 2음: 기죽지 않게 부드럽게 */
    tone(330, 0, 0.18, 'sine', 0.09, 262);
    tone(262, 0.18, 0.26, 'sine', 0.08, 220);
  },

  /* --- 전투음: x(필드 좌표)를 받아 좌우로 벌리고, 매번 피치를 살짝 흔든다 --- */
  shoot(x)     { if (limit('shoot', 55)) return; const p = panOf(x); tone(880, 0, 0.045, 'triangle', 0.032, 440, { pan: p, vary: 55, cutoff: 4200 }); },
  orb(x)       { if (limit('orb', 80)) return; const p = panOf(x); tone(520, 0, 0.09, 'sine', 0.042, 260, { pan: p, vary: 45 }); },
  bolt(x)      { if (limit('bolt', 80)) return; const p = panOf(x); tone(1200, 0, 0.07, 'sawtooth', 0.03, 500, { pan: p, vary: 60, cutoff: 3600 }); },
  hit(x)       { if (limit('hit', 45)) return; noise(0, 0.045, 0.06, 1600, 0.7, { pan: panOf(x), vary: 90 }); },
  /* 치명타: 쨍! 하고 시원하게 */
  crit(x)      { if (limit('crit', 80)) return; const p = panOf(x);
                 tone(1320, 0, 0.09, 'square', 0.055, 660, { pan: p, vary: 40, cutoff: 5000 });
                 noise(0, 0.08, 0.07, 2600, 0.6, { pan: p, vary: 60 }); },
  /* 방패 장벽: 금속 쿵 + 지면 울림 */
  block(x)     { if (limit('block', 180)) return; const p = panOf(x);
                 tone(180, 0, 0.16, 'square', 0.09, 90, { pan: p, vary: 30, cutoff: 1800 });
                 noise(0, 0.2, 0.08, 700, 0.5, { pan: p });
                 tone(90, 0.05, 0.25, 'sine', 0.08, 55, { pan: p }); },
  kill(x)      { if (limit('kill', 55)) return; const p = panOf(x);
                 tone(300, 0, 0.08, 'square', 0.06, 90, { pan: p, vary: 70, cutoff: 2400 });
                 noise(0, 0.07, 0.06, 900, 0.6, { pan: p, vary: 70 }); },
  coin()       { if (limit('coin', 100)) return; tone(988, 0, 0.05, 'square', 0.045, 0, { vary: 35, cutoff: 5200 }); tone(1319, 0.05, 0.08, 'square', 0.045, 0, { vary: 35, cutoff: 5200 }); },
  combo(mul)   { tone(784 * (mul >= 3 ? 1.5 : 1), 0, 0.1, 'square', 0.07, 1175, { cutoff: 5200 }); },
  explode(x)   { if (limit('explode', 100)) return; const p = panOf(x);
                 noise(0, 0.22, 0.1, 400, 0.5, { pan: p, vary: 60 });
                 tone(140, 0, 0.2, 'sine', 0.09, 60, { pan: p, vary: 50 }); },
  thorns(x)    { if (limit('thorns', 140)) return; tone(1400, 0, 0.05, 'sawtooth', 0.035, 700, { pan: panOf(x), vary: 80, cutoff: 3800 }); },

  heroHurt(x)  { if (limit('hurt', 130)) return; const p = panOf(x);
                 tone(180, 0, 0.09, 'sine', 0.07, 90, { pan: p, vary: 60 }); noise(0, 0.06, 0.05, 500, 0.7, { pan: p }); },
  heroDead()   { tone(220, 0, 0.2, 'sine', 0.08, 80); },
  castleHit()  { tone(90, 0, 0.34, 'sawtooth', 0.13, 45); noise(0, 0.3, 0.11, 250, 0.4); },
  heartbeat()  { tone(70, 0, 0.1, 'sine', 0.12); tone(60, 0.16, 0.12, 'sine', 0.1); },

  waveStart()  { tone(392, 0, 0.14, 'sawtooth', 0.07); tone(523, 0.14, 0.2, 'sawtooth', 0.08); },
  waveClear() {
    [523, 659, 784, 880, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.09));
  },
  /* 대보스: 낮게 깔리는 포효 + 굉음 */
  bossRoar() {
    tone(80, 0, 0.7, 'sawtooth', 0.14, 50);
    noise(0, 0.7, 0.09, 200, 0.3);
    tone(55, 0.25, 0.6, 'sawtooth', 0.12, 40);
    tone(41, 0.5, 0.8, 'sawtooth', 0.1, 30);
  },
  /* 중간보스: 짧고 묵직한 으르렁 */
  midBossRoar() {
    tone(140, 0, 0.34, 'sawtooth', 0.1, 85);
    noise(0, 0.35, 0.06, 320, 0.4);
  },
  /* 등장 경고 사이렌 — 음이 위아래로 흔들린다 */
  bossWarn(great) {
    const base = great ? 520 : 660;
    for (let i = 0; i < (great ? 3 : 2); i++) {
      tone(base, i * 0.42, 0.2, 'square', great ? 0.075 : 0.055, base * 1.5);
      tone(base * 1.5, i * 0.42 + 0.2, 0.2, 'square', great ? 0.075 : 0.055, base);
    }
    if (great) tone(60, 0, 1.2, 'sine', 0.07);
  },
  /* 분노 페이즈: 급상승 굉음 */
  bossEnrage() {
    tone(120, 0, 0.55, 'sawtooth', 0.13, 400);
    noise(0, 0.5, 0.09, 900, 0.35);
    tone(90, 0.2, 0.5, 'square', 0.09, 320);
  },
  /* 보스 처치 팡파레 */
  bossDown(great) {
    const notes = great ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
    notes.forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.1));
    noise(0, 0.6, 0.07, 3000, 0.4);
    if (great) tone(65, 0, 0.9, 'sine', 0.09, 40);
  },
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.3, 0.4, 'sawtooth', 0.08));
  },
  shard()      { tone(1568, 0, 0.1, 'sine', 0.06); tone(2093, 0.09, 0.16, 'sine', 0.05); },
};
