# 041 — 사운드 시스템 P0-1~4 리팩터링

- 요청: `rnd_sound_refactoring_p0_guide.md`의 사운드 호출 감사, 공통 믹서, 재생 제한, 모바일 오디오 생명주기를 구현한다.
- 범위: 기존4개 play API와 합성음의 주파수/파형을 유지한다. 보스 전용 사운드·BGM·새 파일/의존성·새 설정 UI·전투/저장 변경은 포함하지 않는다.

## P0-1: 전체 호출 감사

직접 재생 호출12곳을 검색했다. 외부 AudioContext/Phaser 사운드 재생 호출은 없으며, MenuScene 외 직접 enabled 쓰기는 없었다.

| 호출 위치 | 이벤트 / 기존 API | 변경 |
|---|---|---|
| WeaponComponent.tryFire | 실제 발사 callback 다음 playShoot(tier) | 호출과 발사 계산 유지. 소리만 중앙 정책으로 제한 |
| GameScene 분대 피해 callback | 실제 피해 처리 후 playHit | 유지 |
| GameScene.onBulletHitEnemy | 탄환 접촉/관통 대상별 playHit | 동일 life 중복 처리 방어 뒤 호출 유지 |
| GameScene.onBulletHitEnemy AoE | 범위 공격 playExplosion | 범위 피해 루프와 독립, 유지 |
| GameScene.handleEnemyKilled | 각 처치 playExplosion | 처치·보상 중복 방어와 독립, 유지 |
| GameScene.handlePlayerDeath | 패배 playExplosion | 기존 사용 유지 |
| GameScene.startRoomLogic RECOVERY | 회복 playPowerup | 기존 사용 유지 |
| GameScene.finishRoom | 방 클리어 playPowerup | 기존 사용 유지 |
| MenuScene.startRun | 시작/이어하기 playPowerup | 입력 안에서 unlock 시작, Scene 이동은 기다리지 않음 |
| SquadScene 성공 처리 | 정비 거래 성공 playPowerup | 유지 |
| RewardScene 보상 선택 | 보상 성공 playPowerup | 유지. 현재 주 보상 흐름을 변경하지 않음 |
| GameOverScene 재도전 | 재시도 playPowerup | 유지 |

TODO(P1): explosion의 AoE/일반 처치/패배와 powerup의 UI/회복/클리어를 개별 이벤트/음색으로 분리할 수 있다. 이번에는 기존4종 식별자를 유지한다.

## P0-2~3: 공통 재생과 믹서

- `src/config/soundData.ts`:4종 파형·주파수·엔벌로프·게인·정책 설정. 기존 tier1/2/3 발사음620/760/920Hz, 피격220→80Hz, 폭발140→35Hz, 강화380→880Hz와 기존 최대 재생 길이를 유지한다. 시작에3ms attack을 추가했다.
- `src/systems/SoundManager.ts`: 네 play 메서드를 공통 경로에 위임한다. 음성 Gain→SFX/UI Gain→Master Gain→destination. 믹서 Gain3개는 컨텍스트당1회만 생성한다.
- 최소 간격 / 개별 상한: shoot40ms/4개, hit60ms/3개, explosion100ms/3개, powerup120ms/2개. 총8개 상한. 낮은 우선순위가 총 상한을 채우면 더 중요한 효과가 가장 낮은 우선순위의 오래된 음성을 대체한다. 동일 종류 상한은 그대로 지킨다.
- muted/master0/group0 요청은 새 음성 노드를 만들지 않는다. enabled=false/master0은10ms Master ramp 후 기존 음성을 중지한다. background/dispose는 즉시 stop·disconnect한다. 그룹 볼륨은10ms ramp로 기존 음성에도 적용된다.
- 유한한 볼륨은0~1 clamp, NaN/Infinity는0으로 처리한다. 설정 snapshot과 진단 snapshot은 복사본이다. 설정은 기존처럼 앱 실행 동안만 유지하며 저장 키나 정책을 추가하지 않는다.
- onended와 오류/선점/dispose에서 oscillator·voice Gain과 참조를 정리한다. requested/played/skippedCooldown/skippedVoiceLimit/skippedDisabled/skippedState/unlockFailures/audioErrors/active/peak 카운터를 제공한다. 프레임마다 진단 snapshot을 만들거나 로그를 출력하지 않는다.

## P0-4: 사용자 입력과 생명주기

- 새 AudioContext는 사용자 입력의 unlock에서만 만든다. play 함수는 resume를 시도하거나 이전 소리를 큐에 저장하지 않으며 running 상태에서만 재생한다. 재개 중인 Promise를 공유하고1500ms 무응답 시 다음 입력으로 재시도할 수 있게 한다.
- `src/systems/soundLifecycle.ts`: 앱당 한 번 설치. Phaser HIDDEN/VISIBLE, document.visibilitychange, window.pagehide/pageshow를 각각의 사유로 관리한다. 사유가 모두 해제돼야 자동 복귀를 시도한다. 아직 한 번도 활성화하지 않았다면 자동 복귀로 최초 생성을 하지 않는다.
- 전역 입력은 pointerup/keydown이다. Chrome 터치의 pointerdown이 Phaser touchstart보다 먼저 오는 경우를 피하므로, 최초 음소거 터치가 쓸모없는 믹서를 만들지 않는다. 시작/소리 켜기 버튼은 자신의 callback에서 즉시 unlock을 시작한다.
- Scene 전환에는 SoundManager와 앱 리스너를 유지한다. Game.destroy 때 모든 리스너·음성·믹서·컨텍스트를 정리한다. 기존 GameScene의 플레이 일시정지/복귀/SHUTDOWN 리스너는 수정하지 않았다.
- `src/main.ts`: lifecycle 연결과 `audio.noAudio=true` 설정. 사용하지 않는 Phaser 기본 WebAudio 컨텍스트를 방지해 SoundManager가 하나의 출력 컨텍스트를 소유한다.
- `src/scenes/MenuScene.ts`: setEnabled/isEnabled 사용, 라벨 동기화, 시작 시 unlock 결과와 Scene 이동 분리.

## 검증

- `tests/sound.test.mjs` + `tests/helpers/fake-audio.mjs`:10개 단위/통합 시나리오. 가짜 AudioContext/Clock의100회 연사, 음성 상한/우선순위, 믹서 경로·주파수, 음소거·볼륨, 미지원/생성·resume·suspend·노드 실패, 무응답 재시도, 동시 unlock100회, 늦은 resume·hide/show 경합·dispose, 리스너 정리, 실제 WeaponComponent 발사100회/피해 불변을 검증했다.
- 기존 보스 작업이 있는 개발 작업본에서 `npm test`:176/176 통과. `npm run build`: strict TypeScript·Vite 통과. 기존500kB 초과 JS 번들 경고 유지.
- `node tests/audio-browser.mjs`: 실제 Chrome 사용자 터치·WebAudio 검사8항목 통과. 최초 음소거·음소거 시작의 컨텍스트0, 활성화 후 컨텍스트1/믹서 Gain3,100회 동시 발사 요청의 재생1/스킵99/추가 oscillator1을 확인했다. 자동 재개 거절 후 실제 터치 복구, 문서/페이지 숨김 복귀, 씬3회 재시작, Game 종료의 실제 close, WebAudio 미지원에서도 전투 진입을 확인했다.
- `node tests/browser-smoke.mjs`:30개 시나리오 통과. 모바일 터치 이동·소환·조합·거래 실패 원자성·출전 동기화·부활/지원·방 보상·일시정지·스테이지5개 진행·재시작·저장 복원·런타임 예외 없음을 확인했다.
- 헤드리스 부하 표본: Windows HeadlessChrome157,720×1280 터치 에뮬레이션, 적28·최대 탄환150·10초에서 평균15.7/최저12 FPS. 같은 조건의 전후 성능 비교는 아니며60 FPS나 개선을 보장하지 않는다.
- 원격 main 기준 사운드 전용 격리 작업본: `npm test`163/163, `npm run build`, 실제 Chrome 오디오8항목 통과. 기존 보스/HUD 작업과 사용자 사운드 가이드 원본은 해당 PR에 포함하지 않는다. 두 작업본의 테스트 개수 차이는 기존 보스 관련13개 검사이며, 사운드 회귀10개는 동일하다.
- 리뷰: 공통 믹서/음성 종료 정리, 낮은 우선순위 선점, 사용자 입력의 동기 unlock, 배경 사유 중첩, 늦은 비동기 결과와 dispose, 앱 리스너 수명 및 기존 전투 호출을 점검했다. 확인된 회귀 결함은 없으며 Android 실기기와 실제 청취는 아래 후속 확인에 남긴다.

## 수정 파일 / 다음 확인

프로덕션 파일은 `src/config/soundData.ts`, `src/systems/SoundManager.ts`, `src/systems/soundLifecycle.ts`, `src/main.ts`, `src/scenes/MenuScene.ts`이다. 테스트는 위3개 파일을 추가했다. WeaponComponent·GameScene 등 전투/진행 호출부는 변경하지 않았다.

실제 Android WebView의 홈/잠금/통화/블루투스 복귀, 실제 기기 청취에 따른 음량·피로도 튜닝은 미검증이다. 브라우저 테스트는 실제 WebAudio 상태/노드를 계측한 것으로, 사람이 스피커로 청취한 결과가 아니다. 가이드에 따라 사운드 전용 브랜치와 draft PR을 준비하며 main 병합은 수행하지 않는다.

초기 사용자 입력에서 컨텍스트를 만들거나 재개하는 정책은 [MDN WebAudio 권장 사항](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [Chrome 자동 재생 정책](https://developer.chrome.com/blog/autoplay)을 참고했다.
