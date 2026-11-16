# RND 3단계 — 보스 사운드 22종 제작 및 Phaser 3 적용 가이드

- 대상 저장소: `jjhnom/toyPjt`, `rnd/` 폴더
- 대상 플랫폼: Phaser 3 + TypeScript + Vite + Capacitor Android
- 제작물: **발동음 13개 + 지속 루프음 5개 + 공통음 4개 = 22개**, 운석 낙하/충돌 분리본 **4개 추가**
- 제공 형식: **OGG** (게임 배포 권장), **WAV** (원본 편집·비교), 전체 미리듣기 OGG/WAV
- 음원: 이 패키지에서 새로 합성한 원본 효과음; 외부 음원·상용 게임 음원 샘플 미사용
- 사운드 포맷: 스테레오, 32 kHz, WAV 16-bit PCM / OGG Vorbis

## 0. 코드 조사에서 확인한 내용과 주의점

현재 확인된 `main` 브랜치의 `rnd/src/config/bossData.ts`에는 **보스 5종**(`forest_guardian`, `swamp_lord`, `lava_colossus`, `frost_queen`, `twilight_king`)만 등록되어 있습니다. 제공 요청은 **사막의 제왕을 포함한 보스 6종·스킬 13개**를 기준으로 합니다. 따라서 **사막의 제왕 및 황혼의 마왕 `BINDING` 패턴**은 현재 검사한 파일에서는 확인되지 않았으므로, 실제 게임 코드에 신규 보스·패턴이 반영된 브랜치와 병합 시 ID를 맞춰야 합니다. 이 패키지는 요청한 22종을 모두 제공합니다.

현재 `rnd/src/systems/SoundManager.ts`는 **Web Audio API 오실레이터**로 4종(`playShoot`, `playHit`, `playExplosion`, `playPowerup`)을 생성하며 파일 사운드를 로드하지 않습니다. `GameScene.ts`의 `updateBossPatterns()`에서 `planBossAttack()`의 결과를 `this.hazards.add()`에 전달합니다. **이 시점은 위험 구역 예고 시작 시점이지 타격/장판 활성화 시점이 아닙니다.** `EncounterHazards.ts`의 실제 상태 전이(예고 → 활성 → 종료)를 확인하고 그 이벤트에 효과음 재생을 연결해야 합니다. 단순히 `updateBossPatterns()`에서 스킬 발동음을 즉시 재생하면 화면과 소리가 어긋납니다.

## 1. 리소스 구성

```text
rnd/
├─ public/
│  └─ audio/
│     └─ boss/
│        ├─ boss_forest_charge.ogg
│        ├─ boss_forest_slam.ogg
│        ├─ ... (아래 22종)
│        └─ boss_death.ogg
├─ src/
│  ├─ scenes/BootScene.ts             # 오디오 키 로드
│  ├─ scenes/GameScene.ts             # 보스 이벤트와 연결
│  ├─ entities/EncounterHazards.ts    # 장판 활성/종료 전이 확인
│  ├─ config/bossData.ts             # 보스 ID/패턴 매핑
│  └─ systems/SoundManager.ts         # 보스 사운드 API/음량 관리
└─ tests/                            # 패턴별 사운드 이벤트 테스트
```

압축파일의 `ogg/`에 있는 22개 파일을 `rnd/public/audio/boss/`로 복사합니다. `extras/`의 분리본은 필요할 때 같은 폴더에 복사하세요. WAV는 수정·믹싱용으로만 두어 앱 용량을 줄일 수 있습니다.

## 2. 보스별 스킬 발동음 — 13개

| 보스 ID | 스킬 패턴/표현 | 파일명 (`.ogg`) | 재생 기준 |
|---|---|---|---|
| forest_guardian | 돌진: 나무 뒤틀림·바람·흙 | `boss_forest_charge` | 돌진 시작 |
| forest_guardian | 대지 강타: 땅 균열·돌 파편 | `boss_forest_slam` | 강타 충돌 프레임 |
| swamp_lord | 독 웅덩이: 기포·점액 분출 | `boss_swamp_poison_cast` | 독 장판 활성화 |
| swamp_lord | 돌진: 젖은 진흙 이동 | `boss_swamp_charge` | 돌진 시작 |
| lava_colossus | 운석 낙하 + 충돌 | `boss_lava_meteor` | 일체형 사용 시 낙하 개시 시점(내부 충돌 약 1.07초) |
| frost_queen | 사방 빙결: 얼음 균열 | `boss_frost_eruption` | 빙결 활성화 |
| frost_queen | 얼음 소환진 | `boss_frost_summon` | 소환 개시 |
| twilight_king | 십자 운석 + 암흑 충돌 | `boss_twilight_meteor` | 일체형 사용 시 낙하 개시 시점(내부 충돌 약 1.07초) |
| twilight_king | 암흑 독 장판 | `boss_twilight_poison_cast` | 장판 활성화 |
| twilight_king | 암흑 돌진 | `boss_twilight_charge` | 돌진 시작 |
| twilight_king | 금속 사슬 구속 | `boss_twilight_binding` | 사슬/구속 발동 |
| twilight_king | 차원 소환 | `boss_twilight_summon` | 소환 개시 |
| desert_king (제안 ID) | 모래 회오리 형성 | `boss_desert_sandstorm_cast` | 폭풍 활성화 |

**운석 분리본 4개** (`extras/`):

- `boss_lava_meteor_fall.ogg` / `boss_lava_meteor_impact.ogg`
- `boss_twilight_meteor_fall.ogg` / `boss_twilight_meteor_impact.ogg`

**권장:** 실제 운석 낙하 애니메이션과 충돌 시간이 가변적이면 일체형 파일 대신 **분리본**을 사용하세요. 낙하 애니메이션 시작 시 `fall`, 실제 판정·착지 시 `impact`를 호출합니다. 일체형과 분리본을 **동시에 재생하지 않습니다.** 같은 패턴이 복수의 위치에 떨어질 경우 `fall`은 패턴당 1회, `impact`는 대표 충돌 1회 또는 짧은 쿨다운을 적용합니다.

## 3. 장판 지속 루프음 — 5개

| 파일명 | 콘텐츠 | 권장 스킬 지속시간 | 루프 음량(초깃값) |
|---|---|---:|---:|
| `boss_swamp_poison_loop` | 습한 독 기포·저음 | 2.4초 | 0.13 |
| `boss_frost_field_loop` | 냉기 바람·결정 | 2.2초 | 0.13 |
| `boss_twilight_poison_loop` | 저음 암흑 공명·기포 | 2.4초 | 0.12 |
| `boss_twilight_binding_loop` | 사슬 떨림·봉인 | 2.2초 | 0.12 |
| `boss_desert_sandstorm_loop` | 회전 바람·모래 | 2.4초 | 0.15 |

5종은 지정 길이로 **반복 청취 가능하도록 주기성·경계 페이드**를 반영한 오디오입니다. **게임 코드의 실제 장판 활성 시간**을 최우선으로 사용하고, 위 지속시간을 무조건 타이머로 고정하지 마세요. 장판 삭제/보스 사망/방 이탈/씬 종료 시 루프를 중지하고 0.12~0.20초 페이드아웃합니다. 동일 유형의 장판이 동시에 여러 개 생기는 경우 루프를 1개만 재생(참조 카운트/활성 위험 수로 관리)합니다.

## 4. 공통 효과음 — 4개

| 파일명 | 재생 이벤트 | 권장 볼륨 |
|---|---|---:|
| `boss_encounter_start` | 보스 등장 시 패턴당 1회 | 0.65 |
| `boss_attack_warning` | 예고 영역 생성 최초 1회 | 0.36 |
| `boss_phase_change` | 보스 페이즈 변경 시 1회 | 0.7 |
| `boss_death` | 보스 사망 확정 시 1회 | 0.8 |

**주의:** 여러 운석·장판이 생성되어도 `boss_attack_warning`을 각 개체마다 재생하지 마세요. **패턴 계획 단위로 1회** 재생합니다. 페이즈 전환음은 `phase`가 이전 페이즈보다 높아질 때만 재생합니다. 기존 일반 엘리트 사망 효과음과 `boss_death`가 중복되지 않도록 보스 사망은 분기합니다.

## 5. Phaser 로딩 예시

`BootScene.ts`의 `preload()`에 다음과 같은 코드를 추가합니다. 실제 프리로드 흐름에 맞게 통합하세요.

```ts
export const BOSS_AUDIO_KEYS = [
  'boss_forest_charge', 'boss_forest_slam',
  'boss_swamp_poison_cast', 'boss_swamp_charge',
  'boss_lava_meteor', 'boss_frost_eruption', 'boss_frost_summon',
  'boss_twilight_meteor', 'boss_twilight_poison_cast',
  'boss_twilight_charge', 'boss_twilight_binding', 'boss_twilight_summon',
  'boss_desert_sandstorm_cast',
  'boss_swamp_poison_loop', 'boss_frost_field_loop',
  'boss_twilight_poison_loop', 'boss_twilight_binding_loop',
  'boss_desert_sandstorm_loop',
  'boss_encounter_start', 'boss_attack_warning',
  'boss_phase_change', 'boss_death',
] as const;

// preload() 안에서
for (const key of BOSS_AUDIO_KEYS) {
  this.load.audio(key, `audio/boss/${key}.ogg`);
}
```

분리본 사용 시 해당 4개도 추가 로드합니다. iOS Safari 호환성까지 목표라면 OGG 단일 형식만 가정하지 말고 MP3/AAC 대체 인코딩을 함께 제공하며, `this.load.audio(key, ['audio/boss/...mp3', 'audio/boss/...ogg'])`처럼 지원 형식을 검토하세요. Android WebView 실기기에서 오디오 잠금 해제를 확인하세요.

## 6. SoundManager 통합 방식

현재 `SoundManager`는 전역 싱글턴이며 Phaser `Scene.sound`에 종속되지 않습니다. **두 재생 경로를 혼용하면 음소거 토글이 불일치**할 수 있습니다. 하나의 매니저로 래핑해 기존 `enabled` 값을 그대로 공유하세요.

구현 지침:

1. `SoundManager`에 Phaser `SoundManager`를 연결하는 초기화 또는 `playBoss(scene,key,options)` 어댑터를 도입합니다.
2. `enabled === false`면 새 사운드를 시작하지 않으며, 이미 실행 중인 루프도 중지합니다.
3. SFX 전체 마스터 볼륨과 `bossCast`, `bossLoop`, `bossUI` 카테고리 볼륨을 따로 둡니다.
4. `startBossLoop(type)`은 이미 같은 종류의 루프가 활성화되어 있으면 중복 생성하지 않습니다.
5. `stopBossLoop(type, fadeMs)` / `stopAllBossAudio()` / `onSceneShutdown()`을 제공합니다.
6. 보스 피격 일반음은 기존 2단계 효과음을 재사용하고, 보스 경고·죽음 같은 고우선순위 이벤트는 일반 공격음보다 크게 유지합니다.
7. 모바일 첫 터치에서 사운드 잠금을 해제하고, 숨김·복귀 시 루프 오디오를 일시정지/재개하거나 정지합니다.
8. `boss_attack_warning`은 동시 여러 위험 영역과 관계없이 계획 1회당 1회, 동일 보스 패턴 루프 중복 금지.

간단한 **씬 측 재생 어댑터 예시**(최종 구조는 1단계 리팩터링 결과에 맞춰 조정):

```ts
import type Phaser from 'phaser';

export function playBossOneShot(scene: Phaser.Scene, key: string, volume = 0.6): void {
  if (!soundManager.enabled || !scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume });
}
```

위 예제의 `soundManager`는 기존 `../systems/SoundManager`에서 import한 인스턴스이며, 전체 매니저/버스 적용 전의 **최소 호출 예시**입니다. 씬 종료 후 남는 루프는 관리 대상입니다.

### 이벤트 연결의 핵심

```text
보스 등장                -> boss_encounter_start (1회)
패턴 planBossAttack 생성 -> boss_attack_warning (패턴당 1회)
위험 구역 활성 전환       -> 해당 boss_*_cast / boss_*_impact (필요시 1회)
지속 장판 활성화          -> startBossLoop(해당 스킬)
지속 장판 소멸            -> stopBossLoop(해당 스킬, 150ms)
보스 체력 페이즈 변화     -> boss_phase_change (변경 시 1회)
보스 사망                -> boss_death + stopAllBossAudio()
씬 일시정지/종료          -> 루프 오디오 pause 또는 stop
```

`EncounterHazards.ts`에 이벤트를 직접 발행하는 방식이 어렵다면, `GameScene`에서 업데이트 전후 활성 상태를 비교하여 전이를 감지하는 어댑터를 작성할 수 있습니다. 다만 패턴 객체 단위 상태 추적 없이 `durationMs`만으로 임의 스케줄링하면 씬 일시정지 시 동기화가 깨질 수 있습니다.

## 7. 보스 패턴 매핑 규칙

최종 `bossId`/패턴 문자열은 게임 타입 정의를 따르세요. 아래는 요구사항을 표현한 **매핑 의사 규칙**입니다(프로젝트 타입에 없는 `BINDING`, `SANDSTORM`을 임의로 사용하지 마세요).

```text
forest_guardian   + CHARGE  -> boss_forest_charge
forest_guardian   + METEOR  -> boss_forest_slam
swamp_lord        + POISON  -> boss_swamp_poison_cast + swamp_poison_loop
swamp_lord        + CHARGE  -> boss_swamp_charge
lava_colossus     + METEOR  -> boss_lava_meteor (또는 fall/impact)
frost_queen       + FROST   -> boss_frost_eruption + frost_field_loop
frost_queen       + SUMMON  -> boss_frost_summon
twilight_king     + METEOR  -> boss_twilight_meteor (또는 fall/impact)
twilight_king     + POISON  -> boss_twilight_poison_cast + twilight_poison_loop
twilight_king     + CHARGE  -> boss_twilight_charge
twilight_king     + BINDING -> boss_twilight_binding + twilight_binding_loop (추가 패턴 반영 이후)
twilight_king     + SUMMON  -> boss_twilight_summon
desert_king       + SANDSTORM -> boss_desert_sandstorm_cast + desert_sandstorm_loop (추가 보스 반영 이후)
```

## 8. 기본 음량·동시 재생 정책

| 유형 | 권장 초깃값 | 중복 방지 |
|---|---:|---|
| 보스 공통 경고 | 0.36 | 패턴당 1회, 최소 250ms |
| 스킬 발동·충돌 | 0.55~0.75 | 패턴당 1회(다중 장판은 대표 충돌만) |
| 보스 루프 | 0.12~0.15 | 종류별 1개, 종료 시 페이드 |
| 페이즈 변경 | 0.70 | 이전 페이즈 비교 |
| 사망 | 0.80 | 사망 이벤트 1회, 기존 사망음 중복 방지 |

기본 게임 BGM/기존 효과음과 믹싱하여 음량을 재조정하세요. 실제 디바이스 스피커/이어폰 청취 테스트 후 결정합니다.

## 9. 필수 QA 체크리스트

- [ ] 보스 6종·스킬 13개 매핑에서 없는 보스/패턴은 조용히 건너뛰거나 해당 코드 반영 후 활성화된다.
- [ ] 경고음은 위험 영역 생성 직후, 스킬 발동음은 **실제 발동 시점**에 들린다.
- [ ] 운석은 분리본의 충돌음이 착지 애니메이션/대미지 프레임과 맞는다.
- [ ] 같은 패턴에서 장판 여러 개 생성 시 경고/발동음이 폭발적으로 중첩되지 않는다.
- [ ] 독 2.4초, 빙결·구속 2.2초, 폭풍 2.4초(현재 설정 또는 실제 효과 종료 시) 루프가 사라진다.
- [ ] 보스 사망 후 루프가 남거나 다음 방으로 넘어가도 지속되지 않는다.
- [ ] 보스 사망 시 일반 엘리트 사망 사운드와 겹치지 않는다.
- [ ] 메뉴 음소거는 새 보스 사운드와 모든 기존 사운드에 동일하게 적용된다.
- [ ] Android WebView/일반 브라우저에서 첫 터치, 백그라운드 복귀, 무음 전환 후 정상 재생된다.
- [ ] `npm run build`, `npm test`를 통과하며 게임플레이(판정·AI·피해량)에 변경이 없다.

## 10. Codex에 전달할 개발 요청문

> `jjhnom/toyPjt`의 `rnd/` 폴더를 기준으로 이 문서와 ZIP의 OGG 파일을 적용해 주세요. `SoundManager.ts`, `BootScene.ts`, `GameScene.ts`, `EncounterHazards.ts`의 현재 구현을 다시 확인한 후, 보스 경고음과 실제 발동음 타이밍을 정확히 분리하고 5종 루프의 시작/종료를 장판 활성 상태에 연동해 주세요. 복수 장판 중복 재생 방지, 음소거/볼륨 정책, 보스 사망 및 씬 종료 시 루프 정리, 운석 fall/impact 분리본 동기화를 구현해 주세요. `main`에서 확인되지 않는 사막의 제왕 및 암흑 구속은 기존 정의를 확인하여 실제 반영된 ID에 매핑하고, 없으면 코드/디자인 변경과 별개로 사운드 매핑을 준비하세요. 기존 전투 로직은 변경하지 말고, 테스트와 빌드 수행 후 별도 브랜치에서 PR만 생성하세요. 머지하지 마세요.

---

**범위:** 이 패키지는 사운드 **에셋 및 적용 가이드**입니다. GitHub 소스 수정, 빌드/실기기 테스트, PR 생성은 아직 진행되지 않았습니다.
