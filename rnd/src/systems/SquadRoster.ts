import { COMBINATION_RECIPES, SELL_REFUND_PER_TIER, SQUAD_LIMITS, SUMMON_OFFERS } from '../config/squadData';
import { UNIT_TYPES } from '../config/unitData';
import { EconomyLedger } from './EconomyLedger';
import { emptyUpgrades, isUpgradeId, upgradeCost } from '../config/upgradeData';
import type { UpgradeId, UpgradeQuote } from '../types/game';
import type { RelicId, RelicReward, RoomNode } from '../types/game';
import { isRelicId, relicCraftDiscount, discountedCombinationCost } from '../config/relicData';
import { parseRelicSource, isRelicRewards } from './RelicRewards';
import { awakeningCost, awakeningConsent, SERVICES, SIDE_SUPPLY, SUPPLY_CHOICES } from '../config/expeditionFacilities';
import type { AwakeningQuote, ServiceId, SupplyChoice } from '../types/game';
import type { EconomyReason } from './EconomyLedger';
import type { CombinationRecipe, DroneArchetype, DroneInstanceData, IngredientSpec, QuickCraftPlan, RosterSnapshot } from '../types/game';

export function matchesIngredient(unit: Pick<DroneInstanceData, 'archetype'>, item: IngredientSpec): boolean {
  if (item.kind !== 'query') return unit.archetype === item.unitTypeId;
  const type = UNIT_TYPES[unit.archetype];
  return (!item.element || type.elements.includes(item.element)) && (!item.role || type.role === item.role)
    && type.tier >= (item.minTier ?? 1) && type.tier <= (item.maxTier ?? 4);
}

/** Quote fresh materials only: never consume owned units, stars or free summon vouchers. */
export function quickCraftPlans(stageIndex: number, discount = 0): Map<DroneArchetype, QuickCraftPlan> {
  const plans = new Map<DroneArchetype, QuickCraftPlan>();
  const visiting = new Set<DroneArchetype>();
  const types = Object.values(UNIT_TYPES);
  const build = (id: DroneArchetype): QuickCraftPlan | null => {
    const cached = plans.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return null;
    visiting.add(id);
    let best: QuickCraftPlan | null = null;
    const offer = SUMMON_OFFERS.find(item => item.unitTypeId === id);
    if (offer && (UNIT_TYPES[id].tier < 3 || stageIndex >= 2)) {
      best = { unitTypeId: id, totalCost: offer.cost, summonCost: offer.cost, combinationCost: 0,
        summons: [{ unitTypeId: id, count: 1, unitCost: offer.cost }], combinations: [] };
    }
    for (const recipe of COMBINATION_RECIPES) {
      if (recipe.resultUnitTypeId !== id || recipe.kind === 'promotion' || recipe.resultCount !== 1 ||
          (recipe.resultStar !== undefined && recipe.resultStar !== 1) ||
          (recipe.ingredientStar !== undefined && recipe.ingredientStar !== 1)) continue;
      const fee = discountedCombinationCost(recipe.cost, discount);
      const candidate: QuickCraftPlan = { unitTypeId: id, totalCost: fee,
        summonCost: 0, combinationCost: fee, summons: [], combinations: [] };
      let possible = true;
      for (const ingredient of recipe.ingredients) {
        let material: QuickCraftPlan | null = null;
        for (const type of types) {
          if (!matchesIngredient({ archetype: type.id }, ingredient)) continue;
          const option = build(type.id);
          if (option && (!material || option.totalCost < material.totalCost)) material = option;
        }
        if (!material) { possible = false; break; }
        candidate.totalCost += material.totalCost * ingredient.count;
        candidate.summonCost += material.summonCost * ingredient.count;
        candidate.combinationCost += material.combinationCost * ingredient.count;
        for (const entry of material.summons) {
          const existing = candidate.summons.find(item => item.unitTypeId === entry.unitTypeId);
          if (existing) existing.count += entry.count * ingredient.count;
          else candidate.summons.push({ ...entry, count: entry.count * ingredient.count });
        }
        for (const entry of material.combinations) {
          const existing = candidate.combinations.find(item => item.recipeId === entry.recipeId);
          if (existing) existing.count += entry.count * ingredient.count;
          else candidate.combinations.push({ ...entry, count: entry.count * ingredient.count });
        }
      }
      candidate.combinations.push({ recipeId: recipe.id, count: 1, unitCost: fee });
      if (possible && (!best || candidate.totalCost < best.totalCost)) best = candidate;
    }
    visiting.delete(id);
    if (best) plans.set(id, best);
    return best;
  };
  for (const type of types) build(type.id);
  return plans;
}

/** Transactions validate before committing; scene sprites only project this state. */
export class SquadRoster {
  public units: DroneInstanceData[] = [];
  public stageIndex = 0;
  public freeSummons = 0;
  public upgrades = emptyUpgrades();
  public relicRewards: RelicReward[] = [];
  private nextId = 0;
  public readonly economy = new EconomyLedger();

  constructor(public minerals = 30) {
    this.createUnit('BASIC_LASER', true);
    this.createUnit('BASIC_LASER', true);
    this.economy.reset(this);
  }

  public snapshot(): RosterSnapshot {
    return { units: this.units.map(unit => ({ ...unit })), minerals: this.minerals,
      freeSummons: this.freeSummons, nextId: this.nextId, upgrades: { ...this.upgrades },
      relicRewards: this.relicRewards.map(reward => ({ ...reward })) };
  }

  /** Input has already passed checkpoint validation; preserve the ID high-water mark. */
  public restore(snapshot: RosterSnapshot, stageIndex: number): void {
    this.units = snapshot.units.map(unit => ({ ...unit }));
    this.minerals = snapshot.minerals;
    this.freeSummons = snapshot.freeSummons;
    this.nextId = snapshot.nextId;
    this.upgrades = snapshot.upgrades ? { ...snapshot.upgrades } : emptyUpgrades();
    this.relicRewards = snapshot.relicRewards?.map(reward => ({ ...reward })) ?? [];
    this.stageIndex = stageIndex;
    this.economy.reset(this);
  }

  public relicIds(): RelicId[] {
    return this.relicRewards.flatMap(reward => reward.relicId === null ? [] : [reward.relicId]);
  }

  public pendingRelicReward(): RelicReward | null {
    const reward = this.relicRewards.find(item => item.relicId === null);
    return reward ? { ...reward } : null;
  }

  public offerRelic(room: Pick<RoomNode, 'id' | 'type' | 'cleared'>): boolean {
    const source = parseRelicSource(room.id);
    if (room.type !== 'ELITE' || !room.cleared || source?.stageIndex !== this.stageIndex) return false;
    const reward = { sourceRoomId: room.id, relicId: null };
    if (!isRelicRewards([...this.relicRewards, reward], this.stageIndex)) return false;
    this.relicRewards.push(reward);
    return true;
  }

  public claimRelic(sourceRoomId: string, id: RelicId): boolean {
    if (!isRelicId(id) || this.pendingRelicReward()?.sourceRoomId !== sourceRoomId || this.relicIds().includes(id)) return false;
    this.relicRewards.find(reward => reward.sourceRoomId === sourceRoomId)!.relicId = id;
    this.recordEconomy('relic', 0, 0, `${sourceRoomId}:${id}`);
    return true;
  }

  public craftDiscount(): number { return relicCraftDiscount(this.relicIds()); }

  public awakeningQuote(unitId: string): AwakeningQuote | null {
    const unit = this.units.find(item => item.id === unitId);
    const cost = unit ? awakeningCost(unit) : null;
    return cost === null ? null : { unitId, level: unit!.awakening ?? 0, cost };
  }

  public awaken(quote: AwakeningQuote): boolean {
    if (!quote) return false;
    const current = this.awakeningQuote(quote.unitId);
    if (!current || quote.level !== current.level || quote.cost !== current.cost ||
      !Number.isSafeInteger(this.minerals) || this.minerals < current.cost) return false;
    this.minerals -= current.cost;
    this.units.find(unit => unit.id === current.unitId)!.awakening = current.level + 1;
    this.recordEconomy('awakening', -current.cost, 0, `${current.unitId}:${current.level + 1}`);
    return true;
  }

  public payService(id: ServiceId, expectedCost: number): boolean {
    if (!Object.prototype.hasOwnProperty.call(SERVICES, id) || SERVICES[id].cost !== expectedCost ||
      !Number.isSafeInteger(this.minerals) || this.minerals < expectedCost) return false;
    this.minerals -= expectedCost; this.recordEconomy('service', -expectedCost, 0, id); return true;
  }

  public claimSupply(room: RoomNode, choice: SupplyChoice): boolean {
    if (!room.sideSupply || room.type !== 'COMBAT' || !room.cleared || room.supplyChoice !== undefined ||
      parseRelicSource(room.id)?.stageIndex !== this.stageIndex || !SUPPLY_CHOICES.includes(choice)) return false;
    room.supplyChoice = choice;
    const minerals = choice === 'MINERALS' ? SIDE_SUPPLY.minerals : 0;
    const vouchers = choice === 'VOUCHERS' ? SIDE_SUPPLY.vouchers : 0;
    this.minerals += minerals; this.freeSummons += vouchers;
    this.recordEconomy('supply', minerals, vouchers, `${room.id}:${choice}`); return true;
  }

  public combinationCost(recipeId: string): number {
    const recipe = COMBINATION_RECIPES.find(item => item.id === recipeId);
    return recipe ? discountedCombinationCost(recipe.cost, this.craftDiscount()) : 0;
  }

  public upgradeQuote(id: UpgradeId): UpgradeQuote | null {
    if (!isUpgradeId(id)) return null;
    const level = this.upgrades[id], cost = upgradeCost(id, level);
    return cost === null ? null : { id, level, cost };
  }

  public buyUpgrade(quote: UpgradeQuote): boolean {
    if (!quote || !isUpgradeId(quote.id)) return false;
    const current = this.upgradeQuote(quote.id);
    if (!current || quote.level !== current.level || quote.cost !== current.cost ||
        !Number.isSafeInteger(this.minerals) || this.minerals < current.cost) return false;
    this.minerals -= current.cost;
    this.upgrades[current.id]++;
    this.recordEconomy('upgrade', -current.cost, 0, `${current.id}:${current.level + 1}`);
    return true;
  }

  public grantReward(minerals: number, vouchers: number, reason: 'kill' | 'room' | 'boss' | 'circle', detail = ''): void {
    this.minerals += minerals; this.freeSummons += vouchers;
    this.economy.record(this, reason, minerals, vouchers, detail);
  }

  public recordEconomy(reason: EconomyReason, minerals = 0, vouchers = 0, detail = ''): void {
    this.economy.record(this, reason, minerals, vouchers, detail);
  }

  private createUnit(archetype: DroneArchetype, deployed: boolean, star: 1 | 2 | 3 = 1): void {
    this.units.push({ id: `unit_${++this.nextId}`, archetype, tier: UNIT_TYPES[archetype].tier, deployed, star });
  }

  public canSummon(archetype: DroneArchetype): boolean {
    const offer = SUMMON_OFFERS.find(item => item.unitTypeId === archetype);
    const type = UNIT_TYPES[archetype];
    if (!offer || !type || (type.tier >= 3 && this.stageIndex < 2)) return false;
    return this.units.length < SQUAD_LIMITS.owned &&
      ((this.freeSummons > 0 && type.tier === 1) || this.minerals >= offer.cost);
  }

  public summon(archetype: DroneArchetype): boolean {
    if (!this.canSummon(archetype)) return false;
    const offer = SUMMON_OFFERS.find(item => item.unitTypeId === archetype)!;
    const free = this.freeSummons > 0 && UNIT_TYPES[archetype].tier === 1;
    if (free) this.freeSummons--;
    else this.minerals -= offer.cost;
    this.createUnit(archetype, this.units.filter(unit => unit.deployed).length < SQUAD_LIMITS.deployed);
    this.recordEconomy('summon', free ? 0 : -offer.cost, free ? -1 : 0, archetype);
    return true;
  }

  public quickCraft(archetype: DroneArchetype, expectedCost: number): boolean {
    const plan = quickCraftPlans(this.stageIndex, this.craftDiscount()).get(archetype);
    if (!plan || !Number.isSafeInteger(expectedCost) || expectedCost < 0 || expectedCost !== plan.totalCost ||
        this.units.length >= SQUAD_LIMITS.owned || this.minerals < plan.totalCost) return false;
    // Materials are purchased and combined in this transaction; only its final unit occupies the roster.
    this.minerals -= plan.totalCost;
    this.createUnit(archetype, this.units.filter(unit => unit.deployed).length < SQUAD_LIMITS.deployed);
    this.recordEconomy('quickCraft', -plan.totalCost, 0, archetype);
    return true;
  }

  private selectIngredients(recipe: CombinationRecipe, candidates: DroneInstanceData[]): DroneInstanceData[] | null {
    const slots = recipe.ingredients.flatMap(item => Array.from({ length: item.count }, () => item));
    const selected: DroneInstanceData[] = [];
    // Broad queries cannot steal the only candidate for a later exact ingredient.
    const pick = (index: number): boolean => {
      if (index === slots.length) return true;
      for (const unit of candidates) {
        if (selected.includes(unit) || !matchesIngredient(unit, slots[index]) ||
            (recipe.ingredientStar !== undefined && unit.star !== recipe.ingredientStar)) continue;
        selected.push(unit);
        if (pick(index + 1)) return true;
        selected.pop();
      }
      return false;
    };
    return pick(0) ? selected : null;
  }

  public ingredientsFor(recipeId: string, selectedIds?: string[]): DroneInstanceData[] | null {
    const recipe = COMBINATION_RECIPES.find(item => item.id === recipeId);
    if (!recipe) return null;
    if (selectedIds && new Set(selectedIds).size !== selectedIds.length) return null;
    const candidates = selectedIds ? selectedIds.map(id => this.units.find(unit => unit.id === id))
      : [...this.units].sort((a, b) => (a.awakening ?? 0) - (b.awakening ?? 0) || Number(a.deployed) - Number(b.deployed) || a.star - b.star || a.tier - b.tier);
    if (candidates.some(unit => !unit)) return null;
    if (selectedIds && selectedIds.length !== recipe.ingredients.reduce((sum, item) => sum + item.count, 0)) return null;
    return this.selectIngredients(recipe, candidates as DroneInstanceData[]);
  }

  public canCombine(recipeId: string, selectedIds?: string[]): boolean {
    const recipe = COMBINATION_RECIPES.find(item => item.id === recipeId);
    const selected = this.ingredientsFor(recipeId, selectedIds);
    return !!recipe && !!selected && this.minerals >= this.combinationCost(recipeId) &&
      this.units.length - selected.length + recipe.resultCount <= SQUAD_LIMITS.owned;
  }

  public combine(recipeId: string, selectedIds?: string[], consent = ''): boolean {
    if (!this.canCombine(recipeId, selectedIds)) return false;
    const recipe = COMBINATION_RECIPES.find(item => item.id === recipeId)!;
    const selected = this.ingredientsFor(recipeId, selectedIds)!;
    if (awakeningConsent(selected) !== consent) return false;
    this.units = this.units.filter(unit => !selected.includes(unit));
    const cost = this.combinationCost(recipeId);
    this.minerals -= cost;
    let deployedCount = this.units.filter(unit => unit.deployed).length;
    for (let i = 0; i < recipe.resultCount; i++) {
      const deployed = deployedCount < SQUAD_LIMITS.deployed;
      this.createUnit(recipe.resultUnitTypeId, deployed, recipe.resultStar);
      if (deployed) deployedCount++;
    }
    this.recordEconomy(recipe.kind === 'promotion' ? 'promotion' : 'combine', -cost, 0, recipeId);
    return true;
  }

  public sell(id: string, consent = ''): boolean {
    const unit = this.units.find(item => item.id === id);
    if (!unit || awakeningConsent([unit]) !== consent || (unit.deployed && this.units.filter(item => item.deployed).length <= 1)) return false;
    this.units = this.units.filter(item => item !== unit);
    this.minerals += SELL_REFUND_PER_TIER * unit.tier * unit.star;
    this.recordEconomy('sell', SELL_REFUND_PER_TIER * unit.tier * unit.star, 0, id);
    return true;
  }

  public toggleDeployment(id: string): boolean {
    const unit = this.units.find(item => item.id === id);
    if (!unit) return false;
    const deployed = this.units.filter(item => item.deployed).length;
    if ((!unit.deployed && deployed >= SQUAD_LIMITS.deployed) || (unit.deployed && deployed <= 1)) return false;
    unit.deployed = !unit.deployed;
    this.recordEconomy('deployment', 0, 0, id);
    return true;
  }
}
