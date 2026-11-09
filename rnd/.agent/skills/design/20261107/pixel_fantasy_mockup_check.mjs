// Browser verification of the isolated design preview; does not load or modify the game.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const source=dirname(fileURLToPath(import.meta.url));
const output=resolve(source,'../../../../artifacts/pixel-fantasy-mockup');
const profile=await mkdtemp(join(tmpdir(),'smash-design-preview-'));
const chrome=spawn(process.env.SMASH_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-gpu','--no-sandbox','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let browserLog='';chrome.stderr.on('data',data=>{browserLog=(browserLog+data.toString()).slice(-3000);});
let socket;
const errors=[],requests=[],report={scope:'isolated HTML design mockup',viewports:[],screenshots:[],checks:[]};
try{
  let port;
  for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert.ok(port,'Chrome debugging port');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let sequence=0;const pending=new Map();
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(new Error(JSON.stringify(m.error)));else p?.resolve(m.result);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},45000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const waitFor=async exp=>{for(let i=0;i<100;i++){if(await evaluate(exp))return;await sleep(80);}throw new Error(`Timed out ${exp}`);};
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await sleep(90);};
  const select=async(selector,value)=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(90);};
  const screenshot=async(name,selector)=>{const clip=selector?await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`):undefined;const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,...(clip?{clip}:{})});await writeFile(join(output,`${name}.png`),Buffer.from(image.data,'base64'));report.screenshots.push(`${name}.png`);};
  await mkdir(output,{recursive:true});
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  report.browser=(await send('Browser.getVersion')).product;
  await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1200,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(join(source,'pixel_fantasy_mockup.html')).href});
  await waitFor("document.documentElement.dataset.ready==='true'");
  await waitFor("Array.from(document.images).every(i=>i.complete)");await sleep(250);
  assert.equal(await evaluate("document.querySelectorAll('[data-screen]').length"),5);
  await screenshot('overview-1920');
  for(const key of ['menu','squad','battle','choice','result']){
    await click(`[data-view="${key}"]`);
    await screenshot(`${key}-360`,`[data-screen="${key}"] .phone-window`);
  }
  for(const width of [320,360,412]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*16/9)+500,deviceScaleFactor:1,mobile:true});
    await select('#preview-size',String(width));
    for(const key of ['menu','squad','battle','choice','result']){
      await click(`[data-view="${key}"]`);
      const layout=await evaluate(`(()=>{const frame=document.querySelector('[data-screen="${key}"] .phone-window');const r=frame.getBoundingClientRect();const small=[...frame.querySelectorAll('button:not(:disabled)')].map(b=>({label:b.textContent.trim(),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})).filter(b=>b.width<43.9||b.height<43.9);return{width:r.width,height:r.height,pageOverflow:document.documentElement.scrollWidth>innerWidth,small};})()`);
      assert.equal(layout.pageOverflow,false,`${key} page overflow at ${width}`);
      assert.ok(Math.abs(layout.width/9*16-layout.height)<1,`${key} 9:16 frame`);
      assert.deepEqual(layout.small,[],`${key} touch targets at ${width}: ${JSON.stringify(layout.small)}`);
      const clipped=await evaluate(`(()=>{const frame=document.querySelector('[data-screen="${key}"] .phone-window').getBoundingClientRect();return[...document.querySelectorAll('[data-screen="${key}"] button:not(:disabled)')].filter(b=>{const r=b.getBoundingClientRect();return r.bottom>frame.bottom+.5||r.left<frame.left-.5||r.right>frame.right+.5;}).map(b=>b.textContent.trim());})()`);
      assert.deepEqual(clipped,[],`${key} actions outside frame at ${width}`);
      if(key==='battle'){
        const dock=await evaluate(`(()=>{const band=document.querySelector('.battle-team'),r=band.getBoundingClientRect(),controls=document.querySelector('.battle-controls').getBoundingClientRect(),button=band.querySelector('.team-detail-trigger').getBoundingClientRect(),slots=[...band.querySelectorAll('.member')].map(el=>el.getBoundingClientRect());return{count:slots.length,overflow:band.scrollWidth>band.clientWidth,aligned:Math.abs(r.bottom-controls.top)<1,overlap:slots.some(s=>s.right>button.left||s.bottom>r.bottom),widthDifference:Math.max(...slots.map(s=>s.width))-Math.min(...slots.map(s=>s.width)),actorCovered:[...document.querySelectorAll('.battle-actor.ally')].some(el=>el.getBoundingClientRect().bottom>r.top)};})()`);
        assert.equal(dock.count,6);assert.equal(dock.overflow,false);assert.equal(dock.aligned,true);
        assert.equal(dock.overlap,false);assert.ok(dock.widthDifference<1);assert.equal(dock.actorCovered,false,'Combat allies stay above the status dock');
        if(width===320)await screenshot('battle-320','[data-screen="battle"] .phone-window');
      }
      report.viewports.push({screen:key,viewport:width,...layout});
    }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1100,deviceScaleFactor:1,mobile:false});await select('#preview-size','360');
  await click('[data-view="squad"]');
  await select('[data-state="squad"]','poor');
  assert.ok(await evaluate("document.querySelector('[data-screen=squad]').textContent.includes('마력석 부족')"));
  assert.equal(await evaluate("document.querySelector('[data-screen=squad] [data-action=summon]').disabled"),true);
  await screenshot('squad-insufficient-360','[data-screen="squad"] .phone-window');
  await select('[data-state="squad"]','full');assert.equal(await evaluate("[...document.querySelectorAll('[data-action=summon]')].every(b=>b.disabled)"),true);
  await select('[data-state="squad"]','normal');await click('[data-action="tab"][data-id="combine"]');await screenshot('squad-recipe-360','[data-screen="squad"] .phone-window');
  await click('[data-action="combine"]');assert.ok(await evaluate("document.querySelector('[data-screen=squad]').textContent.includes('조합 완료')"));
  await click('[data-action="tab"][data-id="roster"]');await screenshot('squad-roster-360','[data-screen="squad"] .phone-window');
  await select('[data-state="squad"]','save');await screenshot('squad-save-failed-360','[data-screen="squad"] .phone-window');
  await select('[data-state="squad"]','stage');await screenshot('squad-stage-complete-360','[data-screen="squad"] .phone-window');
  await click('[data-view="choice"]');await select('[data-state="choice"]','relic');await screenshot('choice-relic-360','[data-screen="choice"] .phone-window');await click('[data-action="choose"]');assert.equal(await evaluate("[...document.querySelectorAll('[data-action=choose]')].every(b=>b.disabled)"),true);
  await screenshot('choice-owned-360','[data-screen="choice"] .phone-window');
  await click('[data-view="battle"]');await select('[data-state="battle"]','dead');await screenshot('battle-dead-360','[data-screen="battle"] .phone-window');await click('[data-action="team-detail"]');assert.ok(await evaluate("document.querySelector('.team-detail').textContent.includes('부활 8초')"));await screenshot('battle-detail-360','[data-screen="battle"] .phone-window');await click('.team-detail [data-action="team-detail"]');
  await click('[data-action="active"]');assert.equal(await evaluate("document.querySelector('[data-action=active]').disabled"),true);
  await click('[data-view="result"]');await select('[data-state="result"]','pending');await screenshot('result-pending-360','[data-screen="result"] .phone-window');await click('[data-action="retry-payment"]');assert.ok(await evaluate("!document.querySelector('[data-screen=result]').textContent.includes('3개 대기')"));
  await select('[data-state="result"]','defeat');await screenshot('result-defeat-360','[data-screen="result"] .phone-window');
  await click('[data-view="menu"]');await click('[data-action="new-run"]');assert.equal(await evaluate("document.querySelector('dialog').open"),true);await click('#dialog-close');
  // Actual touch dispatch validates button hit routing instead of only DOM click calls.
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await click('[data-view="battle"]');
  const point=await evaluate("(()=>{const r=document.querySelector('[data-action=team-detail]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(150);
  assert.equal(await evaluate("document.querySelector('.team-detail')!==null"),true);
  assert.deepEqual(errors,[],'No browser runtime errors');
  assert.equal(requests.some(url=>/^https?:/.test(url)),false,'No remote asset requests');
  report.checks=['5 screens render','15 viewport/screen layouts','44 CSS px button targets','six equal squad slots / dock alignment / unobscured allies','insufficient funds / capacity','recipe transaction / formation','save failure','relic selection single-use','revival detail / active cooldown','payment retry','new-run confirmation','real touch routing','no remote asset requests','no browser runtime errors'];
  report.result='PASS';await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:report.result,layouts:report.viewports.length,screenshots:report.screenshots.length,checks:report.checks,output},null,2));
}catch(error){report.result='FAIL';report.error=String(error);report.browserErrors=errors;report.browserLog=browserLog;await mkdir(output,{recursive:true});await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));throw error;}
finally{socket?.close();chrome.kill();}
