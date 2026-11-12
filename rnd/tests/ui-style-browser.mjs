import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const output='artifacts/ui-style-20261111',b=await browserSession(),{evaluate,send,tap}=b;
const report={status:'running',screenshots:[]};
const shot=async name=>{const png=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(`${output}/${name}.png`,Buffer.from(png.data,'base64'));report.screenshots.push(name+'.png');};
try{
  await mkdir(output,{recursive:true});
  report.icons=await evaluate(`(async()=>{
    const {fantasyButton,pixelPanel,uiIcon,fantasyRibbon,DESIGN_TOKENS:T,FANTASY,PIXEL_ICON_KINDS}=await import('/src/ui/fantasyTheme.ts');
    const {squadCard}=await import('/src/ui/squadArt.ts');
    const s=smash.scene.getScene('MenuScene');s.tweens.killAll();
    window.styleOverlay=s.add.container(0,0).setDepth(1000);
    const add=o=>{styleOverlay.add(o);return o;};
    add(s.add.rectangle(360,640,720,1280,T.background.base).setInteractive());
    const text=(x,y,value,size=24,color=FANTASY.cream)=>add(s.add.text(x,y,value,{
      fontFamily:FANTASY.font,fontSize:size+'px',fontStyle:'bold',color,resolution:2}).setOrigin(.5));
    text(360,44,'UI 컴포넌트 · 스타일 검수',34,'#ffe9aa');
    text(360,88,'실제 Phaser 버튼 / 팔레트 / 패널 / 아이콘',20,FANTASY.muted);
    const colors=[['배경',T.background.base],['패널',T.surface.panel],['보조',T.surface.raised],['마법',T.accent.magic],
      ['냉기',T.accent.ice],['화염',T.accent.fire],['주요',T.accent.gold],['회복',T.accent.heal]];
    add(pixelPanel(s,24,116,672,112));
    colors.forEach(([name,c],i)=>{const x=72+i*82;add(s.add.rectangle(x,147,62,32,c));
      text(x,180,name,18);text(x,207,'#'+c.toString(16).padStart(6,'0').toUpperCase(),12,FANTASY.muted);});
    text(360,259,'주요 / 보조 / 선택 / 비활성',23,'#ffe9aa');
    window.styleCounts={primary:0,secondary:0,selected:0,normal:0,disabled:0};
    const rows=[['primary',190,330,'원정 출발',{primary:true,icon:'swords'}],['secondary',530,330,'조합하기',{icon:'merge'}],
      ['selected',190,452,'소환',{selected:true,icon:'summon'}],['normal',530,452,'편성',{icon:'helmet'}],
      ['disabled',190,574,'마력석 부족',{primary:true,enabled:false,icon:'lock'}],['disabled2',530,574,'잠금 상태',{enabled:false,icon:'lock'}]];
    rows.forEach(([id,x,y,label,options])=>add(fantasyButton(s,x,y,288,92,label,()=>styleCounts[id in styleCounts?id:'disabled']++,
      {...options,fontSize:28,hitHeight:108}).setName('style-'+id)));
    text(360,661,'패널 / 타이틀 / 티어 프레임',23,'#ffe9aa');
    add(fantasyRibbon(s,360,721,620,'원정대 상세 정보',30));
    add(pixelPanel(s,32,777,656,112));text(360,814,'보라색 바탕 · 이중 테두리 · 금색 코너',26);
    text(360,861,'장식은 입력을 가리지 않습니다',21,FANTASY.muted);
    for(let i=0;i<4;i++){const x=36+i*168;add(squadCard(s,x,924,144,112,i+1,i===3));
      add(uiIcon(s,i===0?'helmet':i===1?'summon':i===2?'merge':'relic',x+72,958,36));
      text(x+72,1009,'T'+(i+1)+(i===3?' · 선택':''),20);}
    text(360,1071,'공통 픽셀 아이콘 17종',22,'#ffe9aa');
    PIXEL_ICON_KINDS.forEach((kind,i)=>{const x=48+i%9*78,y=1120+Math.floor(i/9)*82;
      add(uiIcon(s,kind,x,y,36));text(x,y+32,kind,12,FANTASY.muted);});
    return PIXEL_ICON_KINDS;
  })()`);
  assert.equal(report.icons.length,17);await shot('components-720');
  report.contrast=await evaluate(`(async()=>{
    const {DESIGN_TOKENS:T}=await import('/src/ui/fantasyTheme.ts');
    const rgb=c=>typeof c==='string'?parseInt(c.slice(1),16):c;
    const channels=c=>[rgb(c)>>16&255,rgb(c)>>8&255,rgb(c)&255];
    const lum=c=>channels(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
      .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const blend=(a,b,t)=>channels(a).map((v,i)=>Math.round(v*(1-t)+channels(b)[i]*t)).reduce((c,v)=>c*256+v,0);
    const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    return{panel:contrast(T.text.primary,T.surface.panel),primary:contrast(T.text.onPrimary,T.material.goldLow),
      secondary:contrast(T.text.primary,blend(T.surface.raised,T.material.violetMid,.5)),
      selected:contrast(T.text.selected,blend(T.accent.magic,T.material.violetLight,.25)),
      disabled:contrast(T.state.disabledText,T.state.disabledFill)};
  })()`);
  for(const [name,ratio]of Object.entries(report.contrast))assert.ok(ratio>=4.5,name+': '+ratio);
  const bounds=()=>evaluate("(()=>{const r=styleOverlay.getByName('style-primary').getByName('hit').getBounds();return{x:r.x,y:r.y,width:r.width,height:r.height};})()");
  const before=await bounds(),rect=await evaluate('smash.canvas.getBoundingClientRect().toJSON()');
  const touch=(type,x=190,y=330)=>send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchStart'||type==='touchMove'?
    [{x:rect.x+x*rect.width/720,y:rect.y+y*rect.height/1280}]:[]});
  await touch('touchStart');
  assert.equal(await evaluate("styleOverlay.getByName('style-primary').getByName('label').y"),2);
  assert.deepEqual(await bounds(),before);await shot('components-pressed-720');
  await touch('touchCancel');await sleep(100);
  report.cancelLabelY=await evaluate("styleOverlay.getByName('style-primary').getByName('label').y");
  assert.equal(report.cancelLabelY,0,'Cancelled touch must release the pressed appearance');
  await tap(190,574);await tap(530,574);assert.equal(await evaluate('styleCounts.disabled'),0);
  await tap(190,452);assert.equal(await evaluate('styleCounts.selected'),1);
  for(const [width,height]of[[360,640],[320,569],[960,540]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(150);
    await shot('components-'+width+'x'+height);assert.deepEqual(await bounds(),before);
    assert.equal(await evaluate('(()=>{const r=smash.canvas.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;})()'),true);
  }
  report.textFits=await evaluate(`styleOverlay.list.filter(o=>o.list&&o.name.startsWith('style-')).every(c=>{
    const t=c.getByName('label').getBounds(),r=c.getByName('hit').getBounds();return t.left>r.left&&t.right<r.right&&t.top>r.top&&t.bottom<r.bottom;})`);
  assert.equal(report.textFits,true);assert.deepEqual(b.errors,[],JSON.stringify(b.errors));
  report.status='passed';await writeFile(output+'/component-result.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{b.close();}
