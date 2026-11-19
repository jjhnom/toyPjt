# 재시작 전후 힙 스냅샷 비교 — 2026-11-19

## 결론

재시작 6회·12회 후에도 **추적 대상인 이전 전투 객체의 잔존은 발견하지 못했다**. 기준 시점의 전투 객체 ID 422개는 후속 스냅샷에서 사라졌고, 매 재시작 때 기록한 약한 참조 96개도 최종 GC 후 모두 해제됐다. 현재 게임에 필요한 적·탄환·파티클·컨트롤러 수는 일정했다.

증가한 메모리의 상위 항목은 V8 코드 노드와 Blink 텍스트 캐시였다. 실제 참조 경로는 현재 게임의 메서드·프로토타입 및 현재 UI 캔버스로 이어졌다. 이 결과로 이전 전투 객체를 해제하는 게임 코드를 수정할 근거를 찾지 못했으며, 게임 코드·풀 크기·밸런스는 변경하지 않았다. 모든 종류의 장기 누수나 엔진 캐시 상한을 검증한 결과는 아니다.

## 환경과 방법

- Intel Iris Xe, ANGLE Direct3D11, Chrome 157.0.8103.79. 실제 WebGL 렌더러를 확인하고 소프트웨어 렌더러일 경우 실패 처리했다.
- 720×1280/DPR 1 모바일 에뮬레이션, Vite 개발 서버, 기본 출전 유닛 2기, 오디오 비활성화. Android 실기기 검증이 아니다.
- 앞선 계측과 동일한 적 64기(서리 여왕 포함)·탄환 목표 160개·장판/폭격 fixture를 공유한다. 1.2초 준비 후 5초 관찰하며 자연 AI·사격·물리·렌더링을 실행한다.
- 최대 부하를 두 번 준비한 뒤 기준 스냅샷을 수집했다. 이후 실제 GameOverScene→새 GameScene 전환과 동일 부하를 12회 반복하고 6회·12회 후 스냅샷을 수집했다. 브라우저 스위트 실행 시간은 103.570초였다. 이번 검사는 별도 브라우저의 반복 재시작 검사이며 앞선 15분 검사를 재실행한 것은 아니다.
- 매 스냅샷 직전 대기·강제 GC를 수행했다. 이전 `enemies`, `bullets`, `particles`, `squad`, `hazards`, `bossVfx`, `joystick`, `bossAudio`는 WeakRef로만 기록했다. GC 전에 dereference하지 않아 검사 도구가 이전 객체를 강하게 붙잡지 않도록 했다.
- 스냅샷의 메타데이터로 필드 위치를 해석하고 객체 ID·생성자별 개수·shallow size를 비교했다. 명시적인 weak edge를 제외한 최단 루트 경로를 추출했다. 엔진의 ephemeron 조건이나 dominator를 완전히 모델링한 retained-size 분석은 아니다. 경로는 대표 사례이며 유일한 보유자를 뜻하지 않는다.

## 객체 수와 이전 객체 해제

| 종류 | 기준 | 재시작 6회 | 재시작 12회 |
|---|---:|---:|---:|
| GameScene | 1 | 1 | 1 |
| PlayerSquad / SquadRoster | 각 1 | 각 1 | 각 1 |
| Enemy / Bullet / EffectParticle | 64 / 160 / 120 | 64 / 160 / 120 | 64 / 160 / 120 |
| EnemyGroup / BulletGroup / EffectParticleGroup | 각 1 | 각 1 | 각 1 |
| VirtualJoystick / EncounterHazards | 각 1 | 각 1 | 각 1 |
| BossVfxController / BossAudioController | 각 1 | 각 1 | 각 1 |
| DroneUnit / HealthComponent | 2 / 67 | 2 / 67 | 2 / 67 |
| Text2 / CanvasTexture2 | 69 / 283 | 69 / 283 | 69 / 283 |
| TextureManager2 | 1 | 1 | 1 |

GameScene은 재사용되고 텍스처 관리자와 일부 비활성 UI·공용 텍스처도 유지되는 구조이므로 이들의 ID 잔존을 전투 객체 누수로 판정하지 않았다. 반면 교체되는 기준 전투 객체 422개의 ID는 6회·12회 후 모두 사라졌다. 약한 참조 검사에서도 6회 시점 48개, 12회 시점 96개 중 살아 있는 이전 전투 객체는 0개였다.

## 증가한 항목과 보유 경로

| 지표 | 기준 | 6회 후 | 12회 후 |
|---|---:|---:|---:|
| 스냅샷 직전 GC 후 JS 힙(MiB) | 13.37 | 15.29 | 15.73 |
| 스냅샷 파일(bytes) | 36,941,410 | 37,634,441 | 37,975,604 |
| V8 `code` 노드 shallow 합계(bytes) | 5,879,216 | 6,920,728 | 7,358,720 |
| `native` 노드 shallow 합계(bytes) | 73,033,891 | 74,168,003 | 74,195,171 |
| `object` 노드 shallow 합계(bytes) | 1,503,208 | 1,504,540 | 1,507,024 |

스냅샷 수집·추적을 활성화한 별도 실행이므로 앞선 15분 검사의 절대 힙 증가량과 직접 비교하지 않는다. shallow 합계는 개별 노드 자체 크기의 합이며, JS 힙 사용량·GPU 메모리·전체 프로세스 메모리·특정 객체의 retained size와 다른 지표다. 검사 도구가 추가한 WeakRef와 기록 객체도 포함된다.

기준 대비 12회 후 주요 증가:

- V8 `code` 합계 **+1,479,504 bytes**. `InstructionStream` +974,272, `TrustedByteArray` +238,468, `FeedbackVector` +73,484 bytes 등이 상위였다. JIT/실행 코드·피드백 관련 메모리가 증가했다는 해석과 일치한다. 예시 경로는 모듈 컨텍스트→함수→`Code`→`InstructionStream`, 그리고 현재 `GameScene.topHud`→프로토타입/생성자→feedback cell→`FeedbackVector`였다.
- `native` 합계 **+1,161,280 bytes**. Blink `FrameShapeCache::ShapeEntry` 저장소 +660,512, `NodeEntry` 저장소 +199,264, `PlainTextNode` +145,080 bytes 등이 상위였다. 대표 경로는 현재 `GameScene.doors.right.badgeText.canvas`→`PlainTextPainter`→`FrameShapeCache`와 공용 텍스처 관리자의 `CanvasTexture.canvas`→동일 캐시였다. 이전 전투의 풀을 경유하는 경로가 아니었다.
- native 합계의 6회→12회 증가는 27,168 bytes로 기준→6회 증가보다 작았다. 코드 증가도 계속 남아 있어, 이번 표만으로 모든 캐시가 상한에 도달했다고 단정하지 않는다.
- 일반 `object` shallow 합계 변화는 +3,816 bytes였다. Text·CanvasTexture·게임 전투 객체 개수는 유지됐고 closure 개수도 10,626개로 유지됐다.

## 변경 파일과 재현

- `tests/helpers/browser-session.mjs`: CDP 이벤트 구독/해제 API 추가. 스냅샷 chunk를 파일로 수집하는 데 사용한다.
- `tests/helpers/performance-fixture.mjs`: 기존 부하 fixture를 공유 모듈로 이동. 기존 `tests/performance-browser.mjs`와 새 스냅샷 검사가 같은 장면을 사용한다.
- `tests/heap-snapshot-browser.mjs`: 스냅샷 3개, 재시작 12회, WeakRef·객체 수·기준 객체 ID 검사.
- `tests/helpers/heap-graph.mjs`, `analyze-heap.mjs`: 메타데이터 기반 파서, shallow 통계, 객체 ID 비교, 루트 경로 추출.
- `tests/heap-graph.test.mjs`: 필드 순서 변경과 weak edge를 통한 잘못된 보유 경로 방지 검사 2개.
- `scripts/analyze-heap-snapshots.mjs`: 저장된 스냅샷 재분석. 브라우저 재실행 없이 근거를 검토할 수 있다.
- `scripts/integration-check.mjs`: `heap-snapshot-browser` 선택 실행 추가. 기본 통합 검사에서는 제외한다.

```powershell
$env:SMASH_TEST_URL='http://127.0.0.1:5206/'
$env:SMASH_BROWSER_NO_SANDBOX='1'
$env:SMASH_BROWSER_RENDERER='hardware'
node scripts/integration-check.mjs --serve heap-snapshot-browser
node scripts/analyze-heap-snapshots.mjs
```

## 검증과 남은 범위

- 하드웨어 브라우저: 스냅샷 3개·재시작 12회 수집 통과. 이전 전투 객체의 WeakRef 생존과 기준 객체 ID 잔존 모두 0이었다. 원본 스냅샷 재분석도 통과했다.
- `npm test`: **281개 통과**, 실패 0개. 파서 검사 2개 포함.
- `npm run build`: strict TypeScript·Vite 통과. 기존 번들 크기 경고 유지.
- 새 실행 스크립트 구문 검사와 변경한 추적 파일의 `git diff --check` 통과.
- 리뷰: CDP 이벤트 구독을 수집 완료·실패 시 해제하고 파일 쓰기 완료를 기다리는지, WeakRef 검사 시점, 공용 객체와 교체 대상 객체의 구분, 기본 통합 실행 제외를 검토했다. 이번 계측 변경 범위에서 추가 회귀 문제를 발견하지 않았다. 저장된 스냅샷에서도 생존 객체 검사 조건을 다시 실행해 통과했다. 기존 사용자 변경은 유지했다.
- 미검증: Android, GPU/프로세스 전체 메모리, 자연 플레이 전체 흐름, 최대 편성과 오디오 동시 부하, 더 긴 시간의 엔진 캐시 상한. 재시작 검사에서 이전 객체가 남지 않았다는 결과를 게임 전체의 무누수 보장으로 확대하지 않는다.
- 다음 작업은 최대 편성·BGM·전투음·보스 VFX가 동시에 실행되는 부하 검사다. 측정 근거 없이 텍스트 캐시를 강제로 비우거나 풀을 축소하지 않았다.

원본은 `artifacts/heap-snapshot-20261119/{baseline,restart-6,restart-12}.heapsnapshot`, 분석·객체 ID/대표 경로는 같은 디렉터리의 `report.json`, 테스트·빌드 로그는 `unit-tests.log`, `build.log`에 있다. 스냅샷은 로컬 검증 산출물로만 보관했다.
