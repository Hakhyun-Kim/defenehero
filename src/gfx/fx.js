/* =====================================================
 * 시각 효과 — Renderer3D에 프로토타입 믹스인으로 붙는다.
 * 파티클 · 데미지 숫자 · 말풍선 · 별똥별 · 충격파 링 · 빛기둥 · 연출 묶음.
 * 전부 풀(pool)을 돌려 쓴다 — 런타임 지오메트리 생성 금지 규칙.
 * ===================================================== */
import * as THREE from 'three';
import * as D from '../data.js';
import { wx, wz, glowTexture } from './common.js';

export const fxMethods = {
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
  },

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
  },

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
  },

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
  },

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
  },

  _updateNumbers(dt) {
    for (const s of this.dmgPool) {
      if (s.ttl <= 0) continue;
      s.ttl -= dt;
      s.spr.position.y += s.vy * dt;
      s.spr.material.opacity = Math.min(1, s.ttl / (s.life * 0.6));
      if (s.ttl <= 0) s.spr.visible = false;
    }
  },

  /* ---------- 말풍선 (별지기의 수다) ---------- */
  _buildBubbles() {
    this.bubbles = [];
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 128;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      spr.scale.set(4.0, 1.0, 1);
      spr.center.set(0.5, 0);            // 아래가 기준 — 머리 위에 뜬다
      spr.visible = false;
      spr.renderOrder = 60;
      this.scene.add(spr);
      this.bubbles.push({ spr, tex, c, ttl: 0, life: 1 });
    }
  },

  /* lx/ly = 논리 좌표. 같은 위치에 겹치지 않게 슬롯을 돌려 쓴다.
   * 밝은 대낮 화면 위에 흰 상자를 띄우면 묻힌다 — 토스트처럼 어두운 바탕 + 흰 글씨로,
   * 어느 시간대·어느 배경에서도 읽히게 한다. */
  showBubble(lx, ly, text, ttl = 2.4) {
    this.showBubbleAt(wx(lx), wz(ly), text, ttl);
  },

  /* 월드 좌표판 — 뷰(용사 홀더)는 이미 월드 좌표라 논리 좌표로 되돌릴 길이 없다 */
  showBubbleAt(x3, z3, text, ttl = 2.4) {
    if (!this.bubbles) this._buildBubbles();
    const slot = this.bubbles.find(b => b.ttl <= 0) || this.bubbles[0];
    const g = slot.c.getContext('2d');
    g.clearRect(0, 0, 512, 128);
    g.font = '700 42px Jua, "Segoe UI", "Segoe UI Emoji", sans-serif';
    const w = Math.min(494, g.measureText(text).width + 52);
    const x0 = (512 - w) / 2;
    /* 둥근 상자 + 꼬리 */
    const r = 22, y0 = 6, h = 84;
    g.beginPath();
    g.moveTo(x0 + r, y0);
    g.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
    g.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    g.arcTo(x0, y0 + h, x0, y0, r);
    g.arcTo(x0, y0, x0 + w, y0, r);
    g.closePath();
    g.fillStyle = 'rgba(24, 29, 47, 0.92)';
    g.strokeStyle = 'rgba(255, 226, 122, 0.95)';
    g.lineWidth = 5;
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(240, y0 + h + 1);
    g.lineTo(272, y0 + h + 1);
    g.lineTo(256, y0 + h + 27);
    g.closePath();
    g.fillStyle = 'rgba(24, 29, 47, 0.92)';
    g.fill();
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, y0 + h / 2 + 2, w - 36);
    slot.tex.needsUpdate = true;
    slot.spr.position.set(x3, 2.05, z3);
    slot.ttl = slot.life = ttl;
    slot.spr.material.opacity = 1;
    slot.spr.visible = true;
  },

  _updateBubbles(dt) {
    if (!this.bubbles) return;
    for (const b of this.bubbles) {
      if (b.ttl <= 0) continue;
      b.ttl -= dt;
      b.spr.material.opacity = Math.min(1, b.ttl / 0.35);
      if (b.ttl <= 0) b.spr.visible = false;
    }
  },

  /* ---------- 별똥별 (하늘에서 떨어지는 별) ---------- */
  _starfall(x3, z3, delay = 0) {
    if (!this.stars) this.stars = [];
    let s = this.stars.find(v => !v.live);
    if (!s) {
      if (this.stars.length >= 48) s = this.stars[0];   // 풀 상한 — 은하수 연타 대비
      else {
        const mesh = new THREE.Group();
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd97a, transparent: true, depthWrite: false }));
        halo.scale.set(1.7, 1.7, 1);
        mesh.add(core, halo);
        mesh.visible = false;
        this.scene.add(mesh);
        s = { mesh, live: false, t: 0, dur: 0.36, from: new THREE.Vector3(), to: new THREE.Vector3() };
        this.stars.push(s);
      }
    }
    s.live = true;
    s.t = -delay;
    s.dur = 0.32 + Math.random() * 0.1;
    s.from.set(x3 + 2.6, 10.5, z3 + 1.8);
    s.to.set(x3, 0.25, z3);
    s.mesh.visible = false;
  },

  _updateStars(dt) {
    if (!this.stars) return;
    for (const s of this.stars) {
      if (!s.live) continue;
      s.t += dt;
      if (s.t < 0) continue;
      const k = Math.min(1, s.t / s.dur);
      const ke = k * k;                        // 가속 낙하
      s.mesh.visible = true;
      s.mesh.position.lerpVectors(s.from, s.to, ke);
      s.mesh.rotation.y += dt * 14;
      if (Math.random() < dt * 30) {
        this.burst(s.mesh.position.x, s.mesh.position.y, s.mesh.position.z, 0xffe9a0, 1, 0.4, { grav: 0.5, ttl: 0.3, size: 0.5 });
      }
      if (k >= 1) {
        s.live = false;
        s.mesh.visible = false;
        this._shockRing(s.to.x, s.to.z, 1.9, 0xffd97a, 0.5);
        this._shockRing(s.to.x, s.to.z, 1.1, 0xfff3b0, 0.4);
        this.burst(s.to.x, 0.7, s.to.z, 0xffd97a, 16, 4.2, { grav: 4 });
        this.burst(s.to.x, 0.9, s.to.z, 0xffffff, 8, 2.6);
        this.addShake(0.15);
      }
    }
  },

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
  },
  _blockWave(x3, z3, radius) { this._shockRing(x3, z3, radius, 0x9fd0ff, 0.5); },

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
  },

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
  },

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
  },

  /* 위로 솟는 빛기둥 (즉석 생성 후 자동 제거) */
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
  },
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
  },

  /* ---------- 잔치 =====================================
   * 승급 연출만 터뜨렸더니 "돈 내고 등급 하나 올렸다"로 끝났다 — 잔치라는 이름이
   * 무색했다. 잔치는 승급한 한 명의 사건이 아니라 판 전체가 노는 시간이라,
   * 몇 초 동안 파티 모드로 들어가서 다 같이 뛰고 떠들게 한다.
   *
   * 새 지오메트리는 만들지 않는다 — 색종이는 파티클 풀, 환호는 말풍선 풀을 돌려 쓴다.
   * (파티클 320개 중 파티가 최대 100개쯤 물고 있게 잡았다 — 실측. 준비 단계라 전투가 쓸 일이 없다.) */
  startFeastParty(x, z, starId, tier, lines) {
    this._lightPillar(x, z, tier);
    this._shockRing(x, z, 2.2, 0xffd93d, 0.7);
    this._shockRing(x, z, 3.6, 0xffffff, 0.9);
    this.burst(x, 1.2, z, 0xffd93d, 26, 4.4, { grav: 3 });
    this.addShake(0.3);
    this.party = {
      t: 0, dur: 5.2, x, z, star: starId,
      confT: 0, cheerT: 0.35, ringT: 1.1,
      lines: lines || { star: ['만세!'], crowd: ['와아아!'] },
      said: 0,
    };
  },

  PARTY_COLORS: [0xffd93d, 0x7fd45e, 0x6eb5ff, 0xff8ac2, 0xffffff, 0xffa040],

  _partyFrame(dt, t, state) {
    const p = this.party;
    if (!p) return;
    p.t += dt;
    /* 잔치가 끝나기 전에 웨이브를 시작할 수 있다. 그대로 두면 용사들이 춤추면서
     * 활을 쏘고, 팔 각도를 파티가 붙잡고 있어서 공격 모션도 안 나온다. 파티가 진다. */
    if (p.t >= p.dur || (state && state.phase !== 'prep')) {
      /* 뛰던 높이를 남겨 두면 용사가 공중에 붕 뜬 채로 굳는다.
       * (sync 가 매 프레임 y=0 으로 되돌리지만, 파티가 끝난 프레임을 놓칠 수 있다) */
      for (const [, v] of this.heroViews) {
        v.holder.position.y = 0;
        v.model.rotation.z = 0;   // 기울기는 매 프레임 다시 쓰이지 않는다 — 여기서 펴 준다
      }
      this.party = null;
      return;
    }
    const k = p.t / p.dur;
    const fade = Math.min(1, (1 - k) * 3);          // 끝물에는 잦아든다

    /* 색종이 비 — 전장 위 하늘에서 골고루 */
    p.confT -= dt;
    if (p.confT <= 0) {
      p.confT = 0.07;
      for (let i = 0; i < (fade > 0.4 ? 3 : 1); i++) {
        const cx = (Math.random() - 0.5) * 22;
        const cz = -6 + Math.random() * 13;
        const col = this.PARTY_COLORS[Math.floor(Math.random() * this.PARTY_COLORS.length)];
        /* up:0 = 위로 안 튀고 흩날리며 떨어진다 */
        this.burst(cx, 8.5 + Math.random() * 2, cz, col, 1, 1.1, { grav: 2.6, ttl: 2.4, size: 0.85, up: 0 });
      }
    }

    /* 잔치 자리에서 이따금 터지는 폭죽 + 바닥 링 */
    p.ringT -= dt;
    if (p.ringT <= 0 && fade > 0.35) {
      p.ringT = 0.75;
      const col = this.PARTY_COLORS[Math.floor(Math.random() * 4)];
      this.burst(p.x + (Math.random() - 0.5) * 2.4, 1.4 + Math.random(), p.z + (Math.random() - 0.5) * 2.4,
        col, 12, 3.8, { grav: 3 });
      this._shockRing(p.x, p.z, 2.4, col, 0.6);
    }

    /* 다 같이 뛴다 — 박자는 같고 시작만 어긋나게 (한 몸처럼 뛰면 군무가 된다) */
    for (const [id, v] of this.heroViews) {
      const star = id === p.star;
      const phase = id * 1.7;
      const hop = Math.abs(Math.sin(t * (star ? 7.5 : 6) + phase));
      v.holder.position.y = hop * (star ? 0.75 : 0.45) * fade;
      /* 뛰면서 몸을 좌우로 흔든다 — 발이 붙어 있으면 뛰는 게 아니라 튀는 거다 */
      v.model.rotation.y += Math.sin(t * 4.5 + phase) * 0.45 * fade;
      v.model.rotation.z = Math.sin(t * 5.2 + phase) * 0.1 * fade;
      /* 두 팔을 번쩍 — 공격 모션이 없는 준비 단계라 팔을 빌려 써도 안 겹친다 */
      if (v.refs.armPivot) v.refs.armPivot.rotation.x = -1.5 * fade * (0.6 + hop * 0.4);
      if (star && Math.random() < dt * 14) {
        this.burst(v.holder.position.x, 1.5, v.holder.position.z, 0xffd93d, 1, 1.2,
          { grav: -0.6, ttl: 0.6, size: 0.6 });
      }
    }

    /* 돌아가며 한 마디씩 — 말풍선은 4칸뿐이라 한 번에 하나씩만 띄운다 */
    p.cheerT -= dt;
    if (p.cheerT <= 0 && p.t < p.dur - 0.6) {
      p.cheerT = 0.85;
      const views = [...this.heroViews.entries()];
      /* 첫 마디는 주인공 몫 — 잔치의 이유가 누구인지부터 보여 준다.
       * 다만 승급한 게 벤치 용사면 판 위에 본인이 없다. 그때 남의 입으로
       * "나 승급했어!"가 나오면 누가 주인공인지 되레 헷갈린다 — 환호로 넘긴다. */
      const starView = views.find(([id]) => id === p.star);
      const pick = (p.said === 0 && starView) ? starView
        : (views.length ? views[Math.floor(Math.random() * views.length)] : null);
      if (pick) {
        const pool = pick === starView && p.said === 0 ? p.lines.star : p.lines.crowd;
        const text = pool[Math.floor(Math.random() * pool.length)];
        this.showBubbleAt(pick[1].holder.position.x, pick[1].holder.position.z, text, 1.5);
      }
      p.said++;
    }
  },

  /* 축하 폭죽 (특수 직업 탄생 등) — 벤치라 위치가 없으니 화면 중앙에 */
  celebrate(color = 0xffd93d, big = false) {
    this.burst(0, 2.2, 2, color, big ? 40 : 20, big ? 5 : 3.4, { grav: 3 });
  },

  addShake(v) { this.shake = Math.min(0.8, this.shake + v); },

  /* 성을 강화한 순간 — 성벽을 따라 빛이 번지고 흔들린다 */
  castleUpgradeFx(kind) {
    const color = kind === 'tower' ? 0x7ff3ff : 0xffd76e;
    this._shockRing(0, -4.35, 7.5, color, 0.7, 0.22);
    for (let i = 0; i < 5; i++) {
      this.burst(-5 + i * 2.5, 1.4, -4.35, color, 8, 2.4);
    }
    this.addShake(0.22);
  },
};
