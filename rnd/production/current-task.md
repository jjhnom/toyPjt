# Current Task

## 전투 화면 UI/UX·그래픽 — 2026-11-11

- ID: UI-014
- Status: COMPLETE (P0/P1 적용·단계별 비교·회귀 검증)
- Scope: 상단 2단 HUD/지도, 기존 타일의 명암·정적 장식, 동료 시각 배율/마법진, 8계열 스킬 피드백, 하단 분대 카드/조작·공통 팔레트. 게임 규칙·이미지·경계/판정/저장 유지.
- Acceptance: 실제 720/360/320 단계별 비교·텍스트/터치 경계·스킬 풀 상한/재사용·테스트/빌드·전투/문/보스/저장 회귀.
- Report: [결정029](../design/decisions/029-battle-screen-redesign.md).
- Validation: 테스트148개·최종 빌드·브라우저12종 통과. 720/360/320 단계별 실제 화면, HUD/분대 영역 분리,60px 동료/36px 본체 물리, 정적 캐시 재사용·자식 수 고정·풀120 상한/재사용, 입력/문/5스테이지/보스/직업/저장 검증. 마지막 지도/저장 문구 정리 후 관련3종·빌드 재검증. 기존31파일 보존·diff/공백 검토 통과.
- Risk / Next: 기존 번들 경고. 소프트웨어 부하(적28/탄환 최대150/10초) 평균14.2/min10.1 FPS로 개선을 확인하지 못함. 실기기 GPU/장시간 성능·작은 글자/앱 복귀·Canvas 품질은 후속. 원본 잔디의 반복 무늬 일부 유지.

## 원정대 편성 카드 가독성 — 2026-11-11

- ID: UI-013
- Status: COMPLETE (이름/이미지/별/상태 분리·전후 비교 검증)
- Source / Scope: 사용자 편성 화면 가독성 요청. `SquadScene.renderRoster()`의 카드·출전 슬롯·안내/페이지·선택 상세 배치를 조정한다. 기존 아트·규칙·데이터·저장 유지.
- Acceptance / Validation: 이름 20px 고정·최대 두 줄/말줄임·76px 카드 이미지·별/출전/대기 배지 분리. 720/360/320 전후 비교, 전체22종/61레시피/9입력 배치·선택/출전↔대기·16명 두 페이지·저장 회귀, 테스트148개·빌드·브라우저3종 통과. 기존32파일 해시 보존·diff 검토/공백 검사 통과.
- Report: [결정028](../design/decisions/028-roster-card-readability.md).
- Risk / Next: 기존 번들 경고 유지. Android 실기기/APK와 다른 OS의 한글 폰트 대체는 미검증이며, 실기기 글자 선명도·터치 확인이 다음 범위다.

## 제공 UI·타일·아이콘 자산 — 2026-11-11

- ID: UI-012
- Status: COMPLETE (제공 이미지 추출·실제 UI/배경 적용·검증)
- Source / Scope: 사용자 `20261111/`의5장 이미지 시트. 프레임/버튼/아이콘·4종 바닥·밤 성/소품을 기존 UI·전투 배경에 연결한다. 기존 입력/거래/물리·저장을 유지한다.
- Acceptance:35개 자산·5테마·준비/대기/비활성 버튼/고정 크기·장식 경계·주요 UI와 테스트/빌드/관련 브라우저 회귀 통과. 원본 이미지/기존 캐릭터/규칙 보존.
- Report: [결정027](../design/decisions/027-provided-ui-environment-assets.md).
- Validation: 테스트148개·빌드·브라우저10종 통과.35프레임/5테마·버튼 상태/고정 크기·소품 경계·61레시피/22종 상세·기존 입력/거래/저장 회귀 확인. 원본5장과 기존32파일 해시 보존·배포 아틀라스 일치·diff/공백 검토 통과. 임시 공간 부족 우회와 직업 검사1회 실패 후 재실행 통과는 결정027에 기록했다.
- Risk / Next: PNG 약1.19MB 추가·기존 청크 경고 유지. Android 실기기/APK·Canvas 모서리 품질·장시간 성능은 미검증. 후속은 실기기의 바닥/적/경고 구분·안전 영역·취소 입력 확인이다.

## 상세 목업 UI·버튼 스타일 — 2026-11-11

- ID: UI-011
- Status: COMPLETE (공통 스타일·실제 적용/검수 시트)
- Source / Scope: 상세 목업 v2 PNG의 컴포넌트/팔레트/배경/아이콘 점검. 금속/보라 명암·프레임·17종 공통 아이콘·로비/정비 연결·실제 컴포넌트 검수 시트를 보완한다.
- Acceptance: 실제 스타일 상태·대표 색 대비·아이콘/글자 경계·기존 입력 영역/콜백 및 테스트/빌드·관련 브라우저 회귀 통과. 배경 타일/예시 기능의 미적용 상태를 구분한다.
- Report: [결정026](../design/decisions/026-ui-component-style-audit.md).
- Validation: 테스트148개·빌드·브라우저8종 순차 통과. 대표5색 대비4.60~13.14:1·일반/눌림/선택/비활성·터치 취소/영역 고정·17아이콘/문자 경계·로비/정비/HUD·실제 치유 스킬/도감/성장/저장 회귀 확인. 기존 코드/아트34파일 해시 보존·diff 검토/공백 검사 통과.
- Risk / Next: 기존 번들 경고 유지. PNG/MD 일부 색상 차이는 기존 의미별 토큰을 유지해 기록했다. 전용 환경 타일·독립 로딩/토글 UI·Android 실기기/안전 영역·장시간 성능은 별도다.

## 원정 정비 목업02/03 — 2026-11-11

- ID: UI-010
- Status: COMPLETE (소환·조합·편성·직접 재료 선택)
- Source / Scope: 사용자 소환·조합/편성 PNG 기반 실제 `SquadScene` 개선. 큰 소환 카드·그림 레시피·직접 재료·6인 단상/8개 보유 카드·선택 상세. 기존 거래/보유16·출전6/저장·부가 메뉴 유지.
- Acceptance: 실제 소환/조합/직접 재료/출전/판매 확인·전체61레시피·모바일 영역/글자·기존 테스트/빌드/관련 브라우저 회귀 통과.
- Report: [결정025](../design/decisions/025-squad-maintenance-mockups.md).
- Validation: 테스트148개·빌드·브라우저8종 순차 통과. 720/360/320 및 가로 FIT·주요 입력48 CSS px/겹침 없음·61레시피·22종 상세 경계·16보유/6출전·직접 재료·각성 판매 취소·정비 중 시계 정지·저장/재개/부가 메뉴/HUD 검증. 기존 코드/아트34파일 해시 보존·diff 검토/공백 검사 통과.
- Risk / Next: 기존500kB 번들 경고 유지. Android 실기기/APK·노치/제스처·사람 가독성·장시간 성능은 후속 확인이다. 신규 확률형 소환/자동 편성/드래그 진형·전투/저장 규칙 변경은 수행하지 않았다.

## 실제 소환 유닛의 치비 디자인 — 2026-11-11

- ID: UI-009
- Status: COMPLETE (실제 소환/조합22종·전투/공통 초상화)
- Source / Scope: 사용자 실제 소환 유닛 디자인 교체 요청. 지정 소환/레시피 결과22종의 큰 머리·짧은 팔다리·밝은 표정을 전투/초상화에 적용한다.
- Acceptance:22개 고유 이미지·전투48px/4프레임/6fps·초상화96px·알파/소스 해제·실제 소환/조합/편성/도감 연결 및 기존 테스트/빌드/스모크 통과. 비용·레시피·전투/저장 규칙 보존.
- Report: [결정024](../design/decisions/024-cute-summoned-units.md).
- Validation: 테스트148개·빌드·22종 고유 전투/초상화·변경 전후 해시·실제 소환/조합/편성/도감·22종 출전 개체·기존 모바일 전투/저장 스모크 통과. 기존 게임 코드/설정/프레임·v3 자산12개 해시 보존. diff 검토/공백 검사 통과.
- Risk / Next: 배포 아틀라스는576.06kB로63.94kB 증가했다. 기존500kB 번들 경고·상하 움직임4프레임 유지. Android 실기기/APK·장시간 성능과 작은 전투 이미지의 사람 가독성은 후속 확인이다.

## 귀여운 로비 캐릭터 — 2026-11-11

- ID: UI-008
- Status: COMPLETE (로비 대표5인·상단 초상화)
- Source / Scope: 사용자 치비 캐릭터 참고 이미지. 큰 머리·짧은 몸·밝은 표정의 소환사/기사/궁수/사제/불꽃 마법사를 새로 제작하고 로비에 적용했다.
- Files / Report: [결정023 — 수정 파일·실제 화면·검증·후속](../design/decisions/023-cute-lobby-characters.md). 생성 원본5장·프롬프트 명세·423.22kB 아틀라스·로비 프레임/부팅/메뉴와 기존 브라우저 검사를 갱신했다.
- Validation: 테스트148개·빌드·로비5크기/기능·기존 전투/저장 스모크 통과. 고유 아트/투명 여백·소스 해제·캐릭터 경계, 주요 게임 코드·22유닛 아틀라스 해시 보존 확인. diff 검토/공백 검사 통과.
- Risk / Next: 전투/정비/도감의22유닛 디자인은 기존 상태다. 다음은 전투 크기에서 읽히는 치비 유닛·이동/공격 프레임이다. Android 실기기/APK·장시간 성능은 미검증이며 기존 번들 경고가 남아 있다.

## 화면별 목업 — 메인 로비 (2026-11-11)

- ID: UI-007
- Status: COMPLETE (메인 화면 적용·자동 검증)
- Source: 사용자가 `mockups/01_lobby.png` 기준 메인 화면 변경을 요청했다.
- Scope: 달빛 성·소환진·중앙 캐릭터/동료, 장식 로고·시작/이어하기·프로필·실제 클래스/성장/도감/소리 메뉴. 정비·전투·저장·재화 규칙을 보존한다.
- Files / Report: [결정022 — 수정 파일·실제 화면·검증](../design/decisions/022-main-lobby-mockup.md). 신규 배경/투명 장식과 `lobbyArt.ts`, 메인/부팅 및 기존 성장 화면의 시작 탭을 연결했다.
- Validation: 테스트148개·빌드·브라우저5종 순차 통과. 720/360/320/412 세로·960×540 가로 FIT, 세로48px 입력/영역 분리·저장 확인/취소·메뉴/소리/감쇄 모션·알파/텍스처 정리를 확인했다. 정비/저장 모델/소환 설정·원본 PNG 해시 동일.
- Risk / Next: 기존 번들 경고 유지. Android 실기기·APK·안전 영역·실제 성능 확인은 남아 있다. 출시/서명·push/merge는 수행하지 않았다.

## 상세 디자인 v2 공통 테마 — 2026-11-09

- ID: UI-006
- Status: COMPLETE (문서7절의 1차 공통 테마)
- Source: 사용자 `summoners_expedition_detailed_design_v2.md` 기반 디자인 개선 요청.
- Scope: 의미별 색상 토큰·픽셀 패널/버튼·보라색 선택 탭. 기존 게임 규칙·배치/터치 영역·콜백·저장 정책을 유지한다.
- Files / Report: [결정021 — 수정 파일·전후 화면·검증·미적용 항목](../design/decisions/021-detailed-v2-common-theme.md).
- Validation: 테스트148개·빌드·기존 브라우저5종 및 공통 컴포넌트 검수 통과. 눌림/비활성·선택 콜백·320/360 세로 및960×540 가로 FIT 확인. 원본 MD·PNG 해시 동일.
- Risk: 기존 번들 경고 유지. Android/APK·48 CSS px 전체 충족·실기기60 FPS는 미확인이다. headless 부하 평균29.9/min19.5 FPS이며 성능 개선 비교가 아니다.
- Next: 문서 PR2 소환·조합·편성 카드/재료 선택 가독성. 이번에는 새 아트·VFX·화면 재배치·게임 메커니즘·출시/서명·Git push를 수행하지 않았다.

## 픽셀 판타지 UI 적용 — 2026-11-09

- ID: UI-005
- Status: COMPLETE (실제 게임 UI 적용·자동 검증)
- Source: 사용자 “좋아 이제 적용 부탁해”, 중단 후 “다시 진행해줘”.
- Scope: 공통 테마, 타이틀·정비·전투 HUD/분대 상세·재능/유물·결과 및 모바일 조작부. 기존 규칙·거래·저장·전투 판정과 사용자 변경을 보존한다.
- Validation: `npm test`148개·`npm run build`, 실제 Chrome18종을 순차 통과. 720/360/320 HUD·터치·실시간 상태·저장/이어하기·5스테이지/무한·전체61조합 배치를 확인했다.
- Report: [적용 파일·실제 화면·검증·제약](pixel-fantasy-ui-qa.md). 기존500kB 번들 경고 유지. GPU 비활성 headless 부하 평균22.7/min15.3 FPS이며 실기기 성능으로 해석하지 않는다.
- Next: STABILIZE-001B의 사람 가독성·Android 실기기 입력/복귀·성능 확인. APK·서명/배포·Git push는 수행하지 않았다.

## 이전 작업 — 자동 통합 안정화

- ID: STABILIZE-001A
- Status: COMPLETE (자동 통합 안정화 1차)
- Goal: 0~12단계 통합 회귀의 단일 실행 경로와 클래스별 통제 전투 비교를 마련하고 재현 결함을 수정한다.
- Source: 사용자 2026-11-07 “다음단계 진행 부탁해”. 다음 안정화 작업의 자동 검증 부분이다.
- Scope: 기존 테스트를 순차 실행하고 결과/로그를 남기는 로컬 검사 명령, 실제 Phaser 클래스별 단일/밀집/분산·사거리 조건 비교, 기존 모바일/저장/정비 회귀. 수치·출시 설정은 측정만으로 변경하지 않는다.
- Acceptance: `npm test`, `npm run build`, 기존 스모크/체크포인트/재능/시설/보스·도감/영구 성장/무한 검사와 신규 클래스 비교 통과, 실패 시 명시적 실패 결과/로그, 사람 플레이·Android 미검증 구분.
- Files: `scripts/integration-check.mjs`, `tests/class-balance-browser.mjs`, `tests/helpers/browser-session.mjs`, `package.json`과 README·로드맵·백로그·본 기록·`production/stabilization-qa.md`.
- Validation: `npm test`148개·`npm run build` 통과(기존500kB 경고). Node22.16.0/Chrome156의 최종 `npm run test:integration`8종 전체 통과. 기본 스모크·v2 저장·재능/액티브·시설·보스/시너지/도감·영구 성장·무한·클래스 비교를 순차 검사했다. 새 클래스 비교는 실제 물리 충돌24조건/회복·정화6조건·연속 새로고침3회를 확인했다. 잘못된 검사 이름의 종료 코드1과 JS 구문 검사를 확인했다.
- Artifacts: `artifacts/integration/report.json`, 검사별 `.log`, `artifacts/class-balance/report.json`, `artifacts/stability-final-{test,build}.log`. 상세 조건·비교표·미검증 범위는 `production/stabilization-qa.md`.
- Result: 기본 영구 단계의20초 단일 DPS는 견습7.2/기사8/술사6.75, 밀집4 표적 술사20.25, 거리200 기사0. 본체/동료 회복·술사 정화를 확인했다. 고정 표적 결과만으로 전체 런 밸런스를 확정하지 않으며 게임 수치는 유지했다.
- QA note: 초기에는 캔버스/메뉴 대기·이미지/모듈 미완료 및 일부 ERR_NETWORK_CHANGED를 관측했다. Page.reload가 문서 커밋 전에 응답하는데 attach가 이전 캔버스를 볼 수 있는 경로를 보강했다. 새 loader 확인 뒤 연결하고 연결 중 문서 변경을 실패 처리한다. 별도 서버 자동 생성 대신 기존 개발 서버를 사용한다. 최종 전체 재실행은 통과했으나 초기 네트워크 정체의 모든 원인이 해결됐다고 단정하지 않는다.
- Review: 고정 허용 목록·shell 없이 Node 자식 실행·실패 중단/보고·순차 독립 프로필, 새 문서/캔버스 연결, 완료 요청 추적 정리, 원본 HP와 계측 대조·레벨/풀 상태·단일/범위 공격 비교를 검토했다. 관련 범위에서 추가 결함은 발견하지 않았다. 제품 전투/거래·새 의존성·플랫폼 설정은 변경하지 않았다.
- Environment: Java11은 있으나 ADB/기본 Android SDK와 `android/local.properties`는 없다. 기존 Actions는 JDK17/SDK34를 구성하지만 이번 작업 트리의 APK 빌드 결과가 아니다. 플랫폼/서명·배포 설정은 변경하지 않는다.
- Risk: 통제된 비교는 인간의 회피/타깃·전체 런 밸런스나 실기기 성능을 대체하지 않는다. STABILIZE-001의 사람 플레이/Android 항목은 별도로 남긴다.
- Next: STABILIZE-001B. 사람 플레이 기록과 Android 실기기 입력/복귀/부하 QA, 결과에 따른 작은 수치 조정안을 검토한다. 전체 안정화는 아직 진행 중이다.
- Git: 이전 단계·다른 프로젝트 변경을 보존했으며 커밋/푸시하지 않았다.

## 완료한 12단계

- ID: ROADMAP-012
- Status: COMPLETE (12단계 MVP)
- Goal: 3클래스·클래스별 첫 보스 영혼 조각·영구 성장2종·중복 정산/저장·새 런/이어하기 구분
- Source: 사용자 2026-11-07 “12단계 진행 부탁해” 재요청. 앞선 보류 중 코드 수정 없음.
- Decision: `design/decisions/018-legacy-growth-classes.md`
- Scope: 단일 영구 키의 보상/구매, 기존 HeroSnapshot에 클래스/적용 단계 사본, 야영지 선택·본체 전투/회복·종료 안내. 기존 룸/분대와 런 체크포인트를 재사용한다.
- Files: `src/config/{heroClassData,heroData,heroAbilities}.ts`, `src/systems/{LegacyProfile,HeroProgression}.ts`, `src/entities/PlayerSquad.ts`, `src/scenes/{LegacyScene,MenuScene,GameScene,GameOverScene}.ts`, `src/ui/ActiveSkillButton.ts`, `src/{main,types/game}.ts`, `tests/{legacy.test,legacy-browser,hero.test}.mjs`, `tests/helpers/browser-session.mjs`와 결정018·README·로드맵·메커니즘 문서·백로그.
- Validation: `npm test`148개(기준140+전용8)·`npm run build` 통과(기존500kB 번들 경고). 정식 클래스가 된 KNIGHT 대신 UNKNOWN_CLASS로 기존 잘못된 클래스 검사를 유지했다. Chrome156의 `legacy-browser`, `browser-smoke`, `checkpoint-v2-browser`, `endless-browser` 통과. 720/360 클래스 선택/구매·오래된 입력/터치 취소·중첩 도감·기사 본체25회복/동료 유지·술사6회복/감속 정화·범위탄 영웅 처치·구형/신규 이어하기 사본·실패 재정산/중복/종료 보존/손상 원본을 확인했다.
- Artifacts: `artifacts/legacy/report.json`, `{classes,growth,knight,elementalist,result}-{720,360}.png`(360 육안 확인), `final-unit.log`, `final-build.log`. 기사125HP 시작→이어하기23/135HP, 술사영구1/1로95HP·공격10/범위45, 두 첫 보스/구매2회 뒤4조각을 확인했다. 통제 fixture이며 사람의 전체 전투 실측은 아니다.
- Review: 단일 영구 키 영수증/잔액 거래·가격/상한/revision 재검사, 런별 클래스/단계 사본·최대/현재 HP·대기 보존, 영웅 공격/범위 처치 원천, 씬/버튼 정리를 검토했다. 현재12단계와 호출자에서 추가 회귀 결함은 발견하지 않았다. 새 의존성·플랫폼 설정은 변경하지 않았다.
- QA note: Chrome 시작/재접속의 캔버스/네비게이션 제한 시간 초과가 일부 발생해 네트워크/콘솔 진단을 추가했다. 최종 단독 전용 검사와 기존 회귀는 통과했으나 원인은 미확정이다. 진단 추가가 제품의 시작 성공을 보장한다고 해석하지 않는다.
- Risk: 초기 수치이며 인간 플레이/실기기는 별도다. 쓰기 실패 보류는 메모리에 남지만 모든 저장 실패 후 앱 종료의 무손실은 보장하지 않는다. 단일 브라우저/앱을 기준으로 검증한다.
- Next: 0~12단계 MVP 완료. 통합 안정화와 사람 플레이 클래스 밸런스·Android 터치/앱 복귀/부하 QA를 우선한다. 추가 콘텐츠/출시는 별도 범위다.
- Git: 커밋/푸시하지 않았으며 이전 단계 및 다른 프로젝트 변경을 보존했다. APK는 빌드하지 않았다.

## 완료한 11단계

- ID: ROADMAP-011
- Status: COMPLETE (11단계)
- Goal: 보스5종 패턴/표시 개별화·편성 시너지3종·보유/토벌 발견 도감과 분리 저장
- Source: 사용자 “11단계 진행 부탁해”
- Decision: `design/decisions/017-boss-synergy-codex.md`
- Scope: 기존 적/위험 슬롯·강화 효과 계산·정비/메뉴·안전 저장 원천을 재사용한다. 도감은 별도 영구 키이나 보너스/재화 보상은 없고 발견 사실만 기록한다.
- Files: `src/config/{bossData,synergyData,stageData}.ts`, `src/systems/{CodexManager,UpgradeEffects}.ts`, `src/entities/{Enemy,EncounterHazards,PlayerSquad}.ts`, `src/scenes/{CodexScene,GameScene,SquadScene,MenuScene}.ts`, `src/{main,types/game}.ts`, `tests/identity{.test,-browser}.mjs`, 기존 `tests/{relics,upgrades}.test.mjs`와 결정017·README·로드맵·메커니즘 스킬·백로그.
- Validation: 기준131개→`npm test`140개·`npm run build` 통과(기존500kB 번들 경고). Chrome156의 `identity-browser`, `browser-smoke`, `endless-browser`, `checkpoint-v2-browser`, `facilities-browser` 통과. 실제 720/360 보스5종 스폰/예고/해제·잠금 좌표·정지/정리/중복 보상, 숲/사격1.05배·편성 변경 해제·현재 HP 보존, 도감22종 전체 페이지/조합법·멀티터치 취소·모달/백그라운드·새 런/재접속·손상 원본/런 저장 분리를 확인했다. 모델은 방어/공속 상한·종류/★/대기 중복·공격 원천·풀 재사용·기록 복사/쓰기 재시도/오래된 페이지 병합과 가장자리 안전 공간을 검증한다.
- Artifacts: `artifacts/identity/report.json`, `boss-{1..5}-{720,360}.png`, `synergy-{720,360}.png`, `codex-{units,bosses}-{720,360}.png`(360 육안 확인). 실제 독46·운석56·빙결67 피해/감속0.65, 위치를 옮겨 운석 회피, 십자 중심 무피해를 확인했다. 보스 토벌5개와 유닛2종 기록이 원정 초기화/재접속에도 유지됐다. 통제 fixture이며 실제 인간의 풀 전투를 대신하지 않는다.
- Review: bossId→색상/배치/경고·활성 delta/위험 슬롯/생명 ID/정리, 편성→원천 합산/상한/HP·타이머 보존, 발견→안전 이벤트/독립 키/검증/재시도/원본 보존, 도감 자식 씬 수명을 검토했다. 현재11단계와 관련 호출자에서 추가 회귀 결함은 발견하지 않았다. 시너지는 슬롯 수/HP를 늘리지 않고 파생 효과를 별도 저장하지 않는다. 새 의존성·자산/플랫폼 설정은 변경하지 않았다.
- QA note: 타입 검사에서 도감 저장소 함수/인자 이름 충돌을 고쳤다. 숲 결속을 포함하는 기존 피해 기대값2곳을 새 합산에 맞췄다. 스모크의 HUD 영역 검사가 겹침을 찾아 두 줄로 수정했고 황혼 십자 가장자리 배치를 보강했다. 일부 Chrome 캔버스/네비게이션 대기가 초과했으며 서버 재시작·단독 최종 재검사는 통과했지만 원인은 미확정이다. 이를 제품의 무조건 재접속 성공 보장으로 해석하지 않는다.
- Risk: 신규 패턴/시너지 수치는 초기값이며 사람 플레이/Android·장시간 고부하·노치/제스처는 미검증이다. HP·접촉 피해·기본 보상은 유지하지만 실제 난이도는 바뀐다. 도감 손상/읽기 실패 시 원본을 보존하고 미저장 관측 유실을 안내하며 기기간/동시 쓰기 동기화는 보장하지 않는다. 경제 모델은 새 전투 행동/편성 효율을 평가하지 않는다. APK는 빌드하지 않았다.
- Next: 12단계 영구 성장·추가 클래스. 런/영구 데이터 계약·지급 시점/중복 방지와 클래스 선택/스탯·스킬 범위를 먼저 정의한다.
- Git: 커밋/푸시하지 않았으며 이전 단계와 다른 프로젝트 변경을 보존했다.
- Non-goals: 영구 능력치/영혼 조각·새 클래스·추가 자산/의존성·Android 서명/배포·APK·Git push.

## 완료한 10단계

- ID: ROADMAP-010
- Status: COMPLETE (10단계)
- Goal: ★3 개체 각성·소멸 확인·정비 완치/부활 서비스·우회 전투방 보급고와 저장/중복 방지
- Source: 사용자 “10단계 진행 부탁해”
- Decision: `design/decisions/016-awakening-services-side-supply.md`
- Scope: 새 의존성 없이 개체/견적·기존 정비·전투 투영·격자 부가 필드·안전 저장을 확장한다. 보유/출전 한도와 필수 방 구성은 유지한다. 각성 소멸·미수령 보급 포기는 명시적 확인을 받는다.
- Acceptance: 거래 원자성·각성/HP/쿨다운 보존·옛 견적/동의·서비스 유효 대상/정비 게이트·보급 우회 경로/단일 보상/보류/포기·v1/v2 호환과 잘못된 저장 거부, 자동 테스트/빌드/720·360 Chrome 및 기존 회귀.
- Files: `src/config/expeditionFacilities.ts`, `src/systems/{SideSupply,SquadRoster,RoomGridManager,RunSaveManager,UpgradeEffects,CombatMeasurements,EconomyLedger}.ts`, `src/entities/{DroneUnit,PlayerSquad}.ts`, `src/scenes/{GameScene,SquadScene}.ts`, `src/types/game.ts`, `tests/facilities{.test,-browser}.mjs`, `tests/checkpoint-v2-browser.mjs`와 결정016·README·로드맵·메커니즘 스킬·백로그.
- Validation: 기준 122개 → `npm test` 131개·`npm run build` 통과(기존 500 kB 번들 경고). Chrome156의 `facilities-browser`, `browser-smoke`, `checkpoint-v2-browser`, `endless-browser`, `abilities-browser` 통과. 180개 맵/독립 최단 거리·각성 한도/비용·기본 피해/HP·서비스 대상/원자성·소멸 동의/옛 견적·저장 검증과 720/360 실제 거래·취소/앱 복귀·보급고 문/보상·실패 재개·포기 확인을 검사했다.
- Artifacts: `artifacts/facilities/report.json`, `awakening-{720,360}.png`, `services-{720,360}.png`, `supply-{720,360}.png`, `loss-{720,360}.png`(360 육안 확인). ★3 사수 각성1 비용80·HP13/140→13/147, 부활30/완치40 차감, 불사조1234ms/액티브8000ms 보존, 보급고 일반 보상40·추가25 또는 소환권2, 저장 실패 후 미수령 상태 복원을 확인했다.
- Review: 가격/단계 견적 재검사, 개체 ID/각성 단계 소멸 동의, 공통 HP 공식, 기존 상태 보존, 유효 서비스 대상/정비·백그라운드 게이트, 보급 그래프/수령 플래그·저장 호환, 씬/확인창 수명을 검토했다. 현재 10단계 구현과 호출자에서 추가 기능 결함은 발견하지 않았다. 새 의존성/플랫폼 설정은 변경하지 않았다.
- QA note: 새 fixture의 불사조 티어를 실제4로 바로잡았다. 기존 체크포인트 검사에서 회복방 경로가 보스를 먼저 클리어해 맵이 바뀌는 경우를 보강한 뒤 통과했다. Chrome 부팅/재접속 대기 제한(메뉴/캔버스)을 여러 번 초과했고 런타임 예외는 없었으며 원인은 미확정이다. 실패 진단을 남기도록 전용 검사에 페이지/모듈 상태 출력을 넣었고 최종 단독 재실행은 전체 통과했다. 이를 Android나 무조건 재접속 성공 보장으로 해석하지 않는다.
- Risk: 수치는 초기값이며 사람 플레이/Android 실기기·노치/시스템 제스처·장시간 고부하는 미검증이다. 경제 모델은 새 소비/보급 선택을 계산하지 않는다. 보급은 후보 없으면 생성하지 않고 미수령 다음 단계 포기는 명시적으로 확인한다. 기존 편성 교체/방 이동의 회복 규칙은 유지하므로 서비스 효율은 인간 플레이로 평가해야 한다. APK는 빌드하지 않았다.
- Next: 11단계 보스 개별화·편성 시너지·도감. 기존 패턴과 차이를 정의하고 시너지 합산/상한·발견 저장 범위를 먼저 정한다.
- Git: 이번 변경을 커밋/푸시하지 않았으며 이전 단계 및 다른 프로젝트 변경을 보존했다.
- Non-goals: 리롤·영구 성장·각성 계승/환불·추가 유물·정원 확장·신규 의존성·서명/배포·APK·Git push.

## 완료한 9단계

- ID: ROADMAP-009
- Status: COMPLETE (9단계)
- Goal: 3레벨 재능 3종·치유 파동 1버튼·다음 무한 스테이지 선택형 변이 3종
- Source: 사용자 “다음단계 진행 부탁해”, 로드맵 9단계
- Decision: `design/decisions/015-talents-active-mutations.md`
- Scope: HeroProgression 선택/한도·PlayerSquad 효과/활성 대기·정비 UI·버튼 포인터 소유/취소·변이 원천/상한·현재/다음 변이 분리 저장. 기존 소환/조합·강화·유물·안전 체크포인트를 재사용한다.
- Files: `src/config/{heroAbilities,mutationData,stageData}.ts`, `src/systems/{HeroProgression,UpgradeEffects,CombatMeasurements,EncounterRules,StageProgression,RunSaveManager}.ts`, `src/entities/PlayerSquad.ts`, `src/scenes/{GameScene,SquadScene,EndlessChoiceScene}.ts`, `src/ui/{ActiveSkillButton,combatStatus}.ts`, `src/types/game.ts`, `tests/abilities{.test,-browser}.mjs` 및 결정 015·로드맵·README·메커니즘 스킬·백로그.
- Validation: 기준 115개 → `npm test` 122개·`npm run build` 통과(기존 500 kB 번들 경고). Chrome 156의 `abilities-browser`, `browser-smoke`, `endless-browser`, `checkpoint-v2-browser`, `relics-browser` 통과. 720/360 배치·재능 보류/옛 버튼/HP 보존/복원·스킬 누름/해제/이탈/네이티브 취소/blur/겹친 정지·조이스틱 동시 시전·대기 복원·변이 실패/타이틀/확정 재개·S6 실제 적 피해/처치·방 보상을 검증했다.
- Review: 선택 원천 ID에서 효과를 재계산하며 같은 렌더의 선택 수 검증으로 재실행을 차단한다. 활력 HP는 기존 적용 보너스와 차이만 반영하고 현재 HP를 유지한다. 치유 파동은 실제 회복이 있어야 대기를 소비하고 사망자를 건너뛰며 전투 delta로만 감소한다. 한 포인터가 버튼을 소유하며 취소/일시정지/방·씬 전환에서 해제하고 리스너를 정리한다. 변이는 기존 성장 뒤 최종 상한 전에 적용하고 확정 다음 변이만 저장한다. 실패는 pending/NONE으로 복귀하며 전환 후 다음 선택은 NONE이므로 중첩되지 않는다. 현재 변경 diff와 관련 호출자에서 추가 회귀 결함은 발견하지 않았다.
- Artifacts: `artifacts/abilities/report.json`, `talent-720.png`, `talent-360.png`, `skill-360.png`, `mutation-720.png`, `mutation-360.png`. HP 23/110→23/120, 치유 23→33/대기 18000ms, S6 흉포 적 피해 20·킬 6·방 64를 확인했다. 통제 fixture이며 인간 플레이의 효율/전체 런 밸런스를 측정하지 않았다.
- QA note: 초기 테스트는 계측 회복을 본체/동료별 합산해야 했고, Phaser가 보관한 `sys.sceneUpdate`를 정지해 입력 검사 중 프레임 진행을 통제했다. CDP의 개별 touchEnd는 남은 손가락이 아닌 해제할 손가락을 지정해야 하므로 수정한 뒤 동시 이동/시전을 재검증했다. 제품 동작 오류와 테스트 도구 사용 오류를 구분했다.
- Risk: 회복/재능/변이 수치는 초기값이다. 사람 플레이와 Android 실기기/노치/시스템 제스처·고부하는 미검증이며 실제 APK를 빌드하지 않았다. 전투 중 종료는 기존 마지막 안전 저장으로 돌아간다. 경제 모델은 재능/변이 없이 기존 S1~5 범위를 유지한다.
- Next: 10단계 각성·서비스·사이드 룸. 각성의 개체 수명/조합·판매 경고, 서비스 비용·효과·거래, 방 일회성 보상을 먼저 정하고 원자성·유실/중복 방지를 검증한다.
- Git: 커밋/푸시하지 않았으며 이전 단계와 다른 프로젝트 변경을 보존했다.
- Non-goals: 영구 성장·새 영웅/보스 패턴·변이 중첩·각성/사이드 룸·새 의존성/서명·APK/배포·Git push

## 완료한 8단계

- ID: ROADMAP-008
- Status: COMPLETE (8단계)
- Goal: S5 종료/계속·선택 저장·S6~1000 생성/상한·진행 복원·무한 최고 도달 기록
- Source: 사용자 “다음단계 진행 부탁해”, 로드맵 8단계
- Decision: `design/decisions/014-endless-mvp.md`
- Scope: 기존 S1~5 수치 유지, 기존 정비/회복/소환권·강화·유물 보존, 무한 생성/수치 및 저장/출처 확장, 선택 UI·기록/종료 표시.
- Files: `src/config/stageData.ts`, `src/systems/{StageProgression,RunSaveManager,RelicRewards,EndlessRecordManager}.ts`, `src/scenes/{EndlessChoiceScene,GameScene,GameOverScene,MenuScene}.ts`, `src/main.ts`, `src/types/game.ts`, `tests/endless.test.mjs`, `tests/endless-browser.mjs`, 기존 stage/browser-smoke 검사 및 결정 014·로드맵·메커니즘 스킬·README·백로그.
- Validation: 기준 107개 → `npm test` 115개·`npm run build` 통과(기존 500 kB 번들 경고). Chrome 156의 `endless-browser`, `browser-smoke`, `checkpoint-v2-browser` 통과. 720/360 실제 S5/S6 처치/선택·저장 실패/중복/타이틀·확정 continue/exit 재개·S6 전환 저장 실패·겹친 hidden/정비·새 런/최고 기록, S6 World 충돌, S1000 선택/스폰 상한을 검사했다.
- Review: 선택만 먼저 저장하고, 다음 맵 전환 게이트에 소환권/회복을 적용한다. 실패한 선택은 pending으로 롤백하고 실패한 새 맵 저장은 이전 continue 체크포인트로 복원해 누적을 막는다. 새 스키마는 S6+ explicit v2/endless·S5+ 선택 단계·마왕 토벌 플래그·보스 수와 현재 격자를 검증한다. 유물의 현재/과거 출처를 생성기 정의로 확장했고 최고 기록은 런 키 삭제와 분리한다. 다음 맵/일시정지/씬 종료 입력도 검토했다.
- Artifacts: `artifacts/endless/report.json`, `choice-720.png`, `choice-360.png`(360 육안 확인). S6 HP 23/130→75/130·소환권 0→1·성배 3100ms 유지, 실제 표적 1/90프레임 탄환 5·접촉 5·유효 피해 133, S1000 스폰 요청 65 중 활성 64/예약 1/풀 64≤80과 수치 유한성을 확인했다. 테스트는 통제 fixture이며 실제 인간 플레이/실기기 FPS를 대신하지 않는다.
- QA note: 기존 S5 즉시 승리 검사를 명시적 종료 선택으로 바꾸고, 저장 가능한 정상 보스 격자/연결 경로를 사용하도록 스모크 fixture를 보강했다. S101 속도 검사는 새 무한 상한을 반영했다. 실제 S1~5 공식/보상은 유지한다.
- Risk: 무한 구간의 성장/수입/생존 밸런스는 초기 수치이며 인간 플레이·고부하 Android는 미검증이다. S1000은 기술 안전 상한이고 도달 난이도/성능을 보장하지 않는다. 단계 HP 배율 상한 뒤에 기존 지역/웨이브 보정이 추가된다. 경제 모델은 5스테이지 범위, 다운그레이드 S6+ 복원은 지원하지 않는다.
- Next: 9단계 재능·스킬 버튼·변이. 효과/중복/선택·터치 취소·모달/백그라운드·저장 계약부터 정의한다.
- Git: 커밋/푸시하지 않았으며 이전 단계와 다른 프로젝트 변경을 보존했다. APK 빌드/배포는 수행하지 않았다.
- Non-goals: 변이·각성/새 보스 패턴·영구 성장·신규 의존성/서명·APK/배포·Git push

## 완료한 7단계

- ID: ROADMAP-007
- Status: COMPLETE (7단계)
- Goal: 유물 3종·정예 획득처·보류/선택 UI·강화 합산·전투 회복·조합 할인·v1/v2 저장 호환
- Source: 사용자 “진행해줘”, 로드맵 7단계
- Decision: `design/decisions/013-relic-mvp.md`
- Scope: 정예 방 최초 클리어, 최대 3개 고유 유물/보류 보상 원장, 공격/회복/추가 조합비 할인, 기존 정비와 저장 계약 재사용.
- Files: `src/config/relicData.ts`, `src/systems/RelicRewards.ts`, `src/systems/{SquadRoster,UpgradeEffects,CombatMeasurements,EconomyLedger,RunSaveManager}.ts`, `src/entities/PlayerSquad.ts`, `src/scenes/{GameScene,SquadScene}.ts`, `src/types/game.ts`, `tests/relics.test.mjs`, `tests/relics-browser.mjs`, 결정 013·로드맵·메커니즘 스킬·README·백로그.
- QA note: 최종 Chrome 초기/재접속 검사에서 캔버스 준비 15초 대기 제한을 두 차례 초과했다. 로컬 응답/별도 캔버스·스크립트 진단은 정상이라 공통 브라우저 helper의 캔버스 대기만 30초로 확장했다. 일반 씬/행동 검사는 그대로 유지했고 이후 유물 브라우저 전체 재검사가 통과했다. `tests/helpers/browser-session.mjs`도 변경 파일에 포함한다.
- Validation: 기준 98개 → `npm test` 107개·`npm run build` 통과(기존 번들 경고). Chrome 156의 `relics-browser`, `browser-smoke`, `checkpoint-v2-browser`, `quick-craft-browser`, `upgrades-browser` 통과. 720/360 선택/보류/옛 버튼/취소·책 닫기/재접속/겹친 정지·3종 효과/할인 제작·기존 소환/조합/강화/전투/5스테이지/저장 회귀를 검증했다. 사람 플레이와 실기기는 미검증이다.
- Review: 보상 원장 3개에 출처/선택을 함께 보관해 중복 소유·중복 방/초과 정예 수·미래/잘못된 출처를 막는다. 현재 격자는 실제 정예 클리어 여부도 검사한다. 선택은 FIFO/미보유 ID 검사 후 무료 확정·진단 기록·동기화·저장한다. 깃발/강화는 같은 가산 그룹, 성배는 활성 전투 delta와 남은 시간 저장, 인장은 가격 표시/수동/승급/간편 견적/최종 차감에 같은 올림 비용을 사용한다. 렌더/복원/반복 입력이 효과를 중복 가산하지 않는다.
- Artifacts: `artifacts/relics/report.json`, `choice-720.png`, `choice-360.png`, `discount-360.png`(선택 360 육안 확인). 통제 사수 탄 22/영웅 8, 성배 3.8초 보존과 23→25/30→32, 불사조 250→242(소환 170+조합 72) 실제 지출 일치. 브라우저 3종 선택은 같은 정상 정예 체크포인트의 독립 재생으로 검증했다.
- Risk: 인간 플레이의 효율/전체 런 난이도·Android 실기기·장시간 고부하는 미검증이다. 경제 시뮬레이터는 유물 없는 기존 가정을 유지한다. 과거 격자는 저장하지 않아 과거 출처는 스테이지/좌표/정예 수/고유성을 검증한다. 무한 모드 때 출처/스테이지 검증 확장이 필요하다.
- Next: 8단계 무한 모드 MVP. S5 종료/계속 선택과 S6 생성·저장·수치 상한 및 밸런스 결정을 먼저 정리한다.
- Git: 커밋/푸시하지 않았으며 이전 단계와 다른 프로젝트 변경을 보존했다. APK 빌드/배포는 수행하지 않았다.
- Non-goals: 소환진/보스 보상 변경·무한 모드·리롤/희귀도·영구 성장·의존성/자산 생성/배포 변경

## 완료한 6단계

- ID: ROADMAP-006
- Status: COMPLETE (6단계)
- Goal: 원정 강화 6종·견적/비용/상한·전투 효과·성장 HP 보존·거래/저장 복원
- Source: 사용자 “다음작업 진행해줘”, 로드맵 6단계
- Decision: `design/decisions/012-expedition-upgrades.md`
- Scope: 기존 정비 UI·SquadRoster·무기/체력·v1/v2 계약 확장. 분대 공격/공속/HP, 영웅 공격/HP, 공통 방어. 효과는 원천 레벨에서 재계산하고 중복 가산하지 않는다.
- Files: `src/config/upgradeData.ts`, `src/systems/UpgradeEffects.ts`, `src/systems/{SquadRoster,EconomyLedger,RunSaveManager}.ts`, `src/types/game.ts`, `src/entities/PlayerSquad.ts`, `src/components/HealthComponent.ts`, `src/scenes/SquadScene.ts`, `tests/upgrades.test.mjs`, `tests/upgrades-browser.mjs` 및 결정 012·로드맵·메커니즘 스킬·README·백로그.
- Validation: 기준 89개 → `npm test` 98개 통과, `npm run build` 통과(기존 500 kB 번들 경고). Chrome 156의 `upgrades-browser`, `browser-smoke`, `checkpoint-v2-browser`, `quick-craft-browser`, `hero-browser` 통과. 720/360 UI·6종 구매·즉시 저장·자금 부족/상한·중복 견적/옛 버튼·멀티터치 취소·겹친 정지·탄 피해/방어·HP/남은 시간 복원·구형 저장·스테이지 유지·새 런·기존 소환/조합/전투/보스/저장 회귀를 검증했다.
- Review: 원천 6개 키/레벨에서 효과를 재계산하며 구매/렌더/복원이 중복 가산하지 않는다. 영웅 HP는 적용된 강화량과의 차이만 추가하고 저장된 최대 HP는 로드에서 권위 있게 복원한다. 분대 HP 검증/최대치가 같은 공식을 사용한다. 생존/사망 현재 HP·부활/스킬/보호막은 구매로 초기화하지 않는다. 방어는 모든 아군 Health 피해에 공통 적용하고 기존 적/스킬 원천을 유지한다. 공속 상한은 2.5배이며 기존 저장 배율 원문은 보존한다. 거래는 견적/잔액/상한 검증 후 차감·레벨 증가·지출·저장하며 실패 시 무변경이다.
- Artifacts: `artifacts/upgrades/report.json`, `artifacts/upgrades/menu-720.png`, `artifacts/upgrades/menu-360.png`(360 육안 확인). 각 강화 첫 구매 총 290 ◆, 모두 Lv.3은 1,214 ◆, 모두 Lv.10은 15,856 ◆. 통제된 실제 탄 피해 영웅 18/분대 38, 피해 감소 후 보호막 적용, 재접속 HP/강화/공격 대기/부활 시간 보존을 확인했다.
- Risk: 실제 사람의 구매율·전체 런 난이도/성장 속도, Android 실기기·장시간 고부하는 미검증이다. 명목 DPS와 통제 fixture를 인간 플레이 결과로 해석하지 않는다. 체력 구매 자체 회복은 없지만 이후 비율 회복/부활량은 증가한다. 기존 저장 공속이 2.5 초과이면 실제 적용값은 새 상한으로 제한한다.
- Next: 7단계 유물 MVP 3종·획득처 1개, 강화와 원천별 합산·중복 획득·취소·복원 계약을 정의한다.
- Git: 이번 변경을 커밋/푸시하지 않았으며 이전 단계와 다른 프로젝트 사용자 변경을 보존했다. APK 빌드/배포는 수행하지 않았다.
- Non-goals: 할인·보유/출전 제한 확장·영구 성장·유물·적/보상/제작 가격 변경·의존성/배포 변경

## 완료한 5단계

- ID: ROADMAP-005
- Status: COMPLETE (5단계)
- Goal: 견습 소환사 1종 자동 공격·XP/레벨·HUD·피해 원천/킬 통계·v1/v2 저장 호환
- Source: 사용자 “다음단계도 진행”, 로드맵 5단계
- Decision: `design/decisions/011-apprentice-hero.md`
- Scope: 기존 본체/탄환/무기 재사용, Lv.1~20·다중 레벨 상승·현재 HP 보존, 영웅/분대/환경 원천, 적 생명별 보상 한 번, 정비/백그라운드 사격 대기 정지, 구버전 기본값과 성장 저장
- Non-goals: 액티브 버튼·재능·새 클래스·유물/강화소·영구 성장·새 의존성·배포/서명 변경
- Files: `src/config/heroData.ts`, `src/systems/HeroProgression.ts`, `src/types/game.ts`, `src/components/WeaponComponent.ts`, `src/entities/{PlayerSquad,Bullet,Enemy}.ts`, `src/scenes/{GameScene,GameOverScene}.ts`, `src/systems/RunSaveManager.ts`; 영웅 모델/브라우저 검사, 기존 fixture/모바일 HUD/스테이지 회복 검사, 결정 기록 011·로드맵·메커니즘 스킬·README·백로그.
- Validation: `npm test` 89개 통과, `npm run build` 통과(기존 500 kB 번들 경고). Chrome 156에서 `hero-browser`, `browser-smoke`, `checkpoint-v2-browser`, `recovery-browser`, `combat-status-browser` 통과. 720/360 터치, 자동 탄환 실제 충돌, XP/레벨/HP·공격 대기 보존, 원천별 직접/범위/연쇄/지속 피해·환경 처치, 중복 보상·풀 재활용, 구형 v1/v2, 종료/새 런, 기존 거래/5스테이지/저장/회복/상태 HUD 회귀를 검증했다.
- Review: 원천은 재사용 발사 설정→탄환→직접/범위/연쇄/분열 자식으로 전달하고, 독/화상/반사는 기존 소유 유닛에 귀속한다. 영웅은 Spark의 비주얼만 쓰고 추적·독·분열 등 고유 효과와 분대 처치 발동을 상속하지 않는다. 적 spawn마다 지급 게이트를 초기화해 새 생명에는 지급하고 같은 생명에는 중복 지급하지 않는다. 성장 HP는 증가분만 최대치에 더하며 현재 HP/기존 HP 보너스를 보존한다. 영웅 공격 시계는 활성 delta로 진행하고 저장 검증 후 남은 시간으로 복원한다. 기존 자동 저장 경계는 유지한다.
- QA note: 기존 유닛 전용 fixture의 발사 수집에 영웅 탄이 추가되는 가정을 분리했다. 기존 최대 HP 100/스테이지 회복 40 고정 검사는 성장한 최대 HP의 40%로 갱신하고 레벨업 자체의 현재 HP 무회복을 따로 확인했다. 360 화면에서 이름 가독성을 높이기 위해 글자 크기를 14px로 올리고 HP/방/웨이브 위치와 경계 검사를 조정했다.
- Artifacts: `artifacts/hero/report.json`, `artifacts/hero/hud-720.png`, `artifacts/hero/hud-360.png`. 360 HUD 육안 확인. 통제 조건의 원천별 처치는 영웅 1/분대 7/환경 1, 이후 레벨업에서 HP 23 유지/최대 105, 재접속에서 XP·자금·사격 시간 보존.
- Risk: 영웅과 최대 HP 성장으로 전투 난이도가 달라지며 실제 사람의 전체 런 성장 속도/난이도·Android 실기기는 미검증이다. 시작 영웅/사수 2기 DPS 11.1%, Lv.20/사수 6기 12.5%는 명목 기준 편성 계산이며 모든 편성에 대한 실측/강제 상한은 아니다. 액티브·재능·유물·강화소·영구 성장은 이번에 구현하지 않았다.
- Next: 6단계 강화소 MVP 6종. 효과 합산/상한·가격·잔액·원자적 거래·저장 복원부터 정의한다.
- Git: 이번 작업을 커밋/푸시하지 않았으며 다른 프로젝트와 이전 단계의 로컬 변경은 보존했다. APK 빌드/배포는 수행하지 않았다.

## 완료한 4단계

- ID: ROADMAP-004
- Status: COMPLETE (4단계)
- Goal: 방 이동에서 생존/사망 유닛의 HP 이익 역전 해소, 샘의 분대 회복, 부활 대기의 일시정지/저장 호환
- Source: 사용자 “다음단계 진행 부탁해”, 로드맵 4단계
- Decision: `design/decisions/010-recovery-and-revival.md`
- Scope: 실제 방 이동에서 출전 동료 HP 최소 50%, 최초 샘 본체/생존 동료 +45%, 이어하기의 HP 보존, 남은 부활 대기 일시정지 보정과 회귀 검증
- Preserved: 본체 이동 회복 없음, 12초/HP 50% 자동 부활, 지원/불사조/보상/제작 가격, v1/v2 저장 형식
- Validation: `npm test` 81개 통과, `npm run build` strict TypeScript/Vite 통과. `node tests/recovery-browser.mjs`, `node tests/checkpoint-v2-browser.mjs`, `node tests/browser-smoke.mjs`, `node tests/combat-status-browser.mjs` 통과. Chrome 156, 720×1280/360×640 터치 환경. 기존 번들 크기 경고는 유지된다.
- Changed: `src/config/squadData.ts`, `src/entities/PlayerSquad.ts`, `src/scenes/GameScene.ts`, `src/scenes/SquadScene.ts`, `src/systems/RevivalPause.ts`, `src/ui/combatStatus.ts`; recovery 모델/브라우저 테스트 및 기존 HUD/체크포인트 검증 보강, 결정 기록 010·로드맵·메커니즘 스킬·README·작업 기록.
- Review: 실제 이동과 v1/v2 모든 저장 복원을 구분해 저체력 저장이 로드만으로 회복되지 않도록 했다. 샘의 cleared 플래그가 통계/추가 회복을 한 번만 적용한다. 방 이동의 HP 최저선은 기존 부활 비율과 같고 본체/재화/출전 데이터에 영향을 주지 않는다. 부활 일시정지는 개체 ID별 첫 스냅샷·첫 활성 업데이트의 한 번 적용·방/런/종료 정리를 검토했다. 저장 시간 상한과 HUD의 소수점 경계도 재현 검증했다.
- Artifacts: `artifacts/recovery/report.json`, `artifacts/recovery/spring-360.png`의 실제 샘 안내를 육안 확인했다. HP 0/1 → 이동 35/35 → 샘 67/67, 본체 23→68, 반복 왕복과 이어하기에서 추가 회복 없음.
- QA note: 기존 체크포인트 검사에서 씬 launch 직후 isActive를 확인해 선택 화면을 건너뛸 수 있는 대기 조건을 보강했다. HUD 검사 중 10초가 11초로 보일 수 있는 소수점 경계를 별도 모델로 재현해 수정했다. 이후 관련 브라우저 검사를 재실행했다.
- Next: 5단계 영웅 MVP 1종(자동 공격·XP·HUD·저장), 피해 원천과 분대 주력 계약을 검토한다. 아직 구현하지 않았다.
- Git: 이번 작업을 커밋/푸시하지 않았고 다른 프로젝트의 로컬 변경은 보존했다.
- Risk: 이동 회복으로 다음 방의 생존 난이도는 낮아질 수 있다. 다른 적/스킬 타이머 정책·보유/재배치 회복은 이번 범위에 포함하지 않는다. Android 실기기 미검증.

## 완료한 3단계

- ID: ROADMAP-003
- Status: COMPLETE (3단계)
- Goal: 실제 피해/회복·부활·발사/적중 계측 및 동일 조건 비교로 레시피·지원 밸런스 조정
- Source: 사용자 “다음단계 진행”, `009-recipe-support-review.md`의 3단계 범위
- Implementation: 기본 OFF인 선택형 전투 계측, 실제 Phaser 물리 충돌/지원 비교 보고서, 약초 사제 회복 2→3. 달빛 사제 4·드루이드 6 및 제작 가격/공격력/주기는 유지.
- Evidence: 지속 피해 약초 사제 본체 생존 30→33초, 주기적 강타 30→36초. 전투 AI·인간 플레이 전체가 아닌 통제된 피해/물리 fixture다.
- Validation: `npm test` 74개 통과, 최종 `npm run build` 통과. 실제 Phaser 비교·계측 일시정지/중지/적 풀 재사용/재시작·기존 720/360 모바일 전체 회귀 통과. 마지막 스냅샷 독립성 보완 후 계측 브라우저 재검증 통과. `npm run economy:report -- 42`의 가격·제곱근 수입 유지, 변경분 공백 검사 통과. 기존 번들 크기 경고는 유지된다.
- Next: 4단계 회복방·방 이동 부활의 이익 역전과 저장/시간 계약을 검토한다. 해당 규칙은 이번에 바꾸지 않았다.
- Changed: `src/systems/CombatMeasurements.ts`, `HealthComponent.ts`, `PlayerSquad.ts`, `Enemy.ts`, `GameScene.ts`, `src/config/unitData.ts`; 계측/지원 테스트와 브라우저 비교/수명주기 스크립트, package의 balance:report, README·기존 메커니즘 스킬·결정 기록 009·로드맵/작업 기록.
- Review: 무적/사망 시 거절된 피해는 집계하지 않고 HP 감소/보호막/오버킬을 분리한다. 일반 회복과 부활을 분리하며 죽은 지원 대상은 초과 회복으로 세지 않는다. 고정 크기 집계/최대 44개 회복 분류만 사용하고 개별 이벤트 로그를 저장하지 않는다. 비활성 상태에서는 관측자 호출과 생성이 없다. 출전 동기화/풀 재사용은 현 관측자를 반영하고 stop은 분리하며 새 런은 초기화한다. 보고서 반환 값은 활성/중지 상태 모두 독립 스냅샷이다.
- Measurement: `npm run balance:report` → `artifacts/balance/report.json`. 초기 비교에서 수동 world.step의 본체 동기화 누락을 발견해 정식 update/postUpdate를 사용하도록 고쳤다. HMR 타임스탬프 모듈 중복도 실제 로드 URL 재사용 및 회복 시도 금액 검증으로 해결했다. 실패 측정을 최종 데이터로 사용하지 않는다.
- Risk: 실제 인간 플레이의 난이도와 Android 실기기는 미측정. 추가 규칙·신규 의존성·APK/배포·커밋/푸시 없음.

## 완료한 2단계

- ID: ROADMAP-002
- Status: COMPLETE (2단계)
- Goal: 승인한 제곱근 킬 보상 적용
- Approval: 사용자 “제곱근 배율 적용 — 완만하게 감소 (추천)”
- Changed: `src/systems/EncounterRules.ts`의 실제 정책을 sqrt로 지정. `EconomySimulation.ts` 및 `scripts/economy-report.mjs`에 실제 정책과 변경 전 선형 정책을 구분해 표시. `tests/economy.test.mjs`에 다중 시드 제작 및 구버전 잔액 호환 검증, `tests/kill-reward-browser.mjs`에 실제 지급·로그·저장 검증 추가.
- Preserved: 방/보스 클리어 보상, 소환/조합 비용, 적 스폰·능력치, 저장 형식 및 기존 잔액.
- Validation: `npm test` 69개 통과, `npm run build` 통과, `npm run economy:report -- 42` 재현. Chrome에서 1~5스테이지 SWARMER/ELITE_BRUTE 실제 처치→거래 로그→클리어 보상→저장 잔액 확인 통과. `node tests/browser-smoke.mjs` 전체 모바일 회귀 통과. 기존 번들 크기 경고는 유지된다.
- Analysis: 동일 시드 전체 탐험 S5 유입 10,645→7,590, 최단 보스 경로 2,970→2,214. 실측 플레이가 아닌 필수 스폰 모델이다. 시드 0/1/42/100/4294967295에서 단계별 고정 제작 목표 달성을 확인했다.
- Decision: `design/decisions/008-kill-reward-curve.md`.
- Next: `009-recipe-support-review.md`의 3단계 레시피/지원 역할 측정. 새 규칙 변경은 아직 적용하지 않았다.
- Risk: 실제 인간 플레이 난이도·경제와 Android 실기기는 미검증. 신규 APK·커밋·푸시 없음. 기존 로컬 변경을 보존했다.
- Review: 실제 게임의 호출은 기본 정책 sqrt를 사용한다. 모든 적(보스 포함)의 킬에 동일한 반올림을 적용하고 별도 방/스테이지 클리어 보상은 바꾸지 않았다. 저장 데이터에 배율을 곱하지 않으며 읽기 시 원본 JSON을 유지한다. 비교 리포트의 기존 정책 명칭과 기본값을 함께 확인해 실제 정책과 혼동하지 않도록 했다. 본 단계 범위에서 추가 회귀 문제는 발견하지 않았다.
- Artifacts: `artifacts/economy/simulation.json`, `artifacts/economy/live-kill-rewards.json`. 다음 3단계의 현행 비용/역할 표는 결정 기록 009에 있으며 회복·전투 수치 변경이나 실측 완료를 뜻하지 않는다.

## 완료한 0~1단계

- ID: ROADMAP-000-001
- Status: COMPLETE (0~1단계)
- Goal: 개선 로드맵 0단계 경제 측정 → 1단계 룸 단위 안전 저장
- Source: 사용자 “개선 로드맵 확인해서 단계별로 진행”, `design/smash_review_and_roadmap.md`
- Decision: `design/decisions/007-roadmap-foundations.md`
- Scope: 거래 로그/동일 시드 수입 비교/제작 비용 보고서, v1 호환 v2 저장, 중단·복구 회귀 검증
- Validation: 변경 전 55개 테스트·빌드 통과. 변경 후 67개 테스트 및 빌드 통과. 기존 전체 모바일 스모크·신규 v2 중단/재개·소환진·간편 제작 회귀와 변경분 공백 검사 통과.
- Next: 킬 보상 곡선 선택 후 2단계 수치 조정, 이후 3단계 역할별 밸런스 검증.

## 변경 파일과 검증 기록

- 경제: `EconomyLedger.ts`, `EncounterRules.ts`, `EconomySimulation.ts`, `scripts/economy-report.mjs`, `SquadRoster.ts`, `GameScene.ts`, `RoomGridManager.ts`.
- 저장: `src/types/game.ts`, `RunSaveManager.ts`, `GameScene.ts`, `SquadScene.ts`, `MenuScene.ts`.
- 테스트: `economy.test.mjs`, `run-save-v2.test.mjs`, `checkpoint-v2-browser.mjs`, 브라우저 도우미, 기존 v1/전체 스모크/소환진 검증의 새 버전 기대값.
- 문서: README, 기존 메커니즘 스킬, 로드맵, 결정 기록 007/008, backlog/current-task. 기존 스킬·규칙 파일을 보존한다.
- `npm test`: 67/67 통과. `npm run build`: strict TypeScript 및 Vite 통과. 기존 500kB 번들 크기 경고는 유지된다.
- `npm run economy:report -- 42`: 모든 정책에 같은 지도/경로/필수 처치 수 적용, 재현성·잔액 합계 검증. 원본 리뷰 수치를 테스트 정답으로 고정하지 않았다.
- Chrome 156: `node tests/browser-smoke.mjs`, `node tests/checkpoint-v2-browser.mjs`, `node tests/summoning-circle-browser.mjs`, `node tests/quick-craft-browser.mjs` 통과. 모바일 뷰포트 720×1280 및 360×640, 실제 터치 이벤트 사용.
- 신규 중단 테스트: 정비 화면을 닫기 전 성공 거래 → 브라우저 전체 새로고침 → 동일 자금/유닛 복원, 사망 상태/남은 부활 시간, 연결된 소환진/회복방 재방문, 보스 보상 중복 없음, 다음 스테이지 회복 한 번, 이전 정상본 안내, 패배 시 두 키 삭제.
- 리뷰: 원천 거래/보상 함수의 기존 반올림·스폰 수 보존, 이벤트·보스 상태/저장 그래프, 실패 거래의 무변경, 백업 수명주기를 검토했다. 발견한 복구 안내가 일반 타이틀 메시지에 가려지는 문제를 수정하고 신규 시나리오를 재실행했다.
- 참고 산출물: `artifacts/economy/simulation.json`, `artifacts/roadmap-foundations/live-economy.json`, `artifacts/roadmap-foundations/resumed-management-360.png`.
- 미검증/위험: Android 실기기·APK는 이번 작업에서 빌드/실행하지 않았다. 실제 인간 플레이의 경제·유효 DPS·생존은 미측정이다. 저장 실패 후 강제 종료하면 최신 변경이 유실될 수 있다. 구버전으로 돌아가면 v2 이어하기를 제공하지 못한다.
- 커밋/푸시하지 않았다. 별도 프로젝트 로컬 변경은 건드리지 않았다. 후속 승인 요청은 보상 수치를 변경하는 2단계의 정책 선택에 한정한다.

## 이전 완료 작업

- ID: UI-004
- Status: COMPLETE
- Goal: 조건 조합 재료를 실제 유닛 이름과 보유/필요 수량으로 명확하게 표시
- Owner: Gameplay Engineer → Mobile QA → Code Review
- Source: 사용자의 디자인 개선 요청, `.agent/skills/design/smash_roguelike_ui_redesign.md`, 참고 PNG

## Acceptance Criteria
- [x] 불사조·뇌운·드루이드 조건의 실제 재료 이름을 거래 판정과 같은 함수로 표시
- [x] 재료별 보유/필요 수량·승급 필요 ★ 명시, 기존 재료 자격과 비용 보존
- [x] 두 모바일 화면 크기에서 카드 겹침·줄바꿈 및 실제 불사조 제작 확인
- [x] 테스트·빌드·전체 브라우저 회귀 및 수정 APK 서명/자산 검증

## Validation
- `npm test`: 23개 통과, `npm run build`: 통과.
- `node artifacts/recipe-validation/check-ui.mjs`: 모바일 표시·불사조 제작 통과.
- `node tests/browser-smoke.mjs`: Chrome 156, 720×1280/360×640 터치·전체 회귀 통과.
- Gradle assembleDebug, APK 서명·최신 dist 자산 해시 일치, `git diff --check`: 통과.

## Handoff
기존 비용·레시피 자격·숲 T2의 두 대안을 유지한다. Android 실기기 설치/실행은 미검증이다.

캡처/검증은 `artifacts/recipe-validation/report.md`, 수정 APK는 `artifacts/apk/summoners-expedition-recipes-debug.apk`. 커밋/푸시하지 않았다.
