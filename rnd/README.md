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

소환 비용·조합표는 `src/config/squadData.ts`, 소환 유닛 아트 매핑은 `src/ui/unitArt.ts`, 텍스처/애니메이션 키와 적 도트는 `src/ui/pixelCharacters.ts`, 화면 테마는 `src/ui/fantasyTheme.ts`에서 수정합니다. 소환/조합 유닛 22종은 개별 이미지를 사용하며, 원본·최종 생성 프롬프트와 아틀라스 준비 방법은 [유닛 아트 기록](src/assets/units-v3/README.md)을 확인하세요.

5개 스테이지를 진행하며 중간 보스 처치 후 정비를 거쳐 다음 맵으로 이동하고, 최종 보스 처치 시 승리합니다. 스테이지 구성·배율·보상은 `src/config/stageData.ts`, 22종 유닛의 속성·역할·티어는 `src/config/unitData.ts`에서 관리합니다. 고정/조건 조합, ★ 승급, 재료 직접 선택, 판매와 유닛 개별 체력·부활을 지원합니다. 고유 효과 및 선택 확장의 구현 여부는 `.agent/skills/unit/unit_roster_design.md`의 구현 범위를 확인하세요.

각 스테이지 시작 시 자동 저장됩니다. 타이틀의 **이어하기**로 지도·분대·체력·재화·강화를 복원하며, **중단 · 타이틀** 또는 앱 종료 후에는 현재 스테이지의 시작 상태로 돌아갑니다. 전투 중 진행은 저장하지 않습니다. 승리·패배 시 저장은 삭제되고, 새 모험 시작 시 기존 저장 교체를 확인합니다. 저장은 같은 브라우저/앱의 로컬 저장소를 사용하며 기기 간 동기화는 지원하지 않습니다.
