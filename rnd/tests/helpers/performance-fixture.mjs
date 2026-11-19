// Shared synthetic load; never changes production balance or update paths.
export async function installPerformanceFixture(evaluate){
 await evaluate(`window.runLoadCase=async function(enemyTarget,bulletTarget,vfx,sampleMs=5000){
  const {planBossAttack}=await import('/src/config/bossData.ts');
  gs.clearEncounter();gs.roomState='LOCKED_WAVES';gs.currentWave=gs.totalWavesInRoom=1;gs.bossPatternLeft=Infinity;
  gs.squad.health.maxHp=gs.squad.health.currentHp=1e9;gs.squad.health.invulnerableUntil=Infinity;
  for(const u of gs.squad.drones){u.health.maxHp=u.health.currentHp=1e9;u.health.invulnerableUntil=Infinity;}
  let boss;
  for(let i=0;i<enemyTarget;i++){
   const e=gs.enemies.spawnEnemy(i===0?'BOSS_CORE':'TANK',100+i%8*70,250+Math.floor(i/8)*85);
   if(!e)throw Error('Enemy fixture pool exhausted');
   e.health.maxHp=e.health.currentHp=1e9;
   if(i===0){boss=e;e.applyBossProfile('frost_queen');e.health.maxHp=e.health.currentHp=1e9;}
  }
  const frame=new Float64Array(4096),cpu=new Float64Array(4096);
  const counts={enemies:{min:Infinity,max:0,sum:0},bulletsBeforeRefill:{min:Infinity,max:0,sum:0},bullets:{min:Infinity,max:0,sum:0},particles:{min:Infinity,max:0,sum:0},bossVfx:{min:Infinity,max:0,sum:0},hazards:{min:Infinity,max:0,sum:0}};
  let recording=false,n=0,last=0,stepStart=0,stepMs=0,nextBarrage=0,added=0;
  const pre=()=>{stepStart=performance.now();},post=()=>{stepMs=performance.now()-stepStart;};
  const maintain=()=>{
   const before=gs.bullets.countActive(true);
   if(before>bulletTarget){let excess=before-bulletTarget;for(const b of gs.bullets.getChildren())if(b.active&&excess-->0)b.deactivate();}
   for(let i=gs.bullets.countActive(true);i<bulletTarget;i++)gs.bullets.fireBullet({x:100+i%8*70,y:220+i%9*85,angle:i*2.399+gs.time.now*.001,speed:420,damage:1,color:0xffffff,aoeRadius:0,slowFactor:1,slowDurationMs:0,pierceCount:1,chainCount:0});
   if(vfx&&gs.time.now>=nextBarrage){
    nextBarrage=gs.time.now+3200;
    for(const a of planBossAttack('frost_queen',2,2,{x:360,y:300,speed:boss.spec.speed},{x:360,y:630}).attacks){if(gs.hazards.add(a.kind,a.x,a.y,1,boss.lifeId,{...a,bossId:'frost_queen',patternId:2}))added++;}
    for(const x of [240,480])if(gs.hazards.add('FROST',x,630,1,boss.lifeId,{radius:85,warningMs:100,durationMs:3000,bossId:'frost_queen'}))added++;
   }
   if(recording){const values=[gs.enemies.countActive(true),before,gs.bullets.countActive(true),gs.particles.countActive(true),gs.bossVfx.activeCount,gs.hazards.slots.reduce((s,h)=>s+Number(h.active),0)];let i=0;for(const c of Object.values(counts)){const value=values[i++];c.min=Math.min(c.min,value);c.max=Math.max(c.max,value);c.sum+=value;}samples++;}
  };
  let samples=0;
  gs.sys.events.on('postupdate',maintain);smash.events.on('prestep',pre);smash.events.on('postrender',post);
  try{
   await new Promise(r=>setTimeout(r,1200));recording=true;
   await new Promise(resolve=>{const tick=t=>{if(last&&n<frame.length){frame[n]=t-last;cpu[n++]=stepMs;}last=t;if(!start)start=t;if(t-start>=sampleMs)resolve();else requestAnimationFrame(tick);};let start=0;requestAnimationFrame(tick);});
   const stats=a=>{const values=Array.from(a.subarray(0,n)).sort((a,b)=>a-b);const avg=values.reduce((s,v)=>s+v,0)/n;return{averageMs:avg,p95Ms:values[Math.ceil(n*.95)-1],maxMs:values[n-1]};};
   for(const c of Object.values(counts)){c.average=c.sum/samples;delete c.sum;}
   return{enemyTarget,bulletTarget,vfx,frames:n,samples,durationMs:frame.subarray(0,n).reduce((a,b)=>a+b,0),fps:1000/stats(frame).averageMs,frameTime:stats(frame),mainThreadStep:stats(cpu),counts,hazardsAdded:added,pools:{enemies:gs.enemies.getLength(),bullets:gs.bullets.getLength(),particles:gs.particles.getLength()},sceneChildren:gs.children.length,visualFailed:gs.hazards.visualFailed};
  }finally{gs.sys.events.off('postupdate',maintain);smash.events.off('prestep',pre);smash.events.off('postrender',post);gs.clearEncounter();gs.roomState='TRANSITION';}
 };undefined;`);
}
