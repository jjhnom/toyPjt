# VS Code Codex AI Game Studio 설정

이 구성은 기존 `rnd/.agent/` 문서를 변경하지 않고 Codex가 자동으로 읽는 `rnd/AGENTS.md` 및 `rnd/.agents/skills/` 경로를 새로 추가한다.

## VS Code 시작
1. Git 저장소 `jjhnom/toyPjt`를 연다.
2. 작업 폴더를 `rnd/`로 설정하거나 이 폴더를 VS Code에서 연다.
3. Codex 채팅을 새로 열고 `AGENTS.md` 및 Skills 목록 인식 여부를 확인한다.
4. `$producer`로 작은 작업을 계획한다.
5. `$gameplay-engineer`로 구현한 뒤 `$game-test`와 `$code-review`를 순차 활용한다.

## 현재 명령
- `npm ci`
- `npm test`
- `npm run build`
- `npm run dev`
- `node tests/browser-smoke.mjs` (로컬 서버 및 Chrome 조건 필요)

## 안전
- 기본 브랜치를 직접 수정하지 않고 PR에서 diff를 검토한다.
- 기존 `.agent/` 파일은 유지한다.
- `AGENTS.md`는 지침이며 보안 샌드박스를 대체하지 않는다.
- 이 커밋은 문서 및 Skills 구성만 추가한다. 게임 코드/패키지/Android 설정은 변경하지 않는다.
