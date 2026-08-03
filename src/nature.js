/* =====================================================
 * 자연 배경 — 시간대 · 바람 잔디 · 바다 · 반딧불이
 *
 * 외부 에셋 0개 원칙 유지: 텍스처도 이미지도 쓰지 않고 전부 셰이더로 만든다.
 * render3d.js 가 비대해지는 걸 막으려고 분리했다. 여기 있는 것들은 전부
 * "게임 로직과 무관한 배경"이라 엔진·봇은 이 파일을 몰라도 된다.
 *
 * 카메라는 44.6° 내려다보는 고정 시점이라 수평선이 화면 위로 벗어나 있다.
 * 그래서 하늘·별·달은 지금 프레이밍으로는 한 픽셀도 안 보인다 —
 * 대신 "위에서 잘 보이는 것"(잔디 물결·수면·해안 거품)에 힘을 준다.
 * ===================================================== */
import * as THREE from 'three';
import * as D from './data.js';

/* 지면이 끝나고 모래사장이 시작되는 z (월드 좌표).
 * 성 뒷벽이 z≈-6.9 이므로 그 뒤로 4칸쯤 남기고 물가가 된다. */
/* 이 카메라는 44.6° 내려다보므로 성 뒤로 쓸 수 있는 화면은 위쪽 100px 남짓이다.
 * 잔디 / 모래 / 바다를 그 안에 다 넣어야 하니 물가를 성 가까이 끌어당긴다.
 * (성 뒷벽 z≈-6.9 → 뒤로 2.7칸만 남기고 바로 바닷가) */
export const SHORE_Z = -9.6;

/* 물이 실제로 차오르는 선. 여기서부터 뒤가 바다다.
 * 물 평면은 이보다 앞(SHORE_Z 근처)까지 덮되 셰이더에서 알파를 0으로 빼서
 * 물가 선이 직선 다각형 경계가 아니라 울퉁불퉁하게 보이도록 한다. */
const WATER_LINE = -13.2;

/* =====================================================
 * 시간대 팔레트
 * 웨이브가 진행될수록 아침 → 한낮 → 황금빛 → 노을 → 밤.
 * 13웨이브에 깊은 밤에 닿는다(보통 난이도 중앙값 10 ≈ 노을 무렵).
 * ===================================================== */
const KEYS = [
  { /* 아침   */ p: 0.00, fog: 0xcfe9ff, sky: 0xbfe3ff, sun: 0xfff2d8, sunI: 1.90,
    hemiSky: 0xeaf6ff, hemiGnd: 0x5d8742, hemiI: 1.25, sunPos: [8, 14, 6],
    deep: 0x1e5c86, shallow: 0x4fb3c9, night: 0 },
  { /* 한낮   */ p: 0.28, fog: 0xdff1ff, sky: 0xcfeaff, sun: 0xfffaf0, sunI: 2.05,
    hemiSky: 0xf2faff, hemiGnd: 0x6a9a4a, hemiI: 1.35, sunPos: [4, 18, 3],
    deep: 0x14618f, shallow: 0x53c6da, night: 0 },
  { /* 황금빛 */ p: 0.56, fog: 0xffd9b0, sky: 0xffc98f, sun: 0xffb066, sunI: 1.85,
    hemiSky: 0xffe3c0, hemiGnd: 0x6b7a3a, hemiI: 1.05, sunPos: [13, 6, 7],
    deep: 0x2a4f7a, shallow: 0xd79a63, night: 0.1 },
  { /* 노을   */ p: 0.80, fog: 0xb980a8, sky: 0x8a5f8f, sun: 0xff7a55, sunI: 1.15,
    hemiSky: 0xc99ec0, hemiGnd: 0x47506a, hemiI: 0.80, sunPos: [15, 2.6, 6],
    deep: 0x27304f, shallow: 0x8e6a94, night: 0.45 },
  /* 밤: 분위기보다 가독성이 먼저다. 아이들이 몬스터와 발판을 못 보면 안 되니
   * "달빛이 밝은 밤" 정도로 잡는다(진짜 어둠은 재미가 아니라 스트레스다). */
  { /* 밤     */ p: 1.00, fog: 0x223060, sky: 0x16224a, sun: 0xb2cdff, sunI: 1.02,
    hemiSky: 0x3b4f88, hemiGnd: 0x243050, hemiI: 0.96, sunPos: [-9, 13, 4],
    deep: 0x0d1838, shallow: 0x244577, night: 1 },
];

const _cA = new THREE.Color(), _cB = new THREE.Color();
function mixHex(a, b, t, out) {
  _cA.setHex(a); _cB.setHex(b);
  return out.copy(_cA).lerp(_cB, t);
}

/* 웨이브 → 0..1 위상. 13웨이브부터는 계속 밤. */
export function wavePhase(wave) {
  return Math.max(0, Math.min(1, ((wave || 1) - 1) / 12));
}

/* 위상 → 팔레트. 매 프레임 부르므로 객체를 새로 만들지 않고 out 에 채운다. */
export function daylightPalette(phase, out) {
  const p = Math.max(0, Math.min(1, phase));
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = (p - a.p) / (b.p - a.p);

  mixHex(a.fog, b.fog, t, out.fog);
  mixHex(a.sky, b.sky, t, out.sky);
  mixHex(a.sun, b.sun, t, out.sun);
  mixHex(a.hemiSky, b.hemiSky, t, out.hemiSky);
  mixHex(a.hemiGnd, b.hemiGnd, t, out.hemiGnd);
  mixHex(a.deep, b.deep, t, out.deep);
  mixHex(a.shallow, b.shallow, t, out.shallow);
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  out.night = a.night + (b.night - a.night) * t;
  out.sunPos.set(
    a.sunPos[0] + (b.sunPos[0] - a.sunPos[0]) * t,
    a.sunPos[1] + (b.sunPos[1] - a.sunPos[1]) * t,
    a.sunPos[2] + (b.sunPos[2] - a.sunPos[2]) * t
  );
  return out;
}

export function makePalette() {
  return {
    fog: new THREE.Color(), sky: new THREE.Color(), sun: new THREE.Color(),
    hemiSky: new THREE.Color(), hemiGnd: new THREE.Color(),
    deep: new THREE.Color(), shallow: new THREE.Color(),
    sunI: 1.9, hemiI: 1.25, night: 0, sunPos: new THREE.Vector3(8, 14, 6),
  };
}

/* =====================================================
 * 바람 잔디 — InstancedMesh + 정점 셰이더
 * 잎을 실제로 휘게 만드는 건 정점 셰이더 6줄이고, 나머지는 "어디에 심을까"다.
 * ===================================================== */

/* 풀잎 하나: 밑동이 넓고 끝이 뾰족한 4단 리본.
 * 법선을 전부 위(0,1,0)로 세운다 — 세로 판이라 옆을 보게 두면 램버트가
 * 새까맣게 죽는다. 잔디밭은 "위에서 빛 받는 면"으로 읽혀야 한다. */
function bladeGeometry(segments = 3) {
  const pos = [], nor = [], col = [], idx = [];
  const H = 1, W = 0.055;
  for (let i = 0; i <= segments; i++) {
    const v = i / segments;
    const w = W * (1 - v * 0.92);
    const shade = 0.74 + v * 0.26;          // 밑동은 살짝 어둡게, 끝은 밝게
    pos.push(-w, v * H, 0, w, v * H, 0);
    nor.push(0, 1, 0, 0, 1, 0);
    col.push(shade, shade, shade, shade, shade, shade);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

const GRASS_COUNT = { high: 14000, lite: 4500, min: 0 };

export class WindGrass {
  constructor(scene, quality, wx, wz) {
    this.scene = scene;
    this.uTime = { value: 0 };
    this.uWind = { value: 1 };              // 돌풍 세기 배수(보스전에 올린다)
    this.meshes = {};
    this.quality = null;
    this._wx = wx; this._wz = wz;
    this._geo = bladeGeometry();
    this._mat = this._material();
    /* 최대 개수로 한 번만 자리를 뽑아 두고, 품질에 따라 앞쪽 n개만 그린다.
     * 실행마다 배치가 같아야 하므로 시드 고정 난수를 쓴다. */
    this._spots = this._scatter(GRASS_COUNT.high);
    this.setQuality(quality);
  }

  _material() {
    const m = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      color: 0x8fc46a,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime;
      shader.uniforms.uWind = this.uWind;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uWind;`)
        .replace('#include <begin_vertex>', `
vec3 transformed = vec3( position );
#ifdef USE_INSTANCING
  vec3 iPos = instanceMatrix[3].xyz;
#else
  vec3 iPos = vec3( 0.0 );
#endif
float tip   = clamp( position.y, 0.0, 1.0 );
float bend  = tip * tip;                       /* 밑동은 안 움직인다 */
float phase = iPos.x * 0.83 + iPos.z * 0.61;
/* 넓게 지나가는 돌풍 + 잎마다 다른 잔떨림 */
float gust  = 0.55 + 0.45 * sin( uTime * 0.42 - ( iPos.x + iPos.z * 0.7 ) * 0.085 );
float sway  = sin( uTime * 1.9 + phase ) + 0.32 * sin( uTime * 3.7 + phase * 1.9 );
float amp   = 0.16 * uWind * gust * bend;
transformed.x += sway * amp;
transformed.z += cos( uTime * 1.55 + phase * 0.9 ) * amp * 0.55;
transformed.y -= abs( sway ) * amp * 0.30;     /* 휜 만큼 키가 준다 */
`);
    };
    return m;
  }

  /* 길·발판·성·바다를 피해서 자리를 뽑는다.
   * 자리 하나에 숫자 4개(x, z, 높이, 회전)를 넣으므로 n*4 까지 채운다. */
  _scatter(n) {
    let s = 1337;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const out = [];
    /* 뒤쪽 0.8칸은 비워 둔다 — 잎이 물가를 가리면 해변이 통째로 안 보인다 */
    const NEAR_Z = 7.6, FAR_Z = SHORE_Z + 0.8;
    let guard = 0;
    while (out.length < n * 4 && guard++ < n * 60) {
      /* 화면에 보이는 영역은 사다리꼴이다 — 가까울수록 좁다.
       * 밖에 심으면 인스턴스만 낭비되므로 사다리꼴에 맞춰 뿌린다. */
      const z = FAR_Z + rnd() * (NEAR_Z - FAR_Z);
      const halfW = 9.5 + (NEAR_Z - z) / (NEAR_Z - FAR_Z) * 9.0;
      const x = (rnd() - 0.5) * 2 * halfW;
      /* 논리 좌표로 되돌려 길 판정 */
      const lx = x * 36 + D.FIELD_W / 2, ly = z * 36 + D.FIELD_H / 2;
      if (D.distToPath(lx, ly) < D.ROAD_HALF + 16) continue;
      let onPad = false;
      for (const p of D.PADS) {
        if (Math.hypot(p.x - lx, p.y - ly) < D.PAD_RADIUS + 14) { onPad = true; break; }
      }
      if (onPad) continue;
      if (Math.abs(x) < 7.6 && z > -7.6 && z < -3.2) continue;   // 성 자리
      /* 멀리 있는 잎일수록 낮게 — 안 그러면 수평선 앞에 초록 벽이 선다 */
      const far = (NEAR_Z - z) / (NEAR_Z - FAR_Z);
      const h = (0.34 + rnd() * 0.30) * (1 - far * 0.42);
      out.push(x, z, h, rnd() * Math.PI);                        // x, z, 높이, 회전
    }
    return out;
  }

  setQuality(q) {
    if (this.quality === q) return;
    this.quality = q;
    const n = GRASS_COUNT[q] != null ? GRASS_COUNT[q] : GRASS_COUNT.lite;
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.dispose(); this.mesh = null; }
    if (!n) return;

    const count = Math.min(n, this._spots.length / 4);
    const mesh = new THREE.InstancedMesh(this._geo, this._mat, count);
    mesh.frustumCulled = false;                 /* 셰이더로 휘므로 경계 상자가 안 맞는다 */
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4(), q4 = new THREE.Quaternion();
    const pos = new THREE.Vector3(), scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const x = this._spots[i * 4], z = this._spots[i * 4 + 1];
      const h = this._spots[i * 4 + 2], rot = this._spots[i * 4 + 3];
      pos.set(x, -0.07, z);
      q4.setFromAxisAngle(up, rot);
      scl.set(0.85 + (h - 0.34), h, 1);
      m.compose(pos, q4, scl);
      mesh.setMatrixAt(i, m);
      /* 잎마다 색을 조금씩 흔들어 준다 — 단색 잔디는 카펫처럼 보인다 */
      const t = (Math.sin(x * 3.1 + z * 5.7) * 0.5 + 0.5);
      col.setHSL(0.24 + t * 0.045, 0.42 + t * 0.16, 0.40 + t * 0.14);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  frame(dt, t, palette, bossBlend) {
    this.uTime.value = t;
    /* 보스가 오면 바람이 사나워진다 */
    this.uWind.value = 1 + Math.min(1, bossBlend) * 1.1;
    if (this.mesh) {
      /* 밤에는 잔디도 같이 가라앉아야 한다(램버트 조명만으로는 덜 떨어진다).
       * 낮 기준색은 잎 색(instanceColor)을 죽이지 않도록 초록 쪽에 둔다. */
      const n = palette.night;
      this.mesh.material.color.setRGB(
        0.62 - 0.47 * n,
        0.92 - 0.69 * n,
        0.48 - 0.31 * n
      );
    }
  }

  dispose() {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.dispose(); }
    this._geo.dispose();
    this._mat.dispose();
  }
}

/* =====================================================
 * 바다 — Gerstner 파도 + 프레넬 + 윤슬 + 해안 거품
 * 성 뒤편이 화면 위쪽 30%를 밋밋한 잔디로 채우고 있었다. 거기를 바다로 바꾼다.
 * ===================================================== */

/* 파도를 정점이 아니라 픽셀에서 계산한다.
 *
 * 처음에는 정점을 실제로 밀어 올리는 Gerstner 로 짰는데, 이 게임 카메라에서는
 * 바다가 25~70유닛 밖에 스치는 각으로 깔린다. 파고 0.26유닛은 화면에서 1픽셀도
 * 안 되고, 대신 정점 수만 2만 개 먹었다. 눈에 보이는 건 전부 "면이 어느 쪽을
 * 보느냐"(=법선)에서 나오는 반짝임과 색이다. 그래서 높이장은 프래그먼트에서
 * 해석적으로 미분해 법선만 만든다 — 더 싸고, 이 각도에서 훨씬 선명하다. */
const SEA_VERT = /* glsl */`
#include <fog_pars_vertex>
varying vec3 vWorld;

void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vWorld = wp;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const SEA_FRAG = /* glsl */`
/* tonemapping/colorspace 의 pars 는 three 가 프래그먼트 앞머리에 이미 넣어 준다.
 * 여기서 또 include 하면 함수가 두 번 정의돼 컴파일이 깨진다. fog 만 직접 넣는다. */
#include <fog_pars_fragment>
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uNight;
uniform float uShoreZ;
uniform float uChop;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

/* 파도 한 겹 → vec3(높이, dh/dx, dh/dz).
 * inout 으로 누적하지 않고 값을 돌려준다 — 누적형은 일부 드라이버에서
 * 실제로 깨졌다(수면이 통째로 사라졌다). 순수 함수로 두는 편이 안전하다. */
vec3 wave(vec2 dir, float amp, float len, float speed, vec2 p, float t) {
  float k = 6.2831853 / len;
  vec2 d = normalize(dir);
  float f = k * dot(d, p) - speed * k * t;
  return vec3(amp * sin(f), amp * k * cos(f) * d.x, amp * k * cos(f) * d.y);
}

void main() {
  float dist = length(cameraPosition - vWorld);
  /* 멀리서 잔물결까지 살리면 픽셀이 지글거린다 — 거리로 잔결을 접는다.
   * 큰 너울도 아주 멀리서는 한 픽셀에 여러 주기가 들어가 모아레가 되므로 같이 접는다. */
  float detail  = 1.0 - smoothstep(26.0, 62.0, dist);
  float bigFade = 1.0 - smoothstep(52.0, 92.0, dist);

  /* 도메인 워프 — 이걸 안 하면 마루가 자로 그은 평행선이 되어 골판지처럼 보인다 */
  vec2 p0 = vWorld.xz;
  vec2 warp = vec2(vnoise(p0 * 0.055), vnoise(p0 * 0.047 + 31.0)) - 0.5;
  vec2 p = p0 + warp * 7.0;

  vec3 w = (wave(vec2( 1.0,  0.35), 0.110 * uChop, 7.5, 1.55, p, uTime)
         +  wave(vec2( 0.7, -0.75), 0.075 * uChop, 4.2, 1.20, p, uTime)) * bigFade
         + wave(vec2(-0.4,  0.9 ), 0.045 * uChop, 2.6, 0.95, p, uTime) * (0.35 + 0.65 * detail)
         + wave(vec2( 0.9,  0.15), 0.022 * uChop, 1.3, 0.70, p, uTime) * detail
         + wave(vec2( 0.3,  1.0 ), 0.010 * uChop, 0.6, 0.50, p, uTime) * detail;

  vec3 N = normalize(vec3(-w.y, 1.0, -w.z));
  /* 백파는 가까운 곳의 "높은" 마루에만. 문턱을 낮게 두면 멀리서 모든 마루가
   * 하얗게 찍혀 바다가 골판지처럼 보인다. */
  float crestRaw = clamp((w.x - 0.105) * 7.0, 0.0, 1.0) * detail;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunDir);

  /* 얕은 곳(물가)일수록 밝은 색 */
  float shore = clamp((vWorld.z - (uShoreZ - 11.0)) / 11.0, 0.0, 1.0);
  vec3 base = mix(uDeep, uShallow, shore * 0.85);

  /* 프레넬 — 멀리(스치는 각)일수록 하늘색이 얹힌다 */
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  vec3 col = mix(base, uSky, fres * 0.75);

  /* 윤슬 — 해/달빛이 파도 면에 튀는 날카로운 반사 */
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 220.0);
  float glint = pow(max(dot(N, H), 0.0), 26.0) * 0.16;
  col += uSunColor * (spec * 2.4 + glint) * (1.0 - uNight * 0.35);

  /* 파도 마루 백파 */
  float crest = smoothstep(0.35, 0.9, crestRaw);
  col = mix(col, vec3(0.86, 0.92, 0.98), crest * 0.42);

  /* 물가 선 — 노이즈로 흔들고, 밀려왔다 빠지는 리듬을 준다.
   * 이 선을 기준으로 앞쪽은 알파를 빼서 모래가 드러나게 한다.
   * (평면 경계를 그대로 쓰면 자로 그은 직선이 되어 단번에 가짜로 보인다) */
  float wob = (vnoise(vec2(vWorld.x * 0.34, 11.0)) - 0.5) * 1.7
            + (vnoise(vec2(vWorld.x * 1.15, 27.0)) - 0.5) * 0.6;
  float surge = sin(uTime * 0.62 + vWorld.x * 0.09) * 0.45
              + sin(uTime * 0.41 - vWorld.x * 0.17) * 0.25;
  float line = uShoreZ + wob + surge;
  float d = line - vWorld.z;          /* >0 이면 물, <0 이면 모래 쪽 */

  /* 해안 거품 — 물가 선 바로 안쪽에 몰린다.
   * GLSL smoothstep 은 edge0 >= edge1 이면 결과가 정의되지 않는다.
   * 내려가는 경사는 반드시 1.0 - smoothstep(작은값, 큰값) 으로 써야 한다. */
  float foam = smoothstep(-0.1, 0.4, d) * (1.0 - smoothstep(0.45, 1.7, d));
  foam *= 0.45 + 0.55 * vnoise(vec2(vWorld.x * 2.4, vWorld.z * 2.4 - uTime * 0.8));
  /* 밤에는 거품도 달빛만 받는다 — 낮과 같은 흰색이면 수평선에 형광 띠가 생긴다 */
  col = mix(col, vec3(0.80, 0.88, 0.95), clamp(foam, 0.0, 1.0) * 0.75 * (1.0 - uNight * 0.62));

  float alpha = smoothstep(-0.35, 0.7, d);

  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/* 파도가 정점을 밀지 않으니 면은 잘게 나눌 필요가 없다.
 * 다만 안개는 정점 varying 으로 보간되므로 너무 성기면 띠가 진다 — 적당히 남긴다. */
const SEA_SEG = { high: [48, 32], lite: [24, 16], min: [8, 6] };

export class Sea {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = null;
    this.uniforms = {
      uTime: { value: 0 },
      uChop: { value: 1 },
      uDeep: { value: new THREE.Color(0x14618f) },
      uShallow: { value: new THREE.Color(0x53c6da) },
      uSky: { value: new THREE.Color(0xcfeaff) },
      uSunColor: { value: new THREE.Color(0xfff2d8) },
      uSunDir: { value: new THREE.Vector3(8, 14, 6).normalize() },
      uNight: { value: 0 },
      uShoreZ: { value: WATER_LINE },
      ...THREE.UniformsLib.fog,
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SEA_VERT,
      fragmentShader: SEA_FRAG,
      fog: true,
      transparent: true,        /* 물가에서 알파로 빠져 모래가 드러난다 */
      depthWrite: false,
    });

    /* 모래 해변 — 잔디 끝에서 물 밑까지 이어진다.
     * 물(y=-0.30)보다 낮게 깔아야 물이 모래 위로 덮인다.
     * 색이 낮은 이유: 이 씬은 hemi 1.25 + sun 1.9 로 램버트에 3배 가까이 곱해진다.
     * 실제 모래색(0xe4d3a8)을 그대로 넣으면 하얗게 날아간다. */
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 9),
      new THREE.MeshLambertMaterial({ color: 0x9c8a63 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, -0.34, SHORE_Z - 4.1);   // z: -15.6 ~ -6.6 (잔디와 겹침)
    sand.receiveShadow = true;
    this.sand = sand;
    scene.add(sand);

    this.setQuality(quality);
  }

  setQuality(q) {
    if (this.quality === q) return;
    this.quality = q;
    const seg = SEA_SEG[q] || SEA_SEG.lite;
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    const geo = new THREE.PlaneGeometry(150, 62, seg[0], seg[1]);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.material);
    /* 앞끝을 모래 위(z≈-9.6)까지 밀어 두고 알파로 잘라 낸다 */
    mesh.position.set(0, -0.30, -40.6);        // z: -71.6 ~ -9.6
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;                     // 모래보다 뒤, 나머지 장면보다 앞
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  frame(dt, t, palette, bossBlend) {
    const u = this.uniforms;
    u.uTime.value = t;
    u.uChop.value = 1 + Math.min(1, bossBlend) * 0.9;   // 보스전엔 파도가 거칠어진다
    u.uDeep.value.copy(palette.deep);
    u.uShallow.value.copy(palette.shallow);
    u.uSky.value.copy(palette.fog);                    // 수평선은 안개색으로 녹아든다
    u.uSunColor.value.copy(palette.sun);
    u.uSunDir.value.copy(palette.sunPos).normalize();
    u.uNight.value = palette.night;
    /* 모래도 시간대를 따라간다 */
    const n = palette.night;
    this.sand.material.color.setRGB(0.61 - n * 0.44, 0.54 - n * 0.39, 0.39 - n * 0.27);
  }

  dispose() {
    this.scene.remove(this.mesh, this.sand);
    this.mesh.geometry.dispose();
    this.sand.geometry.dispose();
    this.sand.material.dispose();
    this.material.dispose();
  }
}

/* =====================================================
 * 반딧불이 — 밤에만 켜진다
 * 위치를 정점 셰이더에서 흔들어 CPU 비용을 0으로 둔다.
 * ===================================================== */

const FIRE_VERT = /* glsl */`
uniform float uTime;
uniform float uSize;
attribute vec3 aSeed;
varying float vFade;
void main() {
  vec3 p = position;
  p.x += sin(uTime * aSeed.x * 0.55 + aSeed.z * 6.2) * 1.5;
  p.z += cos(uTime * aSeed.y * 0.48 + aSeed.x * 5.1) * 1.3;
  p.y += sin(uTime * 0.75 + aSeed.z * 4.0) * 0.45;
  /* 깜빡임 — 개체마다 주기가 달라야 살아 있는 것처럼 보인다 */
  vFade = 0.35 + 0.65 * pow(max(sin(uTime * (0.9 + aSeed.y) + aSeed.z * 9.0), 0.0), 2.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (18.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const FIRE_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = pow(1.0 - d * 2.0, 2.2);
  gl_FragColor = vec4(uColor, a * vFade * uOpacity);
}
`;

/* 반딧불이는 "있는 줄 알겠는" 정도가 딱이다. 처음엔 90마리로 뿌려 봤는데
 * 화면 절반을 덮어 몬스터가 안 보였다 — 분위기가 게임을 이기면 안 된다. */
const FIRE_COUNT = { high: 34, lite: 16, min: 0 };

export class Fireflies {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = null;
    this.uniforms = {
      uTime: { value: 0 },
      uSize: { value: 13 },
      uColor: { value: new THREE.Color(0xc8f07a) },
      uOpacity: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: FIRE_VERT,
      fragmentShader: FIRE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.setQuality(quality);
  }

  setQuality(q) {
    if (this.quality === q) return;
    this.quality = q;
    const n = FIRE_COUNT[q] != null ? FIRE_COUNT[q] : FIRE_COUNT.lite;
    if (this.points) { this.scene.remove(this.points); this.points.geometry.dispose(); this.points = null; }
    if (!n) return;

    let s = 909;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      /* 길 위는 피한다 — 몬스터·용사와 겹치면 눈이 아프다.
       * (셰이더에서 ±1.5 만큼 더 떠다니므로 여유를 두고 밀어낸다) */
      let x = 0, z = 0;
      for (let tries = 0; tries < 24; tries++) {
        x = (rnd() - 0.5) * 34;
        z = SHORE_Z + 1.5 + rnd() * 15;
        const lx = x * 36 + D.FIELD_W / 2, ly = z * 36 + D.FIELD_H / 2;
        if (D.distToPath(lx, ly) > D.ROAD_HALF + 60) break;
      }
      pos[i * 3] = x;
      pos[i * 3 + 1] = 0.5 + rnd() * 2.2;
      pos[i * 3 + 2] = z;
      seed[i * 3] = 0.5 + rnd();
      seed[i * 3 + 1] = 0.5 + rnd();
      seed[i * 3 + 2] = rnd() * 6.283;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    const pts = new THREE.Points(geo, this.material);
    pts.frustumCulled = false;
    pts.renderOrder = 6;
    this.points = pts;
    this.scene.add(pts);
  }

  frame(dt, t, palette) {
    this.uniforms.uTime.value = t;
    /* 해가 완전히 기운 뒤에야 나온다 */
    this.uniforms.uOpacity.value = Math.max(0, (palette.night - 0.35) / 0.65) * 0.62;
    if (this.points) this.points.visible = this.uniforms.uOpacity.value > 0.01;
  }

  dispose() {
    if (this.points) { this.scene.remove(this.points); this.points.geometry.dispose(); }
    this.material.dispose();
  }
}
