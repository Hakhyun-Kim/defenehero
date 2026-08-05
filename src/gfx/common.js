/* =====================================================
 * 3D 공용 유틸 — 좌표 변환 · 재질 · 절차 생성 텍스처
 * 외부 에셋 0개: 텍스처는 전부 캔버스로 그린다.
 * ===================================================== */
import * as THREE from 'three';
import * as D from '../data.js';

/* 논리 좌표(700×430) → 월드 좌표 */
export const S = 1 / 36;
export const wx = (x) => (x - D.FIELD_W / 2) * S;
export const wz = (y) => (y - D.FIELD_H / 2) * S;

export function lam(color) { return new THREE.MeshLambertMaterial({ color }); }
export function glow(color) { return new THREE.MeshBasicMaterial({ color }); }

/* ---------- 텍스처 유틸 ---------- */
const emojiCache = new Map();
export function emojiTexture(emoji) {
  if (emojiCache.has(emoji)) return emojiCache.get(emoji);
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  g.font = '120px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 80, 90);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  emojiCache.set(emoji, t);
  return t;
}

let blobTex = null;
export function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

/* 부드러운 발광 스프라이트 (파티클용) */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/* 반복 타일링 가능한 절차 생성 텍스처 (키별 캐시) */
const texCache = new Map();
function cachedTex(key, draw, repeat = 1) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  draw(c.getContext('2d'), 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/* 값 노이즈 (시드 고정) */
function noiseGrid(n, seed = 1) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return g;
}
function sampleNoise(g, n, x, y) {
  const xi = ((x % n) + n) % n, yi = ((y % n) + n) % n;
  return g[Math.floor(yi) * n + Math.floor(xi)];
}

/* 잔디: 색 얼룩 + 풀잎 스트로크 */
export function grassTexture() {
  return cachedTex('grass', (g, S) => {
    const N = 32, nz = noiseGrid(N, 7);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const v = sampleNoise(nz, N, x / 8, y / 8);
        const h = 96 + v * 16;                    // 색상 각도
        const l = 38 + v * 12;
        g.fillStyle = `hsl(${h}, 45%, ${l}%)`;
        g.fillRect(x, y, 1, 1);
      }
    }
    /* 풀잎 */
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const len = 3 + Math.random() * 5;
      g.strokeStyle = `hsla(${95 + Math.random() * 20}, 55%, ${44 + Math.random() * 18}%, 0.7)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 2, y - len);
      g.stroke();
    }
  }, 14);
}

/* 흙길: 자갈 + 발자국 얼룩 */
export function roadTexture() {
  return cachedTex('road', (g, S) => {
    const N = 24, nz = noiseGrid(N, 21);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const v = sampleNoise(nz, N, x / 10, y / 10);
        g.fillStyle = `hsl(${32 + v * 8}, ${34 + v * 10}%, ${52 + v * 14}%)`;
        g.fillRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < 260; i++) {          // 자갈
      const x = Math.random() * S, y = Math.random() * S, r = 1 + Math.random() * 2.6;
      g.fillStyle = `hsla(${30 + Math.random() * 14}, 22%, ${Math.random() < 0.5 ? 42 : 72}%, 0.75)`;
      g.beginPath(); g.ellipse(x, y, r, r * 0.75, Math.random() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 26; i++) {           // 밟힌 자국
      const x = Math.random() * S, y = Math.random() * S;
      g.fillStyle = 'rgba(90,66,38,0.16)';
      g.beginPath(); g.ellipse(x, y, 8 + Math.random() * 12, 5 + Math.random() * 8, Math.random() * 3, 0, 7); g.fill();
    }
  }, 3);
}

/* 성벽 돌: 벽돌 + 이음새 + 얼룩 */
export function stoneTexture() {
  return cachedTex('stone', (g, S) => {
    g.fillStyle = '#9aa1b5';
    g.fillRect(0, 0, S, S);
    const bh = 32, bw = 64;
    for (let row = 0; row * bh < S; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col * bw < S + bw; col++) {
        const x = col * bw + off, y = row * bh;
        const l = 58 + Math.random() * 16;
        g.fillStyle = `hsl(${216 + Math.random() * 12}, 12%, ${l}%)`;
        g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        /* 상단 하이라이트 · 하단 그림자 */
        g.fillStyle = 'rgba(255,255,255,0.13)';
        g.fillRect(x + 1.5, y + 1.5, bw - 3, 2.5);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(x + 1.5, y + bh - 4.5, bw - 3, 3);
      }
    }
    for (let i = 0; i < 200; i++) {          // 얼룩/이끼
      const x = Math.random() * S, y = Math.random() * S;
      g.fillStyle = `rgba(${70 + Math.random() * 60},${80 + Math.random() * 50},${70 + Math.random() * 40},0.09)`;
      g.beginPath(); g.arc(x, y, 2 + Math.random() * 7, 0, 7); g.fill();
    }
  }, 1);
}
