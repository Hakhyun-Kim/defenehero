/* =====================================================
 * 절차 생성 BGM (16분음표 스텝 시퀀서 + 미리 예약 스케줄링)
 * 트랙: prep(준비) / battle(전투) / boss(보스전)
 * 웨이브가 오를수록 전투 템포가 빨라진다.
 * ===================================================== */
import { getAc, getMaster, isMuted } from './sfx.js';

const F = (semi, base = 110) => base * Math.pow(2, semi / 12);

/* 패턴: 반음 오프셋 배열(16스텝), null = 쉼표 */
const TRACKS = {
  prep: {
    bpm: 84,
    bass:   { base: 110, type: 'sine', vol: 0.055, len: 0.28,
      steps: [0, null, null, null, 5, null, null, null, 3, null, null, null, 7, null, 5, null] },
    melody: { base: 440, type: 'triangle', vol: 0.035, len: 0.22,
      steps: [null, null, 7, null, null, 12, null, 10, null, null, 7, null, 5, null, 3, null] },
  },
  battle: {
    bpm: 112,
    bass:   { base: 110, type: 'square', vol: 0.045, len: 0.14,
      steps: [0, null, 0, null, 0, null, -2, null, 3, null, 3, null, -2, null, 0, null] },
    melody: { base: 440, type: 'square', vol: 0.028, len: 0.15,
      steps: [12, null, null, 10, null, null, 7, null, null, 3, 5, null, 7, null, null, null] },
    perc:   { steps: [1, null, null, null, 1, null, null, null, 1, null, null, null, 1, null, 1, null] },
  },
  boss: {
    bpm: 132,
    bass:   { base: 55, type: 'sawtooth', vol: 0.06, len: 0.13,
      steps: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 3, 2, 1, 0] },
    melody: { base: 220, type: 'sawtooth', vol: 0.025, len: 0.18,
      steps: [null, null, 12, null, null, null, 11, null, null, null, 12, null, 14, null, 11, null] },
    perc:   { steps: [1, null, 1, null, 1, null, 1, null, 1, null, 1, null, 1, 1, 1, null] },
  },
};

let current = null;        // 트랙 이름
let step = 0;
let nextTime = 0;
let timer = null;
let waveTempoBoost = 0;    // 웨이브에 따른 bpm 가산
let musicGain = null;

function ensureGain() {
  const c = getAc(); if (!c) return null;
  if (!musicGain) {
    musicGain = c.createGain();
    musicGain.gain.value = 0.8;
    musicGain.connect(getMaster());
  }
  return musicGain;
}

function playNote(cfg, semi, t, dur) {
  const c = getAc(); if (!c || semi == null) return;
  const g = ensureGain(); if (!g) return;
  const o = c.createOscillator(), env = c.createGain();
  o.type = cfg.type;
  o.frequency.setValueAtTime(F(semi, cfg.base), t);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(cfg.vol, t + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(env); env.connect(g);
  o.start(t); o.stop(t + dur + 0.05);
}

function playPerc(t) {
  const c = getAc(); if (!c) return;
  const g = ensureGain(); if (!g) return;
  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 6000;
  const env = c.createGain();
  env.gain.setValueAtTime(0.03, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(f); f.connect(env); env.connect(g);
  src.start(t);
}

function schedule() {
  const c = getAc();
  if (!c || !current || isMuted()) return;
  const T = TRACKS[current];
  const stepDur = 60 / (T.bpm + waveTempoBoost) / 4;   // 16분음표
  while (nextTime < c.currentTime + 0.45) {
    if (nextTime < c.currentTime) nextTime = c.currentTime + 0.05;
    const i = step % 16;
    if (T.bass) playNote(T.bass, T.bass.steps[i], nextTime, T.bass.len);
    if (T.melody) playNote(T.melody, T.melody.steps[i], nextTime, T.melody.len);
    if (T.perc && T.perc.steps[i]) playPerc(nextTime);
    nextTime += stepDur;
    step++;
  }
}

export const music = {
  /* 트랙 전환 (같은 트랙이면 무시) */
  setTrack(name) {
    if (current === name) return;
    current = name;
    step = 0;
    const c = getAc();
    nextTime = c ? c.currentTime + 0.1 : 0;
    if (!timer) timer = setInterval(schedule, 140);
  },
  stop() {
    current = null;
    if (timer) { clearInterval(timer); timer = null; }
  },
  /* 웨이브 수에 따라 전투 템포 상승 (최대 +40bpm) */
  setWave(w) { waveTempoBoost = Math.min(40, w * 2); },
  /* 뮤트 해제 후 재개용 */
  sync() {
    const c = getAc();
    if (c && current) nextTime = c.currentTime + 0.1;
  },
};
