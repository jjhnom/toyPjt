# 소환사의 원정 — 스킬 VFX 개별 이미지 시안

기준: 사용자 제공 `skillEffectTextures.ts` (14 SkillShape + 보조효과 6종).

## 파일 구성

- `{shape}_preview.png`: 각 스킬별 발사체/심볼/범위 효과를 함께 보여주는 개별 디자인 카드
- `{shape}_projectile.png`, `{shape}_glyph.png`, `{shape}_wave.png`: 개별 단계별 이미지 참고 자료
- `skill_vfx_contact_sheet.png`: 전체 시안 모음

공격 14종: arrow, streak, fire, frost, star, void, bolt, stone, leaf, slash, thorn, poison, holy, feather.
보조 6종: heal, shield, buff, rune, slow, poison_support.

## 주의 및 코드 적용

이 PNG는 **이미지 생성 시안에서 영역별로 잘라낸 디자인 레퍼런스**이며, 단색 투명 32×32/96×96 프로덕션 텍스처가 아닙니다. 일부 이미지에 어두운 배경이 포함되어 있습니다. 현재 `skillEffectTextures.ts`는 캔버스에서 32×32 발사체·심볼과 96×96 웨이브를 생성합니다. 이 시안들은 기존 생성 로직을 교체할 때 사용할 고해상도 스타일 가이드입니다. 실제 게임 리소스로 적용하려면 투명 배경 정리·크기별 리샘플링·프레임/텍스처 키 매핑·성능 점검을 추가로 진행해야 합니다.

`skillProjectileTexture(unit)`는 UNIT_COMBAT_STYLES 의 유닛 기준 키를 사용하고, `skillGlyphTexture(shape)`·`skillWaveTexture(shape)`는 스킬 모양 기준 키를 사용합니다. 따라서 `config/skillData.ts`의 실제 매핑을 확인한 후 연결하세요.

게임 코드와 GitHub 저장소는 변경하지 않았습니다.
