/* =====================================================
 * 3D 렌더러 (Three.js)
 * v4: 성이 위(멀리), 몬스터는 아래(카메라 쪽)에서 위로 — 세 갈래 길
 *     사람 모양 용사 10종 (기본 4 + 레시피 특수 6)
 * 외부 에셋 0개: 지형·성·캐릭터·이펙트 전부 코드 생성.
 * ===================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import * as D from './data.js';

const S = 1 / 36;
const wx = (x) => (x - D.FIELD_W / 2) * S;
const wz = (y) => (y - D.FIELD_H / 2) * S;

/* ---------- 텍스처 유틸 ---------- */
const emojiCache = new Map();
function emojiTexture(emoji) {
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
function blobTexture() {
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

/* =====================================================
 * 절차 생성 텍스처 — 외부 이미지 파일 없이 캔버스로 그린다
 * (반복 타일링 가능하도록 wrap 설정)
 * ===================================================== */
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
function grassTexture() {
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
function roadTexture() {
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
function stoneTexture() {
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

/* 부드러운 발광 스프라이트 (파티클용) */
let glowTex = null;
function glowTexture() {
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


/* =====================================================
 * 사람 모양 용사 (치비, +Z를 바라봄)
 * ===================================================== */
const SKIN = 0xffd9b3;
const CLASS_LOOK = {
  knight:       { tunic: 0xcf5548, sleeve: 0xa93b30, pants: 0x54423a },
  guard:        { tunic: 0x5a7fd6, sleeve: 0x3f5fae, pants: 0x3d4666 },
  archer:       { tunic: 0x4f9e57, sleeve: 0x3b7f44, pants: 0x5a4a32 },
  mage:         { tunic: 0x7a5fd0, sleeve: 0x6448b8, pants: 0x453a6b },
  spellblade:   { tunic: 0x9b3a5e, sleeve: 0x7a2c48, pants: 0x3f2735 },
  windblade:    { tunic: 0x3fa08a, sleeve: 0x2f8070, pants: 0x2c4a44 },
  paladin:      { tunic: 0xe8e0c8, sleeve: 0xcfc4a0, pants: 0x8a8064 },
  frostmage:    { tunic: 0x5db4e8, sleeve: 0x4394c8, pants: 0x2f5a78 },
  sentinel:     { tunic: 0x5a6478, sleeve: 0x454e60, pants: 0x32384a },
  spiritarcher: { tunic: 0x9a7fd8, sleeve: 0x7f64bd, pants: 0x54487a },
  /* 신화 3종 */
  swordsaint:   { tunic: 0xffe08a, sleeve: 0xe0b955, pants: 0x8a6a2a },
  archmage:     { tunic: 0x3a2a6e, sleeve: 0x2a1e52, pants: 0x1e1640 },
  seraph:       { tunic: 0xfaf6ea, sleeve: 0xe8e0c8, pants: 0xc8bfa0 },
};

function lam(color) { return new THREE.MeshLambertMaterial({ color }); }
function glow(color) { return new THREE.MeshBasicMaterial({ color }); }

/* 장비 파츠 헬퍼 */
function makeSword(bladeMat) {
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.02), bladeMat);
  blade.position.y = 0.28;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.045), lam(0xd9a93d));
  guard.position.y = 0.05;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12), lam(0x5a3a22));
  grip.position.y = -0.03;
  sword.add(blade, guard, grip);
  return sword;
}
function makeShield(plateColor) {
  const shield = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.05, 6), lam(plateColor));
  plate.rotation.x = Math.PI / 2;
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lam(0xd9a93d));
  boss.position.z = 0.04;
  shield.add(plate, boss);
  return shield;
}
function makeBow(woodMat, horizontal = false) {
  const bow = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 6, 14, Math.PI), woodMat);
  arc.rotation.z = Math.PI / 2;
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.5, 0.008), lam(0xe8e8e8));
  bow.add(arc, string);
  if (horizontal) bow.rotation.z = Math.PI / 2;   // 석궁처럼 눕힘
  return bow;
}
function makeStaff(headMesh) {
  const staff = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.68), lam(0x6b4c2a));
  rod.position.y = 0.2;
  headMesh.position.y = 0.58;
  staff.add(rod, headMesh);
  return staff;
}
function makeHood(color, headGroup) {
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.3, 10), lam(color));
  hood.position.y = 0.14;
  headGroup.add(hood);
}
function makeWizardHat(color, headGroup) {
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 14), lam(color));
  brim.position.y = 0.12;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.4, 12), lam(color));
  hat.position.y = 0.32;
  headGroup.add(brim, hat);
}
function makeKnightHelm(headGroup, plumeColor) {
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), lam(0xc8ccd8));
  helm.position.y = 0.03;
  headGroup.add(helm);
  if (plumeColor != null) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), lam(plumeColor));
    plume.position.y = 0.3;
    headGroup.add(plume);
  }
}
function makeFullHelm(headGroup) {
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.235, 0.2, 12), lam(0xb9c0cf));
  helm.position.y = 0.08;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.225, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), lam(0xb9c0cf));
  top.position.y = 0.16;
  headGroup.add(helm, top);
}

function makeHumanHero(cls, tier) {
  const look = CLASS_LOOK[cls];
  const g = new THREE.Group();
  const refs = {};

  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.13), lam(look.pants));
    leg.position.set(0.09 * sx, 0.1, 0);
    g.add(leg);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.3), lam(look.tunic));
  body.position.y = 0.41;
  g.add(body);
  refs.body = body;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.32), lam(0x3a2f24));
  belt.position.y = 0.24;
  g.add(belt);

  const armL = new THREE.Group();
  armL.position.set(-0.27, 0.6, 0);
  const armLmesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), lam(look.sleeve));
  armLmesh.position.y = -0.12;
  armL.add(armLmesh);
  g.add(armL);
  refs.armL = armL;

  const armPivot = new THREE.Group();
  armPivot.position.set(0.27, 0.6, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), lam(look.sleeve));
  armR.position.y = -0.12;
  armPivot.add(armR);
  g.add(armPivot);
  refs.armPivot = armPivot;

  const head = new THREE.Group();
  head.position.y = 0.93;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), lam(SKIN));
  head.add(skull);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), lam(0x232323));
    eye.position.set(0.075 * sx, 0.02, 0.185);
    head.add(eye);
  }
  g.add(head);
  refs.head = head;

  const holdRight = (mesh) => {
    mesh.position.set(0, -0.26, 0.06);
    mesh.rotation.x = Math.PI / 5;
    armPivot.add(mesh);
  };
  const holdLeft = (mesh, z = 0.14) => {
    mesh.position.set(-0.1, -0.16, z);
    armL.add(mesh);
  };

  /* --- 직업별 장비 --- */
  switch (cls) {
    case 'knight':
      makeKnightHelm(head, 0xd83a3a);
      holdRight(makeSword(lam(0xe8ecf4)));
      break;
    case 'guard':
      makeFullHelm(head);
      holdLeft(makeShield(0xd0d6e2));
      {
        const mace = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3), lam(0x5a3a22));
        handle.position.y = 0.1;
        const headM = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), lam(0x8b93a8));
        headM.position.y = 0.28;
        mace.add(handle, headM);
        holdRight(mace);
      }
      break;
    case 'archer':
      makeHood(0x35703c, head);
      { const bow = makeBow(lam(0x7a4a22)); holdLeft(bow, 0.16); refs.bow = bow; }
      break;
    case 'mage':
      makeWizardHat(0x5b43a8, head);
      {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), glow(0x9ff3ff));
        holdRight(makeStaff(orb));
        refs.staffOrb = orb;
      }
      break;
    case 'spellblade': {  /* 마검사: 불타는 검 */
      makeKnightHelm(head, 0xb14fd8);
      const flameBlade = makeSword(glow(0xff8a3d));
      holdRight(flameBlade);
      refs.flame = flameBlade;
      break;
    }
    case 'windblade': {   /* 질풍검객: 쌍검 + 머리띠 */
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.05, 12, 1, true),
        new THREE.MeshLambertMaterial({ color: 0x2f8070, side: THREE.DoubleSide }));
      band.position.y = 0.06;
      head.add(band);
      holdRight(makeSword(lam(0xd8f4ec)));
      { const s2 = makeSword(lam(0xd8f4ec)); s2.position.set(0, -0.26, 0.06); s2.rotation.x = Math.PI / 5; armL.add(s2); }
      break;
    }
    case 'paladin': {     /* 성기사: 금방패 + 후광 */
      makeFullHelm(head);
      holdLeft(makeShield(0xf2d98a));
      holdRight(makeSword(lam(0xfff2c8)));
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 20), glow(0xffe27a));
      halo.rotation.x = Math.PI / 2.3;
      halo.position.y = 0.34;
      head.add(halo);
      refs.halo = halo;
      break;
    }
    case 'frostmage': {   /* 빙결사: 얼음 결정 지팡이 */
      makeWizardHat(0x3a7fc0, head);
      const ice = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), glow(0xaef4ff));
      holdRight(makeStaff(ice));
      refs.staffOrb = ice;
      break;
    }
    case 'sentinel': {    /* 파수꾼: 눕힌 석궁 */
      makeHood(0x3a4152, head);
      const crossbow = makeBow(lam(0x4a3a28), true);
      crossbow.rotation.x = Math.PI / 2.2;
      holdRight(crossbow);
      break;
    }
    case 'spiritarcher': { /* 정령궁수: 빛나는 활 */
      makeHood(0x6a52a8, head);
      const bow = makeBow(glow(0xd8b4ff));
      holdLeft(bow, 0.16);
      refs.bow = bow;
      break;
    }
    /* --- 신화 --- */
    case 'swordsaint': {        /* 검성: 빛나는 쌍검 + 금투구 */
      makeKnightHelm(head, 0xff4d9d);
      const s1 = makeSword(glow(0xfff3b0)); holdRight(s1);
      const s2 = makeSword(glow(0xfff3b0)); s2.position.set(0, -0.26, 0.06); s2.rotation.x = Math.PI / 5; armL.add(s2);
      refs.flame = s1;
      break;
    }
    case 'archmage': {          /* 대마도사: 별 지팡이 + 챙 넓은 모자 */
      makeWizardHat(0x2a1e52, head);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 1), glow(0xff9ecb));
      holdRight(makeStaff(star));
      refs.staffOrb = star;
      break;
    }
    case 'seraph': {            /* 수호천사: 후광 + 날개 + 빛나는 활 */
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 22), glow(0xfff3b0));
      halo.rotation.x = Math.PI / 2.3;
      halo.position.y = 0.32;
      head.add(halo);
      refs.halo = halo;
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, 0.62),
          new THREE.MeshBasicMaterial({ color: 0xfffdf2, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
        );
        wing.position.set(0.22 * sx, 0.55, -0.2);
        wing.rotation.y = 0.5 * sx;
        g.add(wing);
        if (!refs.wings) refs.wings = [];
        refs.wings.push(wing);
      }
      const bow = makeBow(glow(0xfff3b0));
      holdLeft(bow, 0.16);
      refs.bow = bow;
      break;
    }
  }

  if (tier >= 1) {
    const cape = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.52),
      new THREE.MeshLambertMaterial({ color: D.TIERS[tier].color, side: THREE.DoubleSide })
    );
    cape.position.set(0, 0.52, -0.19);
    cape.rotation.x = 0.16;
    g.add(cape);
    refs.cape = cape;
  }
  if (tier >= 3) {
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd93d, side: THREE.DoubleSide }));
    crown.add(band);
    for (let k = 0; k < 4; k++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), glow(0xffd93d));
      const a = (k / 4) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.12, 0.07, Math.sin(a) * 0.12);
      crown.add(spike);
    }
    crown.position.y = 0.24;
    head.add(crown);
  }

  g.scale.setScalar(1.18 + tier * 0.1);
  return { group: g, refs };
}

/* =====================================================
 * 렌더러 본체
 * ===================================================== */
export class Renderer3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.quality = opts.quality || 'high';
    this.time = 0;
    this.shake = 0;

    const r = new THREE.WebGLRenderer({
      antialias: this.quality !== 'min',
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !!opts.preserve,
    });
    r.setPixelRatio(this._targetDpr());
    r.setClearColor(0xbfe3ff);
    /* 톤매핑 + 실시간 그림자 — 값싼 "AAA 느낌"의 8할 */
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.08;
    r.outputColorSpace = THREE.SRGBColorSpace;
    if (this.quality === 'high') {
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(r.domElement);
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.fogNear = 24; this.fogFar = 44;
    this.scene.fog = new THREE.Fog(0xcfe9ff, this.fogNear, this.fogFar);
    this.scene.background = new THREE.Color(0xcfe9ff);
    /* 보스 분위기 전환용 기준값 */
    this.baseFog = new THREE.Color(0xcfe9ff);
    this.baseClear = new THREE.Color(0xbfe3ff);
    this.bossMode = 0;        // 0 없음 · 1 중간보스 · 2 대보스
    this.bossBlend = 0;

    this.camera = new THREE.PerspectiveCamera(46, 16 / 10, 0.1, 120);
    this.camBase = new THREE.Vector3(0, 13.2, 12.8);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0, -0.6);

    this.hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5d8742, 1.25);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.9);
    sun.position.set(8, 14, 6);
    if (this.quality === 'high') {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const c = sun.shadow.camera;
      c.left = -14; c.right = 14; c.top = 11; c.bottom = -11;
      c.near = 1; c.far = 40;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.02;
    }
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    this._buildTerrain();
    this._buildCastle();
    this._buildParticles();
    this._buildDamageNumbers();

    this.heroViews = new Map();
    this.enemyViews = new Map();
    this.projViews = new Map();
    this.placementMode = false;
    this.placeRange = 0;
    this.selectedHeroId = null;
    this.hoverPad = null;

    this._setupComposer();

    this._resize = this._resize.bind(this);
    this.ro = new ResizeObserver(this._resize);
    this.ro.observe(container);
    this._resize();

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  _targetDpr() {
    const d = window.devicePixelRatio || 1;
    if (this.quality === 'high') return Math.min(d, 2);
    if (this.quality === 'lite') return Math.min(d, 1.4);
    return 0.6;
  }

  _setupComposer() {
    if (this.quality !== 'high') { this.composer = null; return; }
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size, 0.5, 0.35, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setQuality(q) {
    if (this.quality === q) return;
    this.quality = q;
    this.renderer.setPixelRatio(this._targetDpr());
    if (q === 'high') this._setupComposer();
    else { this.composer = null; }
    this._resize();
  }

  _resize() {
    const w = this.container.clientWidth || 700;
    const h = this.container.clientHeight || 430;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
  }

  /* ---------- 지형: 잔디 + 세 갈래 길 + 발판 ---------- */
  _buildTerrain() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(74, 40),
      new THREE.MeshLambertMaterial({ map: grassTexture(), color: 0xd2e3c2 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.scene.add(ground);

    /* 길 (모든 루트, 공유 구간은 겹쳐 그려짐) */
    const roadW = (D.ROAD_HALF * 2 + 10) * S;
    const edgeMat = lam(0x8d6a42);
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture(), color: 0xe8d7bd });
    for (const segs of D.ROUTE_SEGS) {
      for (const seg of segs) {
        const len = seg.len * S;
        const cx = wx((seg.x1 + seg.x2) / 2), cz = wz((seg.y1 + seg.y2) / 2);
        const ang = Math.atan2(wz(seg.y2) - wz(seg.y1), wx(seg.x2) - wx(seg.x1));
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(len + roadW * 0.3, roadW + 0.16), edgeMat);
        edge.rotation.x = -Math.PI / 2;
        edge.rotation.z = ang;
        edge.position.set(cx, -0.045, cz);
        this.scene.add(edge);
        const road = new THREE.Mesh(new THREE.PlaneGeometry(len + roadW * 0.2, roadW), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = ang;
        road.position.set(cx, -0.02 - Math.random() * 0.004, cz);
        this.scene.add(road);
      }
    }
    for (let r = 0; r < D.ROUTES.length; r++) {
      const pts = D.ROUTES[r];
      for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i];
        const cornerE = new THREE.Mesh(new THREE.CircleGeometry(roadW / 2 + 0.08, 18), edgeMat);
        cornerE.rotation.x = -Math.PI / 2;
        cornerE.position.set(wx(px), -0.04, wz(py));
        this.scene.add(cornerE);
        const corner = new THREE.Mesh(new THREE.CircleGeometry(roadW / 2, 18), roadMat);
        corner.rotation.x = -Math.PI / 2;
        corner.position.set(wx(px), -0.015, wz(py));
        this.scene.add(corner);
      }
      /* 발자국 점 */
      const dotMat = lam(0xb08e58);
      for (let s = 30; s < D.ROUTE_LENS[r]; s += 46) {
        const p = D.routePoint(r, s);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 6), dotMat);
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(wx(p.x), 0.001, wz(p.y));
        this.scene.add(dot);
      }
    }

    /* 스폰 포탈 (아래쪽, 카메라 가까이) */
    this.portal = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.1, 10, 26),
      new THREE.MeshBasicMaterial({ color: 0xc478f0 })
    );
    this.portal.position.set(wx(350), 1.0, wz(422));
    this.scene.add(this.portal);
    const portalGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 20),
      new THREE.MeshBasicMaterial({ color: 0x8a4fc0, transparent: true, opacity: 0.55 })
    );
    portalGlow.position.copy(this.portal.position);
    this.scene.add(portalGlow);

    /* 배치 발판 */
    this.padHighlights = [];
    for (let i = 0; i < D.PADS.length; i++) {
      const pad = D.PADS[i];
      const px = wx(pad.x), pz = wz(pad.y);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.8, 0.1, 18), lam(0x8d94a8));
      rim.position.set(px, 0.02, pz);
      this.scene.add(rim);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.1, 18),
        new THREE.MeshLambertMaterial({ map: stoneTexture(), color: 0xdfe4ee }));
      top.position.set(px, 0.07, pz);
      top.receiveShadow = true;
      rim.castShadow = true;
      this.scene.add(top);
      const hl = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 18),
        new THREE.MeshBasicMaterial({ color: 0x3ddc6e, transparent: true, opacity: 0.35, depthWrite: false })
      );
      hl.rotation.x = -Math.PI / 2;
      hl.position.set(px, 0.14, pz);
      hl.visible = false;
      this.scene.add(hl);
      this.padHighlights.push(hl);
    }

    this.hoverRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })
    );
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);

    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.0, 28),
      new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0.9, depthWrite: false })
    );
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.visible = false;
    this.scene.add(this.selRing);

    this.rangeGroup = new THREE.Group();
    const rangeFill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ color: 0x66c2ff, transparent: true, opacity: 0.1, depthWrite: false })
    );
    rangeFill.rotation.x = -Math.PI / 2;
    const rangeEdge = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0x66c2ff, transparent: true, opacity: 0.7, depthWrite: false })
    );
    rangeEdge.rotation.x = -Math.PI / 2;
    this.rangeGroup.add(rangeFill, rangeEdge);
    this.rangeGroup.position.y = 0.16;
    this.rangeGroup.visible = false;
    this.scene.add(this.rangeGroup);

    /* 장식 나무/바위 (좌우 바깥) — 시드 고정이라 매 실행 배치가 같다 */
    const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const treeTrunk = lam(0x7a5230);
    const treeLeaf = lam(0x3f8f3f);
    const rockMat = lam(0x9aa0a8);
    for (let k = 0; k < 16; k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const x = side * (10.4 + rnd() * 3.2);
      const z = -6 + rnd() * 13;
      if (rnd() < 0.7) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5), treeTrunk);
        trunk.position.y = 0.25;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55 + rnd() * 0.3, 1.2 + rnd() * 0.5, 7), treeLeaf);
        leaf.position.y = 1.1;
        g.add(trunk, leaf);
        g.position.set(x, 0, z);
        trunk.castShadow = leaf.castShadow = true;
        this.scene.add(g);
      } else {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + rnd() * 0.2), rockMat);
        rock.position.set(x, 0.12, z);
        rock.rotation.set(rnd() * 3, rnd() * 3, 0);
        this.scene.add(rock);
      }
    }
  }

  /* ---------- 성 (맵 위쪽, 카메라에서 먼 곳) ---------- */
  _buildCastle() {
    const g = new THREE.Group();
    this.castleStoneMats = [];
    const stone = (color) => {
      const m = new THREE.MeshLambertMaterial({ color, map: stoneTexture() });
      m.userData.baseColor = new THREE.Color(color);
      this.castleStoneMats.push(m);
      return m;
    };
    const roofMat = lam(0xe05252);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd76e });

    const base = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.5, 3.6), stone(0x8d94aa));
    base.position.set(0, 0.25, -5.5);
    g.add(base);

    this.wall = new THREE.Mesh(new THREE.BoxGeometry(13.0, 1.6, 0.7), stone(0xa3aabf));
    this.wall.position.set(0, 1.05, -4.35);
    g.add(this.wall);
    for (let k = 0; k < 9; k++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.72), stone(0xb2b8cc));
      c.position.set(-5.8 + k * 1.45, 2.0, -4.35);
      g.add(c);
    }
    /* 성문 — 가운데 길과 정렬 */
    const gate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.3), lam(0x4a3826));
    gate.position.set(0, 0.8, -4.05);
    g.add(gate);

    const keep = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.7, 2.1), stone(0x9ba2b8));
    keep.position.set(0, 1.6, -5.85);
    g.add(keep);
    const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.4, 4), roofMat);
    keepRoof.rotation.y = Math.PI / 4;
    keepRoof.position.set(0, 3.65, -5.85);
    g.add(keepRoof);
    for (const dx of [-0.6, 0.6]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.08), glowMat);
      win.position.set(dx, 1.9, -4.76);
      g.add(win);
    }

    this.flags = [];
    for (const dx of [-5.2, 5.2]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.88, 3.1, 8), stone(0x99a0b6));
      tower.position.set(dx, 1.55, -5.1);
      g.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.25, 8), roofMat);
      roof.position.set(dx, 3.72, -5.1);
      g.add(roof);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0), lam(0x6b4c2a));
      pole.position.set(dx, 4.8, -5.1);
      g.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xffc93d, side: THREE.DoubleSide })
      );
      flag.position.set(dx + 0.34, 5.05, -5.1);
      flag.geometry.translate(0.31, 0, 0);
      this.flags.push(flag);
      g.add(flag);
    }

    this.crystals = [];
    for (let k = 0; k < 3; k++) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3),
        new THREE.MeshBasicMaterial({ color: 0x7ff3ff })
      );
      crystal.position.set((k - 1) * 1.4, 4.6 + (k === 1 ? 0.5 : 0), -5.6);
      crystal.visible = false;
      this.crystals.push(crystal);
      g.add(crystal);
    }

    this.fortifyBands = [];
    for (let k = 0; k < 5; k++) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(13.1, 0.08, 0.76),
        new THREE.MeshBasicMaterial({ color: 0xffd76e })
      );
      band.position.set(0, 0.42 + k * 0.3, -4.35);
      band.visible = false;
      this.fortifyBands.push(band);
      g.add(band);
    }

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.castle = g;
    this.scene.add(g);
  }

  /* ---------- 파티클 ---------- */
  _buildParticles() {
    const MAX = 320;
    this.pMax = MAX;
    this.particles = [];
    const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.pMesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pMesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) {
      this.pMesh.setMatrixAt(i, m);
      this.pMesh.setColorAt(i, new THREE.Color(0xffffff));
      this.particles.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), ttl: 0, life: 1, size: 1, grav: 6 });
    }
    this.pMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.pMesh);
  }

  burst(x3, y3, z3, color, n = 10, speed = 3, opts = {}) {
    const col = new THREE.Color(color);
    let spawned = 0;
    for (let i = 0; i < this.pMax && spawned < n; i++) {
      const p = this.particles[i];
      if (p.live) continue;
      p.live = true;
      p.pos.set(x3, y3, z3);
      const a = Math.random() * Math.PI * 2;
      const up = opts.up != null ? opts.up : 1;
      p.vel.set(
        Math.cos(a) * speed * (0.3 + Math.random() * 0.7),
        (Math.random() * 0.9 + 0.4) * speed * up,
        Math.sin(a) * speed * (0.3 + Math.random() * 0.7)
      );
      p.life = p.ttl = opts.ttl || (0.4 + Math.random() * 0.35);
      p.size = opts.size || (0.7 + Math.random() * 0.7);
      p.grav = opts.grav != null ? opts.grav : 7;
      this.pMesh.setColorAt(i, col);
      spawned++;
    }
    this.pMesh.instanceColor.needsUpdate = true;
  }

  _updateParticles(dt) {
    const m = new THREE.Matrix4();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.pMax; i++) {
      const p = this.particles[i];
      if (!p.live) continue;
      p.ttl -= dt;
      if (p.ttl <= 0) {
        p.live = false;
        this.pMesh.setMatrixAt(i, zero);
        continue;
      }
      p.vel.y -= p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.05) { p.pos.y = 0.05; p.vel.y *= -0.35; }
      const s = p.size * (p.ttl / p.life) * 0.9;
      m.makeScale(s, s, s);
      m.setPosition(p.pos);
      this.pMesh.setMatrixAt(i, m);
    }
    this.pMesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------- 데미지 숫자 ---------- */
  _buildDamageNumbers() {
    this.dmgPool = [];
    for (let i = 0; i < 22; i++) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 96;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      spr.scale.set(2.3, 0.86, 1);
      spr.visible = false;
      spr.renderOrder = 50;
      this.scene.add(spr);
      this.dmgPool.push({ spr, tex, c, ttl: 0, life: 1, vy: 1.6 });
    }
  }

  showNumber(x3, y3, z3, text, color = '#ffffff', scale = 1) {
    let slot = this.dmgPool.find(s => s.ttl <= 0);
    if (!slot) slot = this.dmgPool[0];
    const g = slot.c.getContext('2d');
    g.clearRect(0, 0, 256, 96);
    g.font = `bold ${Math.round(52 * Math.min(scale, 1.35))}px Jua, "Segoe UI", "Segoe UI Emoji", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.strokeText(text, 128, 48);
    g.fillStyle = color;
    g.fillText(text, 128, 48);
    slot.tex.needsUpdate = true;
    slot.spr.position.set(x3, y3, z3);
    slot.spr.scale.set(2.3 * scale, 0.86 * scale, 1);
    slot.spr.visible = true;
    slot.ttl = slot.life = 0.85;
  }

  _updateNumbers(dt) {
    for (const s of this.dmgPool) {
      if (s.ttl <= 0) continue;
      s.ttl -= dt;
      s.spr.position.y += s.vy * dt;
      s.spr.material.opacity = Math.min(1, s.ttl / (s.life * 0.6));
      if (s.ttl <= 0) s.spr.visible = false;
    }
  }

  /* ---------- 뷰 생성 ---------- */
  _makeHeroView(hero) {
    const { group, refs } = makeHumanHero(hero.cls, hero.tier);
    group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const holder = new THREE.Group();
    holder.add(group);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.95),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.12;
    holder.add(shadow);

    const isSpecial = !!D.CLASSES[hero.cls].special;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.64, 24),
      new THREE.MeshBasicMaterial({ color: D.TIERS[hero.tier].color, transparent: true, opacity: 0.95, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.145;
    holder.add(ring);
    /* 특수 직업: 은은한 보라 보조 링 */
    if (isSpecial) {
      const sring = new THREE.Mesh(
        new THREE.RingGeometry(0.66, 0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0xd8b4ff, transparent: true, opacity: 0.55, depthWrite: false })
      );
      sring.rotation.x = -Math.PI / 2;
      sring.position.y = 0.14;
      holder.add(sring);
    }

    let legendGlow = null;
    if (hero.tier >= 3) {
      legendGlow = new THREE.Mesh(
        new THREE.RingGeometry(0.76, 0.94, 26),
        new THREE.MeshBasicMaterial({ color: hero.tier >= 4 ? 0xff4d9d : 0xffc93d, transparent: true, opacity: 0.5, depthWrite: false })
      );
      legendGlow.rotation.x = -Math.PI / 2;
      legendGlow.position.y = 0.14;
      holder.add(legendGlow);
    }

    this.scene.add(holder);
    return {
      holder, model: group, refs, legendGlow,
      attackT: 0, faceY: Math.PI, targetFaceY: Math.PI,
      cls: hero.cls,
    };
  }

  /* 보스 분위기: 하늘·안개·조명을 어둡게 (0 없음 / 1 중간 / 2 대보스) */
  setBossMode(level) { this.bossMode = level; }

  _updateBossMood(dt) {
    const target = this.bossMode;
    this.bossBlend += (target - this.bossBlend) * Math.min(1, dt * 1.6);
    const k = this.bossBlend;
    /* 중간보스는 보랏빛, 대보스는 핏빛으로 */
    const tint = new THREE.Color(k > 1.2 ? 0x6b1418 : 0x3a2050);
    const strength = Math.min(1, k) * (k > 1.2 ? 0.85 : 0.6);
    const fogCol = this.baseFog.clone().lerp(tint, strength);
    const clearCol = this.baseClear.clone().lerp(tint, strength * 0.9);
    this.scene.fog.color.copy(fogCol);
    this.renderer.setClearColor(clearCol);
    this.scene.fog.far = this.fogFar - Math.min(1, k) * 10;   // 안개가 조여든다
    this.hemi.intensity = 1.05 - Math.min(1, k) * 0.42;
    this.sun.intensity = 1.35 - Math.min(1, k) * 0.55;
  }

  _makeEnemyView(e) {
    const E = D.ENEMY_TYPES[e.type];
    const scale = (e.size / 30) * 1.55;
    const g = new THREE.Group();

    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(E.emoji), transparent: true }));
    spr.scale.set(scale, scale, 1);
    spr.position.y = scale * 0.62;
    g.add(spr);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(scale * 0.85, scale * 0.6),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    g.add(shadow);

    let auraRing = null;
    if (e.boss || e.midBoss) {
      const col = e.boss ? 0xff4444 : 0xff9a3d;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(scale * 0.42, scale * 0.54, 24),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      g.add(ring);
      auraRing = ring;
      /* 발밑에서 피어오르는 기운 */
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(scale * 0.6, scale * 0.78, 26),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, depthWrite: false })
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.05;
      g.add(aura);
      g.userData.aura = aura;
    }

    const barW = e.boss ? 2.1 : (e.midBoss ? 1.6 : 1.1);
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(barW, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x1c2333, transparent: true, opacity: 0.75, depthTest: false })
    );
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(barW, 0.11),
      new THREE.MeshBasicMaterial({ color: e.boss ? 0xc084fc : (e.midBoss ? 0xffa040 : 0xf87171), depthTest: false })
    );
    fg.position.z = 0.001;
    bg.renderOrder = 40; fg.renderOrder = 41;
    bar.add(bg, fg);
    bar.position.y = scale * 1.32;
    bar.visible = false;
    g.add(bar);

    this.scene.add(g);
    return { group: g, spr, bar, barFg: fg, barW, baseScale: scale, boss: e.boss, midBoss: e.midBoss, auraRing };
  }

  /* ---------- 상태 동기화 ---------- */
  sync(state) {
    const fieldIds = new Set();
    for (const h of state.field) {
      fieldIds.add(h.id);
      let v = this.heroViews.get(h.id);
      if (!v) {
        v = this._makeHeroView(h);
        /* 처음엔 가장 가까운 길을 바라본다 */
        let bx = 0, bz = 0, bd = Infinity;
        for (let r = 0; r < D.ROUTES.length; r++) {
          for (let s = 0; s < D.ROUTE_LENS[r]; s += 24) {
            const p = D.routePoint(r, s);
            const d = Math.hypot(p.x - h.x, p.y - h.y);
            if (d < bd) { bd = d; bx = p.x; bz = p.y; }
          }
        }
        v.faceY = v.targetFaceY = Math.atan2(wx(bx) - wx(h.x), wz(bz) - wz(h.y));
        this.heroViews.set(h.id, v);
      }
      v.holder.position.set(wx(h.x), 0, wz(h.y));
    }
    for (const [id, v] of this.heroViews) {
      if (!fieldIds.has(id)) { this.scene.remove(v.holder); this.heroViews.delete(id); }
    }

    const enemyIds = new Set();
    for (const e of state.enemies) {
      enemyIds.add(e.id);
      let v = this.enemyViews.get(e.id);
      if (!v) {
        v = this._makeEnemyView(e);
        this.enemyViews.set(e.id, v);
      }
      v.group.position.set(wx(e.x), 0, wz(e.y));
      const ratio = Math.max(0, e.hp / e.maxHp);
      v.bar.visible = ratio < 1;
      v.barFg.scale.x = Math.max(0.001, ratio);
      v.barFg.position.x = -(1 - ratio) * v.barW / 2;
      v.burning = !!e.burn;
      v.slowed = !!e.slowed;
      v.enraged = !!e.enraged;
      v.stunned = !!e.stunned;
    }
    for (const [id, v] of this.enemyViews) {
      if (!enemyIds.has(id)) { this.scene.remove(v.group); this.enemyViews.delete(id); }
    }

    const projIds = new Set();
    for (const p of state.projectiles) {
      projIds.add(p.id);
      let v = this.projViews.get(p.id);
      if (!v) {
        v = this._makeProjView(p);
        this.projViews.set(p.id, v);
      }
      const y3 = p.kind === 'bolt' ? 1.6 : 0.85;
      const nx = wx(p.x), nz = wz(p.y);
      if (p.kind === 'arrow' && v.lastPos) {
        const dx = nx - v.lastPos.x, dz = nz - v.lastPos.z;
        if (dx * dx + dz * dz > 1e-6) v.group.rotation.y = -Math.atan2(dz, dx);
      }
      v.lastPos = { x: nx, z: nz };
      v.group.position.set(nx, y3, nz);
    }
    for (const [id, v] of this.projViews) {
      if (!projIds.has(id)) { this.scene.remove(v.group); this.projViews.delete(id); }
    }

    for (let k = 0; k < this.crystals.length; k++) this.crystals[k].visible = k < state.castle.tower;
    for (let k = 0; k < this.fortifyBands.length; k++) this.fortifyBands[k].visible = k < state.castle.fortify;
    const hpRatio = state.castleMax > 0 ? state.castleHp / state.castleMax : 1;
    this.castleHpRatio = hpRatio;
    const char = new THREE.Color(0x554f5e);
    for (const m of this.castleStoneMats) {
      m.color.copy(m.userData.baseColor).lerp(char, (1 - hpRatio) * 0.55);
    }

    if (this.placementMode) {
      /* 교환 모드(배치된 용사를 고른 상태)에서는 남의 자리도 후보다.
       * 빈 발판은 초록(이동), 다른 용사 자리는 파랑(교환)으로 구분해 준다. */
      for (let i = 0; i < D.PADS.length; i++) {
        const occ = state.field.find(h => h.padIndex === i);
        const self = occ && occ.id === this.selectedHeroId;
        const hl = this.padHighlights[i];
        hl.visible = self ? false : (!occ || this.swapMode);
        hl.material.color.setHex(occ ? 0x4aa8ff : 0x3ddc6e);
      }
    } else {
      for (const hl of this.padHighlights) hl.visible = false;
    }

    let rangeShown = false;
    if (this.placementMode && this.hoverPad != null && this.placeRange > 0) {
      const pad = D.PADS[this.hoverPad];
      this.rangeGroup.position.set(wx(pad.x), 0.16, wz(pad.y));
      this.rangeGroup.scale.setScalar(this.placeRange * S);
      this.rangeGroup.visible = true;
      rangeShown = true;
    }
    if (this.selectedHeroId != null) {
      const h = state.field.find(v => v.id === this.selectedHeroId);
      if (h) {
        this.selRing.visible = true;
        this.selRing.position.set(wx(h.x), 0.15, wz(h.y));
        if (!rangeShown) {
          this.rangeGroup.position.set(wx(h.x), 0.16, wz(h.y));
          this.rangeGroup.scale.setScalar(D.CLASSES[h.cls].range * S);
          this.rangeGroup.visible = true;
          rangeShown = true;
        }
      } else this.selRing.visible = false;
    } else this.selRing.visible = false;
    if (!rangeShown) this.rangeGroup.visible = false;
  }

  _makeProjView(p) {
    const g = new THREE.Group();
    if (p.kind === 'arrow') {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x8a5a2b }));
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }));
      head.rotation.z = -Math.PI / 2;
      head.position.x = 0.36;
      g.add(shaft, head);
      if (p.splash > 0) {   /* 정령궁수: 빛나는 화살 */
        const glowTip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xd8b4ff }));
        glowTip.position.x = 0.36;
        g.add(glowTip);
      }
    } else if (p.kind === 'orb') {
      const color = p.splashSlow ? 0x9fdcff : 0xd08bff;   /* 빙결사는 얼음색 */
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color }));
      g.add(orb);
      g.userData.pulse = true;
    } else {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8df3ff }));
      g.add(bolt);
      g.userData.pulse = true;
    }
    this.scene.add(g);
    return { group: g, lastPos: null };
  }

  /* ---------- 이벤트 → 시각 효과 ---------- */
  _heroAttackAnim(heroId, tx, ty) {
    const v = this.heroViews.get(heroId);
    if (!v) return;
    v.attackT = 1;
    if (tx != null) {
      const hx = v.holder.position.x, hz = v.holder.position.z;
      v.targetFaceY = Math.atan2(wx(tx) - hx, wz(ty) - hz);
    }
  }

  onEvents(state, events) {
    for (const ev of events) {
      const x3 = ev.x != null ? wx(ev.x) : 0;
      const z3 = ev.y != null ? wz(ev.y) : 0;
      switch (ev.type) {
        case 'enemyHit': {
          if (ev.kind === 'burn') {
            if (Math.random() < 0.4) this.showNumber(x3, 1.7, z3, `${ev.dmg}`, '#ff9a3d', 0.72);
          } else if (ev.kind === 'crit') {
            /* 치명타는 크고 노랗게 — 근접의 쾌감 */
            this.showNumber(x3, 2.0, z3, `${ev.dmg}!`, '#ffd93d', 1.35);
            this.burst(x3, 1.0, z3, 0xffd93d, 10, 4, { grav: 3, ttl: 0.3 });
            this.addShake(0.14);
          } else {
            this.showNumber(x3, 1.8, z3, `${ev.dmg}`, '#ffffff', ev.dmg >= 100 ? 1.15 : 0.85);
          }
          break;
        }
        case 'block': {
          /* 방패 장벽: 바닥에 퍼지는 충격파 + 정지 표시 */
          this._blockWave(x3, z3, ev.range * S);
          this.burst(x3, 0.5, z3, 0x9fd0ff, 16, 3.2, { grav: 1.5, ttl: 0.4 });
          this.showNumber(x3, 2.4, z3, '🛡️ 멈춰!', '#9fd0ff', 1.1);
          this.addShake(0.2);
          break;
        }
        case 'kill': {
          const col = ev.boss ? 0xffd93d : (ev.midBoss ? 0xffa040
            : ({ goblin: 0x7fd45e, wolf: 0x9aa7ba, orc: 0xd46e5e, troll: 0x5ea7d4, shaman: 0xb08bff }[ev.etype] || 0xffffff));
          const n = ev.boss ? 56 : (ev.midBoss ? 28 : 12);
          const spd = ev.boss ? 6.5 : (ev.midBoss ? 4.4 : 3.2);
          this.burst(x3, 0.9, z3, col, n, spd);
          if (ev.boss) this.burst(x3, 1.4, z3, 0xffffff, 24, 4.5);
          this.showNumber(x3, 2.2, z3, `+${ev.gold}💰`, '#ffd93d', ev.boss ? 1.3 : (ev.midBoss ? 1.1 : 0.9));
          /* 배율이 "올라가는 순간"에만 알린다 — 처치마다 띄우면 글자가 겹쳐 쌓인다 */
          if (ev.combo === D.COMBO.x2At || ev.combo === D.COMBO.x3At) {
            this.showNumber(x3, 3.0, z3, `골드 ${ev.mul}배!`, '#ff8a3d', 1.25);
          }
          this.addShake(ev.boss ? 0.6 : (ev.midBoss ? 0.3 : 0.07));
          break;
        }
        case 'meleeHit':
          this._heroAttackAnim(ev.heroId, ev.tx, ev.ty);
          if (ev.cleave) {
            this.burst(x3, 0.8, z3, 0xffffff, 18, 4.5, { grav: 2, ttl: 0.3 });
            this.addShake(0.12);
          } else if (ev.slow) {
            this.burst(x3, 0.9, z3, 0x9fdcff, 6, 2.4, { grav: 3, ttl: 0.3 });
          } else if (ev.burn) {
            this.burst(x3, 0.9, z3, 0xff8830, 6, 2.6, { grav: 3, ttl: 0.28 });
          } else {
            this.burst(x3, 0.9, z3, 0xffffff, 4, 2.6, { grav: 3, ttl: 0.22 });
          }
          break;
        case 'shoot':
          this._heroAttackAnim(ev.heroId, ev.tx, ev.ty);
          break;
        case 'explode': {
          /* 폭발 반경을 링으로 그려 "어디까지 맞았는지" 확실히 보인다 */
          const r3 = (ev.radius || 62) * S;
          if (ev.frost) {
            this._shockRing(x3, z3, r3, 0x9fdcff, 0.45, 0.2);
            this._shockRing(x3, z3, r3 * 0.6, 0xe8fbff, 0.35, 0.22);
            this.burst(x3, 0.9, z3, 0x9fdcff, ev.big ? 26 : 16, ev.big ? 4.2 : 3.2);
            this.burst(x3, 1.1, z3, 0xe8fbff, 10, 2.2, { grav: -0.5, ttl: 0.6 });
          } else {
            this._shockRing(x3, z3, r3, 0xffa040, 0.45, 0.2);
            this._shockRing(x3, z3, r3 * 0.55, 0xffe08a, 0.32, 0.22);
            this.burst(x3, 0.9, z3, 0xffa040, ev.big ? 30 : 18, ev.big ? 4.6 : 3.4);
            this.burst(x3, 0.9, z3, 0xff5533, ev.big ? 14 : 8, 2.6);
          }
          this.addShake(ev.big ? 0.22 : 0.12);
          break;
        }
        case 'boltHit':
          this.burst(x3, 1.1, z3, 0x8df3ff, 8, 3);
          break;
        case 'pierceHit':
          this.burst(x3, 1.0, z3, 0xffffff, 5, 3.4, { grav: 2 });
          break;
        case 'castleHit':
          this.burst(0, 1.2, -4.0, 0xff5544, 20, 4);
          this.burst(0, 1.6, -4.1, 0x9aa2b8, 10, 3);
          this.showNumber(0, 2.5, -3.7, `-${ev.dmg}`, '#ff4444', 1.25);
          this.addShake(0.42);
          break;
        case 'castleHeal':
          this.burst(0, 1.5, -4.1, 0x8dff9e, 8, 1.8, { grav: -1.5, ttl: 0.6 });
          this.showNumber(0, 2.6, -3.7, `+${ev.amount}`, '#7dff8e', 0.95);
          break;
        case 'heal':
          this.burst(x3, 1.3, z3, 0x6effa0, 7, 1.6, { grav: -1.5, ttl: 0.5 });
          break;
        case 'spawn':
          if (ev.boss) {
            this.burst(x3, 0.9, z3, 0xff3322, 40, 5.5);
            this.burst(x3, 1.2, z3, 0xc478f0, 20, 3.4);
            this.addShake(0.62);
          } else if (ev.midBoss) {
            this.burst(x3, 0.9, z3, 0xff9a3d, 22, 4);
            this.addShake(0.3);
          } else {
            this.burst(x3, 0.9, z3, 0xc478f0, 6, 2.2);
          }
          break;
        case 'bossWarn':
          /* 포탈이 붉게 요동친다 */
          this.burst(0, 1.0, wz(430), ev.tier === 'great' ? 0xff2222 : 0xff9a3d, ev.tier === 'great' ? 26 : 14, 3.2, { grav: -1 });
          this.addShake(ev.tier === 'great' ? 0.22 : 0.12);
          break;
        case 'bossEnrage':
          this.burst(x3, 1.2, z3, 0xff2200, 36, 5.5, { grav: 2 });
          this.burst(x3, 0.8, z3, 0xffcc00, 18, 3.2);
          this.showNumber(x3, 3.0, z3, '분노!!', '#ff3322', 1.4);
          this.addShake(0.55);
          break;
        case 'waveEnd':
          for (let k = 0; k < 5; k++) {
            this.burst((Math.random() - 0.5) * 10, 3 + Math.random() * 2, (Math.random() - 0.5) * 8,
              [0xffd93d, 0x7fd45e, 0x6eb5ff, 0xff8ac2][k % 4], 12, 3, { grav: 3 });
          }
          break;
        case 'gameOver':
          this.addShake(0.8);
          this.burst(0, 1.5, -4.5, 0xff5533, 60, 6);
          break;
      }
    }
  }

  /* 퍼지는 충격파 링 (방패 장벽·범위 폭발 공용, 풀에서 재사용) */
  _shockRing(x3, z3, radius, color = 0x9fd0ff, life = 0.5, y = 0.18) {
    if (!this.waves) {
      this.waves = [];
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(
          new THREE.RingGeometry(0.84, 1, 40),
          new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0, depthWrite: false })
        );
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        this.scene.add(m);
        this.waves.push({ mesh: m, ttl: 0, life: 0.5, radius: 1 });
      }
    }
    const slot = this.waves.find(w => w.ttl <= 0) || this.waves[0];
    slot.mesh.position.set(x3, y, z3);
    slot.mesh.material.color.setHex(color);
    slot.radius = radius;
    slot.ttl = slot.life = life;
    slot.mesh.visible = true;
  }
  _blockWave(x3, z3, radius) { this._shockRing(x3, z3, radius, 0x9fd0ff, 0.5); }

  _updateWaves(dt) {
    if (!this.waves) return;
    for (const w of this.waves) {
      if (w.ttl <= 0) continue;
      w.ttl -= dt;
      const k = 1 - w.ttl / w.life;
      w.mesh.scale.setScalar(w.radius * (0.25 + k * 0.85));
      w.mesh.material.opacity = 0.85 * (1 - k);
      if (w.ttl <= 0) w.mesh.visible = false;
    }
  }

  /* 소환 연출 — 성 앞 광장에서 등급에 비례해 화려하게 */
  summonBurst(tier) {
    const x = 0, z = 2.6;
    const col = new THREE.Color(D.TIERS[tier].color).getHex();
    const n = [10, 18, 34, 60][tier];
    const spd = [2.4, 3.2, 4.4, 6][tier];
    this.burst(x, 0.8, z, col, n, spd, { grav: 4 });
    this._shockRing(x, z, 1.2 + tier * 0.5, col, 0.55);
    if (tier >= 2) {
      /* 빛의 기둥 */
      this._lightPillar(x, z, tier);
      this.burst(x, 1.6, z, 0xffffff, 16, 3, { grav: 1.5, ttl: 0.6 });
      this.addShake(tier === 3 ? 0.32 : 0.16);
    }
    if (tier === 3) {
      this._shockRing(x, z, 3.2, 0xffd93d, 0.8);
      for (let k = 0; k < 3; k++) {
        setTimeout(() => this.burst(x + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, z + (Math.random() - 0.5) * 2,
          0xffd93d, 14, 4, { grav: 3 }), k * 130);
      }
    }
  }

  /* 조합 성공 연출 (영웅 이상) — 결과 발판(없으면 광장)에서 */
  combineFlourish(padIndex, tier) {
    const x = padIndex >= 0 ? wx(D.PADS[padIndex].x) : 0;
    const z = padIndex >= 0 ? wz(D.PADS[padIndex].y) : 2.6;
    const col = new THREE.Color(D.TIERS[tier].color).getHex();
    this._lightPillar(x, z, tier);
    this._shockRing(x, z, 1.6 + tier * 0.6, col, 0.6);
    this._shockRing(x, z, 2.6 + tier * 0.6, 0xffffff, 0.8);
    this.burst(x, 1.0, z, col, 26 + tier * 12, 4 + tier, { grav: 3 });
    this.burst(x, 1.8, z, 0xffffff, 14, 2.6, { grav: 1 });
    this.addShake(tier === 3 ? 0.4 : 0.22);
  }

  /* 위로 솟는 빛기둥 (풀 없이 즉석 생성 후 자동 제거) */
  _lightPillar(x, z, tier) {
    const col = new THREE.Color(D.TIERS[tier].color);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 + tier * 0.12, 0.7 + tier * 0.15, 6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    mesh.position.set(x, 3, z);
    this.scene.add(mesh);
    if (!this.pillars) this.pillars = [];
    this.pillars.push({ mesh, ttl: 0.7, life: 0.7 });
  }
  _updatePillars(dt) {
    if (!this.pillars) return;
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i];
      p.ttl -= dt;
      const k = 1 - p.ttl / p.life;
      p.mesh.material.opacity = 0.55 * (1 - k);
      p.mesh.scale.set(1 + k * 0.8, 1 + k * 0.4, 1 + k * 0.8);
      p.mesh.rotation.y += dt * 3;
      if (p.ttl <= 0) { this.scene.remove(p.mesh); this.pillars.splice(i, 1); }
    }
  }

  /* 조합 성공 연출 (특수 직업 탄생 등) — 벤치라 위치가 없으니 화면 중앙에 */
  celebrate(color = 0xffd93d, big = false) {
    this.burst(0, 2.2, 2, color, big ? 40 : 20, big ? 5 : 3.4, { grav: 3 });
  }

  addShake(v) { this.shake = Math.min(0.8, this.shake + v); }

  /* ---------- 프레임 ---------- */
  frame(dt, state) {
    this.time += dt;
    const t = this.time;

    this.portal.rotation.z = t * 1.6;
    const ps = 1 + Math.sin(t * 3) * 0.08;
    this.portal.scale.set(ps, ps, ps);

    for (let i = 0; i < this.flags.length; i++) {
      this.flags[i].rotation.y = Math.sin(t * 4 + i * 2) * 0.28;
    }
    for (let i = 0; i < this.crystals.length; i++) {
      const c = this.crystals[i];
      if (!c.visible) continue;
      c.rotation.y = t * 2 + i;
      c.position.y = (4.6 + (i === 1 ? 0.5 : 0)) + Math.sin(t * 2.4 + i * 1.4) * 0.12;
    }

    for (const [id, v] of this.heroViews) {
      v.refs.body.scale.y = 1 + Math.sin(t * 2.6 + id) * 0.025;
      v.refs.head.position.y = 0.93 + Math.sin(t * 2.6 + id) * 0.012;
      if (v.refs.cape) v.refs.cape.rotation.x = 0.16 + Math.sin(t * 3 + id) * 0.09;
      if (v.refs.halo) v.refs.halo.rotation.z = t * 1.4;
      if (v.refs.wings) {
        v.refs.wings[0].rotation.y = 0.5 + Math.sin(t * 3 + id) * 0.22;
        v.refs.wings[1].rotation.y = -0.5 - Math.sin(t * 3 + id) * 0.22;
      }
      if (v.refs.flame && Math.random() < dt * 5) {
        this.burst(v.holder.position.x, 1.0, v.holder.position.z, 0xff8830, 1, 0.7, { grav: -1.4, ttl: 0.35, size: 0.45 });
      }
      let dy = v.targetFaceY - v.faceY;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      v.faceY += dy * Math.min(1, dt * 9);
      v.model.rotation.y = v.faceY;
      if (v.attackT > 0) {
        v.attackT = Math.max(0, v.attackT - dt * 3.4);
        const k = Math.sin((1 - v.attackT) * Math.PI);
        const C = D.CLASSES[v.cls];
        if (C.atk === 'melee') {
          v.refs.armPivot.rotation.x = -1.7 * k;
          if (v.cls === 'windblade') v.refs.armL.rotation.x = -1.7 * (1 - k) * (v.attackT > 0 ? 1 : 0);
        } else if (C.atk === 'arrow') {
          v.refs.armPivot.rotation.x = -1.1 * k;
          if (v.refs.bow) v.refs.bow.scale.x = 1 - 0.25 * k;
        } else {
          v.refs.armPivot.rotation.x = -2.1 * k;
        }
      } else {
        v.refs.armPivot.rotation.x *= 0.8;
        if (v.refs.armL.rotation) v.refs.armL.rotation.x *= 0.8;
      }
      if (v.legendGlow) {
        v.legendGlow.material.opacity = 0.35 + Math.sin(t * 4 + id) * 0.2;
        v.legendGlow.rotation.z = t * 1.2;
        if (Math.random() < dt * 2.2) {
          this.burst(v.holder.position.x, 0.4, v.holder.position.z, 0xffd93d, 1, 0.9, { grav: -0.8, ttl: 0.6, size: 0.5 });
        }
      }
      if (v.refs.staffOrb) {
        const os = 1 + Math.sin(t * 5 + id) * 0.18;
        v.refs.staffOrb.scale.setScalar(os);
      }
    }

    for (const [id, v] of this.enemyViews) {
      const bossHop = v.boss ? 4.2 : (v.midBoss ? 5.5 : 7);
      const hop = Math.abs(Math.sin(t * bossHop + id)) * (v.boss || v.midBoss ? 0.2 : 0.14);
      v.spr.position.y = v.baseScale * 0.62 + hop;
      /* 보스 발밑 기운이 회전·맥동 */
      if (v.group.userData.aura) {
        const a = v.group.userData.aura;
        a.rotation.z = t * (v.boss ? 1.6 : 1.1);
        const s = 1 + Math.sin(t * 3 + id) * 0.12;
        a.scale.set(s, s, s);
        a.material.opacity = (v.enraged ? 0.6 : 0.4) + Math.sin(t * 5 + id) * 0.15;
        if (v.enraged) a.material.color.setHex(0xff2200);
      }
      if (v.enraged && Math.random() < dt * 9) {
        this.burst(v.group.position.x, 0.8, v.group.position.z, 0xff3311, 1, 1.4, { grav: -2, ttl: 0.5, size: 0.8 });
      }
      /* 정지된 적: 제자리에서 부르르 떨고 파란 기운 */
      if (v.stunned) {
        v.spr.position.x = Math.sin(t * 40 + id) * 0.05;
        if (Math.random() < dt * 5) {
          this.burst(v.group.position.x, 1.2, v.group.position.z, 0x9fd0ff, 1, 0.8, { grav: -1, ttl: 0.4, size: 0.6 });
        }
      } else {
        v.spr.position.x = 0;
      }
      if (v.burning) {
        v.spr.material.color.setRGB(1, 0.72, 0.5);
        if (Math.random() < dt * 7) {
          this.burst(v.group.position.x, 0.7, v.group.position.z, 0xff8830, 1, 1.1, { grav: -2.2, ttl: 0.45, size: 0.6 });
        }
      } else if (v.stunned) {
        v.spr.material.color.setRGB(0.72, 0.86, 1);
      } else if (v.enraged) {
        v.spr.material.color.setRGB(1, 0.55, 0.5);
      } else if (v.slowed) {
        /* 감속: 더 진한 청색 + 발밑 서리 고리 + 눈발 */
        v.spr.material.color.setRGB(0.48, 0.74, 1);
        if (!v.frostRing) {
          const fr = new THREE.Mesh(
            new THREE.RingGeometry(v.baseScale * 0.34, v.baseScale * 0.5, 20),
            new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.8, depthWrite: false })
          );
          fr.rotation.x = -Math.PI / 2;
          fr.position.y = 0.07;
          v.group.add(fr);
          v.frostRing = fr;
        }
        v.frostRing.visible = true;
        v.frostRing.rotation.z = t * 1.4;
        v.frostRing.material.opacity = 0.55 + Math.sin(t * 6 + id) * 0.25;
        if (Math.random() < dt * 6) {
          this.burst(v.group.position.x, 0.5, v.group.position.z, 0x9fdcff, 1, 0.7, { grav: -1, ttl: 0.55, size: 0.6 });
        }
      } else {
        if (v.frostRing) v.frostRing.visible = false;
        v.spr.material.color.setRGB(1, 1, 1);
      }
    }

    for (const [, v] of this.projViews) {
      if (v.group.userData.pulse) {
        const s = 1 + Math.sin(t * 18) * 0.22;
        v.group.scale.set(s, s, s);
      }
    }

    if (state && this.castleHpRatio < 0.66 && Math.random() < dt * 5) {
      this.burst((Math.random() - 0.5) * 1.6, 3.4, -5.7, 0x8b8b95, 2, 0.8, { grav: -1.6, ttl: 1.1, size: 1.1 });
    }
    if (state && this.castleHpRatio < 0.33 && Math.random() < dt * 7) {
      this.burst((Math.random() - 0.5) * 2.4, 2.6, -5.5, 0xff7a30, 2, 1.4, { grav: -2.8, ttl: 0.7, size: 0.8 });
    }

    if (this.placementMode) {
      const op = 0.25 + Math.sin(t * 5) * 0.13;
      for (const hl of this.padHighlights) hl.material.opacity = op;
    }
    this.selRing.rotation.z = t * 1.5;

    const q = this.camera.quaternion;
    for (const [, v] of this.enemyViews) v.bar.quaternion.copy(q);

    this._updateParticles(dt);
    this._updateNumbers(dt);
    this._updateWaves(dt);
    this._updatePillars(dt);
    this._updateBossMood(dt);

    this.shake = Math.max(0, this.shake - dt * 1.7);
    const s2 = this.shake * this.shake;
    this.camera.position.set(
      this.camBase.x + Math.sin(t * 0.23) * 0.18 + (Math.random() - 0.5) * s2 * 2.2,
      this.camBase.y + Math.sin(t * 0.31) * 0.1 + (Math.random() - 0.5) * s2 * 1.4,
      this.camBase.z + (Math.random() - 0.5) * s2 * 2.2
    );
    this.camera.lookAt(0, 0, -0.6);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /* ---------- 입력 ---------- */
  _screenToLogical(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const pt = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, pt)) return null;
    return { x: pt.x / S + D.FIELD_W / 2, y: pt.z / S + D.FIELD_H / 2 };
  }

  screenToPad(clientX, clientY) {
    const p = this._screenToLogical(clientX, clientY);
    if (!p) return null;
    let best = null, bd = Infinity;
    for (let i = 0; i < D.PADS.length; i++) {
      const d = Math.hypot(D.PADS[i].x - p.x, D.PADS[i].y - p.y);
      if (d < bd) { bd = d; best = i; }
    }
    return bd <= D.PAD_RADIUS * 1.5 ? best : null;
  }

  setHover(padIndex) {
    this.hoverPad = padIndex;
    if (padIndex == null) { this.hoverRing.visible = false; return; }
    const pad = D.PADS[padIndex];
    this.hoverRing.visible = true;
    this.hoverRing.position.set(wx(pad.x), 0.15, wz(pad.y));
  }

  setPlacementMode(on, rangePx = 0, swap = false) {
    this.placementMode = on;
    this.placeRange = rangePx;
    this.swapMode = !!swap;      // 배치된 용사 자리도 후보(= 자리 교환 가능)
  }
  setSelectedHero(id) { this.selectedHeroId = id; }

  dispose() {
    this.ro.disconnect();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
