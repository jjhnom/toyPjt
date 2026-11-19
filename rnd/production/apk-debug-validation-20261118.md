# 최신 디버그 APK 빌드 및 정적 검증

- 작업일: 2026-11-18 (KST)
- 기준: 로컬 `047e9ee` 및 현재 작업 트리의 BGM·입력·개발 서버 개선 사항.
- 이번 작업에서 게임 소스·Android 패키지명·버전·서명·배포 설정 변경 없음. Capacitor 생성 파일에도 Git 내용 변경 없음.

## 산출물

- [디버그 APK](../artifacts/apk/summoners-expedition-input-fix-20261118-debug.apk)
- 크기: 27,109,543바이트 (약 27.1MB)
- SHA-256: `fcabd140c0c3d077f6386039ae10f88235cdfabd40774cc0d7307ae76d487152`
- 패키지: `com.yourstudio.smashroguelike`
- 앱 이름: 소환사의 원정 / versionCode 1 / versionName 1.0
- minSdk 22 / targetSdk 34 / compileSdk 34

## 실행 환경과 결과

기존 `artifacts/android-toolchain/`의 Microsoft OpenJDK 17.0.21.0.2 및 Android SDK 34·Build Tools 34.0.0을 사용했다. Gradle Wrapper가 지정한 것과 같은 버전인 기존 캐시의 Gradle 8.2.1을 직접 실행해 새 배포본 다운로드를 피했다.

1. `npm test`: **266/266 통과**, 실패·skip 0. [로그](../artifacts/apk-validation-20261118/unit-tests.log)
2. `npm run build`: **성공**. 기존 500kB 초과 청크 경고 유지. [로그](../artifacts/apk-validation-20261118/web-build.log)
3. `node node_modules/@capacitor/cli/bin/capacitor sync android`: **성공**. 제한 환경에서는 Ionic CLI의 `os.userInfo()`가 ENOMEM을 반환했으나 일반 실행 권한에서 정상 완료했다. 의존성을 수정하지 않았다.
4. JDK/SDK 환경 변수를 해당 프로세스에 지정하고 Android 디렉터리에서 기존 Gradle 8.2.1로 `--offline --no-daemon --console=plain assembleDebug`: **성공**, 1분 19초. 82개 작업 중 45개 실행, 37개 최신 상태. 기존 flatDir 경고 있음. [로그](../artifacts/apk-validation-20261118/gradle-build.log)
5. `apksigner verify --verbose --print-certs`: **성공**, 기존 Android Debug 인증서, v1/v2 서명 검증. [로그](../artifacts/apk-validation-20261118/signature.log)
6. `zipalign -c -v 4`: **성공**. [로그](../artifacts/apk-validation-20261118/zipalign.log)
7. `aapt dump badging`: 패키지·버전·SDK·앱 이름·실행 Activity 확인. [로그](../artifacts/apk-validation-20261118/badging.log)
8. APK의 `assets/public/`과 최신 `dist/` 비교: **웹 자산 71개 전체 SHA-256 일치**. BGM 3곡·JS 번들·이미지/아틀라스를 포함한다. [파일별 결과](../artifacts/apk-validation-20261118/asset-verification.json)
9. `git diff --check -- .`: 통과. Android 및 Capacitor 설정·의존성 파일에 새 Git 내용 변경 없음.

## 남은 검증과 다음 작업

이번 결과는 실제 SDK/JDK를 사용한 로컬 APK 빌드와 정적 검증이다. Android 기기에 설치하거나 실행하지 않았으므로 설치·업데이트·WebView·터치·오디오·홈/잠금 후 복귀·장시간 성능은 미검증이다. 이전 브라우저 양손 입력 및 전체 스모크 통과 결과는 [브라우저 검증 보고서](browser-validation-recovery-20261118.md)를 따른다.

다음은 실제 Android 기기에서 양손 입력의 양쪽 순서, 터치 취소, 홈/잠금 후 이동 정지, 정비 모달과 복귀가 겹칠 때 전투 정지, 체력·재화·쿨타임 유지, BGM/SFX 잠금 해제를 확인하는 작업이다. GitHub Actions에서 수정본이 성공한 결과는 아직 없으며 push/merge·릴리스 배포는 수행하지 않았다.
