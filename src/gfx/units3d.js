/* =====================================================
 * 사람 모양 용사 13종 + 별지기 (치비, +Z를 바라봄) · 초상 렌더
 * 몸통 조립은 makeHumanBase 하나로 — 용사와 별지기가 같은 뼈대를 쓴다.
 * ===================================================== */
import * as THREE from 'three';
import * as D from '../data.js';
import { lam, glow } from './common.js';

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

/* ---------- 공용 몸통 ----------
 * 다리·몸통·허리띠·양팔·머리(눈까지)를 조립한다.
 * legPivots: 걷는 캐릭터(별지기)는 다리에 피벗을 잡아 refs.legs로 돌려준다. */
function makeHumanBase({ tunic, sleeve, pants, belt, legPivots = false }) {
  const g = new THREE.Group();
  const refs = {};

  if (legPivots) {
    refs.legs = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.09 * sx, 0.2, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.13), lam(pants));
      leg.position.y = -0.1;
      pivot.add(leg);
      g.add(pivot);
      refs.legs.push(pivot);
    }
  } else {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.13), lam(pants));
      leg.position.set(0.09 * sx, 0.1, 0);
      g.add(leg);
    }
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.3), lam(tunic));
  body.position.y = 0.41;
  g.add(body);
  refs.body = body;
  const beltM = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.32), lam(belt));
  beltM.position.y = 0.24;
  g.add(beltM);

  const armL = new THREE.Group();
  armL.position.set(-0.27, 0.6, 0);
  const armLmesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), lam(sleeve));
  armLmesh.position.y = -0.12;
  armL.add(armLmesh);
  g.add(armL);
  refs.armL = armL;

  const armPivot = new THREE.Group();
  armPivot.position.set(0.27, 0.6, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), lam(sleeve));
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

  return { g, refs, head, armL, armPivot };
}

export function makeHumanHero(cls, tier) {
  const look = CLASS_LOOK[cls];
  const { g, refs, head, armL, armPivot } = makeHumanBase({ ...look, belt: 0x3a2f24 });

  const holdRight = (mesh) => {
    mesh.position.set(0, -0.26, 0.06);
    mesh.rotation.x = Math.PI / 5;
    armPivot.add(mesh);
  };
  const holdLeft = (mesh, z = 0.14) => {
    mesh.position.set(-0.1, -0.16, z);
    armL.add(mesh);
  };
  /* 왼손 보조 검 (쌍검 직업) — holdRight와 같은 자세로 왼팔에 */
  const holdLeftSword = (mesh) => {
    mesh.position.set(0, -0.26, 0.06);
    mesh.rotation.x = Math.PI / 5;
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
      holdLeftSword(makeSword(lam(0xd8f4ec)));
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
      holdLeftSword(makeSword(glow(0xfff3b0)));
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
 * 별지기 — 길을 걷는 메인 캐릭터 (걷기용 다리 피벗 포함)
 * look(옷장 선택)이 색과 파츠를 정한다 — 스킨은 데이터다.
 * ===================================================== */
export function makeChampion(look) {
  const L = D.champLookOf(look);
  const outfit = D.CHAMP_WARDROBE.outfit.options[L.outfit];
  const hairColor = D.CHAMP_WARDROBE.hair.options[L.hair].color;
  const starColor = D.CHAMP_WARDROBE.star.options[L.star].color;
  const { g, refs, head, armL, armPivot } = makeHumanBase({
    tunic: outfit.tunic, sleeve: outfit.sleeve, pants: outfit.pants,
    belt: 0xd9a93d, legPivots: true,
  });

  /* 가슴의 별 문장 */
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), glow(starColor));
  emblem.position.set(0, 0.47, 0.17);
  g.add(emblem);
  refs.emblem = emblem;

  /* 머리카락 + 별 머리핀 (색은 옷장이 정한다) */
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), lam(hairColor));
  hair.position.y = 0.03;
  head.add(hair);
  const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), glow(starColor));
  pin.position.set(0.14, 0.15, 0.1);
  head.add(pin);

  /* 무기 — 별빛 검 / 쌍검 / 별 지팡이 */
  const bladeMat = glow(0xfff0b8);
  const hold = (mesh, arm, rot = Math.PI / 5) => {
    mesh.position.set(0, -0.26, 0.06);
    mesh.rotation.x = rot;
    arm.add(mesh);
  };
  if (L.weapon === 'staff') {
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glow(starColor));
    hold(makeStaff(orb), armPivot, Math.PI / 6);
    refs.staffOrb = orb;
  } else {
    hold(makeSword(bladeMat), armPivot);
    if (L.weapon === 'dual') hold(makeSword(bladeMat), armL);
  }

  /* 망토 */
  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.55),
    new THREE.MeshLambertMaterial({ color: outfit.cape, side: THREE.DoubleSide })
  );
  cape.position.set(0, 0.5, -0.19);
  cape.rotation.x = 0.16;
  g.add(cape);
  refs.cape = cape;

  /* 곁을 도는 작은 별 — 별지기의 표식 */
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.085), glow(starColor));
  star.position.set(0.4, 1.25, 0);
  g.add(star);
  refs.star = star;
  refs.starColor = starColor;

  g.scale.setScalar(1.26);
  return { group: g, refs };
}

/* =====================================================
 * 초상 — 이미지 파일 0개로 "그 캐릭터"의 그림을 얻는다.
 * 3D 조립 함수를 오프스크린에서 한 프레임만 렌더해 PNG dataURL로 굳힌다.
 * 등급별 망토·왕관까지 그대로 나오니 일러스트를 따로 그릴 이유가 없다.
 * 실패하면 null — 호출부는 이모지로 대체한다.
 * ===================================================== */
let _pr = null;
function snapshot(group, px) {
  if (!_pr) {
    _pr = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    _pr.setSize(px, px);
    _pr.outputColorSpace = THREE.SRGBColorSpace;
    _pr.toneMapping = THREE.ACESFilmicToneMapping;
    _pr.toneMappingExposure = 1.15;
  }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a6a, 1.5));
  const key = new THREE.DirectionalLight(0xfff2d8, 2.1);
  key.position.set(2.2, 3.4, 3.0);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd4ff, 1.1);
  rim.position.set(-2.6, 1.6, -2.2);
  scene.add(rim);
  group.rotation.y = Math.PI * 0.12;      // 살짝 비스듬히 — 정면보다 그림처럼 보인다
  scene.add(group);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  cam.position.set(0, 1.28, 3.5);
  cam.lookAt(0, 0.95, 0);
  _pr.render(scene, cam);
  const url = _pr.domElement.toDataURL('image/png');
  scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  return url;
}

const _portraits = new Map();
export function heroPortrait(cls, tier, px = 320) {
  const key = `${cls}:${tier}`;
  if (_portraits.has(key)) return _portraits.get(key);
  let url = null;
  try {
    url = snapshot(makeHumanHero(cls, tier).group, px);
  } catch (e) {
    url = null;                              // WebGL 컨텍스트를 더 못 만드는 기기 등
  }
  _portraits.set(key, url);
  return url;
}

/* look마다 캐시한다: 옷장에서 옷을 갈아입힐 때마다 미리보기를 새로 굽는다 */
const _champPortraits = new Map();
export function champPortrait(look, px = 320) {
  const key = JSON.stringify(D.champLookOf(look));
  if (_champPortraits.has(key)) return _champPortraits.get(key);
  let url = null;
  try {
    url = snapshot(makeChampion(look).group, px);
  } catch (e) {
    url = null;
  }
  _champPortraits.set(key, url);
  return url;
}
