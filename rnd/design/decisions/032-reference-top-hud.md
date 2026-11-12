# 032 — 제공된 상단ui.png의 실제 HUD 반영

- 날짜: 2026-11-12
- 기준: 사용자 확인 경로 `.agent/skills/design/20261112/상단ui.png`.
- 031의 텍스트 사양 기반 구현 후 실제 목업 경로가 전달되어 상단과 배너의 시각적 차이를 보완했다. 기존 하단 분대/컨트롤 구현은 유지한다.

## 목업과의 대응

- 큰 금색 잎·보석 초상화 프레임, 보라색 이중 레일의 메인 카드, 금색 마력석 프레임, 별도 미니맵 프레임, 잎과 중앙 보석이 있는 배너를 적용했다.
- 이름·레벨은 한 줄에, HP는 하트 옆에, EXP 수치는 별도 보라/파랑 그라데이션 바 중앙에 표시한다. 기존 소환사 원본 아트의 상반신을 새 HUD 초상화 텍스처로 사용한다.
- 목업의 문구/숫자/캐릭터/지도 타일/게이지/+를 제거한 장식 스킨을 built-in `image_gen`으로 준비했다. 이미지에는 실시간 문구/수치를 넣지 않았다. 원본과 생성 프롬프트는 `src/assets/hud-v1/generation.json`, 소스 PNG는 같은 폴더에 보존했다.
- `scripts/build-reference-hud.mjs`로 두 스킨을 1028×376의 단일 런타임 atlas로 패킹했다(546,144bytes). 패널 내부 요소의 위치 관계를 유지하는 고정 720px 복합 스킨이며, 기존 다른 패널의 NineSlice 경로는 유지한다.
- 목업 예시 HP71/115·레벨4·마력석320과 같은 fixture를 캡처했다. 실제 레벨4 EXP 요구량은65이므로 54/85로 고정하지 않고 54/65를 표시한다.
- 기존 게임에 마력석 구매 기능이 없으므로 목업의 + 구매 버튼을 새로 추가하지 않았다. 미니맵도 예시 타일을 복제하지 않고 실제 룸/방문/적 상태를 그린다.
- 고정된 아레나와 상단 출입문을 지키기 위해 세로 비율을 조정했다. 배너는 (56,98) 608×58, 하단156이며 기존 상단 문 스프라이트의 상단159와 겹치지 않는다. 물리/문/이동 경계와 720×1280 Scale 설정을 바꾸지 않았다.
- 긴 지역명/방 상태/안내는 각각 독립된 페이지로 순환한다. 이름의 진행은 적 수/전투 상태 갱신으로 초기화되지 않는다.

## 수정 파일

- `src/ui/BattleTopHud.ts`: 금색 스킨, 큰 기존 소환사 초상화, 한 줄 이름/레벨, 하트·HP·EXP·마력석·미니맵 배치.
- `src/ui/StageBanner.ts`: 목업 배너, STAGE/지역/방 상태/안내 배치와 긴 방 상태의 페이지 표시.
- `src/ui/hudArt.ts`, `src/assets/hud-v1/*`, `scripts/build-reference-hud.mjs`: 재사용 가능한 빈 장식 스킨과 atlas 준비/로딩 계약.
- `src/scenes/BootScene.ts`: HUD atlas 로드 및 기존 mage 원본의 상반신 텍스처 생성.
- `src/ui/fantasyTheme.ts`: HP/EXP/패널의 시각 좌표.
- `src/scenes/GameScene.ts`: STAGE/EXP 표시 형식 연결, 새 폭에 맞춘 보스 UI. 게임 데이터·HP/XP 계산·전투·소환·편성·저장 정책은 변경하지 않았다.
- `tests/hud-reference-browser.mjs`: 원본 목업 대응/큰 수치/긴 이름/HP0·최대 레벨 및 HUD crop 캡처.
- 기존 HUD/영웅/무한/전투/모바일 테스트의 표시 형식·레이아웃 계약 갱신. `tests/helpers/browser-session.mjs`의 최초 메뉴 에셋 로딩 대기를 15초에서30초로 조정했다. 일반 씬 전환 대기는 유지한다.

## 검증

- `npm test`: 148/148 통과.
- `npm run build`: TypeScript strict·Vite 빌드 통과. 기존 번들 크기 경고가 남는다.
- `node tests/hud-reference-browser.mjs`: 360/390/720px 목업 대응, 360/390px 큰 수치·긴 이름·HP0·최대 레벨 검증 및 총14개 실제 화면/HUD crop 캡처 통과. 별도의 실제 Canvas 렌더러에서도 HP/EXP 채움 색이 각각 #FF5A65/#3FB7FF로 표시되는 것을 픽셀로 검증했다.
- `node tests/hero-browser.mjs`: 실제 처치에 따른 레벨/HP/EXP 갱신, 저장/복원·일시정지·재시작 통과.
- `node tests/hud-readability-browser.mjs after`: 텍스트/아이콘 겹침, 큰 수치·최대 레벨·긴 이름·저장 실패·보스·S1000 등8개 경계 사례 통과.
- `node tests/browser-smoke.mjs`: 기존 모바일 터치·전투·소환/조합·편성·정비·5스테이지·저장/복원·재시작 회귀 통과.
- `node tests/battle-redesign-browser.mjs final`: 320/360/720px 전투·보스·이펙트·상세 검증 통과 및 기존 전투 비교 이미지 갱신.
- 확대 캡처에서 EXP 바와 배경 레일 사이 여백을 확인하고 상단 스킨 높이를120으로 조정했다. HP/EXP 데이터/계산은 변경하지 않았다.
- 최종 리뷰에서 Boot의 atlas/기존 초상화 생성 수명주기, 실시간 HUD 갱신 연결, 긴 문구의 독립적인 페이지 갱신, WebGL/Canvas 막대 표시와 출입문 경계를 검토했다. 이번 변경에서 추가 회귀 문제를 발견하지 않았다.
- 환경: Windows Headless Chrome157, 모바일 뷰포트/터치 에뮬레이션. 임시 프로필은 D 드라이브에 생성했다. 동시 실행 중 초기 에셋 업로드 지연이 있었고 최초 메뉴 대기를 늘려 재검증했다.

## 확인 자료와 한계

- `artifacts/hud-reference-20261112/comparison.html`: 사용자 원본 목업·기존 구현·새 구현을 나란히 확인한다. 큰 수치/최대 레벨과 전체 전투 화면도 선택할 수 있다.
- `artifacts/hud-reference-20261112/result.json`: 텍스트 겹침·실시간 값·프레임·문/아레나 유지 검증 결과.
- 목업과의 세로 비율, 실제 지도, 실제 EXP 요구량과 기존 캐릭터 아트는 위 제약에 따라 차이가 있다. 새로운 구매 기능이나 목업 예시 수치 고정은 없다.
- Android 실기기 폰트·입력·성능과 APK는 미검증이다. Git push/merge·출시는 수행하지 않았다.
