import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchChrome,sleep} from '../scripts/lib/chrome-cdp.mjs';
const out='artifacts/boss-skill-preview-20261113';
const b=await launchChrome(),{send,evaluate,waitFor}=b,report={cases:[]};
try{
 await mkdir(out,{recursive:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/'});
 await waitFor('!!window.bossPreview');
 const storage=await evaluate('JSON.stringify(localStorage)');
 const bosses=await evaluate("[...document.querySelectorAll('[data-boss]')].map(b=>b.dataset.boss)");
 for(const id of bosses){
  await evaluate(`document.querySelector('[data-boss="${id}"]').click()`);
  const patterns=await evaluate("[...document.querySelectorAll('[data-pattern]')].map(b=>b.dataset.pattern)");
  for(const kind of patterns){
   await evaluate(`document.querySelector('[data-pattern="${kind}"]').click();bossPreview.seek(0)`);
   const result=await evaluate(`(()=>{
    const p=bossPreview,s=p.scene,w=s.hazards.slots.find(h=>h.active).warningMs;
    p.seek(w-1);const warning=s.hazards.slots.filter(h=>h.active).every(h=>!h.resolved);
    p.seek(w+120);const impact=s.vfx.slots.filter(v=>v?.active).some(v=>v.flare.visible||v.floor.visible);
    p.seek(w+600);const field=s.vfx.slots.filter(v=>v?.active).filter(v=>v.floor.visible);
    const aligned=field.every(v=>{const b=v.floor.getBounds(),h=v.state;return Math.abs(b.x-(h.x-h.radius))<.01&&Math.abs(b.width-h.radius*2)<.01;});
    p.seek(p.total);return{warning,impact,aligned,active:s.vfx.activeCount,elapsed:p.elapsed,total:p.total};
   })()`);
   assert.equal(result.warning,true);assert.equal(result.impact,true,`${id}/${kind} visible impact`);assert.equal(result.aligned,true);
   assert.equal(result.active,0);assert.equal(result.elapsed,result.total);
   report.cases.push({id,kind,...result});
  }
 }
 await evaluate(`document.querySelector('[data-boss="twilight_king"]').click();document.querySelector('[data-pattern="FROST"]').click();document.querySelector('[data-jump="field"]').click()`);
 assert.equal(await evaluate("document.getElementById('play').textContent"),'재생');
 const counts=await evaluate(`['earth','poison','ice','fire','dark','binding','frost','void','sand'].map(k=>bossPreview.scene.textures.get('boss_ground_hd_'+k).getFrameNames().length)`);
 assert.deepEqual(counts,[17,24,16,17,17,24,25,17,20]);report.materialFrames=counts;
 for(const width of [1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width===1280?1000:1500,deviceScaleFactor:1,mobile:width===390});await sleep(200);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'page fits viewport');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/preview-${width}.png`,Buffer.from(screenshot.data,'base64'));
 }
 // Slider seeks and pause must hold the selected time, replay and speed must advance.
 await evaluate("document.getElementById('timeline').value='1234';document.getElementById('timeline').dispatchEvent(new Event('input'))");
 await sleep(150);assert.equal(await evaluate('bossPreview.elapsed'),1234);
 await evaluate("document.getElementById('speed').value='0.5';document.getElementById('speed').dispatchEvent(new Event('change'));document.getElementById('replay').click()");
 await sleep(200);assert.ok(await evaluate('bossPreview.elapsed>0&&bossPreview.elapsed<1000'));
 assert.equal(await evaluate('JSON.stringify(localStorage)'),storage,'preview must not write game saves');
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(`${out}/result.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,patterns:report.cases.length,groundFrames:counts,viewports:[1280,390]}));
}finally{b.close();}



