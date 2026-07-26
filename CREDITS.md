# 애셋 출처 및 라이선스

이 게임에서 쓰는 모든 애셋의 출처와 라이선스를 한 곳에 적어 둔다.
**원칙: 라이선스가 확인되지 않은 애셋은 쓰지 않는다.**

## 폰트 (외부 리소스)

| 폰트 | 용도 | 저작자 | 라이선스 | 출처 |
|---|---|---|---|---|
| **Jua** | 전체 UI 기본 서체 | Woowahan Brothers | [SIL Open Font License 1.1](https://openfontlicense.org/) | [Google Fonts](https://fonts.google.com/specimen/Jua) |
| **Gaegu** | 수학 문제·정답 입력란 | Eunyoung Choi (yangheeryu) | [SIL Open Font License 1.1](https://openfontlicense.org/) | [Google Fonts](https://fonts.google.com/specimen/Gaegu) |

OFL 1.1은 상업적 이용·수정·재배포를 모두 허용한다. 조건은 두 가지뿐이다.
폰트 자체를 단독 판매하지 말 것, 그리고 저작권 표시를 유지할 것 — 이 문서가 그 표시다.

폰트는 Google Fonts CDN에서 `<link>`로 불러온다([index.html](index.html)).
네트워크가 없으면 `Segoe UI` / `Malgun Gothic` 시스템 폰트로 자연스럽게 대체되도록
`font-family` 폴백을 걸어 두었다 — 오프라인에서도 레이아웃이 깨지지 않는다.

## 그래픽 — 전부 코드 생성 (외부 리소스 0개)

| 항목 | 만드는 법 | 위치 |
|---|---|---|
| 잔디·길·성벽 텍스처 | Canvas 2D 절차 생성(노이즈 + 붓질 + 벽돌 패턴) | [src/render3d.js](src/render3d.js) `grassTexture()` 등 |
| 용사·몬스터 모델 | Three.js 기본 지오메트리 조합(사람 형태 13종) | [src/render3d.js](src/render3d.js) `_makeHeroModel()` |
| 성·나무·포탈 | 동일 | [src/render3d.js](src/render3d.js) |
| 이펙트(폭발·충격파·빛기둥) | 동일 + 절차 생성 글로우 스프라이트 | [src/render3d.js](src/render3d.js) |
| 이모지 아이콘 | 시스템 이모지 폰트를 캔버스에 렌더 | [src/render3d.js](src/render3d.js) `emojiTexture()` |

외부 3D 모델·스프라이트 팩은 **의도적으로 쓰지 않았다.** 이유는 두 가지다.
① 아트 스타일이 섞이면 오히려 통일감이 깨진다. ② 팩마다 라이선스 조건(크레딧 표기 방식,
재배포 가능 여부)이 달라 검증 비용이 크다. 특정 CC0 팩을 쓰고 싶다면 이 표에 한 줄 추가하면 된다.

## 사운드 — 전부 코드 합성 (음원 파일 0개)

| 항목 | 만드는 법 | 위치 |
|---|---|---|
| 효과음 30여 종 | Web Audio 오실레이터 + 노이즈 버퍼 합성 | [src/sfx.js](src/sfx.js) |
| BGM 4트랙 | 코드 진행 기반 절차 생성(패드·아르페지오·베이스·드럼) | [src/music.js](src/music.js) |
| 리버브 | 피드백 딜레이 + 로우패스 | [src/music.js](src/music.js) `ensureGraph()` |
| 마스터링 | 리미터(DynamicsCompressor) + 고역 셸빙 | [src/sfx.js](src/sfx.js) `getAc()` |

외부 음원은 **그대로 재생하지 않는다.** 샘플을 쓰게 되더라도 반드시 합성 소스로
변형해서 쓴다는 것이 이 프로젝트의 규칙이다. 현재는 파일이 0개라 재생 라이선스 이슈 자체가 없다.

## 라이브러리

| 라이브러리 | 라이선스 |
|---|---|
| [Three.js](https://threejs.org/) | MIT |
| [esbuild](https://esbuild.github.io/) (빌드 전용) | MIT |

## 새 애셋을 추가할 때

1. 라이선스 전문을 직접 확인한다 (README의 한 줄 요약을 믿지 않는다).
2. 상업적 이용·수정·재배포가 모두 허용되는지 본다 (CC0 / MIT / OFL / CC-BY 정도).
3. CC-BY라면 크레딧 표기가 필수다 — 이 문서에 저작자와 원본 링크를 적는다.
4. 이 표에 한 줄 추가한다. 표에 없는 애셋은 저장소에 들어오지 않는다.
