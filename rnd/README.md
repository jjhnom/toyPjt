# 소환사의 원정

Phaser 3·TypeScript·Capacitor로 만든 픽셀 판타지 로그라이크입니다. 마력석으로 동료를 소환하고, 동종·이종 조합과 출전 편성으로 던전을 진행합니다.

## 웹 실행

```sh
npm ci
npm run dev
npm test
npm run build
```

## Android APK

저장소 루트의 `.github/workflows/build-apk.yml`이 `rnd/` 변경을 감지해 테스트·웹 빌드·Capacitor 동기화·디버그 APK 빌드를 실행합니다. GitHub Actions의 `Build Pixel Fantasy APK` 실행 결과에서 `summoners-expedition-debug-apk` 아티팩트를 내려받으면 됩니다. 아티팩트 보관 기간은 14일입니다.

로컬 빌드는 JDK 17, Android SDK Platform 34, Build Tools 34.0.0이 필요합니다. SDK 위치는 환경변수 또는 커밋하지 않는 `android/local.properties`의 `sdk.dir`로 지정합니다.

```sh
npm run cap:sync
cd android
./gradlew assembleDebug --no-daemon
```

Windows에서는 `gradlew.bat assembleDebug --no-daemon`을 사용합니다. APK 출력은 `android/app/build/outputs/apk/debug/app-debug.apk`입니다. 디버그 키로 서명된 설치·테스트용 APK이며 스토어 배포용 서명은 별도로 설정합니다.

소환 비용·조합표는 `src/config/squadData.ts`, 도트 그래픽은 `src/ui/pixelCharacters.ts`, 화면 테마는 `src/ui/fantasyTheme.ts`에서 수정합니다.
