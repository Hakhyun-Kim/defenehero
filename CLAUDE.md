# CLAUDE.md — 코드를 읽고 고치는 사람을 위한 안내

어린이(초3~6) 수학 디펜스 게임. 수학 문제를 풀어야 용사를 조합할 수 있고,
빨리·한 번에 풀수록 더 강해진다. **외부 에셋 0개** — 그래픽(Three.js 절차 생성),
효과음/BGM(Web Audio 합성), 폰트 외 이미지·음원 파일이 없다.

## 명령어

```bash
npm run build          # esbuild: src/main.js → dist/game.js (IIFE 번들)
npm run watch          # 같은 번들을 파일 변경마다
npm run serve          # 정적 서버 (PORT 환경변수, 기본 8642)
npm run check          # ↓ 세 가지를 순서대로 — 커밋 전 필수
npm run engine:check   #   엔진 불변식 (배치/조합/교환/잔치 규약)
npm run math:check     #   문제 생성기 (3000문제: 답 성립·학년 한도·상태 불변)
npm run balance:check  #   봇 시뮬레이션 60판 — 기준선(balance-baseline.json) ±5웨이브
npm run balance        # 밸런스 리포트 (150판 × 3난이도 × 3실력)
```

브라우저 스모크 테스트: `?demo=고수&mute` 로 열면 봇이 실제 UI 경로로 게임을 한다
(소환→배치→수학 문제 풀이→웨이브). **데모가 살아 있는 회귀 테스트다** — 어딘가
망가지면 데모가 먼저 멈춘다. 콘솔 훅: `__game.state`, `__game.gold(1000)`,
`__game.jump(10)`, `__game.hurt(50)`.

URL 플래그: `?mute`(소리 끔) · `?gfx=high|lite|min` · `?decor=on|off`(배경 장식) ·
`?mobile=1`(모바일 판정 강제) · `?hour=18.5`(시간대 강제) · `?rafshim`(숨김 탭 타이머).

## 아키텍처 — 계층은 아래로만 의존한다

```
main.js ─┬─ app/      오케스트레이션 (store · mathflow)
         ├─ ui.js     DOM 패널/모달 (UI 클래스 하나)
         ├─ gfx/      Three.js 렌더링
         ├─ sfx.js · music.js   Web Audio 합성
         ├─ demo.js → bot.js    자동 플레이 (사람과 같은 경로만 사용)
         └─ engine.js → engine/  순수 게임 로직 (DOM/THREE 금지)
                          └─ data.js → balance/  튜닝 상수
math.js → mathgen/    문제 생성기 (arithmetic=교과서 산술, tactical=판을 읽는 문제)
story.js              내러티브 텍스트 (이야기 비트 · 별지기 수다)
```

| 위치 | 내용 |
|---|---|
| `src/engine.js` | **재수출 허브** — 소비자는 전부 `import * as E from './engine.js'` 하나만 쓴다 |
| `src/engine/state.js` | createGame · serialize/deserialize (저장 = 준비 단계 스냅샷) |
| `src/engine/champion.js` | 별지기 능력치·경험치·스킬트리 |
| `src/engine/roster.js` | 소환·조합(listCombos/bestCombo)·배치·판매·잔치 |
| `src/engine/economy.js` | 성 업그레이드 · 수학 환급/재도전/힌트 회계 |
| `src/engine/combat.js` | 웨이브 생성 · `tick(state, dt)` 전투 시뮬 · 별똥별/은하수 |
| `src/app/store.js` | localStorage (별조각·축복·자동저장·꾸미기) + 누적 기록(도감 `codex`·수학 `mathLog`·업적 `earned` — 메모리 캐시, `flushRecords()`로 지연 저장) |
| `src/app/mathflow.js` | **수학 관문 흐름** — 난이도 뽑기·제한 시간·재도전·힌트·환급. `createMathFlow(ctx)` 팩토리로 main이 조립 |
| `src/analytics.js` | **데이터 분석** — GameAnalytics 래퍼 (프로그레션, 수학 결과, 커스텀 이벤트). `src/analytics.config.js`에서 키를 로드 |
| `src/analytics.config.js` | GameKey/SecretKey (**커밋됨** — 공개 전제 값). 수집 허용 위치는 `analytics.js`의 `COLLECT_HOSTS` |
| `src/app/layout.js` | **앱 전용 레이아웃** — 앱에서만 컨트롤을 ⚙️ 설정 모달로 옮기고 벤치를 탭으로 만든다 |
| `src/gfx/renderer.js` | Renderer3D 본체 (씬·뷰 동기화·이벤트→연출·프레임) |
| `src/gfx/world.js` `fx.js` | Renderer3D에 **프로토타입 믹스인**으로 붙는 지형/성 · 이펙트 |
| `src/gfx/units3d.js` | 용사 13종+별지기 3D 모델 · 오프스크린 초상 렌더 |
| `src/gfx/common.js` | 좌표 변환(wx/wz) · 재질 · 절차 생성 텍스처 |
| `src/gfx/nature.js` `sky.js` | 배경 셰이더 (잔디·바다·반딧불이 / 하늘 밴드) |
| `src/balance/` | **밸런스 수치는 여기서만 고친다** (field·heroes·enemies·castle·economy·mathgate·champion·achievements) |
| `scripts/` | Node에서 engine을 직접 import 하는 검증/봇 (그래서 engine에 DOM이 없어야 한다) |

## 핵심 데이터 흐름

1. **틱**: main의 고정 타임스텝 루프(1/60)가 `E.tick(state, dt)` 호출 →
   엔진은 **이벤트 배열**을 반환 (`{type:'kill', x, y, gold, ...}`).
   main이 두 곳에 배분한다: `renderer.onEvents()`(시각 효과) + `handleEvents()`(사운드·토스트).
   엔진은 절대 직접 그리거나 소리 내지 않는다.
2. **수학 관문**: 조합 버튼 → `flow.openMath('combine', pending)` → 난이도 뽑기(cardRoll)
   → `MathGen.gen(grade, lv)` → 정답 시 `E.combineRankUp/combineRecipe` + 환급.
   pending과 listCombos 항목은 `E.comboKey()`로 같은 문자열이 나와야 한다(잠금 키).
3. **렌더 동기화**: `renderer.sync(state)`가 매 프레임 상태→뷰를 맞추고(id 기반 Map),
   `renderer.frame(dt, state)`가 애니메이션을 돌린다.
4. **판을 넘는 진행**: 30웨이브 클리어 → 엔진이 `victory` 이벤트 → main이 별조각 지급 +
   승리 모달 → "별의 시련" 선택 시 `E.nextLoop(state)` (별지기 성장 유지 · 용사/골드/성 리셋 ·
   `state.loop`+1 → 몬스터가 `loopHpMul` 배율로 세짐). 도감/수학 기록/업적은 store의
   누적 기록에 쌓이고 `checkAchievements()`(main)가 달성을 평가한다 —
   **데모(봇) 중에는 기록·업적이 전부 멈춘다** (`demo.active` 가드).

## 지켜야 할 규약 (어기면 조용히 깨진다)

- **엔진은 순수 로직** — DOM·THREE·Audio 금지. scripts/가 Node에서 import 한다.
- **게임에 영향 주는 난수는 `state.rng`만** (저장/불러오기로 리롤 못 하게).
  문제 난이도 뽑기는 일부러 `Math.random` — 문제를 뽑았다고 웨이브가 바뀌면 안 된다.
- **`padIndex: -1` = 벤치** 규약. null을 넣으면 `null >= 0`이 true라 "배치됨"으로 샌다.
- **저장은 준비 단계 스냅샷만** — 전투 중 상태(몬스터·투사체)는 직렬화하지 않는다.
  저장 파일은 사용자가 고칠 수 있는 입력이므로 deserialize는 값 하나하나 clamp 한다.
- **렌더러: 런타임 지오메트리 생성 금지** — 파티클·숫자·링·별똥별은 전부 풀(pool) 재사용.
  성 강화 부품도 미리 만들어 두고 visible만 켠다.
- **매 프레임 불리는 UI 메서드는 "값이 바뀔 때만" DOM을 만진다**
  (comboChip·updateChampChip·setTimer 참고 — 시그니처 문자열 비교).
- **교환·이동은 공격 쿨다운을 유지한다** — 자리를 바꿔 쿨다운을 초기화하는 꼼수 방지.
- **수학 관문의 골드 원칙**: 재도전·힌트를 사서 조합 골드가 모자라지는 일이 없어야 한다
  (사기 전에 조합 비용을 떼어 놓고 판단). "정답인데 골드 부족"이 최악의 결말.
- **애널리틱스 수집 범위**: GameAnalytics 키(`src/analytics.config.js`)는 **커밋한다** — 웹 SDK가
  브라우저에서 이 키로 HMAC 서명을 만들므로 배포본에 노출될 수밖에 없다. 대신 fork·미러·로컬의
  트래픽이 대시보드에 섞이지 않게 `analytics.js`의 `COLLECT_HOSTS` 게이트가 실행 위치를 본다.
  **키를 숨기거나 암호화하는 방식으로 fork를 막으려 하지 말 것** — fork는 복호화 코드까지 가져간다.
  안드로이드는 `Capacitor.isNativePlatform()`으로 가른다 (웹 빌드에도 `window.Capacitor` shim이 있어
  존재 여부로 판별하면 모든 브라우저가 통과한다). 키가 없어도 게임이 멈추지 않고 콘솔 로깅으로 대체한다.
- **손안 화면 배치는 손안 화면에만** — 전체화면 3D + 떠 있는 HUD + ⚙️ 설정 모달은
  `Capacitor.isNativePlatform()` **또는** 손가락 화면 + 짧은 변 ≤820px 일 때만 켠다
  (`app/layout.js`의 `useAppLayout`). 터치 노트북·터치 모니터까지 접히면 안 되므로 크기로 거른다.
  CSS는 예외 없이 `body.app-mobile` 스코프 안에, DOM 재배치는 `app/layout.js` 한 곳에.
  스코프 없이 넣었다가 데스크톱 웹까지 같이 접힌 적이 있다.
  **컨트롤을 복제하지 말 것** — 같은 id 가 둘이면 UI 가 잡은 쪽과 사용자가 누르는 쪽이 갈려서
  눌러도 아무 일 없는 버튼이 생긴다. 복제 대신 원본 노드를 옮긴다. 검증: `?applayout=1`
- **전체화면 배치는 가로 화면 설계다** — 앱은 `sensorLandscape` 로 잠겨 늘 가로지만 폰
  브라우저는 세로로도 열린다. 폭 375px 에 280px 패널을 띄우면 전장에 95px 만 남는다.
  세로는 `@media (orientation: portrait)` 로 예전처럼 한 줄로 쌓는다 — **회전할 때 DOM 을
  도로 옮기지 말 것.** 옮긴 채로 두고 화면만 미디어 쿼리로 가르면 되돌릴 것이 없다.
- **폰용 편의는 폰에서만** — 5초 자동 선택 해제 같은 것. 마우스에서는 고르고 고민하는 사이에 풀린다.
- 주석은 **왜**를 적는다 — 무엇을 하는지는 코드가 말한다. 기존 주석의 설계 배경
  (실패했던 시도 포함)은 지우지 말 것.

## 커밋 메시지

영어로 작성한다. (Commit messages must be written in English.)
예: `Fix champion placement on mobile touch`, `Match ratio answer options with question format`.

## 문서

- `README.md` — 플레이어/방문자용 게임 소개 + 설계 결정 기록 (되도록 함께 갱신)
- `CREDITS.md` — 방법론 출처
- 밸런스 기준선: 의도한 밸런스 변경이면 `node scripts/balance-bot.mjs 150 check`로 새 중앙값을 재고
  `scripts/balance-baseline.json`의 medians를 손으로 갱신한다
