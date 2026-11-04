import Phaser from 'phaser';
import { FANTASY, pixelPanel, dungeonFloor } from '../ui/fantasyTheme';
import { unitTexture } from '../ui/pixelCharacters';
import { DRONE_SPECS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { COMBINATION_RECIPES, SELL_REFUND_PER_TIER, SQUAD_LIMITS, SUMMON_OFFERS, UNIT_MOVEMENT } from '../config/squadData';
import { SquadRoster, matchesIngredient } from '../systems/SquadRoster';
import { soundManager } from '../systems/SoundManager';
import { ELEMENT_NAMES, ROLE_NAMES, UNIT_TYPES } from '../config/unitData';
import type { CombinationRecipe, IngredientSpec } from '../types/game';

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
    this.render();
  }

  private text(x: number, y: number, value: string, size = 20, color = FANTASY.cream): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: FANTASY.font, fontSize: `${size}px`, resolution: 2, fontStyle: 'bold', color, wordWrap: { width: 580 }
    });
  }

  private button(x: number, y: number, width: number, label: string, action: () => void, enabled = true): void {
    pixelPanel(this, x - width / 2, y - 25, width, 50, enabled ? 0x3d5343 : 0x252e30, enabled ? 0xb8a16a : 0x515b51);
    const background = this.add.rectangle(x, y, width, 50, 0x000000, 0);
    this.text(x - width / 2 + 12, y - 13, label, 20, enabled ? '#f0e5c6' : '#86907f');
    if (enabled) background.setInteractive({ useHandCursor: true }).on('pointerdown', action);
  }

  private transact(action: () => boolean): void {
    if (this.closed) return;
    // Lock this rendered set immediately; a new render shows the committed state.
    this.input.enabled = false;
    const success = action();
    this.message = success ? '적용 완료' : '재료·잔액·공간 또는 출전 제한을 확인하세요';
    if (success) soundManager.playPowerup();
    this.render();
    this.input.enabled = true;
  }

  private render(): void {
    this.children.removeAll(true);
    const roster = this.dataSource.roster;
    const backdrop = this.add.graphics();
    dungeonFloor(backdrop, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x111a20, 0.82).setInteractive();
    pixelPanel(this, 24, 26, GAME_WIDTH - 48, 166);
    this.text(44, 55, this.dataSource.stageSummary ?? '소환의 서', this.dataSource.stageSummary ? 23 : 32, '#efe4c4');
    const deployedCount = roster.units.filter(unit => unit.deployed).length;
    this.text(44, 108, `${roster.minerals} ◆  |  보유 ${roster.units.length}/${SQUAD_LIMITS.owned}  |  출전 ${deployedCount}/${SQUAD_LIMITS.deployed}`);
    this.text(44, 148, this.message, 18, '#d9b969');
    const tabs = [['summon', '동료 소환'], ['combine', '조합의 제단'], ['roster', '원정대']] as const;
    tabs.forEach(([tab, title], i) => this.button(145 + i * 215, 228, 195,
      `${this.tab === tab ? '● ' : ''}${title}`, () => { this.tab = tab; this.page = 0; this.editingRecipe = null; this.render(); }));

    if (this.tab === 'summon') {
      this.text(44, 280, `T1 무료 소환권 ${roster.freeSummons}장 · T3 지정 소환은 STAGE 3부터`, 18);
      SUMMON_OFFERS.slice(this.page * 4, this.page * 4 + 4).forEach((offer, i) => {
        const spec = DRONE_SPECS[offer.unitTypeId];
        const y = 355 + i * 145;
        pixelPanel(this, 36, y - 18, 648, 128);
        pixelPanel(this, 52, y - 2, 76, 84, 0x17252b);
        this.add.image(90, y + 37, unitTexture(offer.unitTypeId)).setScale(1.6);
        this.text(146, y, `T${spec.tier} ${spec.name}`, 22);
        this.text(146, y + 38, `${UNIT_MOVEMENT[offer.unitTypeId].role} · ${UNIT_TYPES[offer.unitTypeId].elements.map(element => ELEMENT_NAMES[element]).join('/')}`, 18);
        const free = roster.freeSummons > 0 && spec.tier === 1;
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
        this.add.image(80, y + 10, unitTexture(recipe.resultUnitTypeId)).setScale(1.2);
        this.text(120, y, `→ T${result.tier} ${result.name}${recipe.resultStar ? ` ★${recipe.resultStar}` : ''}`, 22, '#d9c287');
        this.text(44, y + 40, recipe.ingredients.map(item =>
          `${this.ingredientLabel(item)} ${roster.units.filter(u => matchesIngredient(u, item) && (!recipe.ingredientStar || u.star === recipe.ingredientStar)).length}/${item.count}`
        ).join(' + '), 17);
        this.text(44, y + 96, selected ? `소모: ${selected.map(u => `#${u.id.split('_')[1]} ★${u.star} ${u.deployed ? '출전' : '대기'}`).join(', ')}` : '필요한 재료가 부족합니다', 16, '#aab39b');
        const fits = !!selected && roster.units.length - selected.length + recipe.resultCount <= SQUAD_LIMITS.owned;
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
        this.add.image(88, y + 32, unitTexture(unit.archetype)).setScale(1.5);
        this.text(146, y, `T${unit.tier} ${DRONE_SPECS[unit.archetype].name} ★${unit.star}`, 20);
        this.text(146, y + 34, `#${unit.id.split('_')[1]} · ${UNIT_MOVEMENT[unit.archetype].role}`, 17, '#aab39b');
        const allowed = unit.deployed ? deployedCount > 1 : deployedCount < SQUAD_LIMITS.deployed;
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

  private ingredientLabel(item: IngredientSpec): string {
    if (item.kind !== 'query') return DRONE_SPECS[item.unitTypeId].name;
    return `${item.element ? ELEMENT_NAMES[item.element] : ''}${item.role ? ROLE_NAMES[item.role] : ''} T${item.minTier ?? 1}~${item.maxTier ?? 4}`;
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
