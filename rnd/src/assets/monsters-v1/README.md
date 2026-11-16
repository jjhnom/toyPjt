# 지역 몬스터 픽셀 외형

내장 `image_gen`으로 생성한 18종 신규 픽셀 몬스터다. CLI/API 키 경로는 사용하지 않았다. 생성 원본은 `sources/generated.png`, 프롬프트는 [prompts.md](prompts.md)에 보존한다.

- 6지역 × 근접/원거리/주술사 3역할.
- `atlas.png` / `atlas.json`: 448×504, 52px 셀 72프레임. 적의 기존 프레임 크기와 충돌 계약을 유지한다.
- 각 외형의 4프레임은 원본 자세에 상하 1픽셀 idle 움직임을 부여한 것이다. 독립된 걷기/시전 원화를 4장씩 생성한 것은 아니다.
- `node scripts/build-regional-monsters.mjs`로 재생성한다. 생성기의 순색 매트 잔여색·분리된 배경 조각을 제거하고 여백과 발 위치를 맞춘다. 최종 캐릭터 필터는 기존 NEAREST다.
- `frame-review.json`: 투명 픽셀·유효 영역·잘림 검사. 게임 모듈은 생성 원본 대신 최종 작은 아틀라스만 로드한다.
