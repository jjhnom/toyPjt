---
name: smash-roguelike
description: 소환사의 원정 Phaser 3 게임에서 룸 진행, 유닛 소환·레시피 조합, 전투와 보상 작업 시 기존 메커니즘을 확인한다.
---

# Smash Roguelike Mechanics

이 파일은 Codex Skills 탐색용 진입점이다. 게임의 실제 상세 명세는 기존 문서인 [smash_roguelike_skill.md](../../../.agent/skills/smash_roguelike_skill.md)를 읽는다.

작업 전 [공통 프로젝트 규칙](../../../.agent/rules.md)과 실제 구현을 확인한다.

- `SquadRoster`와 `src/config/squadData.ts`의 소환·조합 계약을 유지한다.
- 현재 게임 루프는 소환과 레시피 조합 중심이다. 이전의 단순 Tier 진화 모델로 되돌리지 않는다.
- 과거 명세 또는 예시 코드와 현재 구현이 다를 때 실제 코드와 요구사항을 구분해 보고한다.
- 수정 후 `npm test`와 `npm run build` 실행 여부를 보고한다.
