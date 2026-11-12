# 소환 유닛 치비 픽셀 아트 v4

사용자 요청(2026-11-11): 실제 소환·조합 유닛 전체를 **큰 머리·짧은 팔다리·밝은 표정**의 귀여운 픽셀 스타일로 통일한다. 로비 캐릭터의 비율·보라색 외곽선·큰 눈·볼터치를 기준으로 한다.

## 구성과 출처

- 총22종의 독립된 외형이다. 숲의 사수/불꽃 마법사2종은 승인된 `lobby-characters-v1/sources/{archer,fireMage}.png`를 복사해 재사용하고, 나머지20종은 내장 `image_gen.imagegen`으로 각각 생성했다.
- [sources/manifest.json](sources/manifest.json): 타입 ID·이름·선택된 원본 파일·전체 생성 프롬프트·스타일 참조·투명 배경·재사용 출처. 참조는 스타일용이며 직업별 장비와 속성은 기존 유닛 명세를 따른다.
- `sources/*.png`: 선택된 원본 PNG22장. 생성 폴더와 이전 `units-v3`의 원본은 보존한다.
- `units-atlas.png`: 배포하는 투명 PNG 한 장,768×512/128px셀/6열. 큰 원본22장은 런타임에서 직접 로드하지 않는다.
- `atlas-layout.json`: 원본의 알파 경계와 프레임별 배치 좌표. [unitArt.ts](../../ui/unitArt.ts)의 기존22종 매핑을 유지한다.

사람형 유닛은 얼굴과 머리 장식을 약60% 비율로 키우고 몸·팔·다리를 줄였다. 약초 사제의 초록 후드/약초, 서리 현자의 흰 수염/눈송이, 번개 정령의 노란 결정, 용암 골렘의 검은 돌/용암, 그림자 계열의 보라 후드/단검, 상위 유닛의 달·세계수·불사조·번개·거석 장비로 구분한다. 정령/골렘/수호신은 해당 종족을 유지하며 둥근 얼굴과 밝은 눈으로 표현한다.

## 준비와 검증

```powershell
$env:SMASH_BROWSER_NO_SANDBOX='1' # 이 로컬 검증 환경에서 명시적으로 사용
node scripts/build-unit-atlas.mjs units-v4
npm test
npm run build
node tests/unit-art-browser.mjs
node tests/browser-smoke.mjs
```

Chrome Canvas로 원본의 알파 여백을 정리하고 비율을 유지해 기존128px 셀에 패킹한다. 게임의 공통 `art_units_source`를 이 아틀라스로 연결하므로 소환/레시피·편성/분대 상태·도감의96px 초상화와48px 전투 이미지가 함께 바뀐다. 준비 후 큰 아틀라스 GPU 텍스처/중간 캐시는 해제한다.

전투 프레임은 기존48×48·4프레임·6fps의 작은 상하 움직임을 유지한다. 방향별 이동/공격을 새로 그린 시트는 아니다. 전투 크기·좌우 반전·충돌/공격 판정·스킬·비용·레시피·HP·저장 ID는 변경하지 않는다. 로비·본체 소환사·적/보스는 이번 교체 대상이 아니다.

[실제 런타임 전체 유닛 비교](../../../artifacts/cute-units-20261111/after-all-units-720.png) · [변경 전](../../../artifacts/cute-units-20261111/before-all-units-720.png).

테스트148개·빌드·22종 아트/실제 소환·조합/편성/도감·기존 전투/저장 스모크 통과. 배포 아틀라스576,062bytes이며 기존v3보다63,944bytes 증가했다. 부팅/전투 크기/프레임·22종 고유 아트·알파 여백과 소스 텍스처 해제를 검증했다. [검증 상세/미검증 범위](../../../design/decisions/024-cute-summoned-units.md).
