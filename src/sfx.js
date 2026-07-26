/* =====================================================
 * 효과음 (Web Audio 합성, 음원 파일 0개)
 * tone() + noise() 두 가지 원시 도구로 모든 소리를 만든다.
 * ===================================================== */
let ctx = null;
let master = null;
let muted = localStorage.getItem('mathdef_mute') === '1';

export function getAc() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch (e) { /* 오디오 미지원 */ }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const getMaster = () => { getAc(); return master; };

export function tone(freq, start = 0, dur = 0.1, type = 'triangle', vol = 0.1, glideTo = 0) {
  if (muted) return;
  const c = getAc(); if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export function noise(start = 0, dur = 0.08, vol = 0.1, freq = 1200, q = 0.8) {
  if (muted) return;
  const c = getAc(); if (!c) return;
  const t0 = c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

/* ---------- 뮤트 ---------- */
export function toggleMute() {
  muted = !muted;
  localStorage.setItem('mathdef_mute', muted ? '1' : '0');
  return muted;
}
export const isMuted = () => muted;

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

  shoot()      { if (limit('shoot', 70)) return; tone(880, 0, 0.04, 'triangle', 0.03, 440); },
  orb()        { if (limit('orb', 90)) return; tone(520, 0, 0.09, 'sine', 0.04, 260); },
  bolt()       { if (limit('bolt', 90)) return; tone(1200, 0, 0.07, 'sawtooth', 0.03, 500); },
  hit()        { if (limit('hit', 60)) return; noise(0, 0.045, 0.06, 1600, 0.7); },
  /* 치명타: 쨍! 하고 시원하게 */
  crit()       { if (limit('crit', 90)) return; tone(1320, 0, 0.09, 'square', 0.055, 660); noise(0, 0.08, 0.07, 2600, 0.6); },
  /* 방패 장벽: 금속 쿵 + 지면 울림 */
  block()      { if (limit('block', 200)) return; tone(180, 0, 0.16, 'square', 0.09, 90); noise(0, 0.2, 0.08, 700, 0.5); tone(90, 0.05, 0.25, 'sine', 0.08, 55); },
  kill()       { if (limit('kill', 70)) return; tone(300, 0, 0.08, 'square', 0.06, 90); noise(0, 0.07, 0.06, 900, 0.6); },
  coin()       { if (limit('coin', 110)) return; tone(988, 0, 0.05, 'square', 0.045); tone(1319, 0.05, 0.08, 'square', 0.045); },
  combo(mul)   { tone(784 * (mul >= 3 ? 1.5 : 1), 0, 0.1, 'square', 0.07, 1175); },
  explode()    { if (limit('explode', 120)) return; noise(0, 0.22, 0.1, 400, 0.5); tone(140, 0, 0.2, 'sine', 0.09, 60); },
  thorns()     { if (limit('thorns', 150)) return; tone(1400, 0, 0.05, 'sawtooth', 0.035, 700); },

  heroHurt()   { if (limit('hurt', 140)) return; tone(180, 0, 0.09, 'sine', 0.07, 90); noise(0, 0.06, 0.05, 500, 0.7); },
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
