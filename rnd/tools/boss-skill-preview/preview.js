import Phaser from 'phaser';
import {BOSS_IDS,BOSS_PROFILES,planBossAttack} from '../../src/config/bossData.ts';
import {ARENA_BOUNDS,ENEMY_SPECS} from '../../src/config/gameData.ts';
import {BOSS_ART,BOSS_MOTION_ART,BOSS_VFX_ART,DESERT_MOTION_ART,SANDSTORM_ART} from '../../src/ui/bossArt.ts';
import {BOSS_ATLAS} from '../../src/config/bossVisualData.ts';
import {BOSS_VFX_ATLAS} from '../../src/config/bossVfxMotionData.ts';
import {BossMotion,BOSS_MOTION_ATLAS,BOSS_MOTION_ORIGIN_Y,bossMotionFrame,bossMotionAtlas,DESERT_MOTION_ATLAS} from '../../src/ui/BossMotion.ts';
import {SANDSTORM_SOURCE} from '../../src/ui/bossSandstorm.ts';
import {BossVfxController} from '../../src/ui/BossVfxController.ts';
import {EncounterHazards} from '../../src/entities/EncounterHazards.ts';

const $=id=>document.getElementById(id);
const labels={CHARGE:'돌진',METEOR:'낙하 · 강타',POISON:'독 장판',FROST:'빙결 장판',SUMMON:'소환',FISSURE:'지각 분쇄 · 6연속',SPIKES:'사막의 송곳니 · 5연속',SPORES:'맹독 포자탄 · 5발',ROOTS:'가시뿌리 포위',SLASH:'황혼의 참격 · 교차 2연격'};
const selection={id:'twilight_king',sequence:3,phase:2};
const previewTarget={x:360,y:630};
const requested=new URLSearchParams(location.search);
if(BOSS_IDS.includes(requested.get('boss'))){
  selection.id=requested.get('boss');selection.sequence=Math.max(0,BOSS_PROFILES[selection.id].patterns.indexOf(requested.get('pattern')));
}
let scene,playing=true,elapsed=0,total=5000,attacks=[],speed=1;
const refreshControls=()=>{
  for(const button of $('boss-list').children)button.setAttribute('aria-pressed',String(button.dataset.boss===selection.id));
  $('hint').textContent=BOSS_PROFILES[selection.id].hint;
  $('patterns').replaceChildren(...BOSS_PROFILES[selection.id].patterns.map((kind,i)=>{
    const button=document.createElement('button');button.textContent=selection.id==='frost_queen'&&kind==='METEOR'?'빙하 폭격 · 10연속':selection.id==='desert_emperor'&&kind==='POISON'?'사막의 폭풍':selection.id==='twilight_king'&&kind==='FROST'?'암흑 구속':labels[kind];
    button.dataset.pattern=kind;button.setAttribute('aria-pressed',String(i===selection.sequence));
    button.onclick=()=>{selection.sequence=i;refreshControls();restart();};return button;
  }));
};
for(const id of BOSS_IDS){
  const button=document.createElement('button');button.textContent=BOSS_PROFILES[id].name;button.dataset.boss=id;
  button.onclick=()=>{selection.id=id;selection.sequence=0;refreshControls();restart();};$('boss-list').append(button);
}
function sync(){
  $('timeline').value=String(elapsed);$('clock').textContent=`${(elapsed/1000).toFixed(2)} / ${(total/1000).toFixed(2)} s`;
  const warning=attacks[0]?.warningMs??0,end=Math.max(...attacks.map(a=>a.warningMs+a.durationMs)),persistent=['POISON','FROST','ROOTS'].includes(attacks[0]?.kind);
  $('state').textContent=elapsed<warning?'범위 예고':elapsed<warning+320?'스킬 발동':elapsed<end?(persistent?'장판 유지':attacks[0]?.kind==='SLASH'?'교차 참격':attacks[0]?.kind==='SPORES'?'포자탄 비행':attacks[0]?.kind==='FISSURE'||attacks[0]?.kind==='SPIKES'?'연속 분출':'연속 낙하'):elapsed<end+600?'잔상 · 소멸':'종료';
  $('play').textContent=playing?'일시정지':'재생';
}
function restart(){
  if(!scene)return;
  scene.hazards.clear();scene.motion.reset(360,360);scene.source.x=360;scene.source.y=360;
  const plan=planBossAttack(selection.id,selection.phase,selection.sequence,{x:360,y:360,speed:ENEMY_SPECS.BOSS_CORE.speed},previewTarget);
  attacks=plan.attacks;elapsed=0;total=Math.max(...attacks.map(a=>a.warningMs+a.durationMs))+1000;
  for(const a of attacks)scene.hazards.add(a.kind,a.x,a.y,0,1,{...a,bossId:selection.id});
  scene.source.bossId=selection.id;scene.motion.cast(attacks[0].warningMs);
  scene.title.setText(BOSS_PROFILES[selection.id].name);scene.pattern.setText($('patterns').querySelector('[aria-pressed=true]').textContent);
  scene.actor.setTexture(bossMotionAtlas(selection.id),bossMotionFrame(selection.id,4));scene.actor.setPosition(360,360);
  scene.hazards.update(0);$('timeline').max=String(total);
  const radii=[...new Set(attacks.map(a=>a.radius))].join(' / ');
  $('metrics').replaceChildren();
  for(const [name,value]of [['범위 수',`${attacks.length}개`],['실제 반경',`${radii} px`],['예고 시간',`${attacks[0].warningMs} ms`],['공격 지속',`${attacks[0].durationMs} ms`]]){
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;$('metrics').append(dt,dd);
  }
  sync();
}
function step(delta){
  if(!scene||!attacks.length)return;
  const next=Math.min(total,elapsed+delta),dt=next-elapsed,a=attacks[0],after=next-a.warningMs;
  if(a.kind==='CHARGE'&&after>=0){
    const u=Math.min(1,after/600);scene.source.x=a.fromX+(a.x-a.fromX)*u;scene.source.y=a.fromY+(a.y-a.fromY)*u;
  }
  scene.motion.advance(selection.id,dt,scene.source.x,scene.source.y,a.kind==='CHARGE'&&after>=0&&after<600,a.x<(a.fromX??a.x),true);
  scene.vfx.update(dt);scene.hazards.update(dt,previewTarget);
  scene.actor.setTexture(bossMotionAtlas(selection.id),bossMotionFrame(selection.id,scene.motion.frameIndex)).setPosition(scene.source.x,scene.source.y).setFlipX(scene.motion.facingLeft);
  elapsed=next;sync();
}
function seek(time){
  restart();const end=Math.max(0,Math.min(total,time));
  // Replay fixed small steps so warning callbacks, fields and visual tails match continuous playback.
  while(elapsed<end)step(Math.min(16,end-elapsed));sync();
}
$('play').onclick=()=>{if(elapsed>=total)restart();playing=!playing;sync();};
$('replay').onclick=()=>{playing=true;restart();};
$('speed').onchange=()=>{speed=Number($('speed').value);};
$('phase').onchange=()=>{selection.phase=Number($('phase').value);restart();};
$('timeline').oninput=()=>{playing=false;seek(Number($('timeline').value));};
for(const button of document.querySelectorAll('[data-jump]'))button.onclick=()=>{
  if(!scene)return;const w=attacks[0].warningMs,d=attacks[0].durationMs;
  const points={warning:w*.5,impact:w+100,field:w+Math.min(600,d*.65),end:total};playing=false;seek(points[button.dataset.jump]);
};
refreshControls();

class PreviewScene extends Phaser.Scene{
  preload(){
    for(const [key,art]of [[BOSS_ATLAS,BOSS_ART],[BOSS_MOTION_ATLAS,BOSS_MOTION_ART],[BOSS_VFX_ATLAS,BOSS_VFX_ART],[DESERT_MOTION_ATLAS,DESERT_MOTION_ART],[SANDSTORM_SOURCE,SANDSTORM_ART]])this.load.atlas(key,art.image,art.data);
    this.load.on('loaderror',()=>{$('loading').textContent='에셋을 불러오지 못했습니다. 개발 서버 연결을 확인하고 새로고침해 주세요.';});
  }
  create(){
    scene=this;const g=this.add.graphics().setDepth(0),b=ARENA_BOUNDS;
    g.fillStyle(0x12152f).fillRect(0,0,720,1280).fillStyle(0x212337).fillRect(b.left,b.top,b.width,b.height);
    for(let y=b.top;y<b.bottom;y+=40)for(let x=b.left;x<b.right;x+=40){
      g.fillStyle((Math.floor(x/40)+Math.floor(y/40))%2?0x292c42:0x25283d).fillRect(x+1,y+1,38,38);
    }
    g.lineStyle(2,0x6b527e).strokeRect(b.left,b.top,b.width,b.height);
    const font={fontFamily:'Malgun Gothic, sans-serif',color:'#ede6ff',stroke:'#12152f',strokeThickness:3};
    this.title=this.add.text(360,48,'',{...font,fontSize:'30px'}).setOrigin(.5);
    this.pattern=this.add.text(360,98,'',{...font,fontSize:'22px',color:'#ffd966'}).setOrigin(.5);
    this.add.text(360,1170,'BOSS SKILL PREVIEW',{...font,fontSize:'20px',color:'#b69acc'}).setOrigin(.5);
    this.add.text(360,1210,'720 × 1280 · 실시간 이펙트',{...font,fontSize:'18px',color:'#9a8bad'}).setOrigin(.5);
    g.lineStyle(2,0x8d8fa6,.6).strokeCircle(360,630,18).lineBetween(336,630,384,630).lineBetween(360,606,360,654);
    this.add.text(360,668,'고정 표적',{...font,fontSize:'18px',color:'#a9abc2'}).setOrigin(.5);
    this.motion=new BossMotion();
    this.actor=this.add.image(360,360,bossMotionAtlas(selection.id),bossMotionFrame(selection.id,0)).setDisplaySize(144,144).setOrigin(.5,BOSS_MOTION_ORIGIN_Y).setDepth(30);
    this.source={active:true,lifeId:1,bossId:selection.id,x:360,y:360,showBossImpact:()=>this.motion.impact(selection.id==='desert_emperor')};
    this.vfx=new BossVfxController(this,life=>life===1?this.source:undefined);
    this.hazards=new EncounterHazards(this,()=>{},this.vfx);
    this.events.once('shutdown',()=>{this.hazards.clear();this.vfx.destroy();});
    $('loading').hidden=true;for(const id of ['play','replay','timeline'])$(id).disabled=false;restart();
    // Read-only inspection for browser QA; no access to the main game's scenes or saves.
    window.bossPreview={get scene(){return scene;},get selection(){return {...selection};},get elapsed(){return elapsed;},get total(){return total;},seek:time=>{playing=false;seek(time);}};
  }
  update(_time,delta){
    if(!playing)return;
    if(elapsed>=total){if($('loop').checked)restart();else{playing=false;sync();return;}}
    let remaining=Math.min(delta,100)*speed;
    while(remaining>0){const dt=Math.min(16,remaining);step(dt);remaining-=dt;}
  }
}
new Phaser.Game({type:Phaser.AUTO,parent:'preview-canvas',width:720,height:1280,pixelArt:true,roundPixels:true,backgroundColor:'#12152f',audio:{noAudio:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[PreviewScene]});



