import { COMBINATION_RECIPES, SELL_REFUND_PER_TIER, SQUAD_LIMITS, SUMMON_OFFERS } from '../config/squadData';
import { UNIT_TYPES } from '../config/unitData';
import type { CombinationRecipe, DroneArchetype, DroneInstanceData, IngredientSpec } from '../types/game';

export function matchesIngredient(unit: DroneInstanceData, item: IngredientSpec): boolean {
  if (item.kind !== 'query') return unit.archetype === item.unitTypeId;
  const type = UNIT_TYPES[unit.archetype];
  return (!item.element || type.elements.includes(item.element)) && (!item.role || type.role === item.role)
    && type.tier >= (item.minTier ?? 1) && type.tier <= (item.maxTier ?? 4);
}

/** Transactions validate before committing; scene sprites only project this state. */
export class SquadRoster {
  public units: DroneInstanceData[] = [];
  public stageIndex = 0;
  public freeSummons = 0;
  private nextId = 0;

  constructor(public minerals = 30) {
    this.createUnit('BASIC_LASER', true);
    this.createUnit('BASIC_LASER', true);
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
    if (this.freeSummons > 0 && UNIT_TYPES[archetype].tier === 1) this.freeSummons--;
    else this.minerals -= offer.cost;
    this.createUnit(archetype, this.units.filter(unit => unit.deployed).length < SQUAD_LIMITS.deployed);
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
      : [...this.units].sort((a, b) => Number(a.deployed) - Number(b.deployed) || a.star - b.star || a.tier - b.tier);
    if (candidates.some(unit => !unit)) return null;
    if (selectedIds && selectedIds.length !== recipe.ingredients.reduce((sum, item) => sum + item.count, 0)) return null;
    return this.selectIngredients(recipe, candidates as DroneInstanceData[]);
  }

  public canCombine(recipeId: string, selectedIds?: string[]): boolean {
    const recipe = COMBINATION_RECIPES.find(item => item.id === recipeId);
    const selected = this.ingredientsFor(recipeId, selectedIds);
    return !!recipe && !!selected && this.minerals >= recipe.cost &&
      this.units.length - selected.length + recipe.resultCount <= SQUAD_LIMITS.owned;
  }

  public combine(recipeId: string, selectedIds?: string[]): boolean {
    if (!this.canCombine(recipeId, selectedIds)) return false;
    const recipe = COMBINATION_RECIPES.find(item => item.id === recipeId)!;
    const selected = this.ingredientsFor(recipeId, selectedIds)!;
    this.units = this.units.filter(unit => !selected.includes(unit));
    this.minerals -= recipe.cost;
    let deployedCount = this.units.filter(unit => unit.deployed).length;
    for (let i = 0; i < recipe.resultCount; i++) {
      const deployed = deployedCount < SQUAD_LIMITS.deployed;
      this.createUnit(recipe.resultUnitTypeId, deployed, recipe.resultStar);
      if (deployed) deployedCount++;
    }
    return true;
  }

  public sell(id: string): boolean {
    const unit = this.units.find(item => item.id === id);
    if (!unit || (unit.deployed && this.units.filter(item => item.deployed).length <= 1)) return false;
    this.units = this.units.filter(item => item !== unit);
    this.minerals += SELL_REFUND_PER_TIER * unit.tier * unit.star;
    return true;
  }

  public toggleDeployment(id: string): boolean {
    const unit = this.units.find(item => item.id === id);
    if (!unit) return false;
    const deployed = this.units.filter(item => item.deployed).length;
    if ((!unit.deployed && deployed >= SQUAD_LIMITS.deployed) || (unit.deployed && deployed <= 1)) return false;
    unit.deployed = !unit.deployed;
    return true;
  }
}
