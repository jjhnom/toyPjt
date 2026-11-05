# Current Task

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
