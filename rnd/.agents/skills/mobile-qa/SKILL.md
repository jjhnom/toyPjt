---
name: mobile-qa
description: Capacitor Android 및 모바일 브라우저의 터치·가상 조이스틱·세로 화면·앱 복귀를 점검한다. 모바일 UI 변경이나 APK 검증 시 사용한다.
---

# Mobile QA

- `capacitor.config.json`, `android/`, `src/ui/VirtualJoystick.ts`, `tests/browser-smoke.mjs`를 확인한다.
- 세로 720x1280 기준, 비율 변화, 노치/시스템 제스처 영역, 멀티터치, pointercancel, 포커스 상실, 일시정지/복귀를 검사한다.
- 모달 진입 시 조이스틱 고착·이동 지속을 확인한다.
- `npm run build` 및 필요시 `npm run cap:sync`의 전제 조건을 확인한다.
- 브라우저 테스트, 에뮬레이터 테스트, Android 실기기 테스트를 명확히 구분한다.
- 패키지명, 서명, 권한·배포 설정은 승인 없이 바꾸지 않는다.
