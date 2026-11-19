# BGM·전투음 합산 믹싱 점검

- 작업일: 2026-11-18 (KST)
- 환경: Windows / Node.js v22.16.0 / Headless Chrome 157 / 48kHz 스테레오 PCM.
- [출력 여유 정책](../design/decisions/20261118-audio-output-headroom.md)

## 재현과 수정

실제 SoundManager가 허용한 재생 노드를 수집했다. 전투·서리 폭격·장판이 겹치는 통제 장면 65개 이벤트와, 8보이스를 동시에 허용한 부하 장면 8개 이벤트를 사용했다. 실제 시작·종료·페이드·gain과 음원을 OfflineAudioContext에 재구성하고, BGM 3곡을 각각 0/5/11초 지점에서 겹쳐 비교했다.

합산 전에 볼륨을 독립적으로 제한하더라도 8보이스 부하에서는 full scale 1을 초과했다. `src/systems/audioMix.ts`에 작은 입력은 선형으로 두고 큰 입력만 완화하는 출력 보호를 구현하고, `SoundManager`의 SFX/UI master 뒤에 연결했다. BGM 음량과 전투의 피해·주기·입력은 변경하지 않았다.

같은 이벤트에 대한 보호 전·후 비교(각 장면의 9개 음악/위상 조합 중 최대 피크):

| 장면 | 보호 전 피크 | 보호 후 피크 | 보호 후 클리핑 |
| --- | ---: | ---: | --- |
| 전투+서리 폭격+장판 | 0.9603 | 0.7429 | 0 샘플 |
| 8보이스 동시 부하 | 1.5019 | 0.7815 | 0 샘플 |

전체 18개 조합을 보호 전·후로 각각 렌더링해 총 36회 비교했다. 보호 전 최고 피크를 기록한 황혼 BGM/0초 위상 행에는 full scale 이상 샘플이 633개 있었고, 보호 후 18개 행은 모두 0개였다. 최고 피크를 만드는 위상은 보호 전·후에 달라질 수 있다.

## 수정 파일과 검증

- `src/systems/audioMix.ts`: 출력 곡선·보호 노드 생성 및 할당 실패 격리.
- `src/systems/SoundManager.ts`: 출력 노드 연결·해제, 보호 적용 진단 플래그.
- `tests/audio-mix.test.mjs`: 작은 신호 보존·출력 상한·대칭·그래프 해제·지원 실패 회귀 검사.
- `tests/helpers/fake-audio.mjs`, `tests/sound.test.mjs`: 새 그래프 경로 검증.
- `tests/bgm.test.mjs`: 빠른 BGM 교체의 합산 음량과 출력 여유 검사.
- `tests/audio-mix-browser.mjs`, `scripts/integration-check.mjs`: 부하·합산 PCM·생명주기 검증 등록.

검증 결과:

- `npm test`: **279/279 통과**, 실패·skip 0. [로그](../artifacts/audio-mix-20261118/unit-tests.log)
- `npm run build`: **성공**, 기존 청크 크기 경고 유지. [로그](../artifacts/audio-mix-20261118/build.log)
- `audio-mix-browser`: **통과**. 보호 활성 확인, 최대 8보이스, 오디오 오류 0, 보호 후 18개 조합의 클리핑 0. 전역 음소거·숨김/복귀에서 BGM과 SFX가 함께 정지하고 지난 SFX를 재생하지 않음.
- `boss-audio-browser`: **통과**. 실제 보스 음원 26개·기술 19개, 서리 10회 충격음 음량 정책과 루프·복귀 검증 유지.
- `git diff --check -- .`: 통과. master/버스 음량·노드 수명·할당 실패·기존 호출자 및 테스트 결과 검토.

## 증거와 재현

- [합산 PCM·네이티브 진단 결과](../artifacts/audio-mix-20261118/result.json)
- [최초 클리핑 재현 기록](../artifacts/audio-mix-20261118/before.json)
- [통합 테스트 결과](../artifacts/audio-mix-20261118/integration-report.json)
- [보호 후 부하 장면 미리 듣기 WAV](../artifacts/audio-mix-20261118/mix-preview.wav)

```powershell
$env:SMASH_TEST_URL='http://127.0.0.1:5205/'
$env:SMASH_BROWSER_NO_SANDBOX='1'
node scripts/integration-check.mjs --serve audio-mix-browser boss-audio-browser
```

## 한계와 남은 작업

네이티브 검증은 통제된 재생 요청 장면이며, PCM 비교는 재구성한 디지털 합산 결과다. HTML BGM과 Web Audio의 운영체제 최종 출력 루프백을 녹음한 결과가 아니다. 모든 자연 전투·장시간 성능·스피커/이어폰 청감을 보장하지 않는다. 노드 미지원/실패 시 기존 출력으로 재생하며 보호 적용 여부는 진단 플래그로 확인해야 한다.

실기기 검증은 사용자 결정에 따라 건너뛴 상태다. APK는 이번 수정으로 갱신하지 않았다. 다음은 문서 5단계의 적·탄환·VFX 부하 계측이다. 새 의존성·게임 규칙·Android 설정 변경, push/merge·배포는 수행하지 않았다.
