# 보스 전투 아틀라스 v1

원본: `.agent/skills/design/20261112/bossmonster/`의 캐릭터 시트5장과 VFX 시트5장. 원본 PNG는 수정하지 않았다. 이미 있는 알파 채널을 보존하고 Nearest Neighbor로 분리·정규화했다.

- `atlas.png` / `atlas.json`: 1024×1536, 대기·시전·공격 포즈15개(192×192), 효과82개(96×96). 원시RGBA6MiB, PNG약1.51MB.
- `layout.json`: 시각 검수한 원본 영역·포즈별 발 좌표·보스별 공통 배율·효과별 행과 개별 열 경계. 동일 격자로 전체 시트를 나누지 않는다.
- `frame-review.json`: 각 런타임 프레임의 원본 파일/좌표와 목적지 배치. 캐릭터 발 기준은(96,178), 바닥 효과는(48,76)이다.
- `node scripts/build-boss-atlas.mjs`: 원본에서 아틀라스와 검수용 contact sheet를 재생성한다. 개발용 로컬Chrome 실행이 필요하다. `SMASH_BROWSER_PATH`, `SMASH_BROWSER_NO_SANDBOX`는 기존 스크립트와 같다.

서리 여왕의 실제 캐릭터 파일은 문서 예시 이름과 다른 `서리_여왕의_얼음_스프라이트_시트.png`이다.

숲 수호자 돌진 포즈의 긴 뒤쪽 잔상은 본체 크기를 왜곡하지 않도록 별도 charge VFX로 표현한다. 황혼 마왕의 세 번째 포즈는 지팡이 발사 자세이므로 스킬 발동에 사용하고, 실제 돌진에는 기본 포즈와 이동/잔상을 사용한다.

공격 경고의 원·직선은 기존 판정 좌표로 그린다. 원본 시트의 타원형 경고나 십자 전체 그림을 실제 원형 판정 위에 덮지 않는다. 효과 이미지는 각 판정 영역으로 마스킹해 최종 보스 중앙 안전 영역을 보존한다.

적용: `bossVisualData.ts`, `Enemy.ts`, `BossVfxController.ts`, `EncounterHazards.ts`, `GameScene.ts`. 자세한 검증은 [결정038](../../../design/decisions/038-boss-art-vfx.md)을 참고한다.
