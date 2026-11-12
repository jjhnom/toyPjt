# 029 — 전투 화면 단계별 리디자인

2026-11-11 / UI-014. 기준은 실제 `GameScene`과 `.agent/skills/design/mockups/04_battle.png`다.

## 현재 화면과 목표 차이

| 구역 | 현재 문제 | 적용 방향 |
| --- | --- | --- |
| 상단 | 제목·HP·XP가 프레임에 붙고 보스 정보와 진행 정보가 중첩 | 기존 상단 영역 내 생존/자원 1단 + 진행 배너 2단, 우측 지도 |
| 필드 | 동일 잔디 타일의 격자 반복이 강함 | 기존 타일 유지, 정적 명암/장식, 보스 조명 |
| 유닛 | 작은 48px 동료와 단순 체력바 | 물리 없는 동료의 시각 배율, 소환사 마법진, 상태 표시 |
| 이펙트 | 작은 단색 도형·획일적 링 | 기존 스킬 판정과 풀 유지, 실루엣/파편/원형 마법진 구분 |
| 하단 | 초상화와 부활 문구/HP가 겹침 | 독립 초상화·등급·HP/상태 영역과 별도 정보 행 |
| 조작 | 버튼 간 시각 규격 차이 | 기존 입력 영역/동작 유지, 공통 규격과 비활성 구분 |

신규 스킬 선택/자동 전투/배속, 새 라이브러리, 저장/전투/경제 규칙 변경은 범위 밖이다. 원격 저장소가 `jjhnom/toyPjt`인 로컬 `rnd` 프로젝트를 수정하며 push/배포는 수행하지 않는다.

## 적용 파일과 구현

| 파일 | 적용 |
| --- | --- |
| `src/ui/fantasyTheme.ts` | 요청 팔레트·`BATTLE_UI` 규격/깊이/시각 배율. 기존 공통 키를 유지한다. |
| `src/scenes/GameScene.ts` | 상단 생존/자원+중앙 진행 배너와 우측 지도. 보스는 같은 배너 안에 단계/웨이브/HP 표시. 하단 정보 행·6개 분대 카드·선택 테두리/빈 슬롯·정비 불가 색상을 정리한다. |
| `src/ui/battleEnvironment.ts` | 기존 타일 위의 결정적 명암·풀/꽃/바위/수정/균열·테마별 가장자리 조명. 문 통로는 비워 두며 입력/물리 객체를 만들지 않는다. 방/테마 변경 때 한 장의 720×1280 RenderTexture에 그린 후 임시 도형/이미지를 해제한다. 씬 소유 캐시는 재사용하고 씬 종료 시 해제된다. |
| `src/entities/DroneUnit.ts` | 비물리 동료 스프라이트만 1.25배(48→60px). 기존 위치·AI·공격 주기/사거리·피해는 유지한다. |
| `src/ui/skillEffectTextures.ts`, `src/entities/EffectParticlePool.ts` | 기존 텍스처 준비/연출 API 재사용. 화염 파편·빙결 결정·파란 전격/잔광·초승달 참격·회전 공허·회복 바닥 원과 상승 빛·반투명 보호막·독 구름을 구분한다. |
| `src/entities/EncounterHazards.ts` | 예고 도형만 이펙트보다 높은 depth 38로 변경. 경고 시간·공격 반경·피해 해결 코드는 유지한다. |
| `src/ui/VirtualJoystick.ts` | 힌트의 글꼴·외곽선/여백만 변경. 대기 위치(130,1230), 동적 앵커, 키보드/터치/취소 코드는 유지한다. |
| `tests/battle-redesign-browser.mjs`, `tests/browser-smoke.mjs` | 단계별 실제 화면·새 HUD 경계·하단 영역 분리·캐시 재사용/누수·물리 크기·풀 상한/재사용·기존 상세 입력 검사. 스모크의 이전 HUD 좌표 기준을 새 패널 기준으로 갱신한다. |
| `tests/legacy-browser.mjs` | 자동화 정화 fixture의 살아 있는 감속을 보장. 제품 코드나 정화 판정은 변경하지 않는다. |

상단 패널은 y=156 안에서 끝나고 기존 전투 경계(64..656,170..1090)와 바닥 576×904는 유지한다. 소환사는 기존 물리 크기 36px를 유지하며 마법진/표시만 추가한다. 동료 간 이동 간격/충돌 회피 규칙을 변경하지 않고, 바닥 윤곽·커진 이미지·분리한 체력바로 식별성을 보완한다. `pixelArt`/`roundPixels` 및 원본 텍스처는 유지한다.

하단은 초상화, 우측 별/출전·부활·스킬 상태, 아래 HP/재사용 진행을 분리한다. 비어 있는 슬롯은 어두운 프레임이다. 기존 상세 열기로 선택된 동료는 금색 테두리로 표시하며 카드별 새 입력 동작은 추가하지 않는다. 정비 불가 색상에서도 기존의 안내 배너 입력 동작은 유지한다.

연출은 기존 발동/비행 잔광/타격/자동 소멸 이벤트를 사용한다. 풀 상한120개, 일반 파편100개 제한과 잔광 프레임당12개·활성60개 제한을 유지한다. 매 프레임 새 텍스처나 타이머를 만들지 않는다. 기존 공격/버프의 적용 시간·데미지·투사체 충돌 크기는 수정하지 않았다.

## 단계별 실제 화면

[전후·단계 선택 비교 페이지](../../artifacts/battle-redesign-20261111/comparison.html)

| 단계 | 360px 실제 화면 |
| --- | --- |
| 변경 전 | [before](../../artifacts/battle-redesign-20261111/before-battle-360.png) |
| 1. HUD | [hud](../../artifacts/battle-redesign-20261111/hud-battle-360.png) |
| 2. 필드 | [field](../../artifacts/battle-redesign-20261111/field-battle-360.png) |
| 3. 유닛 | [actors](../../artifacts/battle-redesign-20261111/actors-battle-360.png) |
| 4. VFX | [fx](../../artifacts/battle-redesign-20261111/fx-battle-360.png) |
| 최종 하단/조작·캐시 | [final](../../artifacts/battle-redesign-20261111/final-battle-360.png) |

[720px](../../artifacts/battle-redesign-20261111/final-battle-720.png) · [320px](../../artifacts/battle-redesign-20261111/final-battle-320.png) · [보스](../../artifacts/battle-redesign-20261111/final-boss-320.png) · [VFX 검수 보드](../../artifacts/battle-redesign-20261111/final-effects-320.png).

같은 유닛 종류/배치의 통제 fixture이며 방 생성/미니맵은 실행마다 달라질 수 있다. VFX 보드나 임의 생성한 보스 화면을 실제 스테이지 진행 완료의 증거로 사용하지 않는다. 초기 4단계 캡처 후 하단 글자 크기/폭과 정적 캐시를 최종 조정했다. 잔디 원본의 반복 무늬를 유지하며 명암과 장식으로 완화한 범위다.

## 검사 중 발견한 문제와 조치

초기 부하 검사(Windows HeadlessChrome157, 소프트웨어 렌더링,10초, 적28기/탄환 최대150개)에서 평균14.7/min11.7 FPS였다. 정적 도형의 반복 렌더링을 줄이기 위해 환경 장식을 방별 캐시로 변경했다. 초기/최종 로그를 분리하며 캐시 이후 측정 결과를 최종 검증에 기록한다. Android의60 FPS를 보장하는 측정이 아니다.

직업 정화 검사의 실패는 입력 누락이 아니었다. DOM과 Phaser 입력 추적에서 재입력이 모두 도착했으나 `slowUntil=19083.6`보다 늦은 `scene.time.now=19550.3`에 버튼을 떼고 있었다. 테스트의 `sceneUpdate` 중단은 Phaser Clock을 멈추지 않아 800ms 감속이 자동화 명령 도중 만료되었다. 해당 fixture에만 60초 감속과 살아 있는 감속 사전 검사를 적용하고, 취소/재입력/정화/18초 쿨다운 단언을 그대로 유지했다. 제품의 감속 시간과 입력/정화 로직은 변경하지 않았다. 추적 로그는 `legacy-time-trace.log`에 보존한다.

## 최종 검증

- `npm test`:148개 통과. 최종 `npm run build`:TypeScript/Vite 통과. 기존500kB 청크 경고 유지.
- 통합 브라우저8종 전부 통과: `browser-smoke`, `checkpoint-v2-browser`, `abilities-browser`, `facilities-browser`, `identity-browser`, `legacy-browser`, `endless-browser`, `class-balance-browser`. 문/방 이동·5스테이지·보스5종/예고/피해·시너지·소환/조합·부활·입력 취소/동시 이동·저장/복원/중복 방지·실제 클래스 투사체 충돌/회복을 검증했다. 결과는 `final-integration-result.json`이다.
- 별도4종 통과: `battle-redesign-browser`, `pixel-ui-browser`, `ui-style-browser`, `roster-layout-browser`. 총12종이며 단계별 실행/재실행은 같은 suite로 계산한다.
- 최종 화면 검사:720/360/320 HUD 경계, 하단 초상화/별/상태 간 겹침 없음, 동료60px·본체 물리36px·바닥576×904·pixelArt 유지, 환경 캐시5회 재사용과 씬 자식 수 고정, 환경에 입력/물리 없음, VFX120 상한/소멸/재사용, 기존 상세 열기/닫기 확인.
- 최종 시각 검수에서 첫 적 출현/마지막 적 소멸 시 미니맵을 갱신하도록 보완했다. 기존 방 단위 지도를 유지하며 현재 방의 청록 플레이어/빨간 적 존재/문 연결을 구분한다. 적의 전체 지도 추적 기능은 추가하지 않았다. 긴 저장 메시지는 첫 단의 별도 공간에 저장/실패/이전 정상 복구 요약으로 표시한다. 이후 `battle-redesign-browser`, `pixel-ui-browser`, `checkpoint-v2-browser`와 빌드를 다시 통과했다.
- 기존 규칙·저장·캐릭터 등31파일의 SHA-256을 보존했다. 이전 보존 기준의 나머지1파일인 `DroneUnit.ts`는 시각 배율만 변경했음을 diff로 확인했다. 캐릭터/제공 아트 파일과 게임/스킬 데이터는 그대로다. 읽기 전용 diff 검토·`git diff --check` 통과.
- 캐시 이후 동일 부하 조건(Windows HeadlessChrome157/소프트웨어 렌더링,10초, 적28기/탄환 최대150개)의 평균14.2/min10.1 FPS. 정적 도형을 한 장으로 캐시하는 구조는 검증했으나 이 측정에서 FPS 개선은 확인하지 못했다. 실제 Android 성능과60 FPS를 보장하지 않는다.

다음 확인은 Android 실기기의 작은 글자·터치/앱 복귀·안전 영역과 하드웨어 GPU 부하/장시간 성능이다. Canvas 렌더러 시각 품질도 미검증이다. 사용자 원본 잔디의 반복 무늬는 일부 남아 있다. 출시/서명/플랫폼 설정이나 전투 규칙 변경은 수행하지 않았다.
