# 서리 여왕 연속 폭격 효과음 점검 및 수정

- 작업일: 2026-11-18 (KST)
- 문제: 기존 패턴 공유 `activated` 플래그가 10발 전체의 충격음을 첫 1회로 제한했다. 단순히 요청을 10회로 늘리면 1.34초 길이의 기존 샘플과 보이스 한도 1이 충돌할 수 있었다.
- [음량·중복 억제 결정](../design/decisions/20261118-frost-barrage-audio.md)

## 변경 내용과 파일

- `src/config/bossSoundData.ts`: 서리 여왕 METEOR에 앞 9회 gain 0.35배·마지막 1배 정책을 추가. 해당 음원 보이스 한도 2.
- `src/systems/BossAudioController.ts`: Hazard별 최초 충격을 관찰해 재생한다. 지연된 여러 타격 및 쿨다운 안에 다음 타격이 임박한 경우 소리를 합친다. 오디오는 전투 시각을 관찰하며 피해·타이머를 변경하지 않는다.
- `src/systems/SoundManager.ts`: 개별 보스 효과음 gain 비율과 20ms 이전 소리 페이드아웃 지원. 버스 음량 변경에서도 비율 보존. 전체 8보이스 한도와 80ms 쿨다운 유지.
- `tests/boss-audio.test.mjs`: 정상 10회, 큰 delta, 마지막 음의 쿨다운 보호, 음소거 복귀·보이스·gain 회귀 테스트 추가. 다른 기술의 기존 비교 및 피해 콜백 비교는 유지.
- `tests/boss-audio-browser.mjs`: 실제 19개 기술·OGG 26개 검증. 오래된 고정 대기값을 실제 Hazard의 예고/종료 시각 기준으로 갱신. 실제 AudioParam 값과 보이스 수 확인, 미리 듣기 WAV 생성.
- `scripts/integration-check.mjs`: 오디오 브라우저 스위트 등록.

## 최종 검증

- 수정 전 추가한 재현 테스트 3개 실패 확인 후 수정. 마지막 타격 쿨다운 경계 테스트도 추가했다.
- `npm test`: **275/275 통과**, 실패·skip 0. [로그](../artifacts/frost-audio-20261118/unit-tests.log)
- `npm run build`: **성공**. 기존 청크 크기 경고 유지. [로그](../artifacts/frost-audio-20261118/build.log)
- `boss-audio-browser`: **통과**. 실제 터치 후 OGG 26개 디코딩, 19개 기술의 재생 정책·장판 루프·배경/일시정지·뮤트 복구·정리 검증. 오디오 오류 0. [결과](../artifacts/frost-audio-20261118/result.json)
- 폭격의 논리 시각 1100, 1280, …, 2720ms에서 10회 재생. 실제 AudioParam은 앞 9회 약 0.2275, 마지막 약 0.65. 해당 음원의 활성 보이스는 최대 2개였다. 브라우저 테스트는 delta를 직접 전달하므로 이 시각은 논리 타격 시각이며 실제 타이머 지터 측정과 구분한다.
- `boss-telegraph-browser`: **통과**. 기존 19개 패턴·12개 원형 경계·피해/VFX 복구 검증 유지. [통합 실행 결과](../artifacts/frost-audio-20261118/integration-report.json)
- `git diff --check -- .`: 통과. 음량 설정·페이드 꼬리·그룹 수명·쿨다운과 기존 호출자를 검토했다.

## PCM 측정 및 미리 듣기

[폭격 효과음 미리 듣기 WAV](../artifacts/frost-audio-20261118/frost-barrage-preview.wav)

실제 디코딩한 OGG와 동일 음량·180ms 간격·20ms 페이드 정책을 OfflineAudioContext에 구성해 생성했다. 48kHz 스테레오, 약 4.11초다. 단독 예고+폭격 시퀀스의 피크는 0.591899, RMS는 0.077233으로 PCM full scale 1 미만이었다. 동일 구간에서 마지막/첫 타격 RMS 비율은 약 2.86배다.

이는 해당 단독 시퀀스의 디지털 신호 측정이다. BGM·여러 전투음이 모두 겹친 장면의 클리핑 보장이나 실제 스피커·이어폰 청감 검증은 아니다.

```powershell
$env:SMASH_TEST_URL='http://127.0.0.1:5204/'
$env:SMASH_BROWSER_NO_SANDBOX='1'
node scripts/integration-check.mjs --serve boss-audio-browser boss-telegraph-browser
```

## 남은 항목

Android 청감·장시간 전투 믹싱 평가는 미실행이며 사용자 결정으로 실기기 확인은 건너뛴 상태다. 기존 APK는 이번 수정으로 갱신하지 않았다. 다음은 BGM과 전투 SFX가 겹치는 부하 장면의 전체 믹싱 점검이다. push/merge·배포는 수행하지 않았다.
