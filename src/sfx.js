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
let masterFilter = null; // 몰입/위기 상태 Dynamic Lowpass Flow

/* 효과음과 배경음을 따로 끌 수 있다 — 배경음만 끄고 싶은 요구가 가장 흔하다 */
let sfxMuted = localStorage.getItem('mathdef_mute_sfx') === '1';
let musicMuted = localStorage.getItem('mathdef_mute_bgm') === '1';
let duckingFn = null;

export function registerDucker(fn) {
  duckingFn = fn;
}

function triggerDuck(amt = 0.35, dur = 0.35) {
  if (duckingFn) duckingFn(amt, dur);
}

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

      /* Dynamic Lowpass Flow Filter: 게임 위기 상태나 몰입 시 소리 전체 분위기를 변화 */
      masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 20000; // 기본은 전체 통과
      masterFilter.Q.value = 0.7;

      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(masterFilter);
      masterFilter.connect(tame);
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

/* 게임 상태(체력 비상 등)에 따른 마스터 오디오 플로우 튜닝 */
export function updateAudioFlow(hpRatio = 1) {
  const c = getAc();
  if (!c || !masterFilter) return;
  const targetFreq = hpRatio < 0.3 ? 2500 + hpRatio * 15000 : 20000;
  masterFilter.frequency.setTargetAtTime(targetFreq, c.currentTime, 0.2);
}

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

/* flowTone: 미끄러지는 피치(Smooth Pitch Bend Flow) + LFO 바이브라토 + Filter Cutoff Sweep */
export function flowTone(freqs = [], start = 0, dur = 0.2, type = 'sine', vol = 0.1, opts = {}) {
  if (sfxMuted || !freqs.length) return;
  const c = getAc(); if (!c) return;
  const t0 = c.currentTime + start;
  const k = wobble(opts.vary);

  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;

  // 피치 플로우 (Smooth Curve Ramp)
  const stepDur = dur / Math.max(1, freqs.length - 1);
  o.frequency.setValueAtTime(freqs[0] * k, t0);
  for (let i = 1; i < freqs.length; i++) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqs[i] * k), t0 + i * stepDur);
  }

  // LFO Vibrato Flow (옵션)
  if (opts.vibratoFreq && opts.vibratoDepth) {
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = opts.vibratoFreq;
    lfoGain.gain.value = opts.vibratoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }

  // Gain Envelope
  const atk = opts.atk ?? 0.02;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);

  let node = g;

  // Filter Sweep Flow (옵션)
  if (opts.filterSweep) {
    const filter = c.createBiquadFilter();
    filter.type = opts.filterType || 'lowpass';
    filter.Q.value = opts.filterQ || 2.0;
    filter.frequency.setValueAtTime(opts.filterSweep[0], t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(50, opts.filterSweep[1]), t0 + dur);
    node.connect(filter);
    node = filter;
  } else if (opts.cutoff) {
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
/* 자동화·테스트용 강제 음소거. localStorage에 쓰지 않는다 —
 * 검증하느라 켠 무음 상태가 사용자의 실제 설정을 덮어쓰면 안 된다. */
export function forceMute() {
  sfxMuted = true;
  musicMuted = true;
}

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
  tap()        { flowTone([660, 780], 0, 0.05, 'sine', 0.06); },

  summon(tier) {
    flowTone([330 + tier * 60, 660 + tier * 120], 0, 0.12, 'triangle', 0.09);
    if (tier >= 2) flowTone([880, 1100, 1320], 0.08, 0.16, 'triangle', 0.09, { filterSweep: [2000, 6000] });
    if (tier >= 3) { /* 전설 팡파레 Flow */
      const scale = [523, 659, 784, 1047, 1319, 1568, 2093];
      flowTone(scale, 0.15, 0.35, 'triangle', 0.11, { vibratoFreq: 12, vibratoDepth: 35, filterSweep: [1500, 8000] });
      noise(0.16, 0.5, 0.05, 5000, 0.4);
    }
  },
  combine() {
    flowTone([440, 554, 659, 880, 1108], 0, 0.22, 'triangle', 0.09, { filterSweep: [1000, 5000] });
    noise(0.18, 0.3, 0.04, 4000, 0.5);
  },
  place()      { flowTone([220, 140, 110], 0, 0.09, 'sine', 0.1); noise(0, 0.06, 0.07, 700, 0.6); },
  upgrade()    { flowTone([392, 523, 659, 784], 0, 0.2, 'square', 0.07, { filterSweep: [2000, 6000] }); },

  correct() {   /* 메이저 펜타토닉 음계 플로우 */
    flowTone([523, 659, 784, 1047, 1319], 0, 0.22, 'triangle', 0.08, { filterSweep: [3000, 8000] });
  },
  wrong() {     /* 부드러운 하강 멜로디 플로우 */
    flowTone([330, 293, 262, 220], 0, 0.3, 'sine', 0.08);
  },

  /* --- 제한 시간 연출: 긴장은 주되 무섭지는 않게 --- */
  challenge(lv) {
    const f = [0, 660, 620, 560, 480, 400][Math.max(1, Math.min(5, lv))];
    flowTone([f, f * 1.5], 0, 0.14, 'triangle', 0.07);
    if (lv >= 3) flowTone([f * 1.5, f * 1.8], 0.12, 0.16, 'triangle', 0.06);
    if (lv >= 5) { /* 극한: 심장 쿵 + 종소리 */
      flowTone([140, 90, 60], 0, 0.45, 'sine', 0.12);
      flowTone([784, 1047, 1319, 1568], 0.2, 0.35, 'triangle', 0.07, { filterSweep: [1500, 6000] });
      noise(0.2, 0.5, 0.04, 3200, 0.4);
    }
  },
  /* 째깍: 마지막 10초부터 1초마다, 3초 남으면 더 날카롭게 */
  tick(urgent) {
    flowTone([urgent ? 1500 : 1050, urgent ? 1800 : 1200], 0, 0.04, 'square', urgent ? 0.055 : 0.03, { cutoff: 5000 });
  },
  timeOut() {
    flowTone([280, 180, 90], 0, 0.45, 'sawtooth', 0.1, { filterSweep: [2000, 400] });
    noise(0, 0.35, 0.07, 420, 0.5);
  },
  /* 단계 통과(신화 관문 1단계) */
  stageClear() {
    flowTone([659, 784, 880, 1047], 0, 0.2, 'square', 0.07, { filterSweep: [2000, 6000] });
  },
  /* 연승이 쌓일수록 높아지는 축포 스케일 플로우 */
  streak(n) {
    const base = 660 * Math.pow(1.12, Math.min(5, n));
    flowTone([base, base * 1.25, base * 1.5, base * 1.8], 0, 0.22, 'triangle', 0.07, { vibratoFreq: 10, vibratoDepth: 20 });
  },

  /* --- 전투음: x(필드 좌표)를 받아 좌우로 벌리고, 매번 피치를 살짝 흔든다 --- */
  shoot(x)     { if (limit('shoot', 55)) return; const p = panOf(x); flowTone([880, 520, 440], 0, 0.05, 'triangle', 0.035, { pan: p, vary: 55, cutoff: 4200 }); },
  orb(x)       { if (limit('orb', 80)) return; const p = panOf(x); flowTone([520, 390, 260], 0, 0.1, 'sine', 0.045, { pan: p, vary: 45 }); },
  bolt(x)      { if (limit('bolt', 80)) return; const p = panOf(x); flowTone([1200, 800, 500], 0, 0.08, 'sawtooth', 0.032, { pan: p, vary: 60, cutoff: 3600 }); },
  hit(x)       { if (limit('hit', 45)) return; noise(0, 0.045, 0.06, 1600, 0.7, { pan: panOf(x), vary: 90 }); },
  /* 치명타: 쨍! 하고 시원하게 미끄러지는 피치 플로우 */
  crit(x)      { if (limit('crit', 80)) return; const p = panOf(x); triggerDuck(0.2, 0.2);
                 flowTone([1760, 1320, 880], 0, 0.12, 'square', 0.06, { pan: p, vary: 40, filterSweep: [6000, 2000] });
                 noise(0, 0.09, 0.07, 2600, 0.6, { pan: p, vary: 60 }); },
  /* 방패 장벽: 금속 쿵 + 지면 울림 */
  block(x)     { if (limit('block', 180)) return; const p = panOf(x);
                 flowTone([220, 140, 80], 0, 0.18, 'square', 0.09, { pan: p, vary: 30, cutoff: 1800 });
                 noise(0, 0.2, 0.08, 700, 0.5, { pan: p });
                 tone(90, 0.05, 0.25, 'sine', 0.08, 55, { pan: p }); },
  kill(x)      { if (limit('kill', 55)) return; const p = panOf(x);
                 flowTone([400, 220, 90], 0, 0.09, 'square', 0.065, { pan: p, vary: 70, cutoff: 2400 });
                 noise(0, 0.07, 0.06, 900, 0.6, { pan: p, vary: 70 }); },
  coin()       { if (limit('coin', 100)) return; flowTone([988, 1319, 1760], 0, 0.1, 'square', 0.048, { vary: 35, cutoff: 5200 }); },
  combo(mul)   {
    const root = 784 * (mul >= 3 ? 1.5 : 1);
    flowTone([root, root * 1.25, root * 1.5], 0, 0.16, 'square', 0.075, { filterSweep: [2000, 6000] });
  },
  explode(x)   { if (limit('explode', 100)) return; const p = panOf(x); triggerDuck(0.3, 0.35);
                 noise(0, 0.25, 0.11, 400, 0.5, { pan: p, vary: 60 });
                 flowTone([180, 100, 50], 0, 0.24, 'sine', 0.1, { pan: p, vary: 50 }); },
  thorns(x)    { if (limit('thorns', 140)) return; flowTone([1400, 950, 700], 0, 0.06, 'sawtooth', 0.038, { pan: panOf(x), vary: 80, cutoff: 3800 }); },

  heroHurt(x)  { if (limit('hurt', 130)) return; const p = panOf(x);
                 flowTone([220, 140, 80], 0, 0.1, 'sine', 0.075, { pan: p, vary: 60 }); noise(0, 0.06, 0.05, 500, 0.7, { pan: p }); },
  heroDead()   { flowTone([262, 196, 130, 80], 0, 0.35, 'sine', 0.08); },
  castleHit()  { triggerDuck(0.35, 0.4); flowTone([120, 75, 40], 0, 0.38, 'sawtooth', 0.14, { filterSweep: [1200, 200] }); noise(0, 0.3, 0.11, 250, 0.4); },
  heartbeat()  { flowTone([80, 55], 0, 0.12, 'sine', 0.13); flowTone([70, 45], 0.16, 0.14, 'sine', 0.11); },

  waveStart()  { triggerDuck(0.25, 0.3); flowTone([392, 523, 659, 784], 0, 0.25, 'sawtooth', 0.085, { filterSweep: [1000, 4500] }); },
  waveClear() {
    triggerDuck(0.25, 0.3);
    flowTone([523, 659, 784, 880, 1047, 1319], 0, 0.35, 'triangle', 0.095, { filterSweep: [2000, 7000] });
  },
  /* 대보스: 낮게 깔리는 포효 + 굉음 플로우 */
  bossRoar() {
    triggerDuck(0.5, 0.6);
    flowTone([120, 70, 45, 30], 0, 0.8, 'sawtooth', 0.15, { filterSweep: [1500, 300] });
    noise(0, 0.75, 0.1, 200, 0.3);
    flowTone([65, 45, 30], 0.25, 0.65, 'sawtooth', 0.13);
  },
  /* 중간보스: 짧고 묵직한 으르렁 */
  midBossRoar() {
    triggerDuck(0.35, 0.4);
    flowTone([160, 100, 60], 0, 0.38, 'sawtooth', 0.11, { filterSweep: [1200, 400] });
    noise(0, 0.35, 0.06, 320, 0.4);
  },
  /* 등장 경고 사이렌 — 음이 위아래로 흔들린다 */
  bossWarn(great) {
    triggerDuck(great ? 0.45 : 0.3, 0.5);
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

  /* --- 별지기 --- */
  starfall(x)  { if (limit('star', 120)) return; const p = panOf(x);
    flowTone([2400, 900, 320], 0, 0.42, 'sine', 0.085, { pan: p, filterSweep: [7000, 500] });     // 떨어지는 휘파람
    noise(0.34, 0.22, 0.1, 800, 0.5, { pan: p });                                                  // 착탄
    flowTone([523, 784, 1047], 0.36, 0.18, 'triangle', 0.05, { pan: p }); },
  ultimate()   { triggerDuck(0.45, 0.8);
    flowTone([160, 220, 330, 440], 0, 0.9, 'sawtooth', 0.12, { filterSweep: [400, 5200] });        // 차오르는 굉음
    flowTone([1319, 1568, 2093, 2637], 0.2, 0.75, 'sine', 0.07);                                   // 별의 합창
    noise(0.1, 0.75, 0.08, 420, 0.4); },
  levelUp()    { flowTone([523, 659, 784, 1047], 0, 0.35, 'triangle', 0.1, { filterSweep: [2600, 7000] });
    tone(2093, 0.3, 0.2, 'sine', 0.05); },
};
