# 054 — 보스 스킬 사운드 연결

2026-11-13. 제공된 `rnd_boss_sfx_v1/docs/RND_BOSS_AUDIO_IMPLEMENTATION_GUIDE.md`를 현재 작업 트리의 보스 6종·스킬 13개에 적용한다. 판정·피해량·타깃·AI·페이즈 수치는 변경하지 않는다.

## 현재 구현에 맞춘 매핑

- 가이드의 `desert_king + SANDSTORM`은 실제 `desert_emperor + POISON`에 연결한다.
- 가이드의 `BINDING`은 실제 `twilight_king + FROST`에 연결한다.
- 기존 SoundManager는 이미 15개 전투 샘플과 Web Audio 믹서를 사용한다. Phaser 오디오를 별도로 켜지 않고 같은 컨텍스트·마스터·SFX 볼륨·잠금 해제·백그라운드 정책을 공유한다.
- 제공 OGG 22개와 운석 분리본 4개를 `public/audio/boss/`에 복사한다. WAV와 미리듣기는 배포 자산에 복사하지 않는다. 운석 일체형 2개는 보관하되 실제 패턴에서는 분리본만 재생한다.

## 이벤트와 수명

- 수정 파일: `src/config/soundData.ts`, `src/systems/SoundManager.ts`, `src/scenes/BootScene.ts`, `src/scenes/GameScene.ts`, `src/entities/EncounterHazards.ts`. 추가 파일: `src/config/bossSoundData.ts`, `src/systems/BossAudioController.ts`, 보스 오디오 단위/브라우저 테스트, OGG 26개. 기존 전투 브라우저 테스트의 전체 샘플 개수도 41개에 맞춘다.
- `bossSoundData.ts`: 13개 스킬 매핑과 음량·우선순위·5종 루프 정의.
- `BossAudioController.ts`: `EncounterHazards`의 별도 관찰자로 예고·활성·종료를 수신한다. 그래픽 실패와 오디오 실패는 서로를 막거나 피해 콜백을 변경하지 않는다.
- 보스 생명 ID와 패턴 번호로 같은 계획의 여러 장판을 묶어 경고·발동음을 각각 한 번 재생한다. 풀 고갈로 위험 영역이 전혀 생성되지 않았다면 경고음도 재생하지 않는다.
- 운석은 현재 렌더러의 낙하 시작인 판정 150ms 전에 `fall`, 실제 판정 시점에 `impact`를 재생한다. 착지 시 낙하음은 30ms로 페이드한다. 긴 프레임으로 낙하 구간을 건너뛰면 뒤늦은 낙하음은 생략한다.
- 루프는 실제 활성 장판이 있을 때만 종류당 하나 재생하며, 마지막 장판이 사라질 때 150ms로 페이드한다. 임의 종료 타이머를 만들지 않는다.
- 음소거·SFX/보스 카테고리 볼륨 0·일시정지·백그라운드에서 루프를 정리한다. 복구 후 여전히 활성인 장판만 다시 재생한다. 지난 경고·발동음은 재생 대기열에 넣지 않는다.
- 실제 보스 생성, 증가한 페이즈, 사망 확정에 공통음을 연결한다. 보스 사망은 일반 엘리트 사망음과 분기한다. 처치 즉시 정비/종료 화면으로 전환되므로 사망음의 짧은 잔향은 전역 믹서에서 끝까지 허용하고, 루프·나머지 보스음은 정리한다.
- 기존 전체 8음성 상한을 유지한다. 경고·사망·발동음은 일반 공격보다 높은 우선순위이며, `setBossVolume('bossCast' | 'bossLoop' | 'bossUI', value)`로 개별 조정할 수 있다. 보스 파일 누락·디코딩 실패 시 해당 보스음은 무음 처리한다.

## 검증

- 변경 전 `npm test`: 218개 통과.
- 보스 오디오 회귀 테스트 추가 후 `npm test`: 225개 통과.
- `npm run build`: 성공. 기존 Vite의 500kB 초과 청크 경고가 남아 있다.
- `node tests/boss-audio-browser.mjs`: Chrome 모바일 뷰포트에서 실제 OGG 26개 디코딩/유음 PCM, GameScene 13개 스킬의 경고·낙하·발동 시점, 다중 장판 중복 방지, 음소거·일시정지·백그라운드 복구, 실제 생성·중복 처치 방어·씬 종료 정리 통과. 오디오 오류 0, 최대 동시 음성 8 이하.
- 결과: `artifacts/boss-audio-20261113/result.json`. 브라우저 자동 검증이며 사람의 청취 평가나 Android WebView 실기기 검증은 아니다.
- `node tests/combat-audio-browser.mjs`: 기존 15종 샘플 재생과 30초 제어 전투 통과. 최대 8음성 이내, 오디오 오류 0.
- `node tests/audio-browser.mjs`: 첫 음소거 입력에서 컨텍스트 미생성, 첫 터치 잠금 해제, 숨김/복귀·자동 재개 실패 후 터치 복구, 씬 3회 재시작의 컨텍스트·리스너 재사용, 게임 종료 해제, Web Audio 미지원 시 전투 시작 통과.
- 변경 코드와 호출 경로 검토에서 추가 회귀 문제를 발견하지 않았다. 이번 수정 파일에 대한 `git diff --check`도 통과했다.

후속 확인은 Android 기기 스피커/이어폰에서 발동음과 지속음의 상대 음량 및 앱 복귀 동작을 청취하는 것이다.
