# 보스 스킬 실시간 미리보기

프로젝트 루트에서 `npm run dev`를 실행한 뒤 아래 주소를 엽니다.

http://localhost:5173/tools/boss-skill-preview/

보스·패턴을 바로 지정할 수 있습니다: `http://localhost:5173/tools/boss-skill-preview/?boss=twilight_king&pattern=METEOR`. 잘못된 보스 이름은 기존 기본값을 사용합니다.

- 보스 5종, 실제 공격 패턴 12개를 선택할 수 있습니다.
- 재생·일시정지·반복, 0.25~2배속, 전투 단계, 시간 슬라이더를 제공합니다.
- 예고 / 발동 / 잔류·여운 / 소멸 버튼으로 원하는 장면을 확인합니다.
- 황혼의 마왕의 FROST 패턴은 화면에 `암흑 구속`으로 표시하며 보라색 전용 연출을 사용합니다.
- `planBossAttack`, `EncounterHazards`, `BossVfxController`, `BossMotion` 및 원본 아틀라스를 직접 사용합니다. 돌진 이동은 계획된 시작·끝 좌표를 600ms 동안 시각적으로 보간합니다.
- 배경과 고정 표적은 관찰용입니다. 피해 콜백은 비어 있으며 메인 게임과 저장 데이터는 실행하지 않습니다.

Vite 개발용 도구입니다. HTML 파일을 직접 더블클릭하면 안내를 표시합니다. 일반 게임 배포 빌드에는 추가되지 않습니다.

브라우저 확인: 개발 서버 실행 후 `node tests/boss-skill-preview-browser.mjs`.
