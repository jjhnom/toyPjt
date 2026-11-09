import Phaser from 'phaser';
import {codexManager} from '../systems/CodexManager';
import {BOSS_IDS,BOSS_PROFILES} from '../config/bossData';
import {UNIT_TYPES,ELEMENT_NAMES,ROLE_NAMES} from '../config/unitData';
import {DRONE_SPECS} from '../config/gameData';
import {COMBINATION_RECIPES} from '../config/squadData';
import {UNIT_SKILL_DESCRIPTIONS} from '../config/skillData';
import {unitPortrait,enemyTexture} from '../ui/pixelCharacters';
import {FANTASY,fantasyButton,pixelPanel} from '../ui/fantasyTheme';
import type {IngredientSpec} from '../types/game';

export class CodexScene extends Phaser.Scene {
  private tab:'units'|'bosses'='units';
  private page=0;
  private closed=false;
  constructor(){super('CodexScene');}
  public create():void {this.input.enabled=true;this.tab='units';this.page=0;this.closed=false;codexManager.flush();this.render();}
  private text(x:number,y:number,value:string,size=20,color=FANTASY.cream){return this.add.text(x,y,value,
    {fontFamily:FANTASY.font,fontSize:`${size}px`,resolution:2,color,wordWrap:{width:580}});}
  private ingredient(item:IngredientSpec):string {
    if(item.kind!=='query')return `${UNIT_TYPES[item.unitTypeId].name}×${item.count}`;
    return `${item.element?ELEMENT_NAMES[item.element]:''}${item.role?ROLE_NAMES[item.role]:''} T${item.minTier??1}~${item.maxTier??4}×${item.count}`;
  }
  private render():void {
    this.children.removeAll(true);const discovery=codexManager.snapshot();
    this.add.rectangle(360,640,720,1280,0x080c16,0.98).setInteractive();
    pixelPanel(this,24,28,672,144,FANTASY.panel,FANTASY.gold);
    this.text(48,48,'원정 도감',32).setName('codex-title');
    this.text(48,99,`유닛 획득 ${discovery.units.length}/${Object.keys(UNIT_TYPES).length} · 보스 토벌 ${discovery.bosses.length}/${BOSS_IDS.length}`,21,'#d9c287').setName('codex-count');
    this.text(48,137,discovery.status==='invalid'?'기존 기록을 읽지 못했습니다 · 원본 유지/이번 접속 기록만 표시'
      :discovery.status==='unavailable'||discovery.pending?'기록 저장 실패 · 이번 접속 기록은 유지/재접속 시 유실 가능'
      :'발견 기록은 새 모험에도 유지 · 능력치/재화 보상 없음',14,'#b6c0c8').setName('codex-status');
    (['units','bosses'] as const).forEach((tab,i)=>fantasyButton(this,195+i*330,215,300,54,
      `${this.tab===tab?'● ':''}${tab==='units'?'유닛·조합법':'보스·회피 요령'}`,()=>{this.tab=tab;this.page=0;this.render();},
      {fontSize:23,selected:this.tab===tab}).setName(`codex-${tab}`));
    const entries=this.tab==='units'?Object.values(UNIT_TYPES):BOSS_IDS;
    const pages=Math.ceil(entries.length/4);this.page=Math.min(this.page,pages-1);
    if(this.tab==='units')Object.values(UNIT_TYPES).slice(this.page*4,this.page*4+4).forEach((unit,i)=>{
      const y=270+i*192,known=discovery.units.includes(unit.id),weapon=DRONE_SPECS[unit.id];pixelPanel(this,36,y,648,180);
      this.add.image(88,y+48,unitPortrait(unit.id)).setDisplaySize(68,68).setAlpha(known?1:0.3);
      this.text(139,y+13,`T${unit.tier} ${unit.name} · ${known?'획득':'미획득'}`,22).setName(`codex-unit-${unit.id}`);
      this.text(139,y+48,`${unit.elements.map(e=>ELEMENT_NAMES[e]).join('/')} · ${ROLE_NAMES[unit.role]} · ★1 HP ${unit.maxHp} / 공격 ${weapon.damage}`,16,'#b6c0c8').setWordWrapWidth(510);
      this.text(56,y+89,UNIT_SKILL_DESCRIPTIONS[unit.id],16,'#cfb7ff').setWordWrapWidth(600).setName(`codex-skill-${i}`);
      const recipe=COMBINATION_RECIPES.find(r=>r.kind!=='promotion'&&r.resultUnitTypeId===unit.id);
      const acquisition=[unit.summonable?`지정 소환 ${unit.summonCost}◆${unit.tier>=3?' · S3부터':''}`:'',
        recipe?`조합: ${recipe.ingredients.map(item=>this.ingredient(item)).join(' + ')}${recipe.cost?` + ${recipe.cost}◆`:''}`:''].filter(Boolean).join('\n');
      this.text(56,y+122,acquisition,16,'#d9c287').setWordWrapWidth(600).setName(`codex-acquisition-${i}`);
    });
    else BOSS_IDS.slice(this.page*4,this.page*4+4).forEach((id,i)=>{
      const y=270+i*192,profile=BOSS_PROFILES[id],known=discovery.bosses.includes(id);pixelPanel(this,36,y,648,180);
      this.add.image(88,y+47,enemyTexture('BOSS_CORE')).setDisplaySize(66,66).setTint(profile.color).setAlpha(known?1:0.35);
      this.text(139,y+17,`${profile.name} · ${known?'토벌':'미토벌'}`,23).setName(`codex-boss-${id}`);
      this.text(139,y+55,`예고 ${profile.warningMs/1000}초 · 기본 간격 ${profile.intervalMs/1000}초`,17,'#b6c0c8');
      this.text(56,y+101,profile.hint,19,'#d9c287').setWordWrapWidth(595).setLineSpacing(6);
    });
    fantasyButton(this,150,1095,190,54,'이전',()=>{this.page--;this.render();},{enabled:this.page>0,fontSize:22}).setName('codex-prev');
    this.text(320,1082,`${this.page+1} / ${pages}`,22);
    fantasyButton(this,570,1095,190,54,'다음',()=>{this.page++;this.render();},{enabled:this.page+1<pages,fontSize:22}).setName('codex-next');
    fantasyButton(this,360,1175,600,62,'도감 닫기',()=>{if(this.closed)return;this.closed=true;this.input.enabled=false;this.scene.stop();},
      {fontSize:25,primary:true}).setName('codex-close');
  }
}
