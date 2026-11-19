# 브라우저 검증 복구 완료

> 후속 결과: 기존 JDK 17·SDK로 최신 디버그 APK 빌드와 서명·자산 검증을 완료했다. [APK 검증 보고서](apk-debug-validation-20261118.md) 참고.

- 작업일: 2026-11-18 (KST)
- 이번 코드 수정: `vite.config.ts`의 `server.watch.ignored`.
- 기존 BGM·조이스틱·통합 실행기 수정은 유지했다.

## 원인과 변경

진단 당시 `artifacts/`에 169,795개 파일이 있었다. 개발 서버가 생성물까지 파일 감시 대상으로 삼아 모듈 로딩·Chrome 자동화 응답이 지연됐다. 파일 누락이나 게임 초기화 예외는 확인되지 않았다.

`artifacts`, `android`, `.agent`, `.agents`를 Vite 감시에서 제외했다. 게임 소스와 런타임 자산의 감시는 유지한다. 생성물은 변경해도 브라우저 자동 갱신을 유발하지 않으며, Vite가 해당 파일을 감시하며 쓰는 자원을 줄인다.

비교 진단에서 감시 제외 전 캔버스 생성은 약 89초, 제외 후 기존 WebSocket 헬퍼의 메뉴 준비는 2,349ms였다. 서로 다른 실행에서 관찰한 초기화 시간이며 게임 FPS·실기기 성능 보장이 아니다. 디버깅 파이프·대기 시간 확장은 실험 후 제거했고, 최종 검증은 기존 WebSocket과 기본 대기 시간으로 실행했다. 새 의존성·게임 규칙·밸런스·저장 계약 변경은 없다.

## 최종 검증

- 환경: Windows, Node.js v22.16.0, Headless Chrome 157, 모바일 터치 에뮬레이션.
- `npm test`: **266/266 통과**, 실패·skip 0. 로그: `artifacts/watch-fix-unit-tests.log`.
- `npm run build`: **성공**. 기존 500kB 초과 청크 경고 유지. 로그: `artifacts/watch-fix-build.log`.
- `abilities-browser`: **통과**, 37.912초. 이동 먼저/스킬 먼저의 양손 입력, 이동 영역 밖 터치, 취소·blur·pause·hidden 시 오시전 방지, 쿨타임 저장 복원, 재능 및 변이 흐름 검증.
- `browser-smoke`: **통과**, 83.451초. 720×1280·360×640, 소환·동종/이종 조합·실패 거래 원자성·편성 반영, 보상 중 전투 정지, 숨김/복귀, 스폰 재시도·장판 예고, 스테이지 전환·보상 중복 방지, 저장 복원·재시작 등 기존 검증 전체 통과. 런타임 예외 0건.
- `git diff --check -- .`: 통과. 파일 감시 제외 범위와 관련 소스 import 경로를 검토했다.
- 360px 전투 캡처를 육안 확인해 하단 조이스틱·정비·스킬·타이틀 조작 영역이 화면 안에 배치됨을 확인했다.

재현 명령(프로젝트 루트, PowerShell):

```powershell
$env:SMASH_TEST_URL='http://127.0.0.1:5202/'
$env:SMASH_BROWSER_NO_SANDBOX='1'
node scripts/integration-check.mjs --serve abilities-browser browser-smoke
```

## 증거

- [통합 실행 결과](../artifacts/browser-validation-20261118/report.json)
- [양손 입력 검증 로그](../artifacts/browser-validation-20261118/abilities.log)
- [전체 스모크 로그](../artifacts/browser-validation-20261118/smoke.log)
- [360px 전투 화면](../artifacts/browser-validation-20261118/battle-360.png)
- [360px 정비 화면](../artifacts/browser-validation-20261118/squad-360.png)

## 남은 검증과 다음 작업

PR-02의 브라우저 검증 실패는 해결했다. Android 실기기의 홈/잠금·노치·시스템 제스처, 장시간 플레이 및 APK 설치·실행은 여전히 미검증이므로 문서 2단계 전체 완료로 표시하지 않는다.

추가 탐색에서 `artifacts/android-toolchain/jdk/jdk-17.0.21.0.2+1`과 `artifacts/android-toolchain/sdk`를 발견했다. 이전 보고서의 SDK 미확인은 기본 설치 경로만 확인한 당시의 결과다. 다음은 이 기존 도구로 최신 소스의 디버그 APK 빌드 가능 여부를 확인하는 작업이다. 이번에는 APK를 빌드하지 않았다. 수정본의 GitHub Actions 성공도 아직 확인하지 않았으며 push/merge·배포는 수행하지 않았다.
