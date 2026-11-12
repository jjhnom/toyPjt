# 027 — 사용자 제공 프레임·버튼·아이콘·환경 자산 적용

- 일자 / 작업: 2026-11-11 / UI-012
- 요청: `.agent/skills/design/20261111/`의 프레임·타일·아이콘·버튼 이미지를 실제 게임에 적용한다.
- 범위: 실제 자산을 추출해 기존 UI/전투 배경에 연결한다. 설명 라벨·예시 수치·미구현 상점/랭킹/MP 기능은 제품 UI에 넣지 않는다.

## 적용과 파일

| 파일 | 변화 |
| --- | --- |
| `src/assets/provided-v1/`, `scripts/build-provided-art.mjs` | 원본5장 보존·라벨 제외 추출·패널 레일/모서리 준비·비활성 파생 버튼·35프레임/PNG·좌표와 해시 기록 |
| `src/ui/artAssets.ts`, `src/scenes/BootScene.ts` | 배포용 PNG/JSON 아틀라스 한 장 등록·로딩 |
| `src/ui/providedArt.ts` | 제공 이미지용 NineSlice·아이콘 대응·스테이지 테마→바닥 매핑·치유 버튼 상태 전환 |
| `src/ui/fantasyTheme.ts`, `src/ui/squadArt.ts`, `src/ui/lobbyArt.ts` | 실제 프레임/카드·주요/보조/비활성 버튼·선택/비선택 탭·로비/정비 아이콘 연결. 입력 영역/이벤트·개체/티어 정보는 유지 |
| `src/ui/ActiveSkillButton.ts` | 기존 준비/대기/비활성 상태에 실제 버튼 이미지를 표시. 떼기/취소/대기 판정은 유지 |
| `src/scenes/SquadScene.ts` | 밤 성 배경 띠·제공 책/보석 아이콘 |
| `src/scenes/GameScene.ts` | 테마별 바닥 TileSprite·장식5종·제공 HUD 아이콘/프레임. 기존 벽/문·물리·파티클/적·경고 깊이 유지 |
| `tests/provided-art-browser.mjs`, `tests/ui-style-browser.mjs` | 실제 자산/테마/버튼 크기/장식 경계 검사 및 새 아이콘 검수 시트 |

원본 정보와 재생성 명령은 [자산 README](../../src/assets/provided-v1/README.md)에 기록했다. 새 패키지/셰이더·생성 아트를 추가하지 않는다. 기존22종 캐릭터·거래/레시피·비용·저장 형식은 유지한다.

바닥은 숲/습지→풀, 화산→용암, 빙하→얼음, 성채→던전이다. 기존 스테이지의 `themeId`를 사용하므로 무한 원정의 테마 순환에도 적용된다. 장식은 아레나 좌우 바깥이며 입력/물리/보상 객체가 아니다. 배너/바위 등으로 문·공격 예고·유닛이 가려지지 않도록 배경 깊이에 둔다.

WebGL은 NineSlice로 모서리를 유지하고 Canvas는 크기 조절 이미지로 대체한다. 픽셀 패널 반환 객체가 Container로 바뀌지만 기존 `.setDepth`/`.setName`·부모 컨테이너 연결을 유지하며 관련 호출자를 검증한다. 제공되지 않은 아이콘은 기존 픽셀 도형으로 유지한다. 원본의 상점/랭킹 그림이 새 기능의 구현을 의미하지 않는다.

## 실제 화면

[로비](../../artifacts/provided-art-20261111/lobby-360.png) · [소환](../../artifacts/provided-art-20261111/summon-360.png) · [조합](../../artifacts/provided-art-20261111/combine-360.png) · [편성](../../artifacts/provided-art-20261111/roster-360.png).

[풀 바닥](../../artifacts/provided-art-20261111/battle-forest-360.png) · [용암](../../artifacts/provided-art-20261111/battle-volcano-360.png) · [얼음](../../artifacts/provided-art-20261111/battle-glacier-360.png) · [던전](../../artifacts/provided-art-20261111/battle-citadel-360.png).

전투 테마 캡처는 실제 Phaser의 테마 표시를 통제한 검수 상태다. 화면의S1 제목을 S3/4 진행 완료의 증거로 사용하지 않는다. 실제 스테이지/저장 회귀는 별도 브라우저 검사를 따른다.

## 검증

- `npm test`:148개 통과. `npm run build`:통과. 기존500kB 청크 경고는 남아 있다.
- Chrome 브라우저10종 통과: `provided-art`, `ui-style`, `squad-design`, `browser-smoke`, `abilities`, `identity`, `legacy`, `endless`, `lobby`, `pixel-ui`. 로그와 실제 화면은 `artifacts/provided-art-20261111/`에 보관한다.
- 실제 아틀라스35프레임,5테마 연결, 이동 영역 안의576×904 바닥, 이동 영역 밖/입력·물리 없는 소품5종, 치유 버튼 준비/대기/비활성 전환 시112×88 크기를 확인했다. 주요 화면·61레시피·22종 상세·소환/조합/편성·기존 전투/저장/취소 동작을 검증했다.
- 첫 통합 실행은 시스템 임시 폴더의 공간 부족으로 캡처 저장에 실패했다. 이후 `TEMP`/`TMP`를 프로젝트의 검사 전용 폴더로 지정해 실행했다. 직업 검사에서는 취소 직후 정화 입력이1회 실패했고, 코드와 검사 변경 없이 단독 재실행은 통과했다. 첫 실패 로그도 보존하며 원인은 확정하지 않는다.
- 원본5장과 사본/명세의SHA-256 일치, 기존 규칙·게임 코드·캐릭터 자산32파일 보존을 확인했다. 배포된 아틀라스도 준비본과 일치한다. PNG는1,190,577바이트이며 원본5장을 런타임에서 추가 로드하지 않는다.
- diff와 호출자를 검토해 입력 타깃/콜백·씬 수명주기·패널 반환형 변경의 사용처를 확인했다. `git diff --check` 통과. 이번 래스터 이미지 배경의 명암 대비를 이전 단색 토큰의 대비 수치로 보증하지 않는다.

Android 실기기/APK·Canvas 렌더러의 모서리 품질·장시간 성능은 별도 확인 대상이다. 다음은 실기기에서 배경과 적/경고의 구분, 안전 영역과 터치 취소를 확인하는 작업이다.

후속 확인: 위 직업 검사의 취소 후 재입력 실패 원인은 [결정029](029-battle-screen-redesign.md)에서 추적했다. 입력은 도착했고, 테스트가 멈추지 않은 Phaser Clock 때문에 감속이 검사 중 만료된 문제였다. 제품의 입력·정화 규칙을 유지한 채 해당 테스트 fixture를 보완했다.
