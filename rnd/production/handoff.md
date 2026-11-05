# Handoff

## UI-004 — 조합 재료명과 수량 표시 (2026-11-05)

- Changed: `src/ui/recipePresentation.ts`, `src/scenes/SquadScene.ts`, `src/systems/SquadRoster.ts`의 판정 인자 타입, `tests/squad.test.mjs`, 관련 문서.
- Behavior: 불 T2~3 → 용암 골렘, 번개 T2 → 폭풍 궁수, 숲 T2 → 바람 순찰자 또는 가시 수호자. 실제 조합 판정과 같은 함수로 후보 이름·보유 수를 구하며 재료별 행에 `보유 N / 필요 M`을 표시한다. ★ 승급의 필요 ★도 표시한다. 재료 조건·비용·조합 결과는 유지한다.
- Validation: 테스트 23개·빌드·Chrome 156의 전체 모바일 스모크 통과. 720×1280/360×640에서 재료 줄바꿈/겹침 없음, 용암 골렘 2기+달빛 사제→불사조 제작 확인. Gradle assembleDebug 성공, APK 서명·최신 dist 파일 해시 일치 확인. 실제 Android 설치/실행은 미검증.
- Evidence: [화면/검증 기록](../artifacts/recipe-validation/report.md), [수정 APK](../artifacts/apk/summoners-expedition-recipes-debug.apk). 기존 APK 보존, 커밋/푸시하지 않았다.

## UI-003 — 소환 유닛 전체 아트 교체 (2026-11-05)

- Changed: `src/assets/units-v3/`(신규 21 PNG·manifest·아틀라스·준비 기록), `src/ui/unitArt.ts`, `artAssets.ts`, `pixelCharacters.ts`, `BootScene.ts`, `SquadScene.ts`, `GameScene.ts`, `scripts/build-unit-atlas.mjs`, `scripts/verify-unit-art.mjs`, `scripts/lib/chrome-cdp.mjs`, `tests/squad.test.mjs`, 관련 문서.
- Implemented: 숲의 사수 외 21종에 새 개별 아트 적용. 궁수 공통 이미지도 구분했다. 목록은 별도 96px 초상화, 전투는 기존 48px·4프레임 유지. 실제 게임은 512,118바이트 아틀라스 한 장만 추가 로드하고 원본 21 PNG는 번들에서 제외한다. 준비 후 원본 GPU 텍스처와 캐시를 해제한다.
- Validation: `npm test` 21개·`npm run build`·전체 Chrome 모바일 스모크 통과. 아트 QA에서 전투/초상화 각 22종의 서로 다른 픽셀, 투명도·프레임 크기·목록 연결, 예외 0건 확인. 실제 dist의 아틀라스 HTTP 200과 두 화면 크기 캡처 확인. 전투 부하 10초·적 28·탄환 최대 150에서 평균 60.2/최저 60.0 FPS (Windows Headless Chrome 156).
- Review: 로드/프레임 매핑·픽셀 중복·UI 크기·텍스처 수명·조합 후 개체 교체/저장 복원 경로 검토. 새 차단 문제를 확인하지 못했다. 밸런스/비용/레시피/충돌/입력 수치를 이 작업에서 변경하지 않았다.
- Remaining: 적 몬스터 신규 아트·새 방향별 이동/공격 프레임, Android 실기기와 장시간 성능은 별도. 기존 Vite 청크 경고 유지.
- Evidence: [실제 화면·전체 유닛·검증 보고서](../artifacts/unit-art-validation/report.md), [원본/최종 생성 프롬프트](../src/assets/units-v3/README.md). 미리보기 `http://127.0.0.1:4173/?art=units-v3`. 커밋/푸시하지 않았다.

## UI-002 — 실제 아트 적용 보완 (2026-11-05)

- Problem: UI-001은 코드 도형·색상 개선이 중심이었으며 사용자가 본 타이틀과 시안의 장식·재질 표현을 충분히 바꾸지 못했다. 이전의 포괄적인 완료 표시는 이 상태를 정확히 설명하지 못했다.
- Changed Files: `src/assets/fantasy-v2/`의 PNG 5개와 생성 프롬프트 README, `src/ui/artAssets.ts`, `src/vite-env.d.ts`, `BootScene.ts`, `MenuScene.ts`, `GameScene.ts`, `SquadScene.ts`, `GameOverScene.ts`, `fantasyTheme.ts`, 브라우저 캡처/아트 로딩 확인 및 디자인·작업 기록.
- Implemented: 보라색 포털/유적 타이틀, 균열 석재·횃불·덩굴 던전, 실제 금색 장식 프레임 버튼 및 별도 읽기 영역이 있는 9-slice 카드. 정비·결과 배경과 버튼도 통일했다. 소환사와 궁수 계열은 생성 원본에서 부팅 때만 작은 픽셀 텍스처를 준비하고 원본 GPU 텍스처를 해제한다.
- Tests: `npm test` 20개, `npm run build`, Chrome 156의 전체 브라우저 스모크 통과. 360×640/720×1280 터치·화면 전환·저장·이어하기 및 예외 0건. 4173의 실제 dist에서 PNG 5개 HTTP 200과 실행 화면을 별도로 확인했다.
- Performance: 적 28·탄환 최대 150·10초에서 평균 60.3/최저 59.9 FPS (Windows Headless Chrome). 실제 Android 성능 보장은 아니다.
- Review: 아트 로드/빌드 경로, 프레임/바디 크기, 텍스처 수명, 카드 겹침, 버튼 입력·씬 재시작 경로 검토. 기능을 막는 신규 문제는 확인하지 못했다. 밸런스·레시피 데이터는 이 작업에서 변경하지 않았다.
- Remaining: 전체 유닛/적의 신규 개별 아트와 방향별 이동/공격 프레임은 별도. PNG 원본 합계 약 8.8 MB이며 모바일 다운로드/장시간 메모리·실기기 QA는 미검증. Phaser 청크 경고 유지.
- Evidence: [실제 실행 전후 화면·보고서](../artifacts/ui-redesign-v2/report.md), [아트와 최종 프롬프트](../src/assets/fantasy-v2/README.md). `artifacts/`는 Git 제외 대상.
- Preview: `http://127.0.0.1:4173/?art=v2`. 커밋/푸시하지 않았다.

## UI-001 — 모바일 UI 리디자인 (2026-11-05)

이하 내용은 코드 기반 1차 개선 기록이다. 시안의 전체 아트 구현 완료를 뜻하지 않으며, 사용자가 지적한 시각적 격차는 UI-002에서 보완했다.

- Changed Files: `src/ui/fantasyTheme.ts`, `pixelCharacters.ts`, `VirtualJoystick.ts`, `src/scenes/GameScene.ts`, `SquadScene.ts`, `BootScene.ts`, `src/entities/Bullet.ts`, `EncounterHazards.ts`, `tests/browser-smoke.mjs`, 디자인/작업 기록.
- Implemented: 정보별 HUD·미니맵·분대 초상/상태, 금속 조이스틱·책 버튼, 정비 화면 공통 스타일, 타일 6종·벽/문/횃불, 캐릭터 그림자/외곽선, 진영별 투사체/위험 색상, 짧은 진입 명패. FPS는 `?debug`에서 표시한다. 이전 SAVE-001을 보존했다.
- Tests: `npm test` 20개, `npm run build`, Chrome 모바일 터치 스모크 통과. HUD 텍스트 범위, 360px 화면, 이동 중 두 번째 손가락으로 책 열기, 터치 취소와 복귀, 조합·부대 동기화, 5개 스테이지, 저장 복원에 대한 실행 예외 0건.
- Performance: Windows Headless Chrome 156, 적 28·탄환 최대 150·10초/20샘플에서 평균/최저 FPS가 전 60.5/60.1 → 후 60.3/59.9. 짧은 합성 부하 비교다.
- Risks / Unverified: 실제 Android 노치·제스처 영역·앱 전환 및 장시간 성능은 미검증. Vite의 Phaser 포함 청크 크기 경고는 남아 있다. 밸런스·레시피·충돌·입력 이동 수치는 변경하지 않았다. 이미지 시안의 MP나 새 스킬은 추가하지 않았다.
- Next: 실제 Android에서 안전 영역과 멀티터치 확인. 커밋/푸시는 하지 않았다.
- Evidence: [전후 화면·검증 보고서](../artifacts/ui-redesign-validation/report.md) (`artifacts/`는 Git 제외 대상).

## SAVE-001 — 이전 작업

- Date: 2026-11-05
- Task: SAVE-001 — 스테이지 시작 자동 저장·이어하기
- Changed Files: `src/systems/RunSaveManager.ts`(신규), `RoomGridManager.ts`, `SquadRoster.ts`, `src/types/game.ts`, `src/scenes/GameScene.ts`, `MenuScene.ts`, `GameOverScene.ts`, `tests/run-save.test.mjs`(신규), `tests/browser-smoke.mjs`, 관련 README·게임 브리프·메커니즘·스테이지 문서 및 작업/결정 기록.
- Implemented: 스테이지 진입 체크포인트, 동일 맵·분대·HP·★·배치·재화·소환권·강화·통계 복원, ID 상한 보존, 중단/타이틀, 저장 교체 확인, 승리·패배 시 삭제, 버전/손상/저장소 실패 처리.
- Tests Run: `npm test`, `npm run build`, 로컬 Vite 서버에서 `node tests/browser-smoke.mjs`, `git diff --check`.
- Test Results: 모델 테스트 20개와 빌드 통과. Windows Headless Chrome 156의 720×1280 및 360×640 터치 흐름 통과. 페이지 새로고침 후 이어하기, 반복 3회 시 보상/회복 중복 없음, 소비/판매 ID 유지, 새 ID 발급, 취소/덮어쓰기, 손상 저장 복구, 표시 후 저장 소실, 저장된 타입/★에 따른 전투 개체 생성, 승리·패배 삭제를 확인했다. 브라우저 실행 예외 0건. 정적 검토 후 복원 초기화·잘못된 저장 갱신·저장 소실 경로를 보강하고 재검증했다.
- Unverified: 실제 Android 앱 강제 종료/재실행과 OS에 의한 저장소 정리. 테스트는 브라우저 에뮬레이션이며 APK를 새로 빌드하지 않았다.
- Risks: 저장소 접근/삭제가 모두 차단되면 영구 저장/삭제를 보장할 수 없다. 실패를 알리고 현재 세션의 오래된 이어하기를 차단한다. 빌드에는 Phaser 포함 청크 크기 경고가 남아 있다. 클라우드 동기화·동시 실행 간 충돌 처리는 범위 밖이다.
- Next Action: Android 실기기에서 스테이지 전환 후 앱 프로세스를 종료하고 이어하기·패배 후 삭제를 확인한다. 커밋/푸시는 수행하지 않았다.

정책은 [결정 기록](../design/decisions/001-stage-checkpoints.md), 화면은 [이어하기 타이틀](../artifacts/run-save-validation/continue-menu.png)과 [복원된 스테이지](../artifacts/run-save-validation/restored-stage.png)를 참조한다. `artifacts/`는 Git 제외 대상이다.
