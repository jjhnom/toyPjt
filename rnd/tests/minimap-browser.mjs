import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const phase=process.argv[2]??'after',out=process.env.SMASH_MINIMAP_OUTPUT??'artifacts/minimap-20261112';
const b=await browserSession(),{evaluate,send,click,waitFor}=b,report={phase,status:'running',cases:[],shots:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
  gs.bannerContainer.setVisible(false);undefined;`);
 const shot=async(name,width)=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(160);
  for(const crop of [false,true]){
   const file=phase+'-'+name+'-'+width+(crop?'-map':'')+'.png';
   const png=await send('Page.captureScreenshot',{format:'png',...(crop?{clip:{x:570*width/720,y:0,width:150*width/720,height:108*width/720,scale:1}}:{})});
   await writeFile(out+'/'+file,Buffer.from(png.data,'base64'));report.shots.push(file);
  }
 };
 for(const index of [0,1,3,4]){
  await evaluate(`(async()=>{const {RoomGridManager}=await import('/src/systems/RoomGridManager.ts');
   gs.progression.index=${index};let seed=1212;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   gs.gridManager=new RoomGridManager(gs.progression.current,undefined,random);
   let i=0;for(const row of gs.gridManager.grid)for(const n of row)if(n){n.visited=i%3===0;n.cleared=n.visited&&n.type==='COMBAT';i++;}
   gs.gridManager.getCurrentRoom().visited=true;gs.roomState='CLEARED';
   gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());gs.refreshHud();undefined;})()`);
  const name=await evaluate('gs.progression.current.gridWidth+"x"+gs.progression.current.gridHeight');
  if(phase==='after'){
   const r=await evaluate(`(()=>{
    const snapshot=JSON.stringify(gs.gridManager.grid),g=gs.minimapGraphics;
    const heading=gs.children.getByName('minimap-label').getBounds();gs.drawMinimap();const l=g.getData('minimapLayout');
    return{layout:l,scale:[g.scaleX,g.scaleY],position:[g.x,g.y],headingBottom:heading.bottom,
     unchanged:JSON.stringify(gs.gridManager.grid)===snapshot,current:g.getData('currentRoomId'),expected:gs.gridManager.getCurrentRoom().id};})()`);
   assert.deepEqual(r.scale,[1,1]);assert.deepEqual(r.position,[0,0]);assert.equal(r.unchanged,true);assert.equal(r.current,r.expected);
   const l=r.layout;assert.ok(l.y>r.headingBottom&&l.x>=584&&l.x+l.width<=696&&l.y+l.height<=98);
   assert.ok(Math.abs(l.x+l.width/2-640)<=.5&&Math.abs(l.y+l.height/2-66)<=.5);
   const usage=l.width*l.height/(112*64);assert.equal(l.cellWidth,l.cellHeight);
   report.cases.push({name,...r,usage});
  }
  for(const width of [360,390])await shot(name,width);
 }
 if(phase==='after'){
  const move=await evaluate(`(()=>{
   const gm=gs.gridManager;let found=null;
   for(const row of gm.grid)for(const n of row)if(n?.type==='COMBAT'){
    gm.restoreCurrentRoom(n.id);for(const dir of ['top','bottom','left','right']){
     const next=gm.getAdjacentRoom(dir);if(next?.type==='COMBAT'){found={n,next,dir};break;}}
    if(found)break;
   }
   if(!found)throw Error('No ordinary-room connection in fixture');
   const {n,next,dir}=found;n.visited=true;n.cleared=true;next.visited=false;next.cleared=false;
   gm.restoreCurrentRoom(n.id);gs.roomState='CLEARED';gs.clearEncounter();gs.updateDoorsVisual(n,false);gs.refreshHud();
   const before=gs.minimapGraphics.getData('currentRoomId'),d=gs.doors[dir];
   gs.squad.setPositionImmediate(d.triggerZone.centerX,d.triggerZone.centerY);gs.checkDoorTransition();
   gs.bannerContainer.setVisible(false);
   return{before,after:gs.minimapGraphics.getData('currentRoomId'),target:next.id,visited:next.visited,room:gm.getCurrentRoom().id};})()`);
  assert.notEqual(move.before,move.after);assert.equal(move.after,move.target);assert.equal(move.after,move.room);assert.equal(move.visited,true);report.move=move;
  for(const width of [360,390])await shot('moved',width);
  const enemy=await evaluate(`(()=>{gs.enemies.spawnEnemy('SWARMER',240,340);gs.updateHudVitals();const active=gs.minimapGraphics.getData('hasEnemies');
   for(const e of gs.enemies.getChildren())e.deactivate();gs.updateHudVitals();return{active,cleared:gs.minimapGraphics.getData('hasEnemies')};})()`);
  assert.deepEqual(enemy,{active:true,cleared:false});report.enemy=enemy;
  // Reference-like color/symbol board, drawn independently of the real room graph.
  const legend=await evaluate(`(async()=>{
   const {drawBattleMinimap}=await import('/src/ui/battleMinimap.ts'),snapshot=JSON.stringify(gs.gridManager.grid);
   const rows=[['COMBAT','COMBAT',null,null,null],['COMBAT','COMBAT','COMBAT','COMBAT','COMBAT'],
    ['COMBAT','RECOVERY','COMBAT','EVENT',null],['ELITE','COMBAT','BOSS','COMBAT',null]];
   const grid=rows.map((row,y)=>row.map((type,x)=>type?{id:'legend-'+x+'-'+y,gridX:x,gridY:y,type,visited:true,cleared:false,
    doors:{top:false,bottom:false,left:false,right:false},waveCount:1}:null));
   for(const row of grid)for(const n of row)if(n&&n.type==='COMBAT')n.visited=false;
   drawBattleMinimap(gs.minimapGraphics,grid,2,1,false);
   return{layout:gs.minimapGraphics.getData('minimapLayout'),unchanged:JSON.stringify(gs.gridManager.grid)===snapshot};})()`);
  assert.equal(legend.unchanged,true);report.legend=legend;
  for(const width of [360,390,720])await shot('legend',width);
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(out+'/'+phase+'-result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({phase,status:report.status,shots:report.shots.length}));
}finally{b.close();}
