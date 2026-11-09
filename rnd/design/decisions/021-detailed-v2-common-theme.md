# 021 — 상세 디자인 v2 공통 테마 적용

- 일자 / 작업: 2026-11-09 / UI-006
- 상태: 1차 공통 테마 적용·자동 검증 완료
- 요청: 사용자가 [상세 디자인 v2](../../.agent/skills/design/20261109/summoners_expedition_detailed_design_v2.md)를 참고한 디자인 개선을 요청했다.
- 참조: 같은 폴더의 [실제 제공 시안](../../.agent/skills/design/20261109/summoners_expedition_detailed_mockup_v2.png)을 확인했다. 문서 8절에 적힌 두 이미지 파일명과는 다르다.

## 범위

문서 7절의 “1차 작업은 '공통 테마/버튼/패널'만 진행” 및 PR1의 공통 탭 개선을 적용한다. 기존 디자인 적용분 위에서 수정하며 화면 재배치·새 게임 메커니즘·VFX/아트 교체는 이번 단계에 포함하지 않는다.

문서의 현행 구현 설명에는 이전 상태가 섞여 있다. 실제 게임은 출전6/보유16, 하단 분대 상태, 기존 재능·유물·치유 스킬, 도감·3클래스·영구 성장을 제공한다. 이 구현과 기존 거래/저장 규칙을 유지한다. 신규 랜덤 스킬·가챠·리롤을 추가하거나 기존 기능을 제거하지 않는다.

## 적용

| 수정 파일 | 전후 변화 |
| --- | --- |
| `src/ui/fantasyTheme.ts` | 의미별 `DESIGN_TOKENS`를 추가하고 기존 `FANTASY` 키를 별칭으로 유지한다. 패널은 둥근 테두리에서 각진 픽셀 코너·이중 프레임으로 바꾼다. 주요 버튼에는 금색 명암 띠·받침·모서리 장식을 추가한다. |
| 같은 파일의 `fantasyButton` / `paintButton` | 선택 상태를 별도 `selected` 옵션으로 표현한다. 보라색 강조·금색 밑줄을 쓰며 비활성은 회보라색/별도 글자색으로 구분한다. 기존 `enabled`, `primary`, 클릭 콜백·터치 영역을 보존한다. |
| `src/scenes/{SquadScene,CodexScene,LegacyScene}.ts` | 기존 탭과 메뉴 전환 버튼에 `selected`를 연결한다. 현재 위치를 나타내는 강조와 실제 구매/확정 행동의 금색을 구분한다. 좌표·페이지·선택/거래 로직은 유지한다. |
| `src/ui/ActiveSkillButton.ts` | 공통 비활성/주요 글자색과 2px 눌림 표현을 사용한다. 손을 놓을 때 사용하는 기존 스킬 입력·취소·대기 로직을 유지한다. |
| `src/assets/fantasy-v2/README.md` | `frame.png`의 실제 사용 설명을 수정한다. 원본은 보존하고 현재 공통 UI는 도형 프레임을 사용한다. |

도형 프레임은 기존 Graphics에 그리며 새 이미지·폰트·의존성·셰이더·상시 tween을 추가하지 않는다. 장식은 인터랙티브 객체로 만들지 않는다. 픽셀 렌더링, FIT 해상도, 전투 영역, 기존 텍스처 키를 유지한다.

## 검증

환경: Windows, Node22.16.0, Chrome156 headless, Vite 개발 서버. 이 환경에서는 테스트 전용 `SMASH_BROWSER_NO_SANDBOX=1` 옵션을 사용했다.

| 검사 | 결과 |
| --- | --- |
| `npm test` | 148개 통과 |
| `npm run build` | TypeScript strict·Vite 빌드 통과. 기존500kB 번들 경고 유지 |
| `node tests/browser-smoke.mjs` | 소환·조합·수동 재료·편성·5스테이지·저장/복원·덮어쓰기 확인·멀티터치/취소·재시작 통과 |
| `abilities-browser` | 실제 치유 스킬의 누르기/떼기·취소·동시 이동·재능·저장/복원 통과 |
| `identity-browser` | 도감 탭/페이지·시너지·보스5종 실제 패턴/피해·기록 보존 통과 |
| `legacy-browser` | 클래스/성장 탭·실제 구매/치유·기존 런 이어하기·중복/실패 정산·손상 기록 보존 통과 |
| `pixel-ui-browser` | 실제720/360/320 HUD·전체61조합 카드 배치·정비/재능 거래/저장·상세·결과 통과 |
| 공통 컴포넌트 검수 | 실제 Phaser에서 눌림 전후 터치 영역 고정, 비활성 버튼 무동작, 선택 스타일의 콜백 유지 확인. 360×640·320×569·960×540 FIT와 캡처 확인, 실행 예외 없음 |

기존 브라우저 검사5종과 별도 컴포넌트 검수를 순차 실행했다. 이번 단계에서 기존 테스트의 단정이나 좌표를 수정하지 않았다. 작업 전 사본과 현재 변경분, Git diff 및 호출자를 검토했고 추가 회귀 결함을 발견하지 않았다. `git diff --check`도 통과했다.

스모크 부하 관찰(적28·탄환 최대150·10초): 평균29.9/min19.5 FPS. GPU 비활성 headless 측정이며 변경 전과 동일 조건으로 비교하지 않았으므로 성능 개선/회귀 여부나 실기기60 FPS를 판정하지 않는다.

로그: `artifacts/detailed-design-v2-common/`의 `unit-tests.log`, `build.log`, `browser-smoke.log`, 기존 브라우저별 로그·`browser-results.json`, `component-result.json`, `implementation.diff`, `reference-check.json`.

## 검토용 화면

- 소환: [변경 전](../../artifacts/detailed-design-v2-common/before-summon-360.png) · [변경 후](../../artifacts/detailed-design-v2-common/after-summon-360.png)
- 타이틀: [변경 전](../../artifacts/detailed-design-v2-common/before-title-360.png) · [변경 후](../../artifacts/detailed-design-v2-common/after-title-360.png)
- 도감: [변경 전](../../artifacts/detailed-design-v2-common/before-codex-360.png) · [변경 후](../../artifacts/detailed-design-v2-common/after-codex-360.png)
- 상태 비교: [공통 패널·버튼·탭](../../artifacts/detailed-design-v2-common/components-360x640.png) · [누른 상태](../../artifacts/detailed-design-v2-common/components-pressed-720.png) · [가로 화면 FIT](../../artifacts/detailed-design-v2-common/components-960x540.png)
- 실제 게임: [전투](../../artifacts/detailed-design-v2-common/after-combat-360.png) · [결과](../../artifacts/detailed-design-v2-common/after-result-360.png)

캡처·검사 로그·작업 전 소스 사본은 로컬 `artifacts/detailed-design-v2-common/`에 둔다. 가이드 MD와 시안 PNG의 SHA-256을 기록해 원본 보존을 확인한다.

## 미적용과 다음 단계

문서의 PR2 카드/재료 선택 그리드 재배치·소환 연출, PR3 전투 바탕/VFX, PR4 로비/결과 모션, PR5 저사양·모션 감쇄·safe-area는 후속이다. 현재 카드와 배경은 공통 테마 변경만 받는다. 도감의 작은 일반 글씨를 포함한 개별 화면 타이포 재설계도 다음 가독성 검토 대상이다.

기존 클릭 영역을 보존했으며 모든 기기에서 48 CSS px 목표를 만족한다고 보고하지 않는다. Android 실기기·APK·장시간 성능·60 FPS는 미검증이다. 다음 작업은 PR2 소환·조합·편성 카드와 재료 선택의 가독성 개선이다. 출시·서명/배포·Git push는 수행하지 않는다.
