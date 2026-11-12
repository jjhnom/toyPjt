import Phaser from 'phaser';
import { FANTASY, pixelPanel, fantasyButton, uiIcon } from '../ui/fantasyTheme';
import { PROVIDED_UI } from '../ui/providedArt';
import { unitPortrait } from '../ui/pixelCharacters';
import { recipeIngredientLines } from '../ui/recipePresentation';
import { DRONE_SPECS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { COMBINATION_RECIPES, SELL_REFUND_PER_TIER, SQUAD_LIMITS, SUMMON_OFFERS, UNIT_MOVEMENT } from '../config/squadData';
import { SquadRoster, matchesIngredient, quickCraftPlans } from '../systems/SquadRoster';
import { soundManager } from '../systems/SoundManager';
import { ELEMENT_NAMES, UNIT_TYPES } from '../config/unitData';
import { squadCard, squadPedestal, squadTierColor } from '../ui/squadArt';
import { UNIT_SKILL_DESCRIPTIONS } from '../config/skillData';
import type { CombinationRecipe, DroneTier, QuickCraftPlan } from '../types/game';
import { UPGRADE_IDS, UPGRADES, upgradeEffectLabel } from '../config/upgradeData';
import { RELIC_IDS, RELICS, RELIC_LIMIT } from '../config/relicData';
import { TALENT_IDS, TALENTS, talentRank } from '../config/heroAbilities';
import type { HeroProgression } from '../systems/HeroProgression';
import { AWAKENING, SERVICES, SIDE_SUPPLY, awakeningConsent } from '../config/expeditionFacilities';
import type { PlayerSquad } from '../entities/PlayerSquad';
import type { RoomNode, ServiceQuote, SupplyChoice } from '../types/game';
import { resolveSynergies, SYNERGY_IDS, SYNERGIES } from '../config/synergyData';

interface SquadSceneData { roster: SquadRoster; hero?: HeroProgression; message: string; onClose: () => void;
  onChanged?: () => boolean; closeLabel?: string; stageSummary?: string; squad?: PlayerSquad;
  supplyRoom?: RoomNode | null; onService?: (quote: ServiceQuote) => boolean; onSupply?: (choice: SupplyChoice) => boolean }

export class SquadScene extends Phaser.Scene {
  private dataSource!: SquadSceneData;
  private tab: 'summon' | 'combine' | 'roster' = 'summon';
  private page = 0;
  private message = '';
  private closed = false;
  private editingRecipe: CombinationRecipe | null = null;
  private selectedIds: string[] = [];
  private pickerPage = 0;
  private availableOnly = false;
  private quickMode = false;
  private upgradeMode = false;
  private relicMode = false;
  private talentMode = false;
  private facilityMode: 'awakening' | 'service' | 'supply' | 'synergy' | null = null;
  private confirmation: { detail: string; confirm: () => void } | null = null;
  private quickTier: DroneTier | null = null;
  private quickQuote: QuickCraftPlan | null = null;
  private selectedUnitId: string | null = null;

  constructor() { super('SquadScene'); }

  public create(data: SquadSceneData): void {
    this.input.enabled = true;
    this.dataSource = data;
    this.tab = 'summon';
    this.page = 0;
    this.message = data.message;
    this.closed = false;
    this.editingRecipe = null;
    this.selectedIds = [];
    this.pickerPage = 0;
    this.availableOnly = false;
    this.quickMode = false;
    this.upgradeMode = false;
    this.relicMode = data.roster.pendingRelicReward() !== null;
    this.talentMode = (data.hero?.pendingTalents() ?? 0) > 0;
    if (this.talentMode) this.relicMode = false;
    this.facilityMode = data.supplyRoom && data.supplyRoom.supplyChoice === undefined ? 'supply' : null;
    this.confirmation = null;
    this.quickTier = null;
    this.quickQuote = null;
    this.selectedUnitId = null;
    this.render();
  }

  private text(x: number, y: number, value: string, size = 20, color = FANTASY.cream): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: FANTASY.font, fontSize: `${size}px`, resolution: 2, fontStyle: 'bold', color, wordWrap: { width: 580 }
    });
  }

  private button(x:number,y:number,width:number,label:string,action:()=>void,enabled=true,height=50):Phaser.GameObjects.Container {
    return fantasyButton(this,x,y,width,height,label,action,{enabled,fontSize:height>=88?26:20,
      primary:y>=1190,icon:y>=1190?'swords':undefined,hitHeight:height>=88?108:height});
  }

  private transact(action: () => boolean, successMessage = '적용 완료', failureMessage = '재료·잔액·공간 또는 출전 제한을 확인하세요'): void {
    if (this.closed) return;
    // Lock this rendered set immediately; a new render shows the committed state.
    this.input.enabled = false;
    const success = action();
    this.message = success ? successMessage : failureMessage;
    if (success && this.dataSource.onChanged?.() === false) this.message += ' · 저장 실패: 이전 저장 지점은 유지됩니다';
    if (success) soundManager.playPowerup();
    this.render();
    this.input.enabled = true;
  }

  private render(): void {
    this.children.removeAll(true);
    const roster = this.dataSource.roster;
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'art_lobby').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.image(360,356,PROVIDED_UI,'night').setDisplaySize(720,164).setName('provided-night');
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x100c21, 0.8).setInteractive();
    pixelPanel(this, 24, 26, GAME_WIDTH - 48, 172, FANTASY.panel, FANTASY.gold);
    uiIcon(this,'book',64,70,36);
    this.text(96,45,this.dataSource.stageSummary??'원정 정비',this.dataSource.stageSummary?23:36,'#ffe5a1').setWordWrapWidth(570);
    this.text(96,88,this.dataSource.stageSummary?'다음 원정을 준비하세요':'동료를 모아, 더 멀리 나아가세요',18,FANTASY.muted);
    const deployedCount = roster.units.filter(unit => unit.deployed).length;
    uiIcon(this,'gem',56,130,26);
    this.text(76,114,`${roster.minerals}   ·   보유 ${roster.units.length}/${SQUAD_LIMITS.owned}   ·   출전 ${deployedCount}/${SQUAD_LIMITS.deployed}`,25,'#f3c64d').setName('squad-resource-summary');
    this.text(44,153,this.message,18,'#d5c3e6').setWordWrapWidth(620).setName('squad-message');
    fantasyButton(this,80,1100,104,88,this.quickMode?'일반\n메뉴':'간편\n제작',()=>{
      this.quickMode = !this.quickMode; this.facilityMode = null; this.upgradeMode = false; this.relicMode = this.talentMode = false; this.quickQuote = null; this.page = 0; this.render();
    },{fontSize:22,selected:this.quickMode,hitWidth:108,hitHeight:108}).setName('quick-craft-open');
    fantasyButton(this,528,1100,104,88,this.facilityMode?'일반\n메뉴':'각성·\n서비스',()=>{
      this.facilityMode = this.facilityMode ? null : 'awakening'; this.quickMode = this.upgradeMode = this.relicMode = this.talentMode = false;
      this.page = 0; this.render();
    },{fontSize:20,selected:!!this.facilityMode,hitWidth:108,hitHeight:108}).setName('facility-open');
    fantasyButton(this,192,1100,104,88,this.upgradeMode?'일반\n메뉴':'원정\n강화',()=>{
      this.upgradeMode = !this.upgradeMode; this.facilityMode = null; this.quickMode = false; this.relicMode = this.talentMode = false; this.quickQuote = null; this.render();
    },{fontSize:22,selected:this.upgradeMode,hitWidth:108,hitHeight:108}).setName('upgrade-open');
    const tabs = [['summon', '소환', 'summon'], ['combine', '조합', 'merge'], ['roster', '편성', 'helmet']] as const;
    tabs.forEach(([tab,title,icon],i)=>fantasyButton(this,145+i*215,228,195,64,title,()=>{
        this.tab = tab; this.page = 0; this.editingRecipe = null; this.facilityMode = null; this.quickMode = false; this.upgradeMode = false; this.relicMode = this.talentMode = false; this.quickQuote = null; this.render();
      },{fontSize:30,icon,hitHeight:108,selected:!this.facilityMode&&!this.quickMode&&!this.upgradeMode&&!this.relicMode&&!this.talentMode&&this.tab===tab}).setName(`squad-tab-${tab}`));

    if (this.facilityMode) {
      this.renderFacilities();
    } else if (this.talentMode) {
      this.renderTalents();
    } else if (this.relicMode) {
      this.renderRelics();
    } else if (this.upgradeMode) {
      this.renderUpgrades();
    } else if (this.quickMode) {
      this.renderQuickCraft();
    } else if (this.tab === 'summon') {
      this.renderSummons();
    } else if (this.tab === 'combine') {
      if (this.editingRecipe) this.renderIngredientPicker(this.editingRecipe);
      else this.renderRecipes();
    } else {
      this.renderRoster();
    }
    const ownedRelics = roster.relicIds().length, pendingRelics = roster.relicRewards.filter(reward => reward.relicId === null).length;
    fantasyButton(this,304,1100,104,88,this.relicMode?'일반\n메뉴'
      :`유물\n${pendingRelics?`대기 ${pendingRelics}`:`${ownedRelics}/${RELIC_LIMIT}`}`,()=>{
      this.relicMode = !this.relicMode; this.facilityMode = null; this.talentMode = this.upgradeMode = this.quickMode = false; this.quickQuote = null; this.render();
    },{fontSize:22,selected:this.relicMode,hitWidth:108,hitHeight:108}).setName('relic-open');
    const hero = this.dataSource.hero, pendingTalents = hero?.pendingTalents() ?? 0;
    fantasyButton(this,416,1100,104,88,this.talentMode?'일반\n메뉴'
      :`재능\n${pendingTalents?`대기 ${pendingTalents}`:`${hero?.talents.length??0}개`}`,()=>{
      this.talentMode = !this.talentMode; this.facilityMode = null; this.relicMode = this.upgradeMode = this.quickMode = false; this.quickQuote = null; this.render();
    },{enabled:!!hero,fontSize:22,selected:this.talentMode,hitWidth:108,hitHeight:108}).setName('talent-open');
    fantasyButton(this,640,1100,104,88,'원정\n도감',()=>{
      if(!this.closed&&!this.confirmation&&!this.scene.isActive('CodexScene'))this.scene.launch('CodexScene');
    },{fontSize:22,hitWidth:108,hitHeight:108}).setName('codex-open');
    this.button(GAME_WIDTH/2,1210,648,this.dataSource.closeLabel??'정비를 마치고 전장으로',()=>{
      const close = () => {
        if (this.closed) return;
        this.closed = true; this.input.enabled = false; this.dataSource.onClose(); this.scene.stop();
      };
      if (this.dataSource.stageSummary && this.dataSource.supplyRoom?.supplyChoice === undefined && this.dataSource.supplyRoom) {
        this.confirmation = { detail: '아직 받지 않은 보급고 보상이 있습니다.\n다음 스테이지로 이동하면 이 보상은 사라집니다.\n보상을 포기하고 출발하시겠습니까?', confirm: close }; this.render();
      } else close();
    },true,100).setName('squad-close');
    if (this.confirmation) this.renderConfirmation();
  }

  private renderSummons(): void {
    const roster = this.dataSource.roster;
    this.text(36,282,'마법진에 새 동료를 초대하세요',28,'#ffe5a1');
    this.text(36,324,`지정 소환 · T1 소환권 ${roster.freeSummons}장 · T3는 STAGE 3부터`,20,FANTASY.muted);
    SUMMON_OFFERS.slice(this.page*2,this.page*2+2).forEach((offer,i)=>{
      const type=UNIT_TYPES[offer.unitTypeId],x=36+i*330;
      squadCard(this,x,366,318,552,type.tier).setName(`summon-card-${type.id}`);
      this.text(x+159,384,type.name,28).setOrigin(.5,0).setWordWrapWidth(286);
      this.text(x+159,424,`T${type.tier} · ${UNIT_MOVEMENT[type.id].role}`,21,'#d7c2f1').setOrigin(.5,0);
      squadPedestal(this,x+159,599,224,squadTierColor(type.tier),true);
      this.add.image(x+159,526,unitPortrait(type.id)).setDisplaySize(184,184).setName(`summon-portrait-${type.id}`);
      this.text(x+159,628,type.elements.map(e=>ELEMENT_NAMES[e]).join(' / '),23,'#d7c2f1').setOrigin(.5,0);
      this.text(x+22,674,UNIT_SKILL_DESCRIPTIONS[type.id],22,'#e4d6f0').setWordWrapWidth(274).setName(`summon-skill-${type.id}`);
      const free=roster.freeSummons>0&&type.tier===1,allowed=roster.canSummon(type.id);
      const reason=roster.units.length>=SQUAD_LIMITS.owned?'보유 한도 도달':type.tier>=3&&roster.stageIndex<2?'STAGE 3부터':'마력석 부족';
      this.text(x+159,778,free?'소환권 1장 사용':`소환 비용 ${offer.cost} ◆`,22,'#ffe1a1').setOrigin(.5,0);
      fantasyButton(this,x+159,858,278,96,allowed?(free?'무료 소환':`${offer.cost} ◆ 소환`):reason,
        ()=>this.transact(()=>roster.summon(type.id),`${type.name} 소환 완료`),
        {enabled:allowed,primary:true,icon:allowed?'summon':'lock',fontSize:27,hitHeight:108}).setName(`summon-${type.id}`);
    });
    this.pagination(Math.ceil(SUMMON_OFFERS.length/2));
  }

  private renderRecipes(): void {
    const roster=this.dataSource.roster,available=COMBINATION_RECIPES.filter(r=>roster.canCombine(r.id));
    this.text(36,282,`조합의 제단 · 가능 ${available.length}개`,26,'#ffe5a1');
    fantasyButton(this,578,336,212,48,this.availableOnly?'전체 레시피':'가능한 조합만',()=>{
      this.availableOnly=!this.availableOnly;this.page=0;this.render();
    },{fontSize:21,hitHeight:108,selected:this.availableOnly}).setName('recipe-filter');
    const recipes=[...(this.availableOnly?available:COMBINATION_RECIPES)].sort((a,b)=>b.priority-a.priority);
    this.page=Math.min(this.page,Math.max(0,recipes.length-1));
    const recipe=recipes[this.page];
    if(!recipe){
      pixelPanel(this,36,366,648,552);
      this.text(360,540,'지금 가능한 조합이 없습니다',30,'#ffe1a1').setOrigin(.5);
      this.text(360,600,'동료를 소환하거나 전체 레시피를 확인하세요.',22,FANTASY.muted).setOrigin(.5);
    }else{
      const result=UNIT_TYPES[recipe.resultUnitTypeId],selected=roster.ingredientsFor(recipe.id),fee=roster.combinationCost(recipe.id);
      squadCard(this,36,366,648,552,result.tier);
      this.text(360,382,`T${result.tier} ${result.name} · ★${recipe.resultStar??1}`,28,'#ffe5a1').setOrigin(.5,0);
      recipe.ingredients.forEach((item,i)=>{
        const type=Object.values(UNIT_TYPES).find(type=>matchesIngredient({archetype:type.id},item))!;
        const cx=recipe.ingredients.length===1?188:116+i*160;
        squadCard(this,cx-58,430,116,78,type.tier);
        this.add.image(cx,468,unitPortrait(type.id)).setDisplaySize(74,74);
        this.text(cx+39,433,`×${item.count}`,19,'#ffe5a1').setOrigin(1,0);
        if(item.kind==='query')this.text(cx-49,433,'조건',16,'#e0bbff');
        if(i)this.text(196,463,'+',30,'#d7a7ff').setOrigin(.5);
      });
      this.text(386,463,'»',52,'#dbb0ff').setOrigin(.5);
      squadPedestal(this,540,506,142,squadTierColor(result.tier),true);
      this.add.image(540,463,unitPortrait(result.id)).setDisplaySize(100,100);
      this.text(60,514,'필요 재료 · 보유 / 필요 수량',22,'#e8c98b');
      recipeIngredientLines(recipe,roster.units).forEach((line,row)=>{
        this.text(60,550+row*76,line,23).setWordWrapWidth(590).setName(`recipe-${recipe.id}-ingredient-${row}`);
      });
      this.text(60,704,UNIT_SKILL_DESCRIPTIONS[result.id],21,'#d7c2f1').setWordWrapWidth(590).setName('recipe-result-skill');
      this.text(60,758,selected?`소모: ${selected.map(u=>`#${u.id.split('_')[1]} ★${u.star} ${u.deployed?'출전':'대기'}`).join(', ')}`
        :'필요한 재료가 부족합니다',18,selected?'#bce5ba':'#efb5c0').setWordWrapWidth(590).setName('recipe-consumed');
      const fits=!!selected&&roster.units.length-selected.length+recipe.resultCount<=SQUAD_LIMITS.owned;
      fantasyButton(this,520,864,280,88,`조합 ${fee} ◆`,()=>this.requestCombine(recipe.id),
        {enabled:fits&&roster.minerals>=fee,fontSize:26,icon:'merge',primary:true,hitHeight:108}).setName(`combine-${recipe.id}`);
      fantasyButton(this,196,864,280,88,'재료 직접 선택',()=>{
        this.editingRecipe=recipe;this.selectedIds=selected?.map(u=>u.id)??[];this.pickerPage=0;this.render();
      },{fontSize:25,icon:'book',hitHeight:108}).setName(`recipe-picker-${recipe.id}`);
    }
    this.pagination(Math.max(1,recipes.length));
  }

  private renderRoster(): void {
    const roster=this.dataSource.roster,deployed=roster.units.filter(u=>u.deployed);
    const label=(x:number,y:number,value:string,size=20,color=FANTASY.cream)=>
      this.text(x,y,value,size,color).setStroke('#140e24',2);
    label(360,280,`보유 동료 ${roster.units.length} / ${SQUAD_LIMITS.owned}`,30,'#ffe5a1')
      .setOrigin(.5,0).setName('roster-heading');
    label(360,320,'동료를 선택해 편성을 바꾸세요.',20,FANTASY.muted)
      .setOrigin(.5,0).setName('roster-guide');
    const synergy=resolveSynergies(roster.units),active=SYNERGY_IDS.filter(id=>synergy.counts[id]>=SYNERGIES[id].required);
    pixelPanel(this,24,352,672,138,0x21182f,0x725488);
    for(let i=0;i<SQUAD_LIMITS.deployed;i++){
      const x=80+i*112,unit=deployed[i];
      squadPedestal(this,x,451,90,unit?squadTierColor(unit.tier):0x735e89,!!unit);
      if(unit){
        this.add.image(x,407,unitPortrait(unit.archetype)).setDisplaySize(94,94).setName(`deployed-portrait-${unit.id}`);
        this.add.rectangle(x,470,54,24,0x191127,.96);
        label(x,470,`★${unit.star}`,20,'#ffe5a1').setOrigin(.5).setName(`deployed-stars-${unit.id}`);
      }else label(x,409,'+',36,'#b9b0d2').setOrigin(.5);
    }
    const pages=Math.max(1,Math.ceil(roster.units.length/8));this.page=Math.min(this.page,pages-1);
    const visible=roster.units.slice(this.page*8,this.page*8+8);
    if(!visible.some(u=>u.id===this.selectedUnitId))this.selectedUnitId=visible[0]?.id??null;
    for(const [i,unit] of visible.entries()){
      const x=36+i%4*168,y=502+Math.floor(i/4)*184,selected=unit.id===this.selectedUnitId;
      squadCard(this,x,y,144,172,unit.tier,selected).setName(`roster-card-${unit.id}`);
      // Reserve two lines at a fixed readable size. Wrap Korean by measured glyphs;
      // cap future longer names with an ellipsis instead of shrinking the font.
      const title=label(x+72,y+10,'',20).setOrigin(.5,0).setLineSpacing(0).setName(`roster-name-${unit.id}`);
      const lines:string[]=[''];
      for(const word of DRONE_SPECS[unit.archetype].name.split(/\s+/)){
        const index=lines.length-1,candidate=lines[index]?lines[index]+' '+word:word;
        if(title.context.measureText(candidate).width<=112){lines[index]=candidate;continue;}
        if(lines[index])lines.push('');
        for(const char of word){
          const last=lines.length-1;
          if(title.context.measureText(lines[last]+char).width>112)lines.push(char);
          else lines[last]+=char;
        }
      }
      if(lines.length>2){
        let last=lines[1].trimEnd();
        while(title.context.measureText(last+'…').width>112)last=last.slice(0,-1);
        lines[1]=last+'…';
      }
      title.setText(lines.slice(0,2).map(line=>line.trim()).join('\n')).setAlign('center');
      this.add.image(x+72,y+98,unitPortrait(unit.archetype)).setDisplaySize(76,76).setName(`roster-portrait-${unit.id}`);
      this.add.rectangle(x+72,y+154,126,28,0x171023,.98);
      label(x+33,y+153,`★${unit.star}`,20,'#ffe5a1').setOrigin(.5).setName(`roster-stars-${unit.id}`);
      const badge=this.add.container(x+100,y+154).setName(`roster-badge-${unit.id}`);
      badge.add(this.add.rectangle(0,0,54,24,unit.deployed?0x58412b:0x342847).setStrokeStyle(1,unit.deployed?0xc89e53:0x86749b));
      badge.add(label(0,0,unit.deployed?'출전':'대기',18,unit.deployed?'#ffe5a1':'#d5cbe4').setOrigin(.5));
      const control=this.add.container(x+72,y+86).setName(`roster-select-${unit.id}`);
      control.add(this.add.rectangle(0,0,144,172,0,0).setName('hit').setInteractive({useHandCursor:true})
        .on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{
          event.stopPropagation();this.selectedUnitId=unit.id;this.render();
        }));
    }
    const selected=visible.find(u=>u.id===this.selectedUnitId);
    pixelPanel(this,36,870,648,170,0x21182f,FANTASY.edge).setName('roster-detail');
    if(selected){
      const spec=DRONE_SPECS[selected.archetype],live=this.dataSource.squad?.drones.find(d=>d.id===selected.id);
      label(54,880,`T${selected.tier} ${spec.name} ★${selected.star}`,24,'#ffe5a1').setWordWrapWidth(612).setName('roster-detail-title');
      const state=live?`HP ${Math.ceil(live.health.currentHp)}/${live.health.maxHp}${live.health.isDead?' · 전투 불능':''}`:selected.deployed?'출전 중':'대기 중';
      label(54,910,`#${selected.id.split('_')[1]} · ${UNIT_MOVEMENT[selected.archetype].role} · ${state}${selected.awakening?` · 각성 ${selected.awakening}`:''}`,18,'#d7c2f1').setWordWrapWidth(612).setName('roster-detail-state');
      label(54,936,UNIT_SKILL_DESCRIPTIONS[selected.archetype],18,'#d7c2f1').setWordWrapWidth(612).setName('roster-detail-skill');
      const allowed=selected.deployed?deployed.length>1:deployed.length<SQUAD_LIMITS.deployed;
      fantasyButton(this,200,992,280,64,selected.deployed?'출전 → 대기':'대기 → 출전',
        ()=>this.transact(()=>roster.toggleDeployment(selected.id)),
        {enabled:allowed,primary:!selected.deployed,icon:'helmet',fontSize:26,hitHeight:108}).setName(`roster-deploy-${selected.id}`);
      fantasyButton(this,520,992,280,64,`판매 +${selected.tier*selected.star*SELL_REFUND_PER_TIER} ◆`,()=>this.requestSell(selected.id),
        {enabled:!selected.deployed||deployed.length>1,fontSize:24,icon:'coin',hitHeight:108}).setName(`roster-sell-${selected.id}`);
    }else label(360,918,'보유 동료가 없습니다',26,FANTASY.muted).setOrigin(.5);
    label(666,884,`출전 ${deployed.length}/${SQUAD_LIMITS.deployed} · ${active.length?`시너지 ${active.length}종`:'시너지 대기'}`,16,'#c6e9c0')
      .setOrigin(1,0).setName('synergy-summary');
    const turn=(direction:number)=>{this.page+=direction;this.selectedUnitId=null;this.render();};
    const previous=fantasyButton(this,78,326,84,48,'‹',()=>turn(-1),{enabled:this.page>0,fontSize:32,hitWidth:108,hitHeight:108}).setName('squad-prev');
    const next=fantasyButton(this,642,326,84,48,'›',()=>turn(1),{enabled:this.page+1<pages,fontSize:32,hitWidth:108,hitHeight:108}).setName('squad-next');
    // Keep the enlarged touch targets below the tab targets; only the visual is lifted.
    for(const button of [previous,next])(button.getByName('hit') as Phaser.GameObjects.Rectangle).y=10;
    label(558,332,`${this.page+1}/${pages}`,18,FANTASY.muted).setOrigin(.5).setName('roster-page');
  }

  private requestSell(id: string): void {
    const unit = this.dataSource.roster.units.find(item => item.id === id); if (!unit) return;
    const consent = awakeningConsent([unit]);
    const action = () => this.transact(() => this.dataSource.roster.sell(id, consent));
    if (!consent) { action(); return; }
    this.confirmation = { detail: `#${id.split('_')[1]} ${DRONE_SPECS[unit.archetype].name} · 각성 ${unit.awakening}\n판매하면 이 개체의 각성이 영구 소멸합니다.\n각성 비용은 환불되지 않습니다. 판매하시겠습니까?`, confirm: action }; this.render();
  }

  private requestCombine(recipeId: string, ids?: string[]): void {
    const selected = this.dataSource.roster.ingredientsFor(recipeId, ids); if (!selected) return;
    const selectedIds = selected.map(unit => unit.id), consent = awakeningConsent(selected);
    const action = () => this.transact(() => {
      const success = this.dataSource.roster.combine(recipeId, selectedIds, consent);
      if (success) this.editingRecipe = null; return success;
    });
    if (!consent) { action(); return; }
    this.confirmation = { detail: `재료의 각성이 소멸하고 결과에는 이어지지 않습니다.\n${selected.filter(unit => unit.awakening).map(unit => `#${unit.id.split('_')[1]} 각성 ${unit.awakening}`).join(' · ')}\n각성 비용은 환불되지 않습니다. 조합하시겠습니까?`, confirm: action }; this.render();
  }

  private renderConfirmation(): void {
    const pending = this.confirmation!;
    this.add.rectangle(360, 640, 720, 1280, 0x080c16, 0.96).setDepth(200).setInteractive();
    pixelPanel(this, 36, 390, 648, 450, FANTASY.panel, FANTASY.gold).setDepth(201);
    this.text(65, 426, '소멸 확인', 28, '#f1a18e').setDepth(202).setName('loss-title');
    this.text(65, 490, pending.detail, 21).setWordWrapWidth(580).setLineSpacing(14).setDepth(202).setName('loss-detail');
    fantasyButton(this, 200, 759, 260, 60, '취소 · 보존', () => {
      if (this.confirmation !== pending) return; this.confirmation = null; this.render();
    }, { fontSize: 23 }).setDepth(203).setName('loss-cancel');
    fantasyButton(this, 520, 759, 260, 60, '소멸 확인 · 진행', () => {
      if (this.confirmation !== pending) return; this.confirmation = null; pending.confirm();
    }, { fontSize: 23, primary: true }).setDepth(203).setName('loss-confirm');
  }

  private renderFacilities(): void {
    const roster = this.dataSource.roster;
    (['awakening','service','supply','synergy'] as const).forEach((mode, i) => fantasyButton(this,105+i*170,326,154,88,
      `${this.facilityMode === mode ? '● ' : ''}${{awakening:'유닛 각성',service:'회복 서비스',supply:'보급 보상',synergy:'편성 시너지'}[mode]}`, () => {
        this.facilityMode = mode; this.page = 0; this.render();
      },{fontSize:21,selected:this.facilityMode===mode}).setName(`facility-${mode}`));
    if (this.facilityMode === 'awakening') {
      this.text(44,374,'★3 개체 · 공격/최대 HP +5%씩 · 최대 10단계',21,'#d9c287');
      this.text(44,406,'현재 HP 유지 · 조합/판매 시 각성 소멸',20,'#b6c0c8');
      const units=roster.units.filter(unit=>unit.star===3),pages=Math.max(1,Math.ceil(units.length/3));
      this.page = Math.min(this.page,pages-1);
      if (!units.length) this.text(60, 435, '각성할 ★3 유닛이 없습니다.\n같은 유닛·같은 ★ 3기를 조합해 ★3을 만드세요.', 22).setLineSpacing(15);
      units.slice(this.page*3,this.page*3+3).forEach((unit,i)=>{
        const y=446+i*160,quote=roster.awakeningQuote(unit.id),level=unit.awakening??0;
        pixelPanel(this,36,y,648,146);
        this.text(56,y+16,`#${unit.id.split('_')[1]} ${DRONE_SPECS[unit.archetype].name} · 각성 ${level}/${AWAKENING.maxLevel}`,20).setWordWrapWidth(580);
        this.text(56,y+57,`기본 공격/HP +${Math.round(level*AWAKENING.step*100)}% · ${unit.deployed?'출전':'대기'}`,17,'#b6c0c8');
        fantasyButton(this,535,y+112,250,64,quote?`${quote.cost} ◆ · 각성`:'최대 각성',()=>{
          if (quote) this.transact(()=>roster.awaken(quote),'각성 완료 · 현재 HP는 유지됩니다.');
        },{enabled:!!quote&&roster.minerals>=quote.cost,fontSize:22,primary:true,hitHeight:88}).setName(`awaken-${unit.id}`);
      });
      this.pagination(pages);
    } else if (this.facilityMode === 'service') {
      this.text(44,382,'출전 아군 대상 · 대상이 없으면 구매 불가',22,'#d9c287');
      (['HEAL','REVIVE'] as const).forEach((id,i)=>{
        const def=SERVICES[id],quote=this.dataSource.squad?.serviceQuote(id),y=430+i*254;
        pixelPanel(this,36,y,648,226);
        this.text(60,y+22,def.name,26);
        this.text(60,y+70,def.description,19,'#b6c0c8').setWordWrapWidth(580).setLineSpacing(12);
        fantasyButton(this,360,y+178,568,52,quote?`${def.cost} ◆ · ${def.name}`:'적용할 대상 없음',()=>{
          if(quote) this.transact(()=>this.dataSource.onService?.(quote)??false,`${def.name} 완료`,'대상/잔액/정비 상태가 바뀌었습니다.');
        },{enabled:!!quote&&!!this.dataSource.onService&&roster.minerals>=def.cost,fontSize:25,primary:true,hitHeight:88}).setName(`service-${id}`);
      });
    } else if (this.facilityMode === 'supply') {
      const room=this.dataSource.supplyRoom, pending=!!room&&room.supplyChoice===undefined;
      this.text(44,382,'보급고 · 우회 경로의 추가 선택 보상',24,'#d9c287');
      this.text(44,420,pending?'하나만 선택 · 현 스테이지 안에서 보류 가능':'현재 받을 보급 보상이 없습니다.',20,'#b6c0c8');
      (['VOUCHERS','MINERALS'] as const).forEach((choice,i)=>{
        const y=466+i*236;
        pixelPanel(this,36,y,648,214);
        this.text(60,y+23,choice==='VOUCHERS'?`T1 무료 지정 소환권 ${SIDE_SUPPLY.vouchers}장`:`마력석 ${SIDE_SUPPLY.minerals} ◆`,25);
        this.text(60,y+70,choice==='VOUCHERS'?'보유 한도가 가득 차도 소환권을 보관합니다.':'소환·조합·강화·서비스에 사용할 수 있습니다.',18,'#b6c0c8');
        fantasyButton(this,360,y+166,568,76,pending?'이 보상 받기':'수령할 보상 없음',()=>{
          this.transact(()=>this.dataSource.onSupply?.(choice)??false,'보급 보상 수령 · 다시 지급되지 않습니다.');
        },{enabled:pending&&!!this.dataSource.onSupply,fontSize:25,primary:true,hitHeight:88}).setName(`supply-${choice}`);
      });
      this.text(44,940,'보류 후 각성·서비스 → 보급고 보상에서 다시 선택하세요.\n다음 스테이지로 이동하면 미수령 보상은 소멸합니다.',17,'#d9c287').setLineSpacing(10);
    } else {
      const synergy=resolveSynergies(roster.units);
      this.text(44,382,'서로 다른 출전 유닛 종류만 계산 · 중복 제외',21,'#d9c287');
      SYNERGY_IDS.forEach((id,i)=>{
        const y=425+i*174,def=SYNERGIES[id],count=synergy.counts[id];pixelPanel(this,36,y,648,160);
        this.text(60,y+20,`${def.name} · ${count}/${def.required}종 · ${count>=def.required?'발동':'미발동'}`,25).setName(`synergy-${id}`);
        this.text(60,y+72,def.description,20,'#cfb7ff');
        this.text(60,y+116,'전투 불능이어도 편성을 유지하면 효과 유지',17,'#b6c0c8');
      });
      this.text(44,1000,'공격/공속은 강화와 가산 · 공속2.5배/방어50% 상한 유지',16,'#d9c287');
    }
  }

  private renderTalents(): void {
    const hero = this.dataSource.hero!;
    const count = hero.talents.length, pending = hero.pendingTalents();
    this.text(44, 272, `소환사의 재능 · 선택 대기 ${pending}`, 22, '#d9c287');
    this.text(44, 311, '3레벨마다 하나 선택 · 같은 재능 반복 가능 · 선택은 보관됩니다.', 16, '#b6c0c8');
    TALENT_IDS.forEach((id, i) => {
      const y = 355 + i * 204;
      fantasyButton(this,360,y+95,648,190,'',()=>{
        this.transact(() => hero.chooseTalent(id, count), `${TALENTS[id].name} 선택 · 이번 원정에 적용`,
          '선택할 재능이 없거나 이미 사용한 선택입니다.');
      },{enabled:pending>0}).setName(`talent-select-${id}`);
      const accent=[0xffd966,0x78d8f5,0xbe96ff][i];
      const frame=this.add.graphics();frame.fillStyle(accent).fillRect(36,y+5,4,180);
      pixelPanel(this,56,y+22,72,72,0x231a31,accent);
      uiIcon(this,i===0?'book':i===1?'heart':'gem',92,y+58,36);
      this.text(148,y+16,`${TALENTS[id].name} · ${talentRank(hero.talents,id)}회`,28,'#ffe5a1').setName(`talent-title-${id}`);
      this.text(148,y+58,TALENTS[id].description,23,'#d0c1de').setWordWrapWidth(504).setLineSpacing(5);
      this.text(148,y+150,pending?'이 재능 선택 →':'다음 3레벨에 선택',22,pending?'#f1d08b':'#b6c0c8');
    });
    this.text(44, 987, '현재 HP를 유지하며 새 모험에서 재능이 초기화됩니다.', 18, '#d9c287');
  }

  private renderRelics(): void {
    const roster = this.dataSource.roster, reward = roster.pendingRelicReward(), owned = roster.relicIds();
    this.text(44, 272, reward ? '정예 방의 유물 · 하나를 선택하세요' : `보유 유물 ${owned.length}/${RELIC_LIMIT}`, 22, '#d9c287');
    this.text(44, 311, reward ? '보상은 보관됩니다. 나중에 선택하거나 책을 덮어도 사라지지 않습니다.'
      : '정예 방 첫 클리어로 선택 보상 획득 · 각 유물은 한 번만 보유', 16, '#b6c0c8');
    RELIC_IDS.forEach((id, i) => {
      const y = 355 + i * 204, def = RELICS[id], has = owned.includes(id);
      fantasyButton(this,360,y+95,648,190,'',()=>{
        if (!reward) return;
        this.transact(() => roster.claimRelic(reward.sourceRoomId, id), `${def.name} 획득 · 이번 원정에 적용`,
          '이미 선택한 보상이거나 보유한 유물입니다.');
      },{enabled:!!reward&&!has}).setName(`relic-select-${id}`);
      const accent=[0xffd966,0x78d8f5,0xbe96ff][i];
      const frame=this.add.graphics();frame.fillStyle(accent,has?0.5:1).fillRect(36,y+5,4,180);
      pixelPanel(this,56,y+22,72,72,0x231a31,accent);
      uiIcon(this,def.icon,92,y+58,36);
      this.text(148,y+16,def.name,28,'#ffe5a1').setName(`relic-title-${id}`);
      this.text(148,y+58,def.description,22,'#d0c1de').setWordWrapWidth(504).setLineSpacing(5);
      this.text(148,y+154,has?'✓ 보유 중':reward?'이 유물 선택 →':'정예 방에서 획득',22,has||reward?'#f1d08b':'#b6c0c8');
    });
    this.text(44, 987, '유물은 중복되지 않으며 새 모험에서 초기화됩니다.', 18, '#d9c287');
  }

  private renderUpgrades(): void {
    const roster = this.dataSource.roster;
    this.text(44, 272, '원정 강화 · 효과와 다음 비용을 확인하세요', 20, '#d9c287');
    UPGRADE_IDS.forEach((id, i) => {
      const x = 36 + (i % 2) * 330, y = 317 + Math.floor(i / 2) * 208;
      const def = UPGRADES[id], level = roster.upgrades[id], quote = roster.upgradeQuote(id);
      pixelPanel(this, x, y, 318, 190);
      this.text(x + 18, y + 16, def.name, 23).setName(`upgrade-title-${id}`);
      this.text(x + 18, y + 51, `Lv.${level} / ${def.maxLevel}`, 19, '#cfb7ff').setName(`upgrade-level-${id}`);
      this.text(x + 18, y + 83, `${upgradeEffectLabel(id, level)}${quote ? ` → ${upgradeEffectLabel(id, level + 1)}` : ' · 최대'}`,
        16, '#b6c0c8').setWordWrapWidth(282).setName(`upgrade-effect-${id}`);
      fantasyButton(this, x + 159, y + 150, 282, 50, quote ? `${quote.cost} ◆ 강화` : '상한 도달', () => {
        if (!quote) return;
        this.transact(() => roster.buyUpgrade(quote), `${def.name} Lv.${quote.level + 1} · ${quote.cost} ◆ 사용`,
          '잔액 또는 강화 단계가 변경되었습니다. 다시 확인하세요.');
      }, { enabled: !!quote && roster.minerals >= quote.cost, fontSize: 21, primary: true }).setName(`upgrade-buy-${id}`);
    });
    this.text(44, 964, '체력 강화는 회복 없이 최대 HP만 증가합니다.', 18, '#d9c287');
    this.text(44, 1000, '이번 원정에만 적용 · 공속 최대 2.5배 · 피해 감소 최대 50%', 17, '#b6c0c8');
  }

  private renderQuickCraft(): void {
    const roster = this.dataSource.roster;
    if (this.quickQuote) {
      const quote = this.quickQuote;
      const type = UNIT_TYPES[quote.unitTypeId];
      pixelPanel(this, 36, 282, 648, 710);
      this.add.image(115, 354, unitPortrait(type.id)).setDisplaySize(96, 96);
      this.text(184, 306, `T${type.tier} ${type.name} ★1`, 25).setWordWrapWidth(460);
      this.text(184, 355, `총 ${quote.totalCost} ◆`, 28, '#f3c64d');
      this.text(60, 432, `재료 소환 ${quote.summonCost} ◆ + 조합 ${quote.combinationCost} ◆`, 21);
      this.text(60, 480, '새로 소환할 재료', 21, '#d9c287');
      const materialText = quote.summons.map(item => `${UNIT_TYPES[item.unitTypeId].name} ×${item.count}`).join(' · ');
      this.text(60, 519, materialText, 18).setWordWrapWidth(594);
      this.text(60, 638, `중간 조합 ${quote.combinations.reduce((sum, item) => sum + item.count, 0)}회까지 자동 처리`, 20);
      this.text(60, 684, '보유 유닛·★·소환권은 보존됩니다.\n완성 유닛 1기를 위한 보유 공간이 필요합니다.\n출전이 가득 차면 대기 유닛으로 받습니다.', 18, '#b6c0c8').setLineSpacing(9);
      const room = roster.units.length < SQUAD_LIMITS.owned;
      const affordable = roster.minerals >= quote.totalCost;
      this.text(60, 818, !room ? '보유 공간이 부족합니다.' : !affordable ? `${quote.totalCost - roster.minerals} ◆ 부족합니다.`
        : '표시된 금액으로 ★1 유닛을 제작합니다.', 20, room && affordable ? '#b2f06a' : '#f1a18e');
      fantasyButton(this, 190, 930, 260, 56, '목록으로', () => { this.quickQuote = null; this.render(); },
        { fontSize: 21 }).setName('quick-craft-back');
      fantasyButton(this, 520, 930, 280, 56, `${quote.totalCost} ◆ 제작`, () => {
        const selected = this.quickQuote;
        if (!selected) return;
        this.quickQuote = null;
        this.transact(() => roster.quickCraft(selected.unitTypeId, selected.totalCost),
          `${UNIT_TYPES[selected.unitTypeId].name} ★1 제작 완료 · ${selected.totalCost} ◆ 사용`);
      }, { enabled: room && affordable, fontSize: 21, primary: true }).setName('quick-craft-confirm');
      return;
    }
    ([null, 1, 2, 3, 4] as const).forEach((tier, i) => {
      fantasyButton(this,88+i*136,322,112,64,tier?`T${tier}`:'전체',
        ()=>{this.quickTier=tier;this.page=0;this.render();},{fontSize:24,hitHeight:80,selected:this.quickTier===tier}).setName(`quick-tier-${tier??'all'}`);
    });
    this.text(44,370,'새 재료 비용 포함 · 원하는 유닛을 선택하세요',22,'#d9b969');
    const types = Object.values(UNIT_TYPES).filter(type => this.quickTier === null || type.tier === this.quickTier)
      .sort((a, b) => a.tier - b.tier);
    const plans = quickCraftPlans(roster.stageIndex, roster.craftDiscount());
    const pages=Math.max(1,Math.ceil(types.length/4));
    this.page = Math.min(this.page, pages - 1);
    types.slice(this.page*4,this.page*4+4).forEach((type,i)=>{
      const x=36+(i%2)*330,y=416+Math.floor(i/2)*264;
      const plan = plans.get(type.id);
      pixelPanel(this,x,y,318,248);
      this.add.image(x + 46, y + 47, unitPortrait(type.id)).setDisplaySize(64, 64);
      this.text(x+87,y+17,type.name,24).setWordWrapWidth(218);
      this.text(x + 87, y + 52, `T${type.tier} ★1 · ${UNIT_MOVEMENT[type.id].role}`, 16, '#b6c0c8');
      this.text(x+20,y+112,plan?`${plan.totalCost} ◆`:'제작 경로 없음',28,'#f3c64d');
      fantasyButton(this,x+159,y+202,276,76,'제작 내용 보기',()=>{
        if (!plan) return;
        this.quickQuote = plan; this.render();
      },{enabled:!!plan,fontSize:24,hitHeight:88}).setName(`quick-craft-${type.id}`);
    });
    this.pagination(pages);
  }

  private renderIngredientPicker(recipe: CombinationRecipe): void {
    const roster = this.dataSource.roster;
    const count = recipe.ingredients.reduce((sum, item) => sum + item.count, 0);
    const candidates = roster.units.filter(unit => recipe.ingredients.some(item => matchesIngredient(unit, item)) &&
      (!recipe.ingredientStar || unit.star === recipe.ingredientStar));
    this.text(44, 280, `${DRONE_SPECS[recipe.resultUnitTypeId].name} · 재료 ${this.selectedIds.length}/${count} 선택`, 20);
    candidates.slice(this.pickerPage*3,this.pickerPage*3+3).forEach((unit,i)=>{
      const y=350+i*132;
      squadCard(this,36,y-14,648,118,unit.tier,this.selectedIds.includes(unit.id));
      this.add.image(94,y+45,unitPortrait(unit.archetype)).setDisplaySize(88,88);
      this.text(154, y, `#${unit.id.split('_')[1]} ${DRONE_SPECS[unit.archetype].name} ★${unit.star}${unit.awakening ? ` 각성${unit.awakening}` : ''}`, 20).setWordWrapWidth(302);
      this.text(154,y+66,unit.deployed?'출전 중':'대기 중',20);
      const selected = this.selectedIds.includes(unit.id);
      this.button(570,y+40,180,selected?'선택 해제':'재료로 선택',()=>{
        this.selectedIds = selected ? this.selectedIds.filter(id => id !== unit.id) : [...this.selectedIds, unit.id]; this.render();
      },selected||this.selectedIds.length<count,88).setName(`ingredient-select-${unit.id}`);
    });
    const pages=Math.max(1,Math.ceil(candidates.length/3));
    this.button(150,842,200,'이전 재료',()=>{this.pickerPage--;this.render();},this.pickerPage>0,88).setName('ingredient-prev');
    this.button(570,842,200,'다음 재료',()=>{this.pickerPage++;this.render();},this.pickerPage+1<pages,88).setName('ingredient-next');
    this.text(300,828,`${this.pickerPage+1}/${pages}`,24);
    this.button(180,988,260,'조합 목록으로',()=>{this.editingRecipe=null;this.render();},true,88).setName('ingredient-back');
    this.button(530,988,300,`선택 재료로 조합 ${roster.combinationCost(recipe.id)} ◆`,()=>this.requestCombine(recipe.id,this.selectedIds),roster.canCombine(recipe.id,this.selectedIds),88).setName('ingredient-confirm');
  }

  private pagination(pages: number): void {
    this.button(150,988,200,'이전',()=>{this.page--;this.render();},this.page>0,88).setName('squad-prev');
    this.text(312,973,`${this.page+1} / ${pages}`,26);
    this.button(570,988,200,'다음',()=>{this.page++;this.render();},this.page+1<pages,88).setName('squad-next');
  }
}
