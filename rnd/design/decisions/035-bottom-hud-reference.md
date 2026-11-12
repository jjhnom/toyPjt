# 035 — 첨부 목업 기반 하단 HUD

- 날짜: 2026-11-12
- 범위: 하단 HUD 외형과 배치. 기존 상단 HUD·미니맵·아레나·전투/편성/저장 규칙은 유지한다.
- 사용자 첨부 2172×724 하단 목업을 기준으로 금색·보라색 외곽 프레임, 요약 띠, 출전 카드, 버튼과 원형 조이스틱을 적용한다.

## 변경 파일과 표시

- `src/ui/BattleSquadHud.ts`: 출전/보유/시너지/생존 4개 그룹과 아이콘, 6개 가로 슬롯, 어두운 빈 슬롯의 +, 우측 책 아이콘 상세 버튼. 초상화는 40→50px로 확대한다. 정확한 HP 수치는 기존 상세 보기에 유지하고 카드에는 실시간 HP바를 표시한다. 별 등급·선택 테두리·부활·고유 스킬 상태를 유지한다.
- `src/ui/BattleControlHud.ts`: 가장 넓은 금색 프레임의 원정 정비, 회색 액티브 스킬, 보라색 중단·타이틀. 정비 상태가 기존 방 상태에 따라 갱신된다.
- `src/ui/ActiveSkillButton.ts`: 실제 클래스 스킬명과 준비/남은 초, 진행 바와 준비 표시등을 적용한다. 누름/해제 포인터 소유권, 해제 시 시전, 이탈·취소·blur·pause 시 취소 동작은 유지한다.
- `src/ui/VirtualJoystick.ts`: 목업의 원형 베이스와 보라색 손잡이, 대기 위치 (90,1230). 자유 터치 앵커링·방향 계산·반경64·WASD·리셋을 유지한다.
- `src/ui/bottomHudArt.ts`: 재사용 가능한 스킨/NineSlice·아이콘·버튼. 입력은 스킨과 분리된 고정 hit 영역이 처리한다.
- `src/ui/fantasyTheme.ts`: 하단 슬롯의 시각 좌표만 조정한다.
- `src/scenes/BootScene.ts`: 하단 아틀라스 로드와 기존 손잡이 텍스처의 색상/하이라이트 조정.
- `src/scenes/GameScene.ts`: 기존 데이터를 컴포넌트에 연결하고 슬롯의 중복 ‘출전’ 텍스트를 숨긴다. HP/별/재화/전투 상태 계산은 수정하지 않는다.

## 에셋과 공간

- `src/assets/bottom-hud-v1/`: built-in `image_gen.imagegen`으로 분리한 글자 없는 소스 2장, 1024×512 런타임 아틀라스, 생성 프롬프트 `generation.json`.
- `scripts/build-bottom-hud.mjs`: 원본을 보존하며 필요한 프레임을 잘라 묶는다. 텍스트/샘플 수치/유닛/HP바/스킬 상태를 이미지에 포함하지 않는다.
- 하단은 기존 (0,1080) 720×200 영역을 유지한다. 전투 필드 경계 (64,170)~(656,1090), 출입문, Scale.FIT와 720×1280은 변경하지 않는다.
- 중요 조작 hit 높이88(360px 폭에서44 CSS px), 버튼 사이20 logical px 간격. 조이스틱의 자유 터치는 버튼과 슬롯의 이벤트 전파 차단으로 분리한다.
- 목업의 ‘자유 파밍’은 현재 게임 기능이 아니므로 실제 클래스 액티브 스킬을 표시한다. 신규 모드는 추가하지 않는다.

## 검증 자료

- `tests/bottom-hud-browser.mjs before/after`: 360·390·720px 전후 캡처, 6개 슬롯, 빈 슬롯, 부활·스킬 대기, 동적 생존 수치, 글자/프레임/초상화 간 경계 검사. 기존 상세·정비·타이틀 버튼, 실제 치유와18초 대기, 드래그 이탈·touchcancel·pointercancel·blur·pause·hidden 취소, 멀티터치 시전 검증.
- `tests/hud-mockup-browser.mjs`, `tests/abilities-browser.mjs`, `tests/provided-art-browser.mjs`: 새 하단 스킨과 슬롯 배치에 맞게 기존 시각 검사 기준을 갱신한다.
- 실행 결과와 전후 사진은 `artifacts/bottom-hud-20261112/comparison.html`, `after-result.json`에 저장한다.
- `npm test`: 153/153 통과.
- `npm run build`: TypeScript strict·Vite 빌드 통과. 기존 JS 번들 500kB 초과 경고가 남는다.
- `node tests/bottom-hud-browser.mjs before`, `after`: 전후 캡처 및 하단 상태·입력 검증 통과.
- `node tests/hud-mockup-browser.mjs final`: 기존 HUD 수치 갱신, 긴 제목, 슬롯 선택, 실제 이동, 멀티터치·취소 검증 통과.
- `node tests/browser-smoke.mjs`: 편성/조합, 실제 이동, 취소/일시정지, 5개 스테이지 전환, 저장·복원·재시작 회귀 검사 통과. Headless Chrome 소프트웨어 렌더링이며 실기기 성능 결과로 해석하지 않는다.
- `node tests/provided-art-browser.mjs`: 공통 스킨35종, 5개 테마 바닥, 실제 액티브 버튼과 정비 화면 검사 통과.
- `code-review`로 이번 HUD 변경과 호출 경로를 검토했다. 포인터 소유권/취소, 씬 종료 리스너 해제, 실제 데이터 갱신과 원래 전투 경계에서 추가 회귀 문제를 발견하지 않았다.
- Android 실기기는 미검증이다. 작은 상태 글자의 실제 기기 식별과 엄지 조작감은 다음 수동 확인 항목이다.

## 캐릭터–HP바 간격 후속 조정

- 사용자 피드백에 따라 슬롯 초상화 크기를 48→50px, 중심 Y를 1133→1140으로 조정한다. HP바와 카드의 좌표는 유지한다.
- 별 등급과의 간격을 확보하기 위해 초상화를 왼쪽으로2px 옮긴다.
- 96px 초상화 원본의 투명 여백을 포함해 계산하면, 실제 캐릭터 하단과 HP바 사이 간격은 약12→4px(게임 논리 좌표)로 줄어든다.
- 전후 캡처는 `artifacts/bottom-hud-spacing-20261112/comparison.html`에서 비교한다.
