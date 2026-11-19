# 보스 예고·판정 검증 및 전용 VFX 복구 수정

- 작업일: 2026-11-18 (KST)
- 범위: `EncounterHazards.clear()`의 전용 VFX 복구와 보스 예고 경계 회귀 검증.
- 게임 규칙·피해량·반경·공격 주기·보상·공격 계획 데이터는 변경하지 않았다.

## 확인한 문제와 수정

`EncounterHazards.paint()`에서 렌더링 예외를 격리한 뒤 `visualFailed`를 true로 유지했다. 기존 `clear()`는 정상적으로 전투를 정리해도 이 플래그를 해제하지 않아 이후 방에서도 전용 VFX를 다시 시도하지 않았다. 기본 Graphics 예고와 피해·오디오는 기존에도 별도로 동작했다.

재현 테스트 2개가 수정 전 실패하는 것을 확인했다. `visuals.clear()`가 성공한 경우에만 `visualFailed=false`로 복구하도록 수정했다. 정리 자체가 실패하면 격리를 유지한다. 현재 전투의 매 프레임에 재시도하지 않고, 정상적인 전투 정리 후 후속 공격에서 다시 렌더링한다.

## 수정 파일

- `src/entities/EncounterHazards.ts`: 정상 정리 후 전용 VFX 복구.
- `tests/boss-visual.test.mjs`: 일시적 draw 실패와 cleanup 실패의 복구·피해·오디오 독립성 회귀 테스트 2개.
- `tests/boss-telegraph.test.mjs`: 6종 보스 전체 패턴을 3개 페이즈·중앙/경계 표적에서 검사. 예고 1ms 전·정확한 발동 시점·좌표·반경·참격 양 끝점 전달·정리 후 취소를 확인한다.
- `tests/boss-telegraph-browser.mjs`: 실제 GameScene의 Hazard/VFX/피해 경로 검증과 화면 캡처.
- `scripts/integration-check.mjs`: 새 브라우저 스위트를 등록했다.

## 검증 결과

- `npm test`: **271/271 통과**, 실패·skip 0. [로그](../artifacts/boss-telegraph-20261118/unit-tests.log)
- `npm run build`: **성공**, 기존 500kB 초과 청크 경고 유지. [로그](../artifacts/boss-telegraph-20261118/build.log)
- `boss-telegraph-browser`: **통과**. 6종·19개 패턴·61개 Hazard의 예고/발동 경계와 좌표·반경 전달을 검증했다. 원형 기술 12개는 첫 Hazard의 예고선 1px 안쪽에서 실제 본체 피해 발생, 1px 바깥쪽에서 피해 없음도 확인했다.
- `browser-smoke`: **통과**(103.608초). 소환·조합·보상 정지·숨김/복귀·스테이지 전환·저장 복원·재시작 등 기존 전체 회귀 검증 통과. [통합 실행 결과](../artifacts/boss-telegraph-20261118/integration-report.json) / [스모크 로그](../artifacts/boss-telegraph-20261118/smoke.log)
- 렌더링 예외 주입: 피해 10은 정상 적용, 전투 정리 후 전용 VFX 복구 및 피해 10 재적용. 20회 정리/재사용에서 씬 자식 오브젝트 수 168개 유지.
- 해당 결정적 타임라인 검증의 VFX 활성 수 최댓값은 10개, 브라우저 런타임 예외는 0건(주입한 렌더링 예외는 내부에서 격리됨).
- `git diff --check -- .`: 통과. 변경 diff와 Hazard clear 호출 경로·시각/오디오 관찰자 분리를 검토했다.

브라우저 환경은 Windows / Node.js v22.16.0 / Headless Chrome 157 / 360×640 터치 뷰포트다. GameScene 시뮬레이션을 일시정지하고 실제 컴포넌트에 delta를 단계별로 전달하는 검증이다. 피해는 실제 GameScene 경로로 처리하며, 자연스러운 전체 보스전 플레이나 실시간 FPS 측정과 구분한다.

```powershell
$env:SMASH_TEST_URL='http://127.0.0.1:5203/'
$env:SMASH_BROWSER_NO_SANDBOX='1'
node scripts/integration-check.mjs --serve boss-telegraph-browser browser-smoke
```

## 증거

- [패턴별 계획·발동·충돌·복구 결과](../artifacts/boss-telegraph-20261118/browser-report.json)
- [용암 운석 예고](../artifacts/boss-telegraph-20261118/lava_colossus-warning-360.png) / [발동](../artifacts/boss-telegraph-20261118/lava_colossus-impact-360.png): 육안으로 3개 예고 원과 발동 중심 위치 확인.
- [서리 여왕 예고](../artifacts/boss-telegraph-20261118/frost_queen-warning-360.png) / [발동](../artifacts/boss-telegraph-20261118/frost_queen-impact-360.png)
- [황혼 참격 예고](../artifacts/boss-telegraph-20261118/twilight_king-warning-360.png) / [발동](../artifacts/boss-telegraph-20261118/twilight_king-impact-360.png)
- 총 13장의 360px 캡처를 위 결과 폴더에 저장했다.

## 남은 범위

이번 확인에서 원형 표본의 예고선 밖 숨은 피해는 재현되지 않았다. 돌진의 실제 이동 중 물리 충돌, 모든 표적 위치의 연속 경계 검사, 실시간 FPS/메모리, 자연 플레이 가독성은 별도 검증이다. 서리 연속 폭격 SFX 강약·중복 억제, 접근성 옵션 등 문서 3단계 전체를 완료한 것은 아니다.

실기기 검증은 사용자 결정에 따라 건너뛴 상태다. 이번 소스 수정은 이전에 생성한 디버그 APK에 포함되지 않으며 이번 작업에서 APK를 재빌드하지 않았다. push/merge·배포는 수행하지 않았다.
