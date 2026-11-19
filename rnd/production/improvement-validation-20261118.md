# 개발 서버 응답 복구 및 브라우저 검증 실행기 보완

> 후속 결과: 파일 감시 범위 수정 후 기존 WebSocket·기본 대기 시간으로 양손 입력 및 전체 스모크가 통과했다. 최신 상태와 증거는 [브라우저 검증 복구 완료](browser-validation-recovery-20261118.md)를 따른다. 아래 실패 기록은 수정 전 진단 이력이다.

- 작업일: 2026-11-18 (KST)
- 목적: PR-02 이후 남은 개발 서버 응답 지연을 진단하고 브라우저 검증을 재실행한다.
- 수정 파일: `vite.config.ts`, `scripts/integration-check.mjs`, `tests/browser-smoke.mjs`.
- 기존 BGM·조이스틱 수정은 유지했다. 게임 규칙·밸런스·저장 및 Android 설정은 변경하지 않았다.

## 확인한 사실과 수정

일반 Node HTTP 서버의 자기 요청은 즉시 성공했다. 기존 Vite 설정에서는 HTML의 inline CSS 처리와 소스 변환 요청이 시간 초과됐다. 의존성 자동 탐색을 제한하면 `main.ts` 응답이 가능했고, PostCSS 설정을 inline으로 지정하면 HTML 응답이 가능했다. 두 조건을 함께 적용한 서버에서 HTML과 소스 응답을 확인했다. OS·상위 폴더 탐색·캐시 중 어떤 외부 조건이 지연을 촉발했는지는 확정하지 않았다.

프로젝트는 일반 CSS를 사용하고 브라우저의 외부 런타임 import는 Phaser다. Vite에 빈 PostCSS 설정과 `optimizeDeps: { noDiscovery: true, include: ['phaser'] }`를 명시해 자동 탐색을 제한했다. 새 브라우저 런타임 의존성을 추가하면 include 목록도 검토해야 한다. 향후 PostCSS 플러그인 도입 시 inline 설정도 갱신해야 한다.

통합 실행기에 `--serve`를 추가했다. localhost의 Vite를 직접 실행하고 시작 로그·HTML·변환된 `main.ts`를 확인한 뒤 기존 브라우저 테스트를 순서대로 실행한다. 실행 종료 시 자신이 시작한 서버를 정리한다. 이미 사용 중인 포트에서는 실패하며 기존 서버에 연결해 통과시키지 않는다. 외부 URL의 서버 자동 시작은 허용하지 않고 기존 외부 서버 연결 방식은 유지했다.

스모크 시간 초과 메시지에는 현재 URL·document 상태·네트워크 실패·남은 요청을 추가했다. CDP 연결 시간 초과는 게임 입력 실패와 구분한다.

## 실행 방법

프로젝트 루트에서 기존 서버 없이 실행할 수 있다.

```powershell
npm run test:integration -- --serve browser-smoke abilities-browser
```

기본 포트는 5173이다. 필요하면 `SMASH_TEST_URL=http://127.0.0.1:5194/`처럼 미사용 로컬 포트를 지정한다. 서버 로그와 결과는 `artifacts/integration/vite.log`, `artifacts/integration/report.json`, 테스트별 `.log`에 기록한다. 이 경로는 다음 실행에서 덮어쓴다.

## 검증 결과

- 변경한 기본 Vite 설정으로 로컬 서버를 시작해 HTTP 200 확인: `/` 469ms, `/src/main.ts` 1250ms, `/src/ui/VirtualJoystick.ts` 2363ms, `/src/scenes/GameScene.ts` 529ms. 단일 진단 실행의 응답 시간이며 게임 FPS나 일반적인 서버 성능 보장이 아니다.
- `npm test`: 266/266 통과, 실패·skip 0. 로그: `artifacts/pr03-unit-tests.log`.
- `npm run build`: 성공. 기존 500kB 초과 청크 경고 유지. 로그: `artifacts/pr03-build.log`.
- `node --check scripts/integration-check.mjs`, `node --check tests/browser-smoke.mjs`: 성공.
- 포트 충돌 시나리오: 실행기 종료 코드 1, 기존 HTTP 서버는 계속 정상 응답. 결과: `artifacts/pr03-port-conflict.json`.
- `--serve browser-smoke abilities-browser`: 서버 사전 점검을 통과하고 스모크를 시작했지만 Chrome CDP `Runtime.enable` 시간 초과로 실패했다. 순차 실행 정책에 따라 뒤의 abilities는 이 실행에서 시작하지 않았다.
- Chrome 최소 CDP 진단에서는 같은 명령에 정상 응답한 실행도 있었다. 자동화 실행의 지연 원인은 미확정이며 Chrome 옵션 문제로 단정하지 않는다.
- `--serve abilities-browser`를 별도로 실행: 서버 사전 점검과 CDP 연결 이후 캔버스 생성 대기에서 실패(58.453초). `heroAbilities.ts`, `soundData.ts`, 여러 PNG/JSON import 등 후속 모듈 요청이 대기 중이었다. 앞선 핵심 소스 200 응답만으로 전체 모듈 로딩이 해결됐다고 판단하지 않는다. 로그: `artifacts/integration/abilities-browser.log`.
- `git diff --check -- .`: 통과. 변경 diff와 실행기 호출·서버 정리·포트 충돌 경로 검토.
- Android 실기기/APK, 게임 FPS·메모리, 앱 복귀·중첩 일시정지의 실제 브라우저 시나리오: 미검증.

## 남은 조건

개발 서버의 HTML·핵심 소스 응답을 복구하고 재현 명령을 추가했다. 브라우저 게임 검증은 아직 완료하지 않았으며 문서의 PR-02 또는 2단계를 완료로 표시하지 않는다. 다음은 CDP 초기화 및 후속 모듈 로딩 지연의 실행 환경 진단 후 양손 입력·모달·앱 복귀 검증이다. PR-01 수정본의 CI 성공과 APK 생성도 별도 확인이 필요하다. push/merge·배포는 수행하지 않았다.
