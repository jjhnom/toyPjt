import Phaser from 'phaser';
import { FANTASY, pixelPanel, fantasyButton, pixelIcon } from '../ui/fantasyTheme';
import { unitPortrait } from '../ui/pixelCharacters';
import { recipeIngredientLines } from '../ui/recipePresentation';
import { DRONE_SPECS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { COMBINATION_RECIPES, SELL_REFUND_PER_TIER, SQUAD_LIMITS, SUMMON_OFFERS, UNIT_MOVEMENT } from '../config/squadData';
import { SquadRoster, matchesIngredient, quickCraftPlans } from '../systems/SquadRoster';
import { soundManager } from '../systems/SoundManager';
import { ELEMENT_NAMES, UNIT_TYPES } from '../config/unitData';
import { UNIT_SKILL_DESCRIPTIONS } from '../config/skillData';
import type { CombinationRecipe, DroneTier, QuickCraftPlan } from '../types/game';

interface SquadSceneData { roster: SquadRoster; message: string; onClose: () => void; closeLabel?: string; stageSummary?: string }

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
    this.quickTier = null;
    this.quickQuote = null;
    this.render();
  }

  private text(x: number, y: number, value: string, size = 20, color = FANTASY.cream): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: FANTASY.font, fontSize: `${size}px`, resolution: 2, fontStyle: 'bold', color, wordWrap: { width: 580 }
    });
  }

  private button(x: number, y: number, width: number, label: string, action: () => void, enabled = true): void {
    fantasyButton(this, x, y, width, 50, label, action, { enabled, fontSize: 20, primary: y === 1150 });
  }

  private transact(action: () => boolean, successMessage = '적용 완료'): void {
    if (this.closed) return;
    // Lock this rendered set immediately; a new render shows the committed state.
    this.input.enabled = false;
    const success = action();
    this.message = success ? successMessage : '재료·잔액·공간 또는 출전 제한을 확인하세요';
    if (success) soundManager.playPowerup();
    this.render();
    this.input.enabled = true;
  }

  private render(): void {
    this.children.removeAll(true);
    const roster = this.dataSource.roster;
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'art_dungeon').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x111a20, 0.82).setInteractive();
    pixelPanel(this, 24, 26, GAME_WIDTH - 48, 166, FANTASY.panel, FANTASY.gold);
    const seal = this.add.graphics();
    pixelIcon(seal, 'book', 46, 54, 2);
    this.text(96, 52, this.dataSource.stageSummary ?? '소환의 서', this.dataSource.stageSummary ? 19 : 30, FANTASY.cream).setWordWrapWidth(360);
    this.text(96, 88, this.dataSource.stageSummary ? '다음 원정을 준비하세요' : '동료를 모아, 더 멀리 나아가세요', 14, FANTASY.muted);
    const deployedCount = roster.units.filter(unit => unit.deployed).length;
    this.text(44, 114, `${roster.minerals} ◆   ·   보유 ${roster.units.length}/${SQUAD_LIMITS.owned}   ·   출전 ${deployedCount}/${SQUAD_LIMITS.deployed}`, 21, '#f3c64d');
    this.text(44, 151, this.message, 16, '#d9b969');
    fantasyButton(this, 570, 73, 190, 50, this.quickMode ? '일반 메뉴' : '간편 제작', () => {
      this.quickMode = !this.quickMode; this.quickQuote = null; this.page = 0; this.render();
    }, { fontSize: 21, primary: !this.quickMode }).setName('quick-craft-open');
    const tabs = [['summon', '동료 소환'], ['combine', '조합의 제단'], ['roster', '원정대']] as const;
    tabs.forEach(([tab, title], i) => this.button(145 + i * 215, 228, 195,
      `${!this.quickMode && this.tab === tab ? '● ' : ''}${title}`, () => {
        this.tab = tab; this.page = 0; this.editingRecipe = null; this.quickMode = false; this.quickQuote = null; this.render();
      }));

    if (this.quickMode) {
      this.renderQuickCraft();
    } else if (this.tab === 'summon') {
      this.text(44, 280, `T1 무료 소환권 ${roster.freeSummons}장 · T3 지정 소환은 STAGE 3부터`, 18);
      SUMMON_OFFERS.slice(this.page * 4, this.page * 4 + 4).forEach((offer, i) => {
        const spec = DRONE_SPECS[offer.unitTypeId];
        const y = 355 + i * 145;
        pixelPanel(this, 36, y - 18, 648, 128);
        pixelPanel(this, 52, y - 2, 76, 84, 0x17252b);
        this.add.image(90, y + 37, unitPortrait(offer.unitTypeId)).setDisplaySize(76, 76);
        this.text(146, y, `T${spec.tier} ${spec.name}`, 22);
        this.text(146, y + 38, `${UNIT_MOVEMENT[offer.unitTypeId].role} · ${UNIT_TYPES[offer.unitTypeId].elements.map(element => ELEMENT_NAMES[element]).join('/')}`, 18);
        const free = roster.freeSummons > 0 && spec.tier === 1;
        this.text(146, y + 72, UNIT_SKILL_DESCRIPTIONS[offer.unitTypeId], 14, '#aab39b').setWordWrapWidth(510);
        this.button(570, y + 26, 180, free ? '소환권 사용' : `${offer.cost} ◆ 소환`, () => this.transact(() => roster.summon(offer.unitTypeId)),
          roster.canSummon(offer.unitTypeId));
      });
      this.pagination(Math.ceil(SUMMON_OFFERS.length / 4));
    } else if (this.tab === 'combine') {
      if (this.editingRecipe) {
        this.renderIngredientPicker(this.editingRecipe);
      } else {
      const available = COMBINATION_RECIPES.filter(recipe => roster.canCombine(recipe.id));
      this.text(44, 280, `지금 가능한 조합 ${available.length}개`, 18);
      this.button(575, 285, 200, this.availableOnly ? '전체 조합 보기' : '가능한 조합만', () => {
        this.availableOnly = !this.availableOnly; this.page = 0; this.render();
      });
      const recipes = [...(this.availableOnly ? available : COMBINATION_RECIPES)].sort((a, b) => b.priority - a.priority);
      this.page = Math.min(this.page, Math.max(0, Math.ceil(recipes.length / 3) - 1));
      recipes.slice(this.page * 3, this.page * 3 + 3).forEach((recipe, i) => {
        const y = 335 + i * 205;
        const selected = roster.ingredientsFor(recipe.id);
        const result = DRONE_SPECS[recipe.resultUnitTypeId];
        pixelPanel(this, 36, y - 15, 648, 190);
        this.add.image(80, y + 20, unitPortrait(recipe.resultUnitTypeId)).setDisplaySize(58, 58);
        this.text(120, y, `→ T${result.tier} ${result.name}${recipe.resultStar ? ` ★${recipe.resultStar}` : ''}`, 22, '#d9c287');
        recipeIngredientLines(recipe, roster.units).forEach((line, row) => {
          this.text(52, y + 51 + row * 24, line, 17).setName(`recipe-${recipe.id}-ingredient-${row}`);
        });
        this.text(52, y + 108, selected ? `소모: ${selected.map(u => `#${u.id.split('_')[1]} ★${u.star} ${u.deployed ? '출전' : '대기'}`).join(', ')}` : '필요한 재료가 부족합니다', 14, '#aab39b');
        const fits = !!selected && roster.units.length - selected.length + recipe.resultCount <= SQUAD_LIMITS.owned;
        this.text(120, y + 29, UNIT_SKILL_DESCRIPTIONS[recipe.resultUnitTypeId], 13, '#aab39b').setWordWrapWidth(535);
        this.button(550, y + 153, 220, `조합 (${recipe.cost} ◆)`, () => this.transact(() => roster.combine(recipe.id)),
          fits && roster.minerals >= recipe.cost);
        this.button(170, y + 153, 220, '재료 직접 선택', () => {
          this.editingRecipe = recipe; this.selectedIds = selected?.map(unit => unit.id) ?? []; this.pickerPage = 0; this.render();
        });
      });
      this.pagination(Math.max(1, Math.ceil(recipes.length / 3)));
      }
    } else {
      this.text(44, 280, '전투 불능: 12초 후 또는 다음 방에서 HP 50% 부활', 18);
      this.page = Math.min(this.page, Math.max(0, Math.ceil(roster.units.length / 5) - 1));
      roster.units.slice(this.page * 5, this.page * 5 + 5).forEach((unit, i) => {
        const y = 345 + i * 125;
        pixelPanel(this, 36, y - 14, 648, 114);
        this.add.image(88, y + 32, unitPortrait(unit.archetype)).setDisplaySize(72, 72);
        this.text(146, y, `T${unit.tier} ${DRONE_SPECS[unit.archetype].name} ★${unit.star}`, 20);
        this.text(146, y + 34, `#${unit.id.split('_')[1]} · ${UNIT_MOVEMENT[unit.archetype].role}`, 17, '#aab39b');
        const allowed = unit.deployed ? deployedCount > 1 : deployedCount < SQUAD_LIMITS.deployed;
        this.text(146, y + 60, UNIT_SKILL_DESCRIPTIONS[unit.archetype], 13, '#aab39b').setWordWrapWidth(315);
        this.button(570, y + 14, 180, unit.deployed ? '출전 → 대기' : '대기 → 출전',
          () => this.transact(() => roster.toggleDeployment(unit.id)), allowed);
        this.button(570, y + 69, 180, `판매 +${unit.tier * unit.star * SELL_REFUND_PER_TIER} ◆`,
          () => this.transact(() => roster.sell(unit.id)), !unit.deployed || deployedCount > 1);
      });
      this.pagination(Math.max(1, Math.ceil(roster.units.length / 5)));
    }
    this.button(GAME_WIDTH / 2, 1150, 600, this.dataSource.closeLabel ?? '책을 덮고 · 모험 계속', () => {
      if (this.closed) return;
      this.closed = true;
      this.input.enabled = false;
      this.dataSource.onClose();
      this.scene.stop();
    });
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
      fantasyButton(this, 88 + i * 136, 287, 112, 42, `${this.quickTier === tier ? '● ' : ''}${tier ? `T${tier}` : '전체'}`,
        () => { this.quickTier = tier; this.page = 0; this.render(); }, { fontSize: 18 }).setName(`quick-tier-${tier ?? 'all'}`);
    });
    this.text(44, 320, '새 재료 비용 포함 · 원하는 유닛을 선택하세요', 16, '#d9b969');
    const types = Object.values(UNIT_TYPES).filter(type => this.quickTier === null || type.tier === this.quickTier)
      .sort((a, b) => a.tier - b.tier);
    const plans = quickCraftPlans(roster.stageIndex);
    const pages = Math.max(1, Math.ceil(types.length / 6));
    this.page = Math.min(this.page, pages - 1);
    types.slice(this.page * 6, this.page * 6 + 6).forEach((type, i) => {
      const x = 36 + (i % 2) * 330, y = 361 + Math.floor(i / 2) * 211;
      const plan = plans.get(type.id);
      pixelPanel(this, x, y, 318, 194);
      this.add.image(x + 46, y + 47, unitPortrait(type.id)).setDisplaySize(64, 64);
      this.text(x + 87, y + 17, type.name, 20).setWordWrapWidth(218);
      this.text(x + 87, y + 52, `T${type.tier} ★1 · ${UNIT_MOVEMENT[type.id].role}`, 16, '#b6c0c8');
      this.text(x + 20, y + 96, plan ? `${plan.totalCost} ◆` : '제작 경로 없음', 23, '#f3c64d');
      fantasyButton(this, x + 159, y + 154, 276, 50, '제작 내용 보기', () => {
        if (!plan) return;
        this.quickQuote = plan; this.render();
      }, { enabled: !!plan, fontSize: 19 }).setName(`quick-craft-${type.id}`);
    });
    this.pagination(pages);
  }

  private renderIngredientPicker(recipe: CombinationRecipe): void {
    const roster = this.dataSource.roster;
    const count = recipe.ingredients.reduce((sum, item) => sum + item.count, 0);
    const candidates = roster.units.filter(unit => recipe.ingredients.some(item => matchesIngredient(unit, item)) &&
      (!recipe.ingredientStar || unit.star === recipe.ingredientStar));
    this.text(44, 280, `${DRONE_SPECS[recipe.resultUnitTypeId].name} · 재료 ${this.selectedIds.length}/${count} 선택`, 20);
    candidates.slice(this.pickerPage * 5, this.pickerPage * 5 + 5).forEach((unit, i) => {
      const y = 350 + i * 112;
      pixelPanel(this, 36, y - 14, 648, 98);
      this.text(55, y, `#${unit.id.split('_')[1]} ${DRONE_SPECS[unit.archetype].name} ★${unit.star}`, 21);
      this.text(55, y + 36, unit.deployed ? '출전 중' : '대기 중', 18);
      const selected = this.selectedIds.includes(unit.id);
      this.button(570, y + 24, 180, selected ? '선택 해제' : '재료로 선택', () => {
        this.selectedIds = selected ? this.selectedIds.filter(id => id !== unit.id) : [...this.selectedIds, unit.id]; this.render();
      }, selected || this.selectedIds.length < count);
    });
    const pages = Math.max(1, Math.ceil(candidates.length / 5));
    this.button(150, 970, 170, '이전 재료', () => { this.pickerPage--; this.render(); }, this.pickerPage > 0);
    this.button(570, 970, 170, '다음 재료', () => { this.pickerPage++; this.render(); }, this.pickerPage + 1 < pages);
    this.text(300, 957, `${this.pickerPage + 1}/${pages}`);
    this.button(180, 1040, 260, '조합 목록으로', () => { this.editingRecipe = null; this.render(); });
    this.button(530, 1040, 300, `선택 재료로 조합 ${recipe.cost} ◆`, () => this.transact(() => {
      const success = roster.combine(recipe.id, this.selectedIds);
      if (success) this.editingRecipe = null;
      return success;
    }), roster.canCombine(recipe.id, this.selectedIds));
  }

  private pagination(pages: number): void {
    this.button(150, 1030, 170, '이전', () => { this.page--; this.render(); }, this.page > 0);
    this.text(310, 1018, `${this.page + 1} / ${pages}`);
    this.button(570, 1030, 170, '다음', () => { this.page++; this.render(); }, this.page + 1 < pages);
  }
}
