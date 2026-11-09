# 픽셀 판타지 UI 적용·검증

- ID: UI-005
- 일자: 2026-11-09
- 상태: 실제 게임 UI 적용·자동 검증 완료 / Android 실기기 확인 별도
- 요청: 상세 목업 v2.3 검토 후 실제 게임에 적용. 중단된 적용 작업을 이어서 완료한다.
- 기준: [결정 020](../design/decisions/020-pixel-fantasy-design-proposal.md), [상세 목업](../.agent/skills/design/20261107/pixel_fantasy_mockup.html).

## 적용 내용

| 대상 | 실제 동작과 디자인 |
| --- | --- |
| 공통 테마 | 보라색 패널·이중 테두리·모서리 장식, 금색 주요 버튼과 눌림 표현. 실제 터치 영역은 고정한다. |
| 타이틀 | 수정 장식 로고와 기존 동료 아트. 유효 저장이 있으면 이어하기를 금색 주요 행동으로 표시하며 새 모험의 덮어쓰기 확인을 유지한다. |
| 전투 | 하단 조작부와 연결된 여섯 슬롯, 실제 동료 HP·생존 수·부활 대기·주요 스킬 대기와 보호막. ‘상세’는 여섯 동료를 함께 표시하며 전투가 계속됨을 안내한다. |
| 보스 | 실제 활성 보스의 HP·이름·페이즈를 읽는 상단 표시. 기존 예고 시간·피격 판정·전투 크기를 사용한다. |
| 정비 | 소환 두 카드/쪽, 조합 한 카드/쪽, 원정대 두 카드/쪽. 재료 유닛 이름·보유/필요 수량, 수동 재료 선택, 비용·배치·판매를 기존 거래에 연결한다. |
| 부가 정비 | 간편 제작·강화·유물·재능·각성/서비스·도감을 하단에서 연다. 재능과 유물은 설명을 포함한 카드 전체로 선택한다. |
| 결과 | 왕관·승패 리본, 영혼 조각과 통계 패널, 영웅 기록 및 재도전·타이틀 버튼. 기존 정산/저장 정책을 사용한다. |
| 모바일 입력 | 720×1280 FIT를 유지하고 조작부와 상세 버튼의 터치 영역을 확장했다. 조이스틱은 손을 놓거나 정비를 닫으면 새 하단 대기 위치로 복귀한다. |

## 수정 파일

- UI: `src/ui/fantasyTheme.ts`, `ActiveSkillButton.ts`, `VirtualJoystick.ts`.
- 화면/초상화 준비: `src/scenes/{BootScene,MenuScene,GameScene,SquadScene,GameOverScene}.ts`.
- 검증: `tests/pixel-ui-browser.mjs`, `tests/browser-smoke.mjs`, `tests/combat-status-browser.mjs`, 공통 브라우저 도구 및 배치에 영향을 받는 기존 브라우저 검사.
- 기록: 결정020·가이드/목업 사용법·본 문서·진행 기록·백로그.

새 의존성은 추가하지 않았다. 유닛 22종, 보유16/출전6, 지정 소환·조합 가격, 성장/스킬 수치, 스테이지/무한 원정, `SquadRoster` 거래·저장 계약은 이번 변경 대상이 아니다. 기존 사용자 변경과 다른 프로젝트 파일을 보존했다.

## 목업과 구현의 차이

- 목업의 예시 HP·비용·인원·보스 상태는 실제 데이터로 대체했다. 목업 전용 용암 거신 도트 시안·가짜 공격 연출은 게임 자산/판정으로 옮기지 않았다. 실제 보스 아트와 기존 패턴을 사용한다.
- 정비는 실제 22종 유닛·전체 조합과 부가 시설을 제공하므로 페이지 수와 메뉴 구성이 목업보다 많다.
- PNG의 무작위/10연속 뽑기·스태미나·결제 재화·리롤·유닛별 피해 기여도 등 미구현 시스템은 추가하지 않았다. 참고 PNG와 사용자 원본 적용 MD를 보존했다.

## 검증

환경: Windows, Node 22.16.0, Chrome 156 headless, Vite 개발 서버. 이 환경에서는 `SMASH_BROWSER_NO_SANDBOX=1`로 실행했다. 해당 옵션은 테스트에서 명시할 때만 Chrome의 `--no-sandbox --disable-gpu`를 적용하며 제품 설정은 바꾸지 않는다.

| 검사 | 결과 |
| --- | --- |
| `npm test` | 148개 통과 |
| `npm run build` | TypeScript strict·Vite 빌드 통과. 기존 500 kB 번들 경고 유지 |
| `node tests/browser-smoke.mjs` | 소환·같은/혼합 조합·실패 원자성·수동 재료·배치·5스테이지·저장/이어하기·멀티터치·취소·정비/백그라운드 정지 통과 |
| `checkpoint-v2-browser`, `abilities-browser` | 저장 복원, 재능·치유 스킬 취소/동시 이동·변이 통과 |
| `facilities-browser`, `identity-browser` | 각성·판매/조합 소멸 확인·완치/부활·보급, 시너지·도감·보스5종 패턴/피해 통과 |
| `legacy-browser`, `endless-browser`, `class-balance-browser` | 영구 성장·3클래스·이어서 하기 사본·무한 진행/종료 및 통제된 클래스 비교 통과 |
| `node tests/combat-status-browser.mjs` | 새 상세의 실시간 주요 스킬·자연/불사조 부활·보호막/만료·정지·개체 제거/방 이동/재시작 정리 통과 |
| `node tests/pixel-ui-browser.mjs` | 실제 Phaser 720/360/320 HUD, 44 CSS px 이상 상세 버튼, 슬롯 분리, 실제 거래/선택/저장, 61개 조합 카드 재료 영역 겹침 없음, 화면14개 캡처, 실행 예외 없음 |
| 기존 개별 브라우저8종 | `quick-craft`, `relics`, `upgrades`, `hero`, `recovery`, `combat-measurements`, `kill-reward`, `summoning-circle`의 `-browser.mjs` 통과. 실제 제작/선택/강화·성장·회복·계측·5스테이지 킬 보상·소환진 흐름 보존 |

브라우저18종을 순차로 실행했다. 기존 검사의 구형 좌표/개별 상세 필드를 새 배치·전체 상세로 갱신하고 원래 거래·회복·저장 검증을 유지했다. 유물·강화 카드와 하단 진입 버튼의 배치를 각각 검사한다. 백그라운드 정지 검사에서는 이벤트 이전 시각과 비교하던 프레임 경합을 없애고, 실제 정지 확인 후 시각이 고정되는지 검사한다.

검토: 작업 전 파일 사본과 현재 수정분을 비교하고 Git diff·호출자를 함께 읽었다. 공통 패널/버튼, 실제 상태 원천, 단일 거래·오래된 버튼, 입력 전파/소유권, 씬 재시작 정리 및 저장 정책을 확인했다. 조이스틱 해제 후 예전 위치로 돌아가는 문제와 확대된 영웅 이름이 HP 테두리에 닿는 배치를 수정했다. 최종 검토 범위에서 추가 회귀 결함은 발견하지 않았다. `git diff --check`도 통과했다.

로그: `artifacts/pixel-fantasy-implementation/{unit-tests,build,smoke,combat-status,pixel-ui}.log`, `browser-result.json`, `additional-browser-result.json`, 추가8종의 개별 로그, `artifacts/integration/*.log`, 각 기존 검사 보고서. 마지막 통합 실행 보고서는 시설~클래스5종이며 저장·재능2종은 직전 실행 로그에 남아 있다. 전체 통과를 단일 통합 명령 실행으로 기록하지 않는다.

성능 관찰: 스모크의 10초 부하(적28·활성 탄환 최대150)에서 평균22.7/min15.3 FPS였다. GPU를 비활성화한 headless 환경의 측정이며 변경 전 동일 조건과 비교하지 않았다. 실기기 성능·회귀 유무나 60 FPS 달성을 확인한 결과로 해석하지 않는다.

## 실제 화면

[타이틀](../artifacts/pixel-fantasy-implementation/title-360.png) · [전투](../artifacts/pixel-fantasy-implementation/combat-360.png) · [분대 상세](../artifacts/pixel-fantasy-implementation/squad-detail-320.png) · [소환](../artifacts/pixel-fantasy-implementation/summon-360.png) · [조합](../artifacts/pixel-fantasy-implementation/recipe-360.png) · [원정대](../artifacts/pixel-fantasy-implementation/roster-360.png) · [결과](../artifacts/pixel-fantasy-implementation/result-360.png).

캡처·로그는 `.gitignore`의 `artifacts/` 아래 로컬 검증 산출물이다. 브라우저 캡처는 통제 fixture를 사용하며 사람의 전체 런 플레이 기록이 아니다.

## 남은 확인과 다음 작업

Android 실기기·APK, 노치/시스템 제스처, 사람 가독성·장시간 성능은 검증하지 않았다. 브라우저 자동 검증 후 `STABILIZE-001B`의 실제 기기 입력·앱 복귀·부하 및 가독성 확인을 이어간다. 서명·배포·Git push는 수행하지 않는다.
