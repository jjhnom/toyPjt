import Phaser from 'phaser';
import { FANTASY, pixelPanel, fantasyButton, pixelIcon } from '../ui/fantasyTheme';
import { unitPortrait } from '../ui/pixelCharacters';
import { recipeIngredientLines } from '../ui/recipePresentation';
import { DRONE_SPECS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { COMBINATION_RECIPES, SELL_REFUND_PER_TIER, SQUAD_LIMITS, SUMMON_OFFERS, UNIT_MOVEMENT } from '../config/squadData';
import { SquadRoster, matchesIngredient, quickCraftPlans } from '../systems/SquadRoster';
import { soundManager } from '../systems/SoundManager';
import { ELEMENT_NAMES, ELEMENT_COLORS, UNIT_TYPES } from '../config/unitData';
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
    this.render();
  }

  private text(x: number, y: number, value: string, size = 20, color = FANTASY.cream): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: FANTASY.font, fontSize: `${size}px`, resolution: 2, fontStyle: 'bold', color, wordWrap: { width: 580 }
    });
  }

  private button(x:number,y:number,width:number,label:string,action:()=>void,enabled=true,height=50):Phaser.GameObjects.Container {
    return fantasyButton(this,x,y,width,height,label,action,{enabled,fontSize:height>=88?26:20,primary:y>=1190});
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
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'art_dungeon').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x111a20, 0.82).setInteractive();
    pixelPanel(this, 24, 26, GAME_WIDTH - 48, 172, FANTASY.panel, FANTASY.gold);
    const seal = this.add.graphics();
    pixelIcon(seal, 'book', 46, 54, 2);
    this.text(96,45,this.dataSource.stageSummary??'원정 정비',this.dataSource.stageSummary?23:34,FANTASY.cream).setWordWrapWidth(570);
    this.text(96,88,this.dataSource.stageSummary?'다음 원정을 준비하세요':'동료를 모아, 더 멀리 나아가세요',18,FANTASY.muted);
    const deployedCount = roster.units.filter(unit => unit.deployed).length;
    this.text(44,114,`${roster.minerals} ◆   ·   보유 ${roster.units.length}/${SQUAD_LIMITS.owned}   ·   출전 ${deployedCount}/${SQUAD_LIMITS.deployed}`,25,'#f3c64d');
    this.text(44,153,this.message,18,'#d5c3e6').setWordWrapWidth(620);
    fantasyButton(this,80,1100,104,88,this.quickMode?'일반\n메뉴':'간편\n제작',()=>{
      this.quickMode = !this.quickMode; this.facilityMode = null; this.upgradeMode = false; this.relicMode = this.talentMode = false; this.quickQuote = null; this.page = 0; this.render();
    },{fontSize:22,selected:this.quickMode,hitHeight:100}).setName('quick-craft-open');
    fantasyButton(this,528,1100,104,88,this.facilityMode?'일반\n메뉴':'각성·\n서비스',()=>{
      this.facilityMode = this.facilityMode ? null : 'awakening'; this.quickMode = this.upgradeMode = this.relicMode = this.talentMode = false;
      this.page = 0; this.render();
    },{fontSize:20,selected:!!this.facilityMode,hitHeight:100}).setName('facility-open');
    fantasyButton(this,192,1100,104,88,this.upgradeMode?'일반\n메뉴':'원정\n강화',()=>{
      this.upgradeMode = !this.upgradeMode; this.facilityMode = null; this.quickMode = false; this.relicMode = this.talentMode = false; this.quickQuote = null; this.render();
    },{fontSize:22,selected:this.upgradeMode,hitHeight:100}).setName('upgrade-open');
    const tabs = [['summon', '동료 소환'], ['combine', '조합의 제단'], ['roster', '원정대']] as const;
    tabs.forEach(([tab,title],i)=>fantasyButton(this,145+i*215,228,195,64,title,()=>{
        this.tab = tab; this.page = 0; this.editingRecipe = null; this.facilityMode = null; this.quickMode = false; this.upgradeMode = false; this.relicMode = this.talentMode = false; this.quickQuote = null; this.render();
      },{fontSize:28,hitHeight:100,selected:!this.facilityMode&&!this.quickMode&&!this.upgradeMode&&!this.relicMode&&!this.talentMode&&this.tab===tab}).setName(`squad-tab-${tab}`));

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
      this.text(44,280,`T1 소환권 ${roster.freeSummons}장 · T3 지정 소환은 STAGE 3부터`,22);
      SUMMON_OFFERS.slice(this.page*2,this.page*2+2).forEach((offer,i)=>{
        const spec = DRONE_SPECS[offer.unitTypeId];
        const y=332+i*286;
        pixelPanel(this,36,y,648,252);
        pixelPanel(this,52,y+18,108,142,0x1a1a28,ELEMENT_COLORS[UNIT_TYPES[offer.unitTypeId].elements[0]]);
        this.add.image(106,y+83,unitPortrait(offer.unitTypeId)).setDisplaySize(104,104);
        this.text(78,y+131,`T${spec.tier}`,20,'#d5c3e6');
        this.text(184,y+22,spec.name,32).setWordWrapWidth(470);
        this.text(184,y+68,`${UNIT_MOVEMENT[offer.unitTypeId].role} · ${UNIT_TYPES[offer.unitTypeId].elements.map(element=>ELEMENT_NAMES[element]).join('/')}`,24);
        const free = roster.freeSummons > 0 && spec.tier === 1;
        this.text(184,y+111,UNIT_SKILL_DESCRIPTIONS[offer.unitTypeId],22,'#c5b7d3').setWordWrapWidth(470);
        const allowed=roster.canSummon(offer.unitTypeId);
        const reason=roster.units.length>=SQUAD_LIMITS.owned?'보유 한도':spec.tier>=3&&roster.stageIndex<2?'STAGE 3부터':'마력석 부족';
        this.text(62,y+193,free?'무료 지정 소환권 사용':`소환 비용 ${offer.cost} ◆`,22,'#f3c64d');
        fantasyButton(this,534,y+197,252,88,allowed?(free?'소환권 사용':`${offer.cost} ◆ 소환`):reason,
          ()=>this.transact(()=>roster.summon(offer.unitTypeId)),{enabled:allowed,fontSize:26,primary:true,hitHeight:100}).setName(`summon-${offer.unitTypeId}`);
      });
      this.pagination(Math.ceil(SUMMON_OFFERS.length/2));
    } else if (this.tab === 'combine') {
      if (this.editingRecipe) {
        this.renderIngredientPicker(this.editingRecipe);
      } else {
      const available = COMBINATION_RECIPES.filter(recipe => roster.canCombine(recipe.id));
      this.text(44, 280, `지금 가능한 조합 ${available.length}개`, 18);
      this.button(575,305,200,this.availableOnly?'전체 조합 보기':'가능한 조합만',()=>{
        this.availableOnly = !this.availableOnly; this.page = 0; this.render();
      });
      const recipes = [...(this.availableOnly ? available : COMBINATION_RECIPES)].sort((a, b) => b.priority - a.priority);
      this.page=Math.min(this.page,Math.max(0,recipes.length-1));
      recipes.slice(this.page,this.page+1).forEach(recipe=>{
        const fee = roster.combinationCost(recipe.id);
        const y=356;
        const selected = roster.ingredientsFor(recipe.id);
        const result = DRONE_SPECS[recipe.resultUnitTypeId];
        pixelPanel(this,36,y-15,648,584);
        this.add.image(100,y+48,unitPortrait(recipe.resultUnitTypeId)).setDisplaySize(106,106);
        this.text(176,y+4,`T${result.tier} ${result.name}${recipe.resultStar?` ★${recipe.resultStar}`:''}`,30,'#ffe0a0').setWordWrapWidth(476);
        recipeIngredientLines(recipe, roster.units).forEach((line, row) => {
          this.text(60,y+164+row*76,line,25).setWordWrapWidth(590).setName(`recipe-${recipe.id}-ingredient-${row}`);
        });
        this.text(60,y+342,selected?`소모: ${selected.map(u=>`#${u.id.split('_')[1]} ★${u.star} ${u.deployed?'출전':'대기'}`).join(', ')}`:'필요한 재료가 부족합니다',21,'#c5b7d3').setWordWrapWidth(590);
        const fits = !!selected && roster.units.length - selected.length + recipe.resultCount <= SQUAD_LIMITS.owned;
        this.text(176,y+66,UNIT_SKILL_DESCRIPTIONS[recipe.resultUnitTypeId],22,'#c5b7d3').setWordWrapWidth(476);
        this.text(60,y+125,'필요 재료 · 보유 / 필요 수량',24,'#e8c98b');
        this.text(60,y+414,`추가 비용 ${fee} ◆`,28,'#f3c64d');
        fantasyButton(this,520,y+508,280,88,`조합 (${fee} ◆)`,()=>this.requestCombine(recipe.id),
          {enabled:fits&&roster.minerals>=fee,fontSize:26,primary:true,hitHeight:100}).setName(`combine-${recipe.id}`);
        this.button(196,y+508,280,'재료 직접 선택',()=>{
          this.editingRecipe = recipe; this.selectedIds = selected?.map(unit => unit.id) ?? []; this.pickerPage = 0; this.render();
        },true,88).setName(`recipe-picker-${recipe.id}`);
      });
      this.pagination(Math.max(1,recipes.length));
      }
    } else {
      this.text(44, 280, '전투 불능: 12초 후 부활 · 방 이동 시 동료 HP 최소 50%', 18);
      const synergy=resolveSynergies(roster.units),active=SYNERGY_IDS.filter(id=>synergy.counts[id]>=SYNERGIES[id].required);
      this.text(44,310,`시너지: ${active.map(id=>SYNERGIES[id].name).join(' · ')||'없음'} · 각성·서비스에서 조건 확인`,15,'#cfb7ff').setName('synergy-summary');
      const deployed=roster.units.filter(unit=>unit.deployed);
      for(let i=0;i<SQUAD_LIMITS.deployed;i++){
        pixelPanel(this,40+i*108,340,98,72,0x211b31,0x655275);
        if(deployed[i])this.add.image(89+i*108,374,unitPortrait(deployed[i].archetype)).setDisplaySize(66,66);
      }
      this.page=Math.min(this.page,Math.max(0,Math.ceil(roster.units.length/2)-1));
      roster.units.slice(this.page*2,this.page*2+2).forEach((unit,i)=>{
        const y=440+i*250;
        pixelPanel(this,36,y,648,234);
        this.add.image(98,y+69,unitPortrait(unit.archetype)).setDisplaySize(98,98);
        this.text(166,y+14,`T${unit.tier} ${DRONE_SPECS[unit.archetype].name} ★${unit.star}${unit.awakening?` 각성${unit.awakening}`:''}`,28).setWordWrapWidth(492);
        this.text(166,y+56,`#${unit.id.split('_')[1]} · ${UNIT_MOVEMENT[unit.archetype].role} · ${unit.deployed?'출전':'대기'}`,24,'#c5b7d3');
        const allowed = unit.deployed ? deployedCount > 1 : deployedCount < SQUAD_LIMITS.deployed;
        this.text(166,y+96,UNIT_SKILL_DESCRIPTIONS[unit.archetype],20,'#c5b7d3').setWordWrapWidth(492);
        fantasyButton(this,200,y+182,280,88,unit.deployed?'출전 → 대기':'대기 → 출전',
          ()=>this.transact(()=>roster.toggleDeployment(unit.id)),{enabled:allowed,fontSize:26,primary:unit.deployed,hitHeight:100}).setName(`roster-deploy-${unit.id}`);
        fantasyButton(this,520,y+182,280,88,`판매 +${unit.tier*unit.star*SELL_REFUND_PER_TIER} ◆`,
          ()=>this.requestSell(unit.id),{enabled:!unit.deployed||deployedCount>1,fontSize:24,hitHeight:100}).setName(`roster-sell-${unit.id}`);
      });
      this.pagination(Math.max(1,Math.ceil(roster.units.length/2)));
    }
    const ownedRelics = roster.relicIds().length, pendingRelics = roster.relicRewards.filter(reward => reward.relicId === null).length;
    fantasyButton(this,304,1100,104,88,this.relicMode?'일반\n메뉴'
      :`유물\n${pendingRelics?`대기 ${pendingRelics}`:`${ownedRelics}/${RELIC_LIMIT}`}`,()=>{
      this.relicMode = !this.relicMode; this.facilityMode = null; this.talentMode = this.upgradeMode = this.quickMode = false; this.quickQuote = null; this.render();
    },{fontSize:22,selected:this.relicMode,hitHeight:100}).setName('relic-open');
    const hero = this.dataSource.hero, pendingTalents = hero?.pendingTalents() ?? 0;
    fantasyButton(this,416,1100,104,88,this.talentMode?'일반\n메뉴'
      :`재능\n${pendingTalents?`대기 ${pendingTalents}`:`${hero?.talents.length??0}개`}`,()=>{
      this.talentMode = !this.talentMode; this.facilityMode = null; this.relicMode = this.upgradeMode = this.quickMode = false; this.quickQuote = null; this.render();
    },{enabled:!!hero,fontSize:22,selected:this.talentMode,hitHeight:100}).setName('talent-open');
    fantasyButton(this,640,1100,104,88,'원정\n도감',()=>{
      if(!this.closed&&!this.confirmation&&!this.scene.isActive('CodexScene'))this.scene.launch('CodexScene');
    },{fontSize:22,hitHeight:100}).setName('codex-open');
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
    (['awakening','service','supply','synergy'] as const).forEach((mode, i) => fantasyButton(this,105+i*170,322,154,88,
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
      pixelIcon(this.add.graphics(),i===0?'book':i===1?'heart':'gem',74,y+42,2);
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
      pixelIcon(this.add.graphics(),def.icon,74,y+42,2);
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
      fantasyButton(this,88+i*136,320,112,64,tier?`T${tier}`:'전체',
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
    candidates.slice(this.pickerPage*4,this.pickerPage*4+4).forEach((unit,i)=>{
      const y=350+i*132;
      pixelPanel(this,36,y-14,648,118);
      this.text(55, y, `#${unit.id.split('_')[1]} ${DRONE_SPECS[unit.archetype].name} ★${unit.star}${unit.awakening ? ` 각성${unit.awakening}` : ''}`, 19).setWordWrapWidth(420);
      this.text(55,y+64,unit.deployed?'출전 중':'대기 중',21);
      const selected = this.selectedIds.includes(unit.id);
      this.button(570,y+40,180,selected?'선택 해제':'재료로 선택',()=>{
        this.selectedIds = selected ? this.selectedIds.filter(id => id !== unit.id) : [...this.selectedIds, unit.id]; this.render();
      },selected||this.selectedIds.length<count,88);
    });
    const pages=Math.max(1,Math.ceil(candidates.length/4));
    this.button(150,916,200,'이전 재료',()=>{this.pickerPage--;this.render();},this.pickerPage>0,88);
    this.button(570,916,200,'다음 재료',()=>{this.pickerPage++;this.render();},this.pickerPage+1<pages,88);
    this.text(300,902,`${this.pickerPage+1}/${pages}`,24);
    this.button(180,1004,260,'조합 목록으로',()=>{this.editingRecipe=null;this.render();},true,88);
    this.button(530,1004,300,`선택 재료로 조합 ${roster.combinationCost(recipe.id)} ◆`,()=>this.requestCombine(recipe.id,this.selectedIds),roster.canCombine(recipe.id,this.selectedIds),88).setName('ingredient-confirm');
  }

  private pagination(pages: number): void {
    this.button(150,988,200,'이전',()=>{this.page--;this.render();},this.page>0,88).setName('squad-prev');
    this.text(312,973,`${this.page+1} / ${pages}`,26);
    this.button(570,988,200,'다음',()=>{this.page++;this.render();},this.page+1<pages,88).setName('squad-next');
  }
}
