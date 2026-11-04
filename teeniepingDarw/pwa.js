(() => {
  const button = document.querySelector('#install-app');
  const guide = document.querySelector('#install-guide');
  const status = document.querySelector('#install-status');
  let installPrompt;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone()) guide.hidden = true;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event; button.hidden = false;
  });
  button.addEventListener('click', async event => {
    event.preventDefault();
    if (!installPrompt) return;
    const prompt = installPrompt; installPrompt = null; button.hidden = true;
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { status.textContent = '브라우저 메뉴에서 홈 화면에 추가를 선택해주세요.'; }
  });
  window.addEventListener('appinstalled', () => { guide.hidden = true; installPrompt = null; });
  if (!window.isSecureContext) {
    status.textContent = '현재 주소에서는 웹으로 사용할 수 있어요. 앱 설치와 오프라인 사용은 HTTPS 주소에서 지원됩니다.';
    return;
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      status.textContent = '오프라인 준비에 실패했어요. 온라인에서는 계속 사용할 수 있어요.';
    });
  }
})();
