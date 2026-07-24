/* =====================================================
 * 3D 렌더러 (Three.js)
 * 엔진의 논리 좌표(x: 0~700, y: 0~408)를 3D 월드로 투영한다.
 * 외부 에셋 0개: 모든 지형/성/이펙트는 코드로 생성.
 * ===================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import * as D from './data.js';

const S = 1 / 36;                                    // 논리px → 월드 유닛
const wx = (x) => (x - D.FIELD_W / 2) * S;
const wz = (y) => (y - D.FIELD_H / 2) * S;

/* ---------- 이모지 텍스처 캐시 ---------- */
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

/* ---------- 블롭 그림자 텍스처 ---------- */
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

/* ---------- 레벨 배지 텍스처 ---------- */
const lvCache = new Map();
function levelTexture(level) {
  if (lvCache.has(level)) return lvCache.get(level);
  const c = document.createElement('canvas');
  c.width = 96; c.height = 48;
  const g = c.getContext('2d');
  g.font = 'bold 30px "Segoe UI", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.65)';
  g.strokeText(`Lv${level}`, 48, 26);
  g.fillStyle = '#ffd93d';
  g.fillText(`Lv${level}`, 48, 26);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  lvCache.set(level, t);
  return t;
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
      preserveDrawingBuffer: !!opts.preserve,   // 자동화/숨김 탭 캡처용
    });
    r.setPixelRatio(this._targetDpr());
    r.setClearColor(0xbfe3ff);
    container.appendChild(r.domElement);
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe9ff, 20, 46);

    this.camera = new THREE.PerspectiveCamera(46, 16 / 10, 0.1, 120);
    this.camBase = new THREE.Vector3(0.4, 12.8, 11.8);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0.4, 0, 0.4);

    /* 조명 */
    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x5d8742, 1.05));
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
    sun.position.set(7, 12, 5);
    this.scene.add(sun);

    this._buildTerrain();
    this._buildCastle();
    this._buildPortals();
    this._buildHighlights();
    this._buildParticles();
    this._buildDamageNumbers();

    /* 엔티티 뷰 */
    this.heroViews = new Map();
    this.enemyViews = new Map();
    this.projViews = new Map();
    this.placementMode = false;
    this.selectedHeroId = null;
    this.hoverCell = null;

    /* 후처리 (블룸) */
    this._setupComposer();

    /* 리사이즈 */
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
    return 0.6;                                  // min: 초저사양/소프트웨어 렌더링
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

  /* ---------- 지형 ---------- */
  _buildTerrain() {
    /* 넓은 바깥 잔디 */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 50),
      new THREE.MeshLambertMaterial({ color: 0x67a94a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    this.scene.add(ground);

    /* 격자 셀 (인스턴스) */
    const geo = new THREE.BoxGeometry(1.86, 0.14, 1.86);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const cells = new THREE.InstancedMesh(geo, mat, D.COLS * D.ROWS);
    const m = new THREE.Matrix4();
    const cA = new THREE.Color(0x8fd45e), cB = new THREE.Color(0x7fc44f);
    let i = 0;
    for (let row = 0; row < D.ROWS; row++) {
      for (let col = 0; col < D.COLS; col++) {
        m.setPosition(wx(D.GRID_X + col * D.CELL + D.CELL / 2), 0, wz(D.GRID_Y + row * D.CELL + D.CELL / 2));
        cells.setMatrixAt(i, m);
        cells.setColorAt(i, (row + col) % 2 === 0 ? cA : cB);
        i++;
      }
    }
    cells.instanceColor.needsUpdate = true;
    this.scene.add(cells);

    /* 몬스터 행진로 (격자 오른쪽 → 스폰 지점) */
    const laneMat = new THREE.MeshLambertMaterial({ color: 0x86a852 });
    const gridRight = D.GRID_X + D.COLS * D.CELL;
    const laneLen = (D.FIELD_W + 60 - gridRight) * S;
    for (let row = 0; row < D.ROWS; row++) {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(laneLen, 1.3), laneMat);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(wx(gridRight) + laneLen / 2, -0.02, wz(D.GRID_Y + row * D.CELL + D.CELL / 2));
      this.scene.add(lane);
    }

    /* 장식: 나무/바위 */
    const treeTrunk = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
    const treeLeaf = new THREE.MeshLambertMaterial({ color: 0x3f8f3f });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
    const rnd = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    for (let k = 0; k < 14; k++) {
      const behind = rnd() < 0.65;
      const x = -10 + rnd() * 22;
      const z = behind ? -(7.2 + rnd() * 3.5) : (7.2 + rnd() * 3);
      if (rnd() < 0.7) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5), treeTrunk);
        trunk.position.y = 0.25;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55 + rnd() * 0.3, 1.2 + rnd() * 0.5, 7), treeLeaf);
        leaf.position.y = 1.1;
        g.add(trunk, leaf);
        g.position.set(x, 0, z);
        this.scene.add(g);
      } else {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + rnd() * 0.2), rockMat);
        rock.position.set(x, 0.12, z);
        rock.rotation.set(rnd() * 3, rnd() * 3, 0);
        this.scene.add(rock);
      }
    }
  }

  /* ---------- 성 (왼쪽) ---------- */
  _buildCastle() {
    const g = new THREE.Group();
    this.castleStoneMats = [];
    const stone = (color) => {
      const m = new THREE.MeshLambertMaterial({ color });
      m.userData.baseColor = new THREE.Color(color);
      this.castleStoneMats.push(m);
      return m;
    };
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xe05252 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd76e });

    /* 받침 */
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 12.6), stone(0x8d94aa));
    base.position.set(-8.35, 0.25, 0);
    g.add(base);

    /* 성벽 + 요철 */
    this.wall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 12.2), stone(0xa3aabf));
    this.wall.position.set(-6.95, 1.05, 0);
    g.add(this.wall);
    this.crenels = [];
    for (let k = 0; k < 9; k++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.62), stone(0xb2b8cc));
      c.position.set(-6.95, 2.0, -5.4 + k * 1.35);
      g.add(c);
      this.crenels.push(c);
    }
    /* 성문 */
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 1.5), new THREE.MeshLambertMaterial({ color: 0x4a3826 }));
    gate.position.set(-6.55, 0.8, 0);
    g.add(gate);

    /* 본성 */
    const keep = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.7, 2.7), stone(0x9ba2b8));
    keep.position.set(-8.6, 1.6, 0);
    g.add(keep);
    const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.4, 4), roofMat);
    keepRoof.rotation.y = Math.PI / 4;
    keepRoof.position.set(-8.6, 3.65, 0);
    g.add(keepRoof);
    /* 창문 (발광 → 블룸) */
    for (const dz of [-0.6, 0.6]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.3), glowMat);
      win.position.set(-7.52, 1.9, dz);
      g.add(win);
    }

    /* 좌우 탑 + 깃발 */
    this.flags = [];
    for (const dz of [-4.7, 4.7]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.88, 3.1, 8), stone(0x99a0b6));
      tower.position.set(-8.3, 1.55, dz);
      g.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.25, 8), roofMat);
      roof.position.set(-8.3, 3.72, dz);
      g.add(roof);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0), new THREE.MeshLambertMaterial({ color: 0x6b4c2a }));
      pole.position.set(-8.3, 4.8, dz);
      g.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xffc93d, side: THREE.DoubleSide })
      );
      flag.position.set(-8.3 + 0.34, 5.05, dz);
      flag.geometry.translate(0.31, 0, 0);
      this.flags.push(flag);
      g.add(flag);
    }

    /* 마법 포탑 수정 (업그레이드 시 표시) */
    this.crystals = [];
    for (let k = 0; k < 3; k++) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3),
        new THREE.MeshBasicMaterial({ color: 0x7ff3ff })
      );
      crystal.position.set(-8.6 + (k - 1) * 0.9, 4.6 + (k === 1 ? 0.5 : 0), k === 1 ? 0 : (k === 0 ? -1.4 : 1.4));
      crystal.visible = false;
      this.crystals.push(crystal);
      g.add(crystal);
    }

    /* 강화 시 금색 띠 */
    this.fortifyBands = [];
    for (let k = 0; k < 5; k++) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.08, 12.3),
        new THREE.MeshBasicMaterial({ color: 0xffd76e })
      );
      band.position.set(-6.95, 0.42 + k * 0.3, 0);
      band.visible = false;
      this.fortifyBands.push(band);
      g.add(band);
    }

    this.castle = g;
    this.scene.add(g);
  }

  /* ---------- 스폰 포탈 ---------- */
  _buildPortals() {
    this.portals = [];
    const mat = new THREE.MeshBasicMaterial({ color: 0xc478f0 });
    for (let row = 0; row < D.ROWS; row++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.075, 10, 24), mat);
      ring.position.set(wx(D.FIELD_W + 26), 0.85, wz(D.GRID_Y + row * D.CELL + D.CELL / 2));
      ring.rotation.y = Math.PI / 2;
      this.portals.push(ring);
      this.scene.add(ring);
    }
  }

  /* ---------- 배치 하이라이트 ---------- */
  _buildHighlights() {
    this.highlights = [];
    const geo = new THREE.PlaneGeometry(1.8, 1.8);
    for (let row = 0; row < D.ROWS; row++) {
      for (let col = 0; col < D.COLS; col++) {
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0x3ddc6e, transparent: true, opacity: 0.3, depthWrite: false,
        }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(wx(D.GRID_X + col * D.CELL + D.CELL / 2), 0.1, wz(D.GRID_Y + row * D.CELL + D.CELL / 2));
        mesh.visible = false;
        mesh.userData = { row, col };
        this.highlights.push(mesh);
        this.scene.add(mesh);
      }
    }
    /* 호버 표시 */
    this.hoverMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })
    );
    this.hoverMesh.rotation.x = -Math.PI / 2;
    this.hoverMesh.visible = false;
    this.scene.add(this.hoverMesh);
    /* 선택 링 */
    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.0, 28),
      new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0.9, depthWrite: false })
    );
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.visible = false;
    this.scene.add(this.selRing);
  }

  /* ---------- 파티클 풀 ---------- */
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

  /* ---------- 데미지 숫자 풀 ---------- */
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
    g.font = `bold ${Math.round(52 * Math.min(scale, 1.35))}px "Segoe UI", "Segoe UI Emoji", sans-serif`;
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

  /* ---------- 엔티티 뷰 생성 ---------- */
  _makeUnitView(emoji, scale, ringColor, barColor, barW = 1.2) {
    const g = new THREE.Group();

    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(emoji), transparent: true }));
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

    let ring = null;
    if (ringColor != null) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(scale * 0.42, scale * 0.52, 24),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.95, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      g.add(ring);
    }

    /* 체력바 (빌보드 그룹) */
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(barW, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x1c2333, transparent: true, opacity: 0.75, depthTest: false })
    );
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(barW, 0.11),
      new THREE.MeshBasicMaterial({ color: barColor, depthTest: false })
    );
    fg.position.z = 0.001;
    bg.renderOrder = 40; fg.renderOrder = 41;
    bar.add(bg, fg);
    bar.position.y = scale * 1.32;
    bar.visible = false;
    g.add(bar);

    this.scene.add(g);
    return { group: g, spr, ring, bar, barFg: fg, barW, baseScale: scale, hurtT: 0, flashT: 0 };
  }

  _removeView(v) {
    this.scene.remove(v.group);
  }

  /* ---------- 상태 동기화 ---------- */
  sync(state) {
    /* 용사 */
    const fieldIds = new Set();
    for (const h of state.field) {
      fieldIds.add(h.id);
      let v = this.heroViews.get(h.id);
      if (!v) {
        const C = D.CLASSES[h.cls];
        v = this._makeUnitView(C.emoji, 1.7, D.TIERS[h.tier].color, 0x4ade80);
        v.tier = h.tier;
        if (h.tier === 3) {
          const glow = new THREE.Mesh(
            new THREE.RingGeometry(0.78, 0.95, 26),
            new THREE.MeshBasicMaterial({ color: 0xffc93d, transparent: true, opacity: 0.5, depthWrite: false })
          );
          glow.rotation.x = -Math.PI / 2;
          glow.position.y = 0.055;
          v.group.add(glow);
          v.legendGlow = glow;
        }
        /* 레벨 배지 */
        const lv = new THREE.Sprite(new THREE.SpriteMaterial({ map: levelTexture(h.level), transparent: true, depthTest: false }));
        lv.scale.set(0.85, 0.42, 1);
        lv.position.set(0.72, 2.0, 0);
        lv.renderOrder = 42;
        lv.visible = h.level > 1;
        v.group.add(lv);
        v.lvSprite = lv;
        v.level = h.level;
        this.heroViews.set(h.id, v);
      }
      if (v.level !== h.level) {
        v.level = h.level;
        v.lvSprite.material.map = levelTexture(h.level);
        v.lvSprite.visible = h.level > 1;
      }
      v.group.position.set(wx(h.x), 0, wz(h.y));
      const ratio = Math.max(0, h.hp / h.maxHp);
      v.bar.visible = ratio < 1;
      v.barFg.scale.x = Math.max(0.001, ratio);
      v.barFg.position.x = -(1 - ratio) * v.barW / 2;
    }
    for (const [id, v] of this.heroViews) {
      if (!fieldIds.has(id)) { this._removeView(v); this.heroViews.delete(id); }
    }

    /* 몬스터 */
    const enemyIds = new Set();
    for (const e of state.enemies) {
      enemyIds.add(e.id);
      let v = this.enemyViews.get(e.id);
      if (!v) {
        const E = D.ENEMY_TYPES[e.type];
        const sc = (e.size / 30) * 1.55;
        v = this._makeUnitView(E.emoji, sc, e.boss ? 0xff4444 : null, e.boss ? 0xc084fc : 0xf87171, e.boss ? 2.1 : 1.1);
        v.boss = e.boss;
        this.enemyViews.set(e.id, v);
      }
      v.group.position.set(wx(e.x), 0, wz(e.y));
      const ratio = Math.max(0, e.hp / e.maxHp);
      v.bar.visible = ratio < 1;
      v.barFg.scale.x = Math.max(0.001, ratio);
      v.barFg.position.x = -(1 - ratio) * v.barW / 2;
      v.burning = !!e.burn;
      v.id = e.id;
    }
    for (const [id, v] of this.enemyViews) {
      if (!enemyIds.has(id)) { this._removeView(v); this.enemyViews.delete(id); }
    }

    /* 투사체 */
    const projIds = new Set();
    for (const p of state.projectiles) {
      projIds.add(p.id);
      let v = this.projViews.get(p.id);
      if (!v) {
        v = this._makeProjView(p);
        this.projViews.set(p.id, v);
      }
      const y3 = p.kind === 'bolt' ? 1.6 : 0.95;
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

    /* 성 상태 */
    for (let k = 0; k < this.crystals.length; k++) this.crystals[k].visible = k < state.castle.tower;
    for (let k = 0; k < this.fortifyBands.length; k++) this.fortifyBands[k].visible = k < state.castle.fortify;
    const hpRatio = state.castleMax > 0 ? state.castleHp / state.castleMax : 1;
    this.castleHpRatio = hpRatio;
    /* 체력이 낮을수록 성이 그을린다 */
    const char = new THREE.Color(0x554f5e);
    for (const m of this.castleStoneMats) {
      m.color.copy(m.userData.baseColor).lerp(char, (1 - hpRatio) * 0.55);
    }

    /* 배치 하이라이트 */
    if (this.placementMode) {
      const occupied = new Set(state.field.map(h => h.row * 100 + h.col));
      for (const hmesh of this.highlights) {
        hmesh.visible = !occupied.has(hmesh.userData.row * 100 + hmesh.userData.col);
      }
    } else {
      for (const hmesh of this.highlights) hmesh.visible = false;
    }

    /* 선택 링 */
    if (this.selectedHeroId != null) {
      const h = state.field.find(v => v.id === this.selectedHeroId);
      if (h) {
        this.selRing.visible = true;
        this.selRing.position.set(wx(h.x), 0.08, wz(h.y));
      } else this.selRing.visible = false;
    } else this.selRing.visible = false;
  }

  _makeProjView(p) {
    const g = new THREE.Group();
    if (p.kind === 'arrow') {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x8a5a2b }));
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }));
      head.rotation.z = -Math.PI / 2;
      head.position.x = 0.36;
      g.add(shaft, head);
    } else if (p.kind === 'orb') {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd08bff }));
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
  onEvents(state, events) {
    for (const ev of events) {
      const x3 = ev.x != null ? wx(ev.x) : 0;
      const z3 = ev.y != null ? wz(ev.y) : 0;
      switch (ev.type) {
        case 'enemyHit': {
          if (ev.kind === 'burn') {
            if (Math.random() < 0.4) this.showNumber(x3, 1.7, z3, `${ev.dmg}`, '#ff9a3d', 0.72);
          } else if (ev.kind === 'thorns') {
            this.showNumber(x3, 1.8, z3, `${ev.dmg}`, '#8dff5a', 0.8);
          } else {
            this.showNumber(x3, 1.8, z3, `${ev.dmg}`, '#ffffff', ev.dmg >= 100 ? 1.15 : 0.85);
          }
          break;
        }
        case 'kill': {
          const col = ev.boss ? 0xffd93d : ({ goblin: 0x7fd45e, wolf: 0x9aa7ba, orc: 0xd46e5e, troll: 0x5ea7d4, shaman: 0xb08bff }[ev.etype] || 0xffffff);
          this.burst(x3, 0.9, z3, col, ev.boss ? 46 : 12, ev.boss ? 6 : 3.2);
          this.showNumber(x3, 2.2, z3, `+${ev.gold}💰`, '#ffd93d', ev.boss ? 1.3 : 0.9);
          if (ev.mul > 1) this.showNumber(x3, 2.9, z3, `콤보 x${ev.mul}!`, '#ff8a3d', 1.1);
          this.addShake(ev.boss ? 0.5 : 0.07);
          break;
        }
        case 'meleeHit':
          if (ev.cleave) {
            this.burst(x3, 0.8, z3, 0xffffff, 18, 4.5, { grav: 2, ttl: 0.3 });
            this.addShake(0.12);
          } else {
            this.burst(x3, 0.9, z3, 0xffffff, 4, 2.6, { grav: 3, ttl: 0.22 });
          }
          break;
        case 'explode':
          this.burst(x3, 0.9, z3, 0xffa040, ev.big ? 26 : 14, ev.big ? 4.6 : 3.4);
          if (ev.big) this.burst(x3, 0.9, z3, 0xff5533, 10, 2.6);
          this.addShake(ev.big ? 0.2 : 0.1);
          break;
        case 'boltHit':
          this.burst(x3, 1.1, z3, 0x8df3ff, 8, 3);
          break;
        case 'pierceHit':
          this.burst(x3, 1.0, z3, 0xffffff, 5, 3.4, { grav: 2 });
          break;
        case 'thorns':
          this.burst(x3, 0.9, z3, 0x8dff5a, 6, 2.8, { grav: 3 });
          break;
        case 'heroHurt': {
          this.showNumber(x3, 1.9, z3, `-${ev.dmg}`, '#ff8080', 0.8);
          const v = this.heroViews.get(ev.heroId);
          if (v) v.hurtT = 0.25;
          break;
        }
        case 'heroDead':
          this.burst(x3, 0.9, z3, 0x666677, 16, 3);
          this.showNumber(x3, 1.8, z3, '💀', '#ffffff', 1.1);
          this.addShake(0.15);
          break;
        case 'castleHit':
          this.burst(-6.6, 1.2, ev.y != null ? wz(ev.y) : 0, 0xff5544, 20, 4);
          this.burst(-6.7, 1.6, ev.y != null ? wz(ev.y) : 0, 0x9aa2b8, 10, 3);
          this.showNumber(-6.2, 2.4, ev.y != null ? wz(ev.y) : 0, `-${ev.dmg}`, '#ff4444', 1.25);
          this.addShake(0.42);
          break;
        case 'heal':
          this.burst(x3, 1.3, z3, 0x6effa0, 7, 1.6, { grav: -1.5, ttl: 0.5 });
          break;
        case 'spawn':
          this.burst(x3, 0.9, z3, 0xc478f0, ev.boss ? 30 : 6, ev.boss ? 5 : 2.2);
          if (ev.boss) this.addShake(0.5);
          break;
        case 'waveEnd':
          for (let k = 0; k < 5; k++) {
            this.burst((Math.random() - 0.5) * 10, 3 + Math.random() * 2, (Math.random() - 0.5) * 8,
              [0xffd93d, 0x7fd45e, 0x6eb5ff, 0xff8ac2][k % 4], 12, 3, { grav: 3 });
          }
          break;
        case 'gameOver':
          this.addShake(0.8);
          this.burst(-7.5, 1.5, 0, 0xff5533, 60, 6);
          break;
      }
    }
  }

  addShake(v) { this.shake = Math.min(0.8, this.shake + v); }

  /* ---------- 프레임 ---------- */
  frame(dt, state) {
    this.time += dt;
    const t = this.time;

    /* 포탈 회전/맥동 */
    for (const p of this.portals) {
      p.rotation.x = t * 1.6;
      const s = 1 + Math.sin(t * 3 + p.position.z) * 0.08;
      p.scale.set(s, s, s);
    }
    /* 깃발 펄럭임 */
    for (let i = 0; i < this.flags.length; i++) {
      this.flags[i].rotation.y = Math.sin(t * 4 + i * 2) * 0.28;
    }
    /* 포탑 수정 */
    for (let i = 0; i < this.crystals.length; i++) {
      const c = this.crystals[i];
      if (!c.visible) continue;
      c.rotation.y = t * 2 + i;
      c.position.y = (4.6 + (i === 1 ? 0.5 : 0)) + Math.sin(t * 2.4 + i * 1.4) * 0.12;
    }
    /* 용사 애니메이션 */
    for (const [id, v] of this.heroViews) {
      const bob = Math.sin(t * 3 + id) * 0.05;
      v.spr.position.y = v.baseScale * 0.62 + bob;
      if (v.hurtT > 0) {
        v.hurtT -= dt;
        v.spr.material.color.setRGB(1, 0.5 + v.hurtT, 0.5 + v.hurtT);
      } else {
        v.spr.material.color.setRGB(1, 1, 1);
      }
      if (v.legendGlow) {
        v.legendGlow.material.opacity = 0.35 + Math.sin(t * 4 + id) * 0.2;
        v.legendGlow.rotation.z = t * 1.2;
        if (Math.random() < dt * 2.2) {
          this.burst(v.group.position.x, 0.4, v.group.position.z, 0xffd93d, 1, 0.9, { grav: -0.8, ttl: 0.6, size: 0.5 });
        }
      }
    }
    /* 몬스터 애니메이션 */
    for (const [id, v] of this.enemyViews) {
      const hop = Math.abs(Math.sin(t * 7 + id)) * 0.14;
      v.spr.position.y = v.baseScale * 0.62 + hop;
      if (v.burning) {
        v.spr.material.color.setRGB(1, 0.72, 0.5);
        if (Math.random() < dt * 7) {
          this.burst(v.group.position.x, 0.7, v.group.position.z, 0xff8830, 1, 1.1, { grav: -2.2, ttl: 0.45, size: 0.6 });
        }
      } else {
        v.spr.material.color.setRGB(1, 1, 1);
      }
    }
    /* 투사체 맥동 */
    for (const [, v] of this.projViews) {
      if (v.group.userData.pulse) {
        const s = 1 + Math.sin(t * 18) * 0.22;
        v.group.scale.set(s, s, s);
      }
    }
    /* 성: 손상 연기/불 */
    if (state && this.castleHpRatio < 0.66 && Math.random() < dt * 5) {
      this.burst(-8.5 + Math.random(), 3.4, (Math.random() - 0.5) * 2, 0x8b8b95, 2, 0.8, { grav: -1.6, ttl: 1.1, size: 1.1 });
    }
    if (state && this.castleHpRatio < 0.33 && Math.random() < dt * 7) {
      this.burst(-8.3 + Math.random() * 0.8, 2.6, (Math.random() - 0.5) * 3, 0xff7a30, 2, 1.4, { grav: -2.8, ttl: 0.7, size: 0.8 });
    }
    /* 하이라이트 맥동 */
    if (this.placementMode) {
      const op = 0.22 + Math.sin(t * 5) * 0.12;
      for (const hmesh of this.highlights) hmesh.material.opacity = op;
    }
    this.selRing.rotation.z = t * 1.5;

    /* 체력바 빌보드 */
    const q = this.camera.quaternion;
    for (const [, v] of this.heroViews) v.bar.quaternion.copy(q);
    for (const [, v] of this.enemyViews) v.bar.quaternion.copy(q);

    this._updateParticles(dt);
    this._updateNumbers(dt);

    /* 카메라: 흔들림(제곱 감쇠) + 미세한 흐름 */
    this.shake = Math.max(0, this.shake - dt * 1.7);
    const s2 = this.shake * this.shake;
    this.camera.position.set(
      this.camBase.x + Math.sin(t * 0.23) * 0.18 + (Math.random() - 0.5) * s2 * 2.2,
      this.camBase.y + Math.sin(t * 0.31) * 0.1 + (Math.random() - 0.5) * s2 * 1.4,
      this.camBase.z + (Math.random() - 0.5) * s2 * 2.2
    );
    this.camera.lookAt(0.4, 0, 0.4);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /* ---------- 입력 지원 ---------- */
  screenToCell(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const pt = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, pt)) return null;
    const lx = pt.x / S + D.FIELD_W / 2;
    const ly = pt.z / S + D.FIELD_H / 2;
    const col = Math.floor((lx - D.GRID_X) / D.CELL);
    const row = Math.floor((ly - D.GRID_Y) / D.CELL);
    if (col < 0 || col >= D.COLS || row < 0 || row >= D.ROWS) return null;
    return { row, col };
  }

  setHover(cell) {
    if (!cell) { this.hoverMesh.visible = false; return; }
    this.hoverMesh.visible = true;
    this.hoverMesh.position.set(
      wx(D.GRID_X + cell.col * D.CELL + D.CELL / 2), 0.12,
      wz(D.GRID_Y + cell.row * D.CELL + D.CELL / 2)
    );
  }

  setPlacementMode(on) { this.placementMode = on; }
  setSelectedHero(id) { this.selectedHeroId = id; }

  dispose() {
    this.ro.disconnect();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
