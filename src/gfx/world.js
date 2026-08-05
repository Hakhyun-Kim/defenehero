/* =====================================================
 * 지형과 성 — Renderer3D에 프로토타입 믹스인으로 붙는다.
 * (this = Renderer3D 인스턴스. 만든 메시 참조를 this에 걸어 두면
 *  sync/frame이 강화 단계·체력에 따라 켜고 끄고 색칠한다)
 * ===================================================== */
import * as THREE from 'three';
import * as D from '../data.js';
import { S, wx, wz, lam, grassTexture, roadTexture, stoneTexture } from './common.js';
import { SHORE_Z } from './nature.js';

export const worldMethods = {
  /* 잔디 → 모래 경계선.
   * 평면 모서리를 그대로 쓰면 성 뒤에 자로 그은 직선이 깔려 단번에 가짜로 보인다.
   * 바다의 물가 선과 같은 수법으로 푼다: 월드 x 로 노이즈를 뽑아 경계를 흔들고,
   * 선 너머 픽셀은 discard 해서 밑에 깔린 모래(y=-0.34)가 드러나게 한다.
   * discard 는 블렌딩이 아니라서 투명 정렬 문제도, 그림자 문제도 안 생긴다. */
  _grassShoreEdge(mat) {
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vShoreW;')
        .replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvShoreW = (modelMatrix * vec4(position, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */`#include <common>
varying vec2 vShoreW;
float shoreHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float shoreNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(shoreHash(i), shoreHash(i + vec2(1, 0)), f.x),
             mix(shoreHash(i + vec2(0, 1)), shoreHash(i + vec2(1, 1)), f.x), f.y);
}`)
        .replace('#include <map_fragment>', /* glsl */`
/* 큰 굽이 + 잔 톱니 두 옥타브. 바다 쪽(-)으로는 혀처럼 길게 뻗고 뭍 쪽(+)은
 * 짧게만 문다 — 뭍 쪽으로 너무 파이면 물가 잔디잎(z ≥ SHORE_Z+0.8)이
 * 모래 위에 뜬 채 남는다. 진폭: 바다 쪽 -1.35 / 뭍 쪽 +0.74 */
float shoreW = (shoreNoise(vec2(vShoreW.x * 0.33, 3.0)) - 0.5) * 2.0
             + (shoreNoise(vec2(vShoreW.x * 1.31, 17.0)) - 0.5) * 0.7;
shoreW *= shoreW > 0.0 ? 0.55 : 1.0;
float shoreEdge = ${(SHORE_Z - 0.15).toFixed(2)} + shoreW;
if (vShoreW.y < shoreEdge) discard;
#include <map_fragment>
/* 잔디(y=-0.08)와 모래(y=-0.34) 사이 단차에는 옆면이 없다 — 끝단을 살짝
 * 어둡게 눌러 얕은 턱의 그림자처럼 보이게 한다 */
diffuseColor.rgb *= 1.0 - 0.26 * (1.0 - smoothstep(0.0, 0.8, vShoreW.y - shoreEdge));`);
    };
  },

  /* ---------- 지형: 잔디 + 세 갈래 길 + 발판 ---------- */
  _buildTerrain() {
    /* 땅은 물가(SHORE_Z)에서 끝난다 — 그 너머는 바다(nature.js).
     * 바다를 안 만드는 모드에서는 땅이 그대로 화면 끝까지 이어져야 한다.
     * 안 그러면 성 뒤에 배경색이 뚫린 구멍이 생긴다. */
    /* 장식 모드에서는 평면을 물가 너머까지 깔아 둔다 — 실제 끝단은 셰이더가
     * 노이즈 곡선으로 잘라 내므로(_grassShoreEdge), 기하는 곡선이 가장 깊이
     * 파고드는 곳(-1.35)보다 더 바다 쪽까지 나가 있어야 한다. */
    const farZ = this.decor ? SHORE_Z - 2.6 : -20;
    const landDepth = 20 - farZ;
    const groundMat = new THREE.MeshLambertMaterial({ map: grassTexture(), color: 0xd2e3c2 });
    if (this.decor) this._grassShoreEdge(groundMat);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(74, landDepth), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.08, farZ + landDepth / 2);
    ground.receiveShadow = true;
    this.ground = ground;
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
  },

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

    /* ---- 성 강화가 눈에 보이게 ----
     * 띠 몇 줄로는 "내 성이 자랐다"가 안 느껴진다. 부품을 미리 만들어 두고
     * 레벨에 따라 visible만 켠다(런타임 지오메트리 생성 금지 규칙 유지). */

    /* 강화 2: 흉벽 톱니가 늘어난다 */
    this.extraMerlons = [];
    for (const dx of [-6.9, 6.9, -6.2, 6.2]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.72), stone(0xb2b8cc));
      c.position.set(dx, 2.0, -4.35);
      c.visible = false;
      this.extraMerlons.push(c);
      g.add(c);
    }
    /* 강화 3: 성벽 앞 방어 말뚝 */
    this.spikes = [];
    for (let k = 0; k < 11; k++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.62, 5), lam(0x6b4c2a));
      sp.position.set(-6.5 + k * 1.3, 0.31, -3.55);
      sp.rotation.z = (k % 2 ? 0.16 : -0.16);
      sp.visible = false;
      this.spikes.push(sp);
      g.add(sp);
    }
    /* 강화 4: 성문이 강철문으로 */
    this.steelGate = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.22, 0.34), stone(0x6a7590));
    this.steelGate.position.set(0, 0.82, -4.02);
    this.steelGate.visible = false;
    g.add(this.steelGate);
    this.gate = gate;
    /* 강화 5: 성벽이 밝은 대리석으로 (재질 색만 바꾼다) */
    this.wallBaseColor = this.wall.material.color.clone();

    /* 마법 포탑 — 크리스털만 뜨던 것을 실제 탑으로 */
    this.towerPillars = [];
    for (let k = 0; k < 3; k++) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.5, 7), stone(0x8f97b0));
      pil.position.set((k - 1) * 1.4, 3.55, -5.6);
      pil.visible = false;
      this.towerPillars.push(pil);
      g.add(pil);
    }
    this.towerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.06, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.75 })
    );
    this.towerRing.rotation.x = -Math.PI / 2;
    this.towerRing.position.set(0, 4.9, -5.6);
    this.towerRing.visible = false;
    g.add(this.towerRing);

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.castle = g;
    this.scene.add(g);
  },
};
