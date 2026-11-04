# AI Game Studio — Codex 작업 지침

## 프로젝트와 기준
- 프로젝트 루트는 이 파일이 있는 `rnd/` 디렉터리다.
- Phaser 3, TypeScript strict, Vite, Capacitor Android 프로젝트다.
- 변경 전 `.agent/rules.md` 및 해당 게임 메커니즘 스킬 `.agents/skills/smash-roguelike/SKILL.md`를 읽는다.
- 기존 `.agent/rules.md` 및 `.agent/skills/smash_roguelike_skill.md`는 보존한다.
- 실제 구현이 문서와 다르면 구현 상태를 확인하고 차이를 보고한다. 문서의 목표를 구현 완료로 간주하지 않는다.

## 현재 게임 구조
- 게임은 유닛 **소환 → 재료 확보 → 레시피 조합 → 출전 편성 → 다음 방 전투** 흐름이다.
- `src/config/squadData.ts`: 소환 비용, 조합 레시피, 보유/출전 한도.
- `src/config/gameData.ts`: 전투 밸런스, 룸 설정.
- `src/systems/SquadRoster.ts`: 보유·재화·조합 거래의 원천 데이터.
- `src/scenes/SquadScene.ts`: 전투 후 정비 화면. `RewardScene`을 현재의 주 보상 흐름으로 되돌리지 않는다.
- `src/types/game.ts`의 기존 계약을 우선 재사용한다.
- 원작 게임의 자산·확인되지 않은 규칙을 임의로 복제하지 않는다.

## 작업 흐름
1. Producer: 목적, 변경 범위, 완료 조건을 정리한다.
2. Designer: 기존 게임 규칙과 충돌 여부를 확인한다.
3. Engineer: 승인된 범위 내에서 최소한으로 수정한다.
4. QA: 자동 테스트와 관련 시나리오를 검증한다.
5. Reviewer: Git diff와 회귀 위험을 검토한다.
6. Director(사용자): 게임 규칙·밸런스 변경과 출시를 최종 승인한다.
- 간단한 수정은 여러 역할을 한 세션에서 순차적으로 수행할 수 있다.
- 다른 에이전트와 병렬 작업할 때 동일 파일 동시 수정을 피한다.

## 안전과 승인
- 기존 사용자 수정사항을 되돌리지 않는다.
- 새 의존성, 대규모 리팩터링, 핵심 메커니즘 변경, Android 서명/배포 설정 변경, Git push/merge는 먼저 승인을 요청한다.
- 비밀 키, 인증정보, keystore, `local.properties` 등 민감 설정을 커밋하지 않는다.
- 현재 저장소에 없는 기능, 테스트, 측정 결과를 만들어 보고하지 않는다.

## 검증
- 코드 변경 후 프로젝트 루트에서 `npm test`, `npm run build`를 가능한 범위에서 실행한다.
- 모바일 입력 변경 시 `node tests/browser-smoke.mjs`를 해당 실행 조건에서 확인한다.
- APK 실제 빌드는 GitHub Actions 결과 또는 Android SDK/JDK가 있는 환경에서만 확인할 수 있다.
- 실행하지 못한 검증은 이유와 함께 명시한다.
- 보고서는 한국어로 작성하고 수정 파일, 변경 요약, 테스트 결과, 위험, 다음 작업을 포함한다.

## AI Studio 기록
- 작업을 시작할 때 필요한 경우 `production/current-task.md`를 사용한다.
- 기획 변경은 `design/decisions/`의 별도 결정 기록으로 남긴다.
- 단순 코드 수정에 과도한 문서 작성을 강요하지 않는다.
