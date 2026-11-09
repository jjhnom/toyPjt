import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function browserSession() {
  const profile = await mkdtemp(join(tmpdir(), 'smash-roadmap-'));
  const browser = spawn(process.env.SMASH_BROWSER_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
    ...(process.env.SMASH_BROWSER_NO_SANDBOX==='1'?['--no-sandbox','--disable-gpu']:[]),
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
  ], { windowsHide: true, stdio: 'ignore' });
  let socket;
  const close = () => { socket?.close(); browser.kill(); };
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
      catch { await sleep(100); }
    }
    assert.ok(port, 'Chrome debugging port');
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    let mainLoader, attachedLoader;
    const pending = new Map(), errors = [], diagnostics = [], requests = new Map();
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if(message.method==='Page.frameNavigated'&&!message.params.frame.parentId)mainLoader=message.params.frame.loaderId;
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if(message.method==='Network.requestWillBeSent')requests.set(message.params.requestId,message.params.request.url);
      if(message.method==='Network.loadingFailed')diagnostics.push({url:requests.get(message.params.requestId),error:message.params.errorText});
      if(message.method==='Network.loadingFinished'||message.method==='Network.loadingFailed')requests.delete(message.params.requestId);
      if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')diagnostics.push(message.params.entry.text);
      if(diagnostics.length>12)diagnostics.shift();
      if (!message.id) return;
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 45000);
      pending.set(++id, { resolve: result => { clearTimeout(timer); resolve(result); },
        reject: error => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (expression, attempts = 150) => {
      for (let i = 0; i < attempts; i++) { if (await evaluate(expression)) return; await sleep(100); }
      const state = await evaluate("JSON.stringify({scenes: window.smash?.scene.scenes.map(s => [s.sys.settings.key, s.sys.settings.status]), canvases: document.querySelectorAll('canvas').length, ready: document.readyState})");
      throw new Error(`Timed out: ${expression}; state=${state}; errors=${JSON.stringify(errors)}; diagnostics=${JSON.stringify(diagnostics)}; pendingRequests=${JSON.stringify([...requests.values()].slice(-20))}`);
    };
    const tap = async (x, y) => {
      const bounds = await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        { x: bounds.x + x * bounds.width / 720, y: bounds.y + y * bounds.height / 1280 }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(150);
    };
    const click = async (scene, name) => {
      const point = await evaluate(`(() => { const find = list => { for (const o of list) { if (o.name === ${JSON.stringify(name)}) return o; const child = o.list && find(o.list); if (child) return child; } };
        const control = find(smash.scene.getScene(${JSON.stringify(scene)}).children.list);
        if (!control) throw Error('Missing control: ' + ${JSON.stringify(name)});
        const matrix = control.getWorldTransformMatrix(); return { x: matrix.tx, y: matrix.ty }; })()`);
      await tap(point.x, point.y);
    };
    const attach = async () => {
      // Page.reload acknowledges the command before navigation commits. Never attach to its old canvas/game.
      for (let i=0; i<150 && (!mainLoader || mainLoader===attachedLoader); i++) await sleep(100);
      assert.ok(mainLoader && mainLoader!==attachedLoader,'A new main document must commit before attach');
      const loader=mainLoader;
      // Cold Vite module loading can outlast ordinary in-game scene transitions.
      await waitFor("document.querySelector('canvas') !== null", 300);
      await evaluate(`(async () => { const entry = document.querySelector('script[type="module"][src*="/src/main.ts"]');
        window.smash = (await import(entry.src)).game; })()`);
      await waitFor("smash.scene.isActive('MenuScene')"); await sleep(350);
      assert.equal(mainLoader,loader,'Document changed while attaching');
      attachedLoader=loader;
    };
    await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await send('Page.navigate', { url: process.env.SMASH_TEST_URL ?? 'http://127.0.0.1:5173/' });
    await attach();
    return { send, evaluate, waitFor, tap, click, attach, errors, close };
  } catch (error) { close(); throw error; }
}
