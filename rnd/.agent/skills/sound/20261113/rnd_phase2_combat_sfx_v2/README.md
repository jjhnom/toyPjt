# rnd / 2단계 전투 사운드 v2 (개선판)

총 15종의 **새로 합성한** WAV/OGG 게임 효과음. Phaser 3 + Capacitor 기준. 이전 버전의 무음과 오실레이터 합성음을 대체할 수 있도록 기존 15개 ID 유지.

## 주요 개선점
- 기존: 여러 샘플이 동일한 노이즈 + 단순한 하강 주파수 + 일률적인 피크 노멀라이즈로 비슷한 음색이 나기 쉬웠음.
- 개선: 검(금속 공명과 공기 가르기), 활(짧은 시위/비행음), 총(3연발 기계음), 화염(난류/불꽃), 얼음(유리 공명), 번개(불규칙 파열) 등 별도 음색 설계.
- 피격: 둔탁한 살점 타격 / 금속 충격 / 저음 강화 크리티컬 / 방패 차단음 분리.
- 사망: 소형은 짧고, 중형은 묵직하게, 엘리트는 긴 충격과 잔향, 마법형은 맑은 소멸음.
- 크리티컬·엘리트 등 중요한 이벤트를 강하게, 일반 공격은 낮은 강도로 상대적 다이내믹을 줌.

## 구성 및 설치
- `assets/audio/sfx/*.ogg`: 게임 런타임 권장(이전 15개와 같은 이름)
- `assets/audio/sfx/*.wav`: 편집용 원본
- `phase2_v2_all_sfx_preview.ogg`: 모든 효과음 순서대로 듣기(사이 공백 0.57초)
- `manifest.json`: 재생 길이와 레벨 정보
- `tools/generate_sfx_v2.py`: 재생성 가능한 원본 합성 코드

복사할 위치: `rnd/public/audio/sfx/` 에 OGG 15개 배치. 파일 경로는 `/audio/sfx/<id>.ogg`.

## 개별 파일 및 권장 연결

| ID | 상황 | 권장 재생 게인 |
|---|---|---:|
| attack_sword_light | 빠른 근접 공격 | 0.20 |
| attack_sword_heavy | 중량 근접 공격 | 0.28 |
| attack_arrow | 활/투사체 발사 | 0.20 |
| attack_gun_burst | 기계/개틀링 | 0.18 |
| attack_fire_magic | 화염 공격 | 0.25 |
| attack_ice_magic | 빙결 공격 | 0.22 |
| attack_lightning | 번개 공격 | 0.22 |
| hit_flesh_light | 일반 피격 | 0.19 |
| hit_armor | 중장갑 피격 | 0.22 |
| hit_critical | 크리티컬 타격 | 0.38 |
| hit_shield_block | 방패 막기 | 0.22 |
| death_enemy_small | 소형 몬스터 처치 | 0.17 |
| death_enemy_medium | 중형 몬스터 처치 | 0.21 |
| death_enemy_elite | 엘리트 처치 | 0.48 |
| death_enemy_magic | 마법형 몬스터 처치 | 0.25 |

게인은 **권장 시작값**이며 SoundManager 마스터 음량·동시 재생 제한·실제 게임 기기 테스트에 따라 조정해야 함. 공격마다 모두 재생할 경우 일반 발사는 throttle 40ms, 일반 피격 60ms, 사망은 별도 우선순위 적용 권장.

## 적용 주의
- 현재 파일은 사운드 자산만 포함. 실제 `SoundManager.ts` 소스 코드를 변경하지 않았음.
- `WeaponComponent.ts`: unit type/attack type에 따라 공격 ID 매핑.
- `GameScene.ts`: 피격 이벤트에서 일반/방어/크리티컬 분기; 사망 이벤트에서 몬스터 종류에 따라 분기.
- `BootScene.ts`: 오디오 preload 등록. 모바일에서는 사용자 탭 이후 재생 허용 처리.
- 기기에서 헤드폰과 내장 스피커 모두 테스트하고, 다수의 적이 동시에 피격할 때 레벨을 확인할 것.

## 검증
- 각 파일의 시작/끝 클릭 노이즈 없는지
- 전투 30초 연속 플레이에서 소리 뭉침 없는지
- 크리티컬과 엘리트 처치가 일반 타격보다 충분히 강조되는지
- Android WebView 앱 배경/복귀 후 무음 문제 없는지
