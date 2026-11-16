import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const b=await browserSession(),out=process.env.SMASH_DESERT_OUT??'artifacts/desert-emperor-20261113';
try{
 await b.click('MenuScene','new-run');await b.waitFor("smash.scene.isActive('GameScene')");
 const actual=await b.evaluate(`(async()=>{
 const gs=smash.scene.getScene('GameScene');window.gs=gs;gs.scene.pause();gs.clearEncounter();gs.bannerContainer.setVisible(false);gs.progression.index=5;
 const {RoomGridManager}=await import('/src/systems/RoomGridManager.ts');gs.gridManager=new RoomGridManager(gs.progression.current);
 const room=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS');gs.gridManager.restoreCurrentRoom(room.id);gs.drawArenaForRoom(room);
 gs.currentWave=1;gs.totalWavesInRoom=1;gs.roomState='LOCKED_WAVES';gs.refreshHud();
 const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300);boss.applyBossProfile(gs.progression.current.bossId);window.boss=boss;
 gs.squad.setPositionImmediate(360,630);gs.squad.health.maxHp=gs.squad.health.currentHp=100000;gs.squad.health.invulnerableUntil=0;
 const {planBossAttack}=await import('/src/config/bossData.ts');const p=planBossAttack(boss.bossId,2,0,boss,{x:360,y:630});
 const calls=[],real=gs.resolveHazard.bind(gs);gs.hazards.resolve=(...a)=>{calls.push(a);real(...a);};
 boss.windUpBossCast(1200);for(const a of p.attacks)gs.hazards.add(a.kind,a.x,a.y,10,boss.lifeId,{...a,bossId:boss.bossId});
 gs.hazards.update(1199);const early=calls.length;gs.hazards.update(1);gs.bossVfx.update(180);gs.hazards.update(180);
 const slot=gs.bossVfx.slots.find(s=>s?.active),f=slot.floor;
 return {id:boss.bossId,stage:gs.progression.current.index,early,hits:calls.length,plan:p,texture:f.texture.key,width:f.displayWidth,x:f.x,y:f.y,frame:boss.bossVisual.frame.name,actorTexture:boss.bossVisual.texture.key,physicalRadius:boss.body.radius};
 })()`);
 assert.equal(actual.id,'desert_emperor');assert.equal(actual.stage,5);assert.equal(actual.early,0);assert.equal(actual.hits,4);assert.equal(actual.texture,'boss_ground_hd_sand');assert.equal(actual.width,180);assert.equal(actual.actorTexture,'desert_motion_v3');assert.equal(actual.frame,'desert_emperor_motion_12');assert.ok(actual.physicalRadius>0);
 for(const width of [720,360]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(100);const png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/game-${width}.png`,Buffer.from(png.data,'base64'));}
 await b.evaluate('gs.hazards.update(2400);gs.bossVfx.update(2400);undefined');assert.equal(await b.evaluate('gs.bossVfx.activeCount'),0);
 assert.deepEqual(b.errors,[]);await writeFile(`${out}/native-result.json`,JSON.stringify(actual,null,2));console.log('Desert emperor native GameScene, actual hazard callbacks, cleanup and 720/360 screenshots passed.');
}finally{b.close();}
