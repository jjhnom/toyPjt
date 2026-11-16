# 전투 SFX v2

출처: 사용자가 제공한 `.agent/skills/sound/20261113/rnd_phase2_combat_sfx_v2/`의 새 합성 효과음 15종. OGG만 런타임에 복사했다. 편집용 WAV, 합성 코드와 원본 manifest는 제공 폴더에 보존한다.

`src/config/soundData.ts`가 ID·권장 게인·재생 간격·우선순위·유닛 매핑을 관리한다. `SoundManager`가 사용자 입력 후 생성하는 기존 AudioContext에서 한 번 디코딩해 재사용한다. Phaser 사운드 매니저를 별도로 켜지 않는다.

현재 크리티컬 판정은 없어 `hit_critical`은 등록/미리 듣기만 제공한다. 새 확률이나 피해 보너스는 추가하지 않았다. 기존 알림과 AoE 폭발 등 제공 목록 밖 효과음의 합성 재생은 유지한다.
