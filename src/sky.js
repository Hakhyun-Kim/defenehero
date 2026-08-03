/* =====================================================
 * 하늘 밴드 — 별 · 달 · 행성 · 구름
 *
 * 이 게임 카메라는 내려다보는 고정 시점이라 진짜 수평선이 화면 위로 벗어나 있다.
 * 그래서 하늘 돔을 씌워 봐야 한 픽셀도 안 보인다. 대신 화면 위쪽 일정 비율을
 * "그려 넣은 배경"으로 떼어 준다 — 카메라에 붙인 쿼드 하나가 전부다.
 * nature.js 가 실제 3D 자연(잔디·바다)이라면 이쪽은 배경화(背景畵)다.
 *
 * 이음매를 감추는 게 하늘을 그리는 것보다 중요하다. 밴드 아래쪽 색을 안개색과
 * 맞추면, 멀어지며 안개색으로 수렴하는 바다와 이어져 경계가 사라진다.
 * ===================================================== */
import * as THREE from 'three';

const SKY_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */`
uniform vec3  uHorizon;      /* 밴드 아래 — 안개색과 같아야 이음매가 안 보인다 */
uniform vec3  uZenith;       /* 밴드 위 */
uniform vec3  uSunColor;
uniform float uTime;
uniform float uNight;        /* 0 낮 · 1 밤 */
uniform float uCloud;
uniform float uAspect;       /* 밴드 가로/세로 — 달·행성을 동그랗게 유지 */
uniform float uMoonPhase;    /* 0 신월 · 1 보름 */
uniform float uSunX;         /* 해의 가로 위치 (0..1) */
uniform float uSunY;         /* 해의 높이 — 하루가 갈수록 내려온다 */
uniform float uMoonX;        /* 달의 가로 위치 (0..1) */
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

/* 별: 격자 한 칸에 최대 하나. 칸마다 밝기와 반짝임 주기가 달라야 살아 보인다. */
float starField(vec2 p, float density, float size) {
  vec2 g = floor(p), f = fract(p);
  float h = hash(g);
  if (h < density) return 0.0;
  vec2 c = vec2(hash(g + 1.37), hash(g + 7.71));
  float d = length(f - c);
  float mag = 0.35 + hash(g + 9.13) * 0.65;
  float tw = 0.55 + 0.45 * sin(uTime * (1.2 + hash(g + 3.11) * 3.4) + hash(g + 5.57) * 6.283);
  return smoothstep(size * mag, 0.0, d) * mag * tw;
}

void main() {
  /* sp: 가로세로 비율이 같은 좌표. 밴드는 아주 납작해서(가로 9배쯤)
   * vUv 를 그대로 쓰면 달이 타원이 된다. */
  vec2 sp = vec2(vUv.x * uAspect, vUv.y);

  /* ---- 바탕 그라데이션 ---- */
  float grad = pow(clamp(vUv.y, 0.0, 1.0), 0.85);
  vec3 col = mix(uHorizon, uZenith, grad);

  /* ---- 별 (밤에만) ---- */
  float starAmt = smoothstep(0.30, 0.85, uNight);
  float band = 1.0 - smoothstep(0.0, 0.42, abs(vUv.y - 0.62 - (vUv.x - 0.5) * 0.30));
  if (starAmt > 0.001) {
    /* 은하수 — 비스듬한 띠 하나. 이게 있어야 밤하늘이 "점 찍어 놓은 것"에서 벗어난다 */
    float milky = band * (0.35 + 0.65 * fbm(sp * 2.6 + 4.0)) * 0.17;
    col += vec3(0.62, 0.68, 0.95) * milky * starAmt;

    /* 위로 갈수록 촘촘하게 — 수평선 근처는 옅은 대기에 가려진 셈 */
    float up = smoothstep(0.02, 0.65, vUv.y);
    float s = starField(sp * 46.0, 0.972, 0.085)
            + starField(sp * 78.0, 0.984, 0.060) * 0.75
            + starField(sp * 27.0, 0.990, 0.115) * 1.20;   /* 드문 큰 별 */
    s += band * starField(sp * 96.0, 0.975, 0.055) * 0.5;  /* 은하수엔 더 빽빽하게 */
    col += vec3(0.92, 0.95, 1.0) * s * up * starAmt;
  }

  /* ---- 거대 행성 — 판타지 세계관의 "저 하늘의 지구" ----
   * 성 바로 위에 띄운다. 낮에도 흐릿하게 남는다 —
   * 아이가 "저게 뭐야?" 하고 물어보라고. */
  {
    vec2 c = vec2(uAspect * 0.50, 0.70);
    float r = 0.26;
    float d = length(sp - c);
    float disc = 1.0 - smoothstep(r * 0.985, r, d);
    if (disc > 0.001) {
      vec2 uvp = (sp - c) / r;
      float z = sqrt(max(0.0, 1.0 - dot(uvp, uvp)));      /* 구 표면으로 올린다 */
      vec3 n = normalize(vec3(uvp, max(z, 0.001)));
      /* 대륙 — 노이즈를 구면 좌표로 감아 아주 천천히 돌린다 */
      vec2 sph = vec2(atan(n.x, n.z) * 0.55 + uTime * 0.006, n.y * 0.9);
      float land = fbm(sph * 3.4 + 11.0);
      vec3 surf = mix(vec3(0.09, 0.26, 0.55), vec3(0.24, 0.42, 0.22),
                      smoothstep(0.50, 0.60, land));
      surf = mix(surf, vec3(0.86, 0.90, 0.96), smoothstep(0.70, 0.80, land) * 0.55);
      /* 명암 경계 — 빛은 해 쪽에서 온다 */
      vec3 ldir = normalize(vec3(uSunX * 2.0 - 1.0, 0.30, 0.80));
      float lam = clamp(dot(n, ldir), 0.0, 1.0);
      surf *= 0.14 + 0.86 * smoothstep(0.0, 0.55, lam);
      /* 대기 테두리 */
      surf += vec3(0.35, 0.60, 1.0) * smoothstep(0.55, 1.0, 1.0 - z) * lam * 0.5;
      /* 낮에는 흔적만. 0.3 쯤 주니 하늘에 비눗방울이 뜬 것처럼 보였다. */
      float vis = mix(0.14, 1.0, smoothstep(0.15, 0.75, uNight));
      col = mix(col, surf, disc * vis);
    }
  }

  /* ---- 해 ---- */
  {
    float isNight = smoothstep(0.35, 0.78, uNight);
    vec2 c = vec2(uAspect * clamp(uSunX, 0.04, 0.96), uSunY);
    float d = length(sp - c);
    float disc = 1.0 - smoothstep(0.098, 0.116, d);
    float halo = pow(1.0 - smoothstep(0.0, 0.70, d), 2.4);
    col += uSunColor * halo * 0.40 * (1.0 - isNight);
    col = mix(col, uSunColor * 1.35, disc * (1.0 - isNight));
  }

  /* ---- 달 — 위상이 웨이브를 따라 차오른다 ---- */
  {
    float isNight = smoothstep(0.30, 0.72, uNight);
    vec2 c = vec2(uAspect * clamp(uMoonX, 0.04, 0.96), 0.60);
    float d = length(sp - c);
    float r = 0.115;
    float disc = 1.0 - smoothstep(r * 0.95, r, d);
    /* 가림 원을 옆으로 밀어 초승달을 만든다. 완전히 비켜나면 보름. */
    float shade = 1.0 - smoothstep(r * 0.95, r * 1.02, length(sp - (c + vec2(uMoonPhase * 2.3 * r, 0.0))));
    float lit = clamp(disc - shade, 0.0, 1.0);
    float cr = fbm((sp - c) * 24.0);
    vec3 moonCol = mix(vec3(0.90, 0.92, 0.88), vec3(0.64, 0.68, 0.73), smoothstep(0.44, 0.62, cr));
    col += vec3(0.75, 0.82, 1.0) * pow(1.0 - smoothstep(0.0, 0.44, d), 3.0) * 0.20 * isNight;
    /* 어두운 면도 아주 희미하게 — 달이 원반이 아니라 공으로 보인다 */
    col = mix(col, moonCol * 0.15, clamp(disc - lit, 0.0, 1.0) * isNight * 0.75);
    col = mix(col, moonCol, lit * isNight);
  }

  /* ---- 구름 — 가로로 흐른다 ---- */
  {
    vec2 q = sp * vec2(1.15, 2.4) + vec2(uTime * 0.011, 0.0);
    float n = fbm(q);
    n = fbm(q + vec2(n * 0.6, n * 0.3));                 /* 한 번 더 접어 뭉게뭉게 */
    /* 구름은 "군데군데 뭉게구름"이어야 한다. 문턱을 낮게 잡았더니 온통 흐린 날이 돼
     * 하늘색도 해도 다 묻혔다 — 성기게, 위쪽은 비워 둔다. */
    float mask = smoothstep(0.04, 0.34, vUv.y) * (1.0 - smoothstep(0.40, 0.86, vUv.y) * 0.85);
    float c = smoothstep(0.66 - uCloud * 0.14, 0.88, n) * mask;
    vec3 cloudCol = mix(vec3(1.0, 0.99, 0.96), uSunColor, 0.35);
    cloudCol = mix(cloudCol, vec3(0.26, 0.32, 0.52), uNight * 0.85);
    col = mix(col, cloudCol, clamp(c, 0.0, 1.0) * (0.45 + 0.35 * (1.0 - uNight)));
  }

  /* 맨 아래는 안개색으로 완전히 녹인다 — 바다와 만나는 이음매.
   * 여기가 어설프면 하늘이 아무리 예뻐도 "붙여 놓은 그림"으로 보인다. */
  col = mix(uHorizon, col, smoothstep(0.0, 0.24, vUv.y));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class SkyBand {
  /* fraction: 화면 높이에서 하늘이 차지할 비율 */
  constructor(camera, fraction = 0.17) {
    this.camera = camera;
    this.fraction = fraction;
    this.uniforms = {
      uHorizon: { value: new THREE.Color(0xcfe9ff) },
      uZenith: { value: new THREE.Color(0x5aa8e8) },
      uSunColor: { value: new THREE.Color(0xfff2d8) },
      uTime: { value: 0 },
      uNight: { value: 0 },
      uCloud: { value: 0.55 },
      uAspect: { value: 9 },
      uMoonPhase: { value: 0.5 },
      uSunX: { value: 0.78 },
      uSunY: { value: 0.62 },
      uMoonX: { value: 0.22 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      depthTest: false,        /* 게임 위에 덮어 그린다 */
      depthWrite: false,
      /* 알파는 늘 1이지만 transparent 를 켜야 한다.
       * 불투명 큐에 두면 그 뒤에 그려지는 투명 오브젝트(바다!)가 하늘을 덮어 버린다.
       * 투명 큐 안에서는 renderOrder 가 우선하므로 900 이 확실히 마지막이 된다. */
      transparent: true,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.renderOrder = 900;
    this.mesh.frustumCulled = false;
    camera.add(this.mesh);     /* 카메라 자식 — 화면에 붙어 따라다닌다 */
    this.layout();
  }

  /* 절두체 안에서 위쪽 fraction 만큼을 정확히 덮도록 크기·위치를 잡는다.
   * 창 크기나 fov 가 바뀌면 다시 불러야 한다. */
  layout() {
    const cam = this.camera;
    const dist = 1;                                      // 카메라 앞 1
    const h = 2 * Math.tan((cam.fov * Math.PI / 180) / 2) * dist;
    const w = h * cam.aspect;
    const bh = h * this.fraction;
    this.mesh.scale.set(w * 1.02, bh * 1.02, 1);
    this.mesh.position.set(0, h / 2 - bh / 2, -dist);
    this.uniforms.uAspect.value = (w / bh) || 9;
  }

  /* moonPhase: 0 신월 → 1 보름. 웨이브가 지날수록 차오르게 쓰면
   * 하늘만 봐도 얼마나 버텼는지 알 수 있다. */
  frame(dt, t, palette, moonPhase) {
    const u = this.uniforms;
    u.uTime.value = t;
    u.uHorizon.value.copy(palette.fog);                  // 바다와 같은 색으로 만난다
    u.uZenith.value.copy(palette.zenith);
    u.uSunColor.value.copy(palette.sun);
    u.uNight.value = palette.night;
    u.uCloud.value = palette.cloud;
    u.uMoonPhase.value = moonPhase;
    /* 해는 하루가 갈수록 오른쪽으로 기울며 내려앉고(방향광 sunPos 와 같은 쪽),
     * 달은 반대편에서 떠오른다. 행성은 성 위에 고정. */
    const day = 1 - palette.night;
    u.uSunX.value = 0.70 + palette.night * 0.20;
    u.uSunY.value = 0.24 + day * 0.44;
    u.uMoonX.value = 0.20;
  }

  dispose() {
    this.camera.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
