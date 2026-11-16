# RND 게임 사운드 시스템 P0 리팩터링 가이드

> 대상 저장소: [`jjhnom/toyPjt`](https://github.com/jjhnom/toyPjt)  
> 대상 경로: `rnd/` (`main` 브랜치 기준)  
> 적용 기술: **Phaser 3 + TypeScript + Vite + Capacitor(Android)**  
> 범위: **P0-1 ~ P0-4 통합 리팩터링**  
> 문서 목적: 개발 담당자 또는 Codex 등 코딩 에이전트에게 그대로 전달할 수 있는 구현 요구사항 및 검증 기준

## 1. 목표와 범위

현재 `rnd/src/systems/SoundManager.ts`는 Web Audio API를 사용하여 간단한 오실레이터 기반 효과음을 만들고, 게임 곳곳에서 이를 직접 호출한다. 기능은 동작하지만 **반복 타격 시 중첩, 사운드 정책의 분산, 모바일 브라우저/웹뷰의 오디오 상태 전환**을 체계적으로 처리하지 못한다.

이번 작업은 사운드 에셋 대규모 교체가 아닌 **기반 사운드 엔진의 안전성과 확장성 확보**를 목적으로 한다.

**이번 PR에서 수행할 항목**

1. **P0-1 — 기존 사운드 호출 위치 점검 및 이벤트 구분:** 모든 현재 호출을 파악하고 누락·중복 가능성을 정리한다.
2. **P0-2 — SoundManager 구조 개선:** 중앙 집중형 재생 정책, 마스터/효과음 볼륨, 유지보수 가능한 인터페이스를 구현한다.
3. **P0-3 — 중복 재생 및 빈도 제한:** 짧은 시간에 폭증하는 발사·피격·폭발 효과음을 제어한다.
4. **P0-4 — 모바일 오디오 초기화:** 사용자 입력에 따른 unlock, suspend/resume, 백그라운드·복귀 처리를 안전하게 구현한다.

**이번 PR에서 제외할 항목**: 보스 5종 전용 사운드 제작, BGM 및 사운드 파일 구매/교체, 신규 UI 디자인, 대규모 전투 밸런싱, 게임 메커니즘 변경. 단, 이후 확장을 위한 인터페이스와 TODO는 허용한다.

## 2. 현재 코드 진단 (정적 분석)

### 2.1 주요 파일 및 현상

| 파일 | 현재 확인된 역할 | 개선 관점 |
|---|---|---|
| `rnd/src/systems/SoundManager.ts` | `AudioContext` 지연 생성, `playShoot(tier)`, `playHit()`, `playExplosion()`, `playPowerup()`, `enabled` 플래그 | 각 함수가 직접 oscillator/gain 생성; 공통 믹서/쿨다운/상태 관리 없음 |
| `rnd/src/components/WeaponComponent.ts` | `fireCallback(...)` 직후 `soundManager.playShoot(this.spec.tier)` | 다수 유닛의 연속 발사에서 효과음 밀집 가능 |
| `rnd/src/scenes/GameScene.ts` | 피격, AoE 폭발, 적 처치, 패배, 룸 클리어, 회복 등에서 사운드 실행 | 이벤트 종류가 다른데 동일 효과음 공유; 빈도 관리 필요 |
| `rnd/src/scenes/MenuScene.ts` | `soundManager.enabled` 직접 토글 및 시작 시 강화음 | 명시적 음소거 API와 초기 입력 unlock 정책 필요 |
| `rnd/src/scenes/SquadScene.ts` | 성공 처리에서 `playPowerup()` | 공통 API 호환성 유지 |
| `rnd/src/scenes/RewardScene.ts` | 보상 선택 시 `playPowerup()` | 공통 API 호환성 유지 |
| `rnd/src/scenes/GameOverScene.ts` | 재도전 시 `playPowerup()` | 공통 API 호환성 유지 |
| `rnd/src/scenes/BootScene.ts`, `rnd/src/main.ts` | 게임 시작과 부트스트랩 | 초기화 진입점 검토 및 이벤트 구독/해제 위치 선정 |

### 2.2 현재 구현의 구체적 특징

- `ensureContext()`에서 처음 재생될 때 `new AudioContext()`를 시도한다.
- 컨텍스트가 `suspended`라면 `resume().catch(() => {})`를 수행하나, **재개 성공 여부가 관리되지 않는다**.
- `play*` 메서드는 매번 발진기와 GainNode를 만들고 `ctx.destination`에 직결한다.
- `enabled`는 공개 불리언으로, UI가 값을 직접 바꾼다.
- `GameScene`에서 Phaser의 `HIDDEN`/`VISIBLE` 이벤트로 게임 플레이는 정지·재개하지만, **오디오 컨텍스트는 직접 동기화되지 않는다**.
- `WeaponComponent`의 발사 이벤트는 실제 공격 동작과 결합되어 있으므로 **소리 제한이 발사 로직을 제한해서는 안 된다**.

> 주의: 본 진단은 GitHub 소스의 정적 점검 결과이며, 실제 안드로이드 단말의 무음/지연 발생 여부는 테스트로 검증해야 한다.

## 3. 설계 원칙 및 구현 요구사항

### 3.1 외부 호환성 유지

현재 호출되는 아래 API는 그대로 유지한다.

```ts
soundManager.playShoot(tier: number): void;
soundManager.playHit(): void;
soundManager.playExplosion(): void;
soundManager.playPowerup(): void;
```

새로운 관리 API는 다음과 같이 설계한다. 세부 이름/형태는 프로젝트 규칙에 맞게 조정할 수 있다.

```ts
type SoundGroup = 'sfx' | 'ui';
type SoundId = 'shoot' | 'hit' | 'explosion' | 'powerup';

interface SoundSettings {
  enabled: boolean;
  masterVolume: number; // 0..1
  sfxVolume: number;    // 0..1
  uiVolume: number;     // 0..1
}

class SoundManager {
  playShoot(tier: number): void;
  playHit(): void;
  playExplosion(): void;
  playPowerup(): void;

  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  setMasterVolume(volume: number): void;
  setGroupVolume(group: SoundGroup, volume: number): void;
  unlockFromUserGesture(): Promise<boolean>;
  suspendForBackground(): Promise<void>;
  resumeAfterForeground(): Promise<boolean>;
  dispose(): Promise<void>;
}
```

**중요:** 이벤트 핸들러·장면에서 `AudioContext`를 직접 사용하지 않는다. `SoundManager`가 오디오 상태와 출력을 단일 소유한다. 사운드 사용 여부는 전투 판정과 독립적으로 처리한다.

### 3.2 오디오 노드 그래프

권장 그래프:

```text
Oscillator / (향후 AudioBufferSource)
                 │
            per-voice Gain
                 │
          group Gain (SFX/UI)
                 │
           master Gain
                 │
         AudioContext.destination
```

- `master Gain`은 컨텍스트당 1개 생성해 재사용한다.
- `sfx/ui Gain`을 각각 1개 생성해 재사용한다.
- 각 재생 음성에는 짧은 엔벌로프를 가진 전용 GainNode가 필요할 수 있다.
- `connect`/`disconnect`, `onended` 정리를 통해 해제되지 않는 참조가 쌓이지 않도록 한다.
- 0~1 범위 밖의 값, `NaN`, `Infinity`를 사전에 처리한다.
- 가능하면 갑작스러운 음량 변경에 짧은 ramp를 적용해 클릭 노이즈를 줄인다.

### 3.3 재생 정책 — 중복·폭주 제어

아래 수치는 **초기 튜닝값**이며 게임을 듣고 조정한다.

| 사운드 ID | 최소 시작 간격 | 최대 동시 음성 | 기본 우선순위 | 제어 정책 |
|---|---:|---:|---|---|
| `shoot` | 40ms | 4 | 낮음 | 해당 시간 내 여러 발사 요청은 소리만 일부 생략 |
| `hit` | 60ms | 3 | 낮음 | 연속 충돌 소리 밀도 감소 |
| `explosion` | 100ms | 3 | 중간 | 범위 공격·처치 다발에서 폭주 방지 |
| `powerup` | 120ms | 2 | 높음 | UI/보상 피드백이 필요할 때 우선 보호 |

- 같은 종류의 사운드에 `cooldown`과 `maxVoices`를 조합해 사용한다.
- 전체 동시 재생 수에도 상한(예: **8~12개**)을 두는 것을 검토한다.
- **사운드 스킵은 게임 로직을 막지 않는다.** 공격/피격/처치/보상 이벤트 자체는 항상 정상 처리해야 한다.
- 요청을 스킵할 때도 오류를 던지거나 부정적인 부수 효과를 만들지 않는다.
- UI 사운드와 전투 효과음의 우선순위를 구분하고, 고우선순위 사운드가 저우선순위에 의해 계속 묻히지 않도록 한다.
- 성능 측정을 위해 개발 모드에서 `requested`, `played`, `skippedCooldown`, `skippedVoiceLimit`, `unlockFailures` 카운터를 수집할 수 있도록 한다. 운영 빌드에서 과도하게 로그를 남기지 않는다.

### 3.4 모바일 / Android WebView 오디오 라이프사이클

1. **첫 사용자 동작(버튼 클릭/터치)에서** `unlockFromUserGesture()` 호출을 시작한다. 사용자의 제스처 흐름 밖에서 비동기적으로 처음 `resume()`을 시작하지 않도록 유의한다.
2. `AudioContext.state`를 검사하고 `running` 상태일 때만 실제 재생을 수행한다.
3. 처음 해제에 실패했다면 다음 명시적 입력에서 재시도할 수 있도록 한다. 실패를 영구 상태로 고정하지 않는다.
4. 앱·탭이 숨김 상태이면 새로운 효과음 재생을 막고, 필요할 경우 오디오 컨텍스트를 `suspend()`한다.
5. 복귀 시 상태를 확인하되 **자동 `resume()`이 플랫폼 정책으로 거부될 수 있다는 점**을 고려한다. 그런 경우 다음 사용자 입력으로 재활성화한다.
6. 동시에 여러 `resume()` 호출이 쏟아지지 않도록 진행 중인 Promise를 재사용하거나 직렬화한다.
7. 브라우저가 Web Audio API를 지원하지 않거나 `AudioContext` 생성이 실패해도 게임 화면·전투는 정상 동작해야 한다.
8. Scene이 전환되거나 종료될 때 등록한 이벤트 핸들러를 해제한다. 전역 사운드 매니저 자체는 장면 전환마다 무조건 파괴하지 않는다.
9. `enabled=false` 상태에서는 재생 요청을 스킵하며, 토글이 기존에 재생 중인 소리를 즉시 정지/페이드할지 정책을 명확히 정한다. 권장: 짧은 페이드 후 마스터 게인을 0으로 변경.

## 4. 파일별 작업 지시

### A. `rnd/src/systems/SoundManager.ts` — 핵심 리팩터링

- [ ] 효과음 정의(주파수·파형·엔벌로프·기본 게인)를 설정 데이터로 분리한다.
- [ ] 공통 `playSound(id, options)` 또는 동등한 내부 재생 함수로 중복 코드를 줄인다.
- [ ] 현재 네 개의 공개 `play*()` 메서드는 내부 함수로 위임한다.
- [ ] Master/SFX/UI 게인 체인을 구축한다.
- [ ] 효과음별 최소 재생 간격, 개별/전체 동시 재생 제한을 적용한다.
- [ ] 유효하지 않은 설정값 입력을 검증한다.
- [ ] `AudioContext` 생성·resume·suspend·dispose 실패를 안전하게 처리한다.
- [ ] 오디오 상태가 `running`이 아니면 재생을 건너뛴다.
- [ ] 음성 종료 시 노드/카운터를 정리한다.
- [ ] 필요한 공개 상태 API를 만들고 외부에서 `enabled`를 직접 변경하는 코드는 전환한다.

### B. `rnd/src/components/WeaponComponent.ts` — 발사음 경로

- [ ] `fireCallback(...)`와 발사음 호출의 관계를 유지한다.
- [ ] `playShoot(tier)` 호출은 유지하되 새 재생 정책이 이 호출을 자동으로 제어하도록 한다.
- [ ] 발사 쿨다운이나 공격 속도/대미지가 사운드 제한으로 변경되지 않는지 확인한다.
- [ ] 여러 드론/유닛 동시 사격 시 소리 과밀을 재현해 확인한다.

### C. `rnd/src/scenes/GameScene.ts` — 전투 사운드 이벤트

- [ ] `playHit()`가 호출되는 각 경로(접촉/탄환 충돌 등)의 의도와 호출 횟수를 점검한다.
- [ ] `playExplosion()`이 AoE, 적 처치, 게임 오버에서 공용 사용되는 점을 기록하고 향후 카테고리 분리 지점을 표시한다.
- [ ] 사운드 스킵이 폭발 범위 데미지, 처치 판정, 스테이지 종료를 방해하지 않도록 한다.
- [ ] 기존 `Phaser.Core.Events.HIDDEN` / `VISIBLE`와 `SoundManager`의 백그라운드 전환을 연계한다.
- [ ] 기존 GameScene 리스너 정리(`SHUTDOWN`) 패턴을 유지해 중복 리스너가 생기지 않게 한다.

### D. `rnd/src/scenes/MenuScene.ts` — 음소거 및 사용자 제스처

- [ ] `soundManager.enabled = !soundManager.enabled`를 `setEnabled()` / `isEnabled()` 호출로 변경한다.
- [ ] 버튼 라벨 표시가 SoundManager의 실제 설정과 동기화되도록 한다.
- [ ] 시작/소리 켜기 등 최초 사용자 제스처에서 AudioContext 활성화를 시도한다.
- [ ] 오디오 활성화가 실패해도 `GameScene` 이동은 정상 가능해야 한다.
- [ ] 음소거 토글이 꺼짐 상태에서는 새로운 노드를 만들지 않는지 확인한다.

### E. 기타 호출부

- [ ] `SquadScene`, `RewardScene`, `GameOverScene`의 `playPowerup()` 호출이 변경 후에도 동작하는지 확인한다.
- [ ] 기타 사용처는 검색으로 재확인한다: `soundManager`, `playShoot(`, `playHit(`, `playExplosion(`, `playPowerup(`, `AudioContext`, `game.sound`, `this.sound`.
- [ ] `BootScene` 또는 애플리케이션 진입점에 리스너를 추가한다면 중복 등록과 해제 수명주기를 명확히 정한다.

## 5. 권장 구현 순서

1. **진단 기준선 확정** — 각 호출 위치, 재생 시점, 재현 가능한 과밀 시나리오를 목록화한다.
2. **SoundManager 내부 API 정리** — 기존 외부 함수 호환을 유지한 공통 재생/믹서 구현.
3. **오디오 정책 적용** — ID별 쿨다운, 최대 음성 수, 중요도, 노드 정리.
4. **모바일 상태 처리** — 사용자 제스처 unlock, 화면 숨김/복귀, 실패 재시도.
5. **호출부 최소 수정** — 메뉴 토글, 게임 Scene 이벤트 연결, 테스트용 진단.
6. **자동 테스트와 수동 QA** — 전투 로직 유지, 빌드, 브라우저/Android 검증.

## 6. 테스트 및 완료 기준 (Definition of Done)

### 6.1 자동화 테스트

- [ ] `npm test` 통과.
- [ ] `npm run build` 통과 (`tsc && vite build`).
- [ ] 가짜 AudioContext/Clock 기반 단위 테스트 추가: 동일 `shoot` 반복 요청 100회에서 허용 간격/동시 재생 수 위반 없음.
- [ ] `enabled=false` 또는 `masterVolume=0`에서 신규 노드 생성이 없거나 재생이 스킵되는 정책이 지켜짐.
- [ ] `AudioContext` 미지원/생성 실패/`resume()` reject 상태에서도 메서드가 예외를 상위 게임 로직에 던지지 않음.
- [ ] 백그라운드 상태에서 새 효과음이 재생되지 않으며, 복귀 후 조건을 만족하면 재생됨.
- [ ] 여러 `unlock` 요청이 동시에 발생해도 상태가 꼬이지 않음.
- [ ] 노드 종료 후 활성 음성 수가 정상 감소함.
- [ ] 게임 로직 관련 기존 통합 테스트가 동일한 결과를 유지함.

### 6.2 수동 QA 시나리오

| 시나리오 | 기대 결과 |
|---|---|
| PC 브라우저 첫 실행 후 시작 버튼 클릭 | 정상적으로 첫 효과음 출력 |
| 소리 끄기 → 시작/전투 → 다시 켜기 | 끈 동안 무음, 다시 켠 후 정상 출력 |
| 여러 유닛의 동시 사격·연속 피격 | 효과음 과밀/왜곡이 현저하게 감소하고 공격 판정은 동일 |
| 몬스터 다수 동시 사망/AoE | 과도한 폭발음 중첩 없이 이벤트 정상 처리 |
| 게임 중 다른 탭 이동 후 복귀 | 불필요한 사운드 출력 없음; 정책에 따라 재개 |
| Android에서 홈 버튼 → 앱 복귀 | 게임 정상 복귀, 사운드 정상 또는 재터치로 복구 가능 |
| Android에서 화면 잠금 → 해제 | 크래시/무한 resume 시도 없이 안정 동작 |
| 짧은 시간 반복 메뉴 클릭 | 오디오 초기화 중복/오류 없이 UI 유지 |

### 6.3 완료 조건

- **호환성**: 기존 `play*()` 호출을 삭제하지 않고 동작 유지.
- **안정성**: 오디오 실패로 게임 크래시 없음.
- **품질**: 무분별한 다중 발사·피격·폭발음에 재생 제한 적용.
- **성능**: 활성 오디오 노드 수가 정의된 상한을 넘지 않음.
- **모바일**: 사용자 제스처 unlock 및 일시정지/복귀 흐름 구현.
- **검증**: 자동 테스트/빌드 통과, 수동 QA 결과와 남은 제약을 PR에 명시.

## 7. PR 작성 가이드

**추천 브랜치:** `codex/rnd-audio-p0-refactor`  
**추천 PR 제목:** `refactor(rnd): stabilize audio manager and mobile sound lifecycle`

PR 본문에는 다음을 기재한다.

- 변경 전/후 구조 요약
- 변경된 파일 및 기존 API 호환 여부
- 재생 쿨다운/음성 수 설정값과 조정 근거
- 브라우저/안드로이드 테스트 결과 (수동 테스트 미실시 시 명시)
- 남은 이슈 및 다음 단계(P1: 보스별 고유 효과음, 실제 에셋 도입 등)

### 코딩 에이전트에 전달할 간단한 요청문

> `jjhnom/toyPjt` 저장소의 `rnd/` 프로젝트에서 `rnd_sound_refactoring_p0_guide.md`의 P0-1~4 요구사항을 하나의 리팩터링으로 구현해 주세요. `SoundManager`의 기존 `playShoot`, `playHit`, `playExplosion`, `playPowerup` 호출 호환성을 유지하면서 공통 믹서, 동시 재생/쿨다운 제한, 모바일 사용자 제스처 unlock과 앱 백그라운드/복귀 대응을 구현하세요. 공격/대미지/보상/스테이지 진행 로직을 변경하지 마세요. 기존 호출 위치를 전수 확인하고 테스트를 추가한 뒤 `npm test`와 `npm run build`를 실행하세요. 별도 브랜치에서 커밋하고 PR을 생성하되, **main에 자동 머지하지 마세요**. 실기기에서 테스트하지 않은 사항은 검증 완료로 표시하지 마세요.
