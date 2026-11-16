# 보스 스킬 모션 v2

기존 보스별 VFX 원본5장을 각각 참고해 built-in `image_gen`으로 제작한 효과 시트다. 원본과 이전 아틀라스는 보존했다.

- `sources/{bossId}.png`: 생성 결과5장. 숲·늪·용암·여왕은8열4행, 마왕은8열6행이다.
- `prompts.json`: 실제 사용한 생성 프롬프트5개와 도구 기록.
- `layout.json`: 행별 공통 배율 계산용 발 기준과 효과 순서. 마왕은 실제 그림 경계가 균일 격자와 달라 검수한 행·열 좌표를 별도로 지정한다.
- `atlas.png` / `atlas.json`:22개 트랙×8프레임=176개96×96 프레임.1024×1824 PNG약1.63MB, 원시RGBA7.125MiB. 생성 원본5장은 런타임에 로드하지 않는다.
- `frame-review.json`: 실제 원본 영역·발 좌표·목적지 배치·투명/불투명 픽셀 수. 행 안의 작은 초기 효과도 같은 배율로 처리한다. Nearest Neighbor와2px 외부 여백을 사용한다.

각 프레임의 지면 기준은(48,76)이다. 재생 프레임 수와 샘플링은 `src/config/bossVfxMotionData.ts`, 실제 위험 영역과의 연결은 `src/ui/BossVfxController.ts`가 담당한다. 기존32개 슬롯의 Image2개와 마스크를 재사용하며 물리 객체를 추가하지 않는다. 새 아틀라스가 없으면 이전 아틀라스로 표시한다.

마왕 `FROST`는 기존 수정의 `summon` 바닥/`impact` 타격 매핑을 유지한다. 새 시트에도 파란 얼음 행을 추가하지 않았다. 여왕은 청색 얼음, 마왕은 보라색 암흑 구속을 사용한다.

재생성: `node scripts/build-boss-vfx-atlas.mjs` (로컬 Chrome 필요). [움직이는 비교](../../../artifacts/boss-vfx-motion-20261112/comparison.html) · [수정 파일·검증 기록](../../../design/decisions/040-boss-vfx-motion.md).
