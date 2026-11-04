# Project Rules: Phaser 3 Mobile Smash Roguelike

## 1. Tech Stack & Environment
- **Game Engine:** Phaser 3 (`phaser` npm package)
- **Physics Engine:** Phaser Arcade Physics (경량 탑다운 2D 충돌 최적화)
- **Language:** TypeScript (Strict mode enabled)
- **Build Tool:** Vite (`vite`, `@types/node`)
- **Mobile Container:** Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`). 현재 Android 프로젝트가 있으며 iOS는 미설치 확장 대상이다.
- **UI & DOM:** Phaser DOM Elements 또는 경량 오버레이 HTML/CSS

## 2. Architecture & Scene Structure
- **Scene Flow:**
  - `BootScene`: 에셋 사전 로딩 및 텍스처 아틀라스 생성.
  - `MenuScene`: 타이틀, 사운드 설정, 시작 버튼.
  - `GameScene`: `StageProgression` 기반 스테이지 전환, 격자 룸 인스턴스, 본체/소환 유닛 분대, 적 웨이브, 전투 루프 관리.
  - `SquadScene`: 클리어 후 지정 소환, 레시피 조합, 보유/출전 관리 UI. `RewardScene`은 기존 보상 UI이며 현재 전투 보상 흐름에서는 사용하지 않는다.
  - `GameOverScene`: 통계, 획득 재화, 재도전 화면.
- **Entity Component Structure:**
  - 상속 지양, 컴포넌트/모듈화 지향 (`HealthComponent`, `WeaponComponent`, `MovementComponent`).
  - 본체와 독립 전투하는 소환 유닛 분대를 분리한다. `SquadRoster`는 보유 데이터·재화·거래, `PlayerSquad`/`DroneUnit`은 전투 개체, `squadData.ts`는 소환·조합 설정을 담당한다.

## 3. Mobile Performance & WebGL Constraints
- **Visual Theme:** 픽셀 판타지. `src/ui/fantasyTheme.ts`의 석재·이끼·금색 패널과 `src/ui/pixelCharacters.ts`의 코드 기반 도트 캐릭터를 사용한다. 캐릭터는 회전 대신 좌우 반전으로 방향을 표현하고 픽셀 렌더링을 유지한다.
- **Object Pooling:**
  - 총알, 적 유닛, 대미지 텍스트, 이펙트 파티클은 기존 풀을 재사용한다. 물리 객체는 Arcade Group, 시각 효과는 기존 전용 풀 등 객체 특성에 맞게 구현한다.
  - `runChildUpdate`는 자식 `update` 호출이 필요한 그룹에만 설정한다. 수동 순회와 그룹 자동 업데이트로 같은 객체를 두 번 갱신하지 않는다.
  - 매 프레임 대량 호출되는 이동·조준·충돌 경로에서 임시 배열, 객체, Vector2 생성을 피하고 재사용한다. 초기화·보상 UI까지 일률적으로 할당을 금지하지 않는다.
- **Viewport & Touch Input:**
  - 화면 해상도: 세로형 기준 $720 \times 1280$ (Phaser Scale Manager: `Phaser.Scale.FIT`, `autoCenter: Phaser.Scale.CENTER_BOTH`).
  - 모바일 터치 이벤트 기본 동작 차단(`touch-action: none`, `user-select: none`).
  - 가상 조이스틱은 씬 좌측 하단 터치 영역에 동적으로 앵커링되도록 구현.

## 4. AI Agent Execution Protocol
- 변경 전 관련 구현과 `src/types/game.ts`를 읽고 기존 타입을 재사용한다. 새 데이터 계약이 필요할 때 타입을 먼저 추가한다.
- 블리즈드/스타크래프트 원작의 저작권 리소스를 사용하지 않고, 기하학적 도형(프리미티브) 또는 자체 픽셀 에셋/파티클로 그래픽을 처리한다.
- 각 단계 구현 완료 시 브라우저 모바일 디바이스 뷰포트 터치 반응성 및 FPS 저하 여부를 우선 점검한다.

## 5. Source of Truth & Change Scope
- 공통 개발 규칙은 이 문서, 게임 메커니즘은 [smash_roguelike_skill.md](skills/smash_roguelike_skill.md)에 작성한다. 같은 규칙을 양쪽에 복제하지 않는다.
- 실제 구현 위치: `src/types/game.ts`(계약), `src/config/gameData.ts`(밸런스), `src/systems/RoomGridManager.ts`(격자), `src/scenes/`(화면 흐름), `src/entities/`(전투 객체), `src/components/`(공통 기능), `src/ui/VirtualJoystick.ts`(입력).
- 무기 사양은 `gameData.ts`, 소환 비용·조합표·보유/출전 한도·역할별 이동은 `src/config/squadData.ts`에서 관리한다. 변경 요청과 무관한 리팩터링·패키지 업그레이드·플랫폼 추가를 함께 수행하지 않는다.
- 유닛 도감·속성·역할은 `src/config/unitData.ts`, 스테이지 구성·난이도·전환 보상은 `src/config/stageData.ts`에서 관리한다.
- 문서의 목표 동작과 현재 구현이 다르면 이를 구분해 보고한다. 문서 수정만으로 해당 기능을 구현했다고 기록하지 않는다.
- 문서는 UTF-8로 저장한다. PowerShell에서 한글이 깨지면 `Get-Content -Encoding utf8`로 원문을 확인한 뒤 수정한다.

## 6. Scene Lifecycle & Run State
- 룸 이동에는 체력·보유 유닛·배치·강화·재화를 유지하고 새 게임에는 런 상태를 초기화한다. 설정 같은 영구 데이터와 런 데이터를 분리한다.
- 런 상태는 스테이지 번호·보스 토벌 수·무료 소환권을 포함한다. 스테이지 전환 시 런 상태를 유지하고 격자·룸 방문/보상 기록·적·탄환·공격 예고/장판·예약 스폰·전투 효과를 정리한다.
- 씬 종료/재시작 시 직접 등록한 외부 이벤트, DOM 리스너, 사운드 및 참조를 해제한다. 지연 콜백이 이전 방이나 종료된 런을 변경하지 못하게 한다.
- 보상 UI, 백그라운드 전환, 게임 오버 중에는 전투·스폰·피해·입력이 진행되지 않아야 한다. 물리 일시정지만으로 타이머와 다른 씬의 업데이트까지 멈춘다고 가정하지 않는다.
- 입력 취소·포커스 상실·모달 진입 시 조이스틱과 이동 속도를 초기화한다. 여러 일시정지 원인이 겹치면 하나가 해제되어도 나머지 원인이 있는 동안 전투를 재개하지 않는다.

## 7. Validation & Completion Report
- 코드 변경 후 `npm run build`로 strict TypeScript 검사와 Vite 빌드를 확인한다. 문서만 바꾼 경우 링크·코드 경로·명령의 일관성을 검토한다.
- 게임 로직 변경은 관련 시나리오를 검증한다: 웨이브 사이 적 0기, 마지막 적 동시 처치, 보상 연타, 방 재방문, 합성 재료 부족, 풀 고갈, 사망 직후 재시작.
- 모바일 입력 변경은 세로 화면, 화면 크기 변경, 멀티터치, 터치 취소, 앱 복귀를 확인한다. 브라우저 에뮬레이션과 실제 Android 기기 검증을 구분한다.
- 성능 검증은 기기/브라우저, 적·탄환 수, 관찰 시간을 함께 기록한다. 60 FPS를 목표로 하되 실측하지 않은 성능을 보장하지 않는다.
- 소환·조합 모델은 `npm test`로 검증한다. 로컬 개발 서버 실행 후 `node tests/browser-smoke.mjs`로 Chrome 모바일 터치 흐름을 확인할 수 있다. 필요하면 `SMASH_BROWSER_PATH`/`SMASH_TEST_URL`로 실행 환경을 지정한다.
- 완료 보고에 변경 내용, 실행한 검사와 결과, 미확인 항목을 적는다. 현재 없는 `lint` 스크립트를 실행했다고 보고하지 않는다.
