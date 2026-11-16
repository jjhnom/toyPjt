import type Phaser from 'phaser';
import type {BossId,BossPattern} from '../types/game';
import type {Enemy} from '../entities/Enemy';
import type {HazardView,HazardVisualSink} from '../entities/EncounterHazards';
import {BOSS_ATLAS,BOSS_VISUALS,bossEffectFor,bossEffectFrame,bossFieldEffectFor} from '../config/bossVisualData';
import type {BossEffect} from '../config/bossVisualData';
import {BOSS_VFX_ATLAS,BOSS_VFX_MOTIONS,bossVfxFrameIndex,bossVfxFade} from '../config/bossVfxMotionData';
import {placeBossArea,prepareBossGroundTextures,bossGroundAtlas} from './bossAreaGeometry';
import {prepareForestSlamTextures,forestSlamVisual,forestSlamFrameIndex,forestSlamCoreFrame,forestSlamDebrisAtlas,placeForestSlamDebris} from './forestSlamVfx';
import {LAVA_METEOR,prepareLavaMeteorTextures,renderLavaMeteor} from './lavaMeteorVfx';
import {TWILIGHT_METEOR_ATLAS,prepareTwilightMeteorTextures} from './twilightMeteorVfx';
import {prepareBossAreaQuality,bossAreaQualityReady,renderBossAreaQuality} from './bossAreaQuality';

interface VisualSlot {
  active:boolean;released:boolean;elapsed:number;state:HazardView;source:Enemy;
  floor:Phaser.GameObjects.Image;flare:Phaser.GameObjects.Image;
  swirls?:[Phaser.GameObjects.Image,Phaser.GameObjects.Image,Phaser.GameObjects.Image];
  shape:Phaser.GameObjects.Graphics;mask:Phaser.Display.Masks.GeometryMask;
  detail:Phaser.GameObjects.Graphics;
}
interface Arrival {active:boolean;age:number;id:BossId;image:Phaser.GameObjects.Image}

/** Fixed hazard-index visuals. It observes combat deadlines and never owns damage or a timer. */
export class BossVfxController implements HazardVisualSink {
  private readonly slots:(VisualSlot|undefined)[]=Array(32);
  private readonly arrivals:Arrival[]=[];
  private aura?:Phaser.GameObjects.Image;
  private phaseSource?:Enemy;
  private phaseLife=0;
  private phase=1;
  private phaseLeft=0;
  private readonly animated:boolean;

  constructor(private readonly scene:Phaser.Scene,private readonly findSource:(life:number)=>Enemy|undefined){
    this.animated=scene.textures.exists(BOSS_VFX_ATLAS);
    prepareBossAreaQuality(scene);
    if(!bossAreaQualityReady(scene)){
      prepareBossGroundTextures(scene);
      prepareForestSlamTextures(scene);
      prepareLavaMeteorTextures(scene);
      prepareTwilightMeteorTextures(scene);
    }
  }

  public get activeCount():number {return this.slots.reduce((n,s)=>n+(s?.active?1:0),0)+this.arrivals.filter(a=>a.active).length+(this.phaseLeft>0?1:0);}

  private image(name:string,depth:number):Phaser.GameObjects.Image {
    return this.scene.add.image(0,0,this.animated?BOSS_VFX_ATLAS:BOSS_ATLAS,'forest_guardian_cast_0').setVisible(false)
      .setOrigin(.5,76/96).setDepth(depth).setName(name);
  }

  public start(index:number,state:HazardView):void {
    const previous=this.slots[index];if(previous)this.hide(previous);
    if(!state.bossId||!this.scene.textures.exists(BOSS_ATLAS))return;
    const source=this.findSource(state.sourceLife);if(!source)return;
    let slot=this.slots[index];
    if(!slot){
      const shape=this.scene.add.graphics().setVisible(false),mask=shape.createGeometryMask();
      const detail=this.scene.add.graphics().setDepth(20).setVisible(false).setMask(mask);
      slot={active:false,released:false,elapsed:0,state,source,shape,mask,detail,
        floor:this.image('boss-vfx-floor',19),flare:this.image('boss-vfx-impact',34)};
      slot.floor.setMask(mask);slot.flare.setMask(mask);this.slots[index]=slot;
    }
    if(state.bossId==='desert_emperor'&&this.scene.textures.exists('boss_ground_hd_sand')&&!slot.swirls)
      slot.swirls=[slot.flare,this.image('boss-sand-swirl-1',34),this.image('boss-sand-swirl-2',34)];
    slot.flare.setDepth(34);
    slot.active=true;slot.released=false;slot.elapsed=0;slot.state=state;slot.source=source;
    slot.floor.setVisible(false).setMask(slot.mask);slot.flare.setVisible(false).setMask(slot.mask);slot.shape.clear().fillStyle(0xffffff);
    if(state.fromX!==null&&state.fromY!==null){
      slot.shape.lineStyle(state.radius*2,0xffffff).lineBetween(state.fromX,state.fromY,state.x,state.y)
        .fillCircle(state.fromX,state.fromY,state.radius).fillCircle(state.x,state.y,state.radius);
    }else slot.shape.fillCircle(state.x,state.y,state.radius);
  }

  private show(image:Phaser.GameObjects.Image,id:BossId,kind:BossEffect,progress:number,loop=false,ground=false):boolean {
    const animated=this.animated&&!!BOSS_VFX_MOTIONS[id][kind];
    const sourceAtlas=animated?BOSS_VFX_ATLAS:BOSS_ATLAS;
    const count=animated?BOSS_VFX_MOTIONS[id][kind]:BOSS_VISUALS[id].effects[kind];if(!count){image.setVisible(false);return false;}
    const index=bossVfxFrameIndex(progress,count,loop);
    const frame=bossEffectFrame(id,kind,index);
    const groundAtlas=bossGroundAtlas(this.animated);
    const atlas=ground&&this.scene.textures.exists(groundAtlas)&&this.scene.textures.get(groundAtlas).has(frame)?groundAtlas:sourceAtlas;
    if(!this.scene.textures.get(atlas).has(frame)){image.setVisible(false);return false;}
    if(image.texture.key!==atlas||image.frame.name!==frame)image.setTexture(atlas,frame);
    image.setVisible(true).clearTint().setRotation(0).setFlipX(false).setCrop();return true;
  }

  public draw(index:number,state:HazardView,impact:boolean):void {
    const slot=this.slots[index];if(!slot?.active)return;
    if(impact)slot.source.showBossImpact();
    this.render(slot,state.age);
  }

  private render(slot:VisualSlot,age:number):void {
    const {state,floor,flare,source}=slot,id=state.bossId;
    if(!id||!source.active||source.lifeId!==state.sourceLife){this.hide(slot);return;}
    const r=state.radius,after=age-state.warningMs;
    floor.setVisible(false);flare.setVisible(false);
    if(slot.swirls)for(const swirl of slot.swirls)swirl.setVisible(false);
    slot.detail.clear().setVisible(false);
    const qualityAlpha=slot.released?bossVfxFade(slot.elapsed,this.slotTailMs(slot)):1;
    if(renderBossAreaQuality(this.scene,slot,state,age,qualityAlpha))return;
    if(id==='lava_colossus'&&state.kind==='METEOR'&&renderLavaMeteor(this.scene,floor,flare,state,age))return;
    if(id==='twilight_king'&&state.kind==='METEOR'&&renderLavaMeteor(this.scene,floor,flare,state,age,TWILIGHT_METEOR_ATLAS))return;
    if(after<0){
      const progress=age/state.warningMs;
      if(progress>.65&&(id==='lava_colossus'||id==='twilight_king')&&state.kind==='METEOR'){
        const u=(progress-.65)/.35,fall=u*u;
        this.show(flare,id,'fall',u);
        flare.setOrigin(.5).setPosition(state.x+r*.35*(1-fall),state.y-r*.35*(1-fall))
          .setDisplaySize(r*(.85+.55*u),r*(.85+.55*u)).setAlpha(.3+.55*u);
      }else if(this.animated&&progress>.65){
        const u=(progress-.65)/.35;this.show(flare,id,'cast',u);
        flare.setOrigin(.5,76/96).setPosition(state.fromX??state.x,(state.fromY??state.y)+r*.25)
          .setDisplaySize(r*1.4,r*1.4).setAlpha(.25*u);
      }
      return;
    }
    const alpha=slot.released?bossVfxFade(slot.elapsed,this.tailMs(state.kind)):1;
    if(id==='forest_guardian'&&state.kind==='METEOR'){
      const config=forestSlamVisual(this.animated),index=forestSlamFrameIndex(this.animated,after),frame=forestSlamCoreFrame(index);
      if(this.scene.textures.exists(config.atlas)&&this.scene.textures.get(config.atlas).has(frame)){
        floor.setTexture(config.atlas,frame).setCrop().setOrigin(.5).setPosition(state.x,state.y)
          .setDisplaySize(r*2,r*2).setAlpha(.9*alpha).setVisible(true);
        if(this.scene.textures.exists(forestSlamDebrisAtlas(this.animated))){
          flare.clearTint().setRotation(0).setFlipX(false);
          placeForestSlamDebris(flare,this.animated,index,state.x,state.y,r);
          flare.setVisible(true).setAlpha(.75*alpha);
        }
        return;
      }
    }
    if(state.kind==='CHARGE'){
      this.show(flare,id,'charge',this.animated?after/600:after/75,!this.animated);
      flare.setOrigin(.5,76/96).setPosition(source.x,source.y+30).setDisplaySize(132,88).setAlpha(.65*alpha)
        .setFlipX(source.bossVisual?.flipX??false);
      return;
    }
    const kind=state.kind as BossPattern;
    const fieldAlpha=this.animated?Math.min(1,.25+after/120)*Math.min(1,Math.max(0,(state.duration-after)/150)):1;
    if(kind==='POISON'){
      this.show(floor,id,bossFieldEffectFor(id,kind),after/180,true,true);
      placeBossArea(floor,this.animated,id,bossFieldEffectFor(id,kind),state.x,state.y,r,true);
      floor.setAlpha(.75*alpha*fieldAlpha);
      if(this.animated&&after<320){
        this.show(flare,id,'impact',after/320);
        placeBossArea(flare,this.animated,id,'impact',state.x,state.y,r);
        flare.setAlpha(.65*bossVfxFade(after,320));
      }else if(!this.animated&&id==='swamp_lord'){
        this.show(flare,id,'cast',after/200,true);
        placeBossArea(flare,this.animated,id,'cast',state.x,state.y,r);
        flare.setAlpha(.4*alpha);
      }
    }else if(kind==='FROST'){
      this.show(floor,id,bossFieldEffectFor(id,kind),after/180,true,true);
      placeBossArea(floor,this.animated,id,bossFieldEffectFor(id,kind),state.x,state.y,r,true);
      floor.setAlpha(.7*alpha*fieldAlpha);
      const impactMs=this.animated?360:300;
      if(after<impactMs){
        this.show(flare,id,bossEffectFor(id,kind),after/impactMs);
        placeBossArea(flare,this.animated,id,bossEffectFor(id,kind),state.x,state.y,r);
        flare.setAlpha(.85*bossVfxFade(after,impactMs));
      }
    }else{
      this.show(flare,id,bossEffectFor(id,kind),Math.min(1,after/(this.animated?(kind==='SUMMON'?360:480):280)));
      placeBossArea(flare,this.animated,id,bossEffectFor(id,kind),state.x,state.y,r);
      flare.setAlpha(.9*alpha);
      if(id==='lava_colossus'||this.animated&&id==='forest_guardian'){
        this.show(floor,id,'field',after/(this.animated?480:280),false,true);
        placeBossArea(floor,this.animated,id,'field',state.x,state.y,r,true);
        floor.setAlpha(.6*alpha);
      }
    }
  }

  public end(index:number,state:HazardView):void {
    const slot=this.slots[index];if(!slot?.active)return;
    if(state.kind==='POISON'||state.kind==='FROST'){this.hide(slot);return;}
    slot.released=true;slot.elapsed=0;
  }

  private hide(slot:VisualSlot):void {
    slot.active=false;slot.floor.setVisible(false);slot.flare.setVisible(false);slot.detail.clear().setVisible(false);
    if(slot.swirls)for(const swirl of slot.swirls)swirl.setVisible(false);
  }
  private tailMs(kind:string):number{return kind==='CHARGE'?600:this.animated&&kind==='SUMMON'?420:260;}
  private slotTailMs(slot:VisualSlot):number {
    return (slot.state.bossId==='lava_colossus'||slot.state.bossId==='twilight_king')&&slot.state.kind==='METEOR'
      ?Math.max(0,LAVA_METEOR.endMs-(slot.state.age-slot.state.warningMs)):this.tailMs(slot.state.kind);
  }

  public phaseChanged(source:Enemy,phase:number):void {
    if(this.phaseLife!==source.lifeId){this.phaseLife=source.lifeId;this.phase=phase;this.phaseLeft=0;this.aura?.setVisible(false);return;}
    if(phase===this.phase||!source.bossId)return;
    this.phase=phase;this.phaseLeft=700;this.phaseSource=source;
    this.aura??=this.image('boss-phase-aura',19.5);
  }

  public spawnArrived(id:BossId,x:number,y:number):void {
    if(!this.scene.textures.exists(BOSS_ATLAS))return;
    let arrival=this.arrivals.find(a=>!a.active);
    if(!arrival&&this.arrivals.length<4){arrival={active:false,age:0,id,image:this.image('boss-summon-arrival',19.5)};this.arrivals.push(arrival);}
    if(!arrival)return;
    arrival.active=true;arrival.age=0;arrival.id=id;
    arrival.image.setPosition(x,y+16).setOrigin(.5,76/96).setDisplaySize(84,84);
    this.show(arrival.image,id,'summon',0);
  }

  public update(delta:number):void {
    try{this.updateVisuals(delta);}catch{try{this.clear();}catch{/* Cosmetic failures cannot interrupt the combat update. */}}
  }

  private updateVisuals(delta:number):void {
    for(const slot of this.slots)if(slot?.active){
      if(!slot.source.active||slot.source.lifeId!==slot.state.sourceLife){this.hide(slot);continue;}
      if(slot.released){slot.elapsed+=delta;if(slot.elapsed>=this.slotTailMs(slot))this.hide(slot);else this.render(slot,slot.state.age+slot.elapsed);}
    }
    for(const arrival of this.arrivals)if(arrival.active){
      const lifetime=this.animated?360:280;
      arrival.age+=delta;if(arrival.age>=lifetime){arrival.active=false;arrival.image.setVisible(false);}
      else{this.show(arrival.image,arrival.id,'summon',arrival.age/lifetime);arrival.image.setAlpha(.7*bossVfxFade(arrival.age,lifetime));}
    }
    if(this.phaseLeft>0&&this.aura){
      this.phaseLeft=Math.max(0,this.phaseLeft-delta);const source=this.phaseSource;
      if(!source?.active||source.lifeId!==this.phaseLife||!source.bossId){this.phaseLeft=0;this.aura.setVisible(false);return;}
      this.show(this.aura,source.bossId,BOSS_VISUALS[source.bossId].effects.cast?'cast':'summon',(700-this.phaseLeft)/700);
      this.aura.setPosition(source.x,source.y+32).setDisplaySize(150,88).setAlpha(.5*this.phaseLeft/700).setVisible(this.phaseLeft>0);
    }
  }

  public clear():void {
    for(const slot of this.slots)if(slot)this.hide(slot);
    for(const arrival of this.arrivals){arrival.active=false;arrival.image.setVisible(false);}
    this.phaseLeft=0;this.phaseLife=0;this.aura?.setVisible(false);
  }

  public destroy():void {
    this.clear();for(const slot of this.slots)if(slot){slot.floor.destroy();slot.flare.destroy();slot.detail.destroy();slot.mask.destroy();slot.shape.destroy();if(slot.swirls)for(let i=1;i<3;i++)slot.swirls[i].destroy();}
    for(const arrival of this.arrivals)arrival.image.destroy();this.aura?.destroy();
  }
}
