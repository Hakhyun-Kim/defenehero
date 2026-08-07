# Play 스토어 출시 가이드 — 용사 수학 디펜스

## 지금까지 준비된 것 ✅

- `android/` — Capacitor 안드로이드 프로젝트 (앱 ID: `com.metah.defenehero` — **스토어 첫 업로드 전 최종 확정 필요, 업로드 후 변경 불가**)
- 런처 아이콘 + 스플래시 기본 생성 완료 (`android/app/src/main/res/`)
- 업로드 서명 설정 지원 (`android/app/build.gradle`에 `keystore.properties` 연동 구성 완료)
- 개인정보처리방침: `https://metah.dev/privacy/defenehero/` (원본: D:\MetaH\public\privacy\defenehero\index.html — **main 푸시 시 자동 배포**)

> ⚠️ **키스토어 생성 및 백업 필수!** `upload-keystore.jks`와 `keystore.properties` 두 파일을
> 클라우드 등 안전한 곳에 복사해 두세요. 분실하면 앱 업데이트를 올릴 수 없습니다.
> 이 파일들은 .gitignore에 추가하여 git에 올리지 마세요.

---

## 🔑 업로드 키스토어 생성 방법 (최초 1회)

PowerShell에서 아래 명령어로 업로드 서명 키를 생성합니다:

```powershell
keytool -genkeypair -v -keystore android/upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

그리고 `android/keystore.properties` 파일 생성:
```properties
storePassword=본인이설정한비밀번호
keyPassword=본인이설정한비밀번호
keyAlias=upload
storeFile=upload-keystore.jks
```

---

## 🛠️ 빌드 명령 (매번 출시할 때)

```powershell
# 1) 웹 번들링 + 동기화
npm run build
npx cap sync android

# 2) 환경 변수 설정 (Android Studio 내장 JDK 사용)
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'

# 3) 빌드 실행
.\android\gradlew.bat -p android assembleDebug   # 테스트용 APK
.\android\gradlew.bat -p android bundleRelease   # 스토어 제출용 AAB (서명됨)
```

- **테스트 APK**: `android/app/build/outputs/apk/debug/app-debug.apk` → 스마트폰에 직접 전송 후 설치 테스트
- **스토어 AAB**: `android/app/build/outputs/bundle/release/app-release.aab` → Play Console에 업로드

> 버전 업그레이드 시: `android/app/build.gradle`의 `versionCode`(정수, 업로드 때마다 +1) 및 `versionName`(예: "1.0.1") 수정.

---

## 📋 Play Console 출시 절차

1. **계정**: 조직(법인) 계정 프로덕션 권장 (테스터 모집 기간 필요 없음).
2. **앱 생성**:
   - **앱 이름**: 용사 수학 디펜스: 초등 수학 타워 디펜스
   - **기본 언어**: 한국어
   - **앱/게임**: 게임
   - **무료/유료**: 무료
3. **앱 콘텐츠 설문** (콘솔 좌측 메뉴 '앱 콘텐츠'):
   - **개인정보처리방침**: `https://metah.dev/privacy/defenehero/`
   - **광고**: "아니요, 앱에 광고가 없습니다"
   - **앱 액세스 권한**: "제한 없이 모든 기능 이용 가능"
   - **콘텐츠 등급 설문**: 게임 카테고리 선택 후 모든 폭력성/선정성 "아니요" → 전체이용가
   - **타겟층 및 콘텐츠**: 만 8세까지 포함 선택 (초등 3~6학년) → **가족 정책** 적용
     - 이 앱: 광고 없음, 데이터 수집 없음, 외부 링크 없음 → 가족 정책 충족
   - **데이터 보안 폼**: "수집하는 데이터 없음 / 공유하는 데이터 없음" 선택
4. **스토어 등록정보 작성**:
   - 아래 초안 참고
   - 대표 그래픽 (1024×500), 앱 아이콘 (512×512)
   - 스크린샷 (16:9 가로 방향 4장 이상)

---

## 📝 스토어 등록정보 초안

- **앱 이름**: 용사 수학 디펜스: 초등 수학 타워 디펜스
- **간단한 설명** (80자 이내):
  > 🧮 수학 문제를 풀수록 용사가 강력해진다! 초등 3~6학년 3D 수학 타워 디펜스 게임.
- **자세한 설명**:
  > 🏰 **용사 수학 디펜스 — 셈이 맞아야 성을 지킨다!**
  >
  > 마왕군의 침략으로부터 성을 지키기 위해 용사를 조합하세요!
  > 교과서 산술부터 전술 문제까지, 수학 문제를 빠르고 정확하게 풀수록 더 강한 용사와 많은 골드를 얻을 수 있습니다.
  >
  > ⚔️ **신나는 3D 타워 디펜스**
  > - 기사, 마법사, 궁수, 별지기 등 13종의 용사를 소환하고 전략적으로 배치하세요.
  > - 세 갈래 길로 몰려오는 몬스터와 보스 드래곤을 막아내세요.
  >
  > 🧮 **초등 3~6학년 맞춤 수학 관문**
  > - 3학년 분수·나눗셈부터 6학년 비례식·비율 문제까지!
  > - 연속 정답(연승) 시 보너스 골드와 희귀 용사 확정 소환!
  >
  > 🌟 **성장과 별의 축복**
  > - 30웨이브를 클리어하고 별지기를 성장시키세요.
  > - 별조각을 모아 영구적인 별의 축복을 받고 더 높은 시련에 도전하세요.
  >
  > ✅ 회원가입 없음, 광고 없음, 데이터 수집 없음. 모든 기록은 기기에 안전하게 저장됩니다.
- **카테고리**: 게임 > 교육
- **태그**: 교육, 초등, 수학, 디펜스, 타워디펜스, 게임

---

## 📱 폰에 바로 설치하여 테스트

1. `.\android\gradlew.bat -p android assembleDebug` 실행
2. `android/app/build/outputs/apk/debug/app-debug.apk` 파일 생성 확인
3. 카카오톡/드라이브 등으로 스마트폰 전송 후 설치 및 실행 테스트!
