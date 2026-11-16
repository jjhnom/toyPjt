# 보스 이동·시전 모션 v2

기존 `.agent/skills/design/20261112/bossmonster/` 캐릭터 시트5장을 각각 참고해 built-in `image_gen`으로 제작한 투명 시트다. 원본과 기존 `bosses-v1` 아틀라스는 보존했다.

- `sources/{bossId}.png`: 새 보스별 시트5장, 각1448×1086. 원본 출력 알파를 보존한다.
- `prompts.json`: 실제 사용한5개 생성 프롬프트와 도구 기록.
- `layout.json`: 수동 검수한 행 경계·발 기준·공통0.4배율. 서리 여왕의 지팡이 등은 단순한3등분 행 경계를 넘으므로 실제 경계를 지정한다.
- `atlas.png` / `atlas.json`: 1024×1664,60개160×160 프레임, PNG약2.17MB·원시RGBA6.5MiB. 런타임은 이 아틀라스1장만 추가 로드한다. `sources/`5장은 런타임에 로드하지 않는다.
- `frame-review.json`: 프레임별 실제 원본 영역, 배치, 내용 경계와 투명 픽셀 수. 정규화 때 잘린 픽셀은0이다.

각 보스의 프레임0~3은 이동,4~7은 시전 준비,8~11은 발동·복귀다. 캔버스 발 기준(80,140), 런타임144×144·originY59/96을 사용해 발이 기존 물리 객체 중심 아래37.5 논리px에 놓이게 한다. 모든 프레임은 같은 배율로 변환하며 프레임마다 자동 확대하지 않는다. Nearest Neighbor·2px 외부 여백을 유지한다.

재생은 `src/ui/BossMotion.ts`가 담당한다. 발걸음은 실제 이동 거리를 따르고, 시전은 기존 warningMs, 발동은 실제 hazard의 impact 신호를 따른다. 실제 속도·충돌·공격 타이머를 바꾸지 않는다. 돌진 중에는 대지/늪 보스의 돌진 포즈를, 황혼 마왕은 망토 이동 프레임을 사용한다. 새 아틀라스가 없으면 기존3포즈 표시로 돌아간다.

재생성: `node scripts/build-boss-motion-atlas.mjs` (로컬 Chrome 필요). 자세한 전후 자료와 검증은 [결정039](../../../design/decisions/039-boss-motion.md), [움직이는 비교](../../../artifacts/boss-motion-20261112/comparison.html)를 참고한다.
