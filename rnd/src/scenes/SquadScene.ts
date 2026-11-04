import Phaser from 'phaser';
import { FANTASY, pixelPanel, dungeonFloor } from '../ui/fantasyTheme';
import { unitTexture } from '../ui/pixelCharacters';
import { DRONE_SPECS, GAME_HEIGHT, GAME_WIDTH } from '../config/gameData';
import { COMBINATION_RECIPES, SQUAD_LIMITS, SUMMON_OFFERS, UNIT_MOVEMENT } from '../config/squadData';
import { SquadRoster } from '../systems/SquadRoster';
import { soundManager } from '../systems/SoundManager';

interface SquadSceneData { roster: SquadRoster; message: string; onClose: () => void }

export class SquadScene extends Phaser.Scene {
  private dataSource!: SquadSceneData;
  private tab: 'summon' | 'combine' | 'roster' = 'summon';
  private page = 0;
  private message = '';
  private closed = false;

  constructor() { super('SquadScene'); }

  public create(data: SquadSceneData): void {
    this.input.enabled = true;
    this.dataSource = data;
    this.tab = 'summon';
    this.page = 0;
    this.message = data.message;
    this.closed = false;
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
    this.text(44, 55, '소환의 서', 32, '#efe4c4');
    const deployedCount = roster.units.filter(unit => unit.deployed).length;
    this.text(44, 108, `${roster.minerals} ◆  |  보유 ${roster.units.length}/${SQUAD_LIMITS.owned}  |  출전 ${deployedCount}/${SQUAD_LIMITS.deployed}`);
    this.text(44, 148, this.message, 18, '#d9b969');
    const tabs = [['summon', '동료 소환'], ['combine', '조합의 제단'], ['roster', '원정대']] as const;
    tabs.forEach(([tab, title], i) => this.button(145 + i * 215, 228, 195,
      `${this.tab === tab ? '● ' : ''}${title}`, () => { this.tab = tab; this.page = 0; this.render(); }));

    if (this.tab === 'summon') {
      this.text(44, 280, '마력석으로 동료를 소환하세요. 빈자리가 없으면 대기합니다.', 18);
      SUMMON_OFFERS.forEach((offer, i) => {
        const spec = DRONE_SPECS[offer.unitTypeId];
        const y = 355 + i * 145;
        pixelPanel(this, 36, y - 18, 648, 128);
        pixelPanel(this, 52, y - 2, 76, 84, 0x17252b);
        this.add.image(90, y + 37, unitTexture(offer.unitTypeId)).setScale(1.6);
        this.text(146, y, spec.name, 23);
        this.text(146, y + 38, `${UNIT_MOVEMENT[offer.unitTypeId].role} · 보유 ${roster.units.filter(u => u.archetype === offer.unitTypeId).length}기`, 18);
        this.button(570, y + 26, 180, `${offer.cost} ◆ 소환`, () => this.transact(() => roster.summon(offer.unitTypeId)),
          roster.minerals >= offer.cost && roster.units.length < SQUAD_LIMITS.owned);
      });
    } else if (this.tab === 'combine') {
      this.text(44, 280, '동료들의 힘을 모아 더 높은 존재를 소환합니다.', 18);
      COMBINATION_RECIPES.slice(this.page * 3, this.page * 3 + 3).forEach((recipe, i) => {
        const y = 335 + i * 205;
        const selected = roster.ingredientsFor(recipe.id);
        const result = DRONE_SPECS[recipe.resultUnitTypeId];
        pixelPanel(this, 36, y - 15, 648, 190);
        this.add.image(80, y + 10, unitTexture(recipe.resultUnitTypeId)).setScale(1.2);
        this.text(120, y, `→ ${result.name} ×${recipe.resultCount}`, 24, '#d9c287');
        this.text(44, y + 40, recipe.ingredients.map(item =>
          `${DRONE_SPECS[item.unitTypeId].name} ${roster.units.filter(u => u.archetype === item.unitTypeId).length}/${item.count}`
        ).join(' + '), 17);
        this.text(44, y + 96, selected ? `소모: ${selected.map(u => `#${u.id.split('_')[1]} ${u.deployed ? '출전' : '대기'}`).join(', ')}` : '필요한 재료가 부족합니다', 16, '#aab39b');
        const fits = !!selected && roster.units.length - selected.length + recipe.resultCount <= SQUAD_LIMITS.owned;
        this.button(550, y + 153, 220, `조합 (${recipe.cost} ◆)`, () => this.transact(() => roster.combine(recipe.id)),
          fits && roster.minerals >= recipe.cost);
      });
      this.pagination(Math.ceil(COMBINATION_RECIPES.length / 3));
    } else {
      this.text(44, 280, '최소 1기 출전 · 개별 유닛은 피해를 받지 않습니다', 18);
      roster.units.slice(this.page * 5, this.page * 5 + 5).forEach((unit, i) => {
        const y = 345 + i * 113;
        pixelPanel(this, 36, y - 14, 648, 98);
        this.add.image(88, y + 32, unitTexture(unit.archetype)).setScale(1.5);
        this.text(146, y, DRONE_SPECS[unit.archetype].name, 22);
        this.text(146, y + 34, `#${unit.id.split('_')[1]} · ${UNIT_MOVEMENT[unit.archetype].role}`, 17, '#aab39b');
        const allowed = unit.deployed ? deployedCount > 1 : deployedCount < SQUAD_LIMITS.deployed;
        this.button(570, y + 24, 180, unit.deployed ? '출전 → 대기' : '대기 → 출전',
          () => this.transact(() => roster.toggleDeployment(unit.id)), allowed);
      });
      this.pagination(Math.max(1, Math.ceil(roster.units.length / 5)));
    }
    this.button(GAME_WIDTH / 2, 1150, 360, '책을 덮고 · 모험 계속', () => {
      if (this.closed) return;
      this.closed = true;
      this.input.enabled = false;
      this.dataSource.onClose();
      this.scene.stop();
    });
  }

  private pagination(pages: number): void {
    this.button(150, 1030, 170, '이전', () => { this.page--; this.render(); }, this.page > 0);
    this.text(310, 1018, `${this.page + 1} / ${pages}`);
    this.button(570, 1030, 170, '다음', () => { this.page++; this.render(); }, this.page + 1 < pages);
  }
}
