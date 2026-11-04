import { DRONE_SPECS } from '../config/gameData';
import { COMBINATION_RECIPES, SQUAD_LIMITS, SUMMON_OFFERS } from '../config/squadData';
import type { DroneArchetype, DroneInstanceData } from '../types/game';

/** Owns the transaction state; scene sprites are only projections of this roster. */
export class SquadRoster {
  public units: DroneInstanceData[] = [];
  private nextId = 0;

  constructor(public minerals = 30) {
    this.createUnit('BASIC_LASER', true);
    this.createUnit('BASIC_LASER', true);
  }

  private createUnit(archetype: DroneArchetype, deployed: boolean): void {
    this.units.push({ id: `unit_${++this.nextId}`, archetype, tier: DRONE_SPECS[archetype].tier, deployed });
  }

  public summon(archetype: DroneArchetype): boolean {
    const offer = SUMMON_OFFERS.find(item => item.unitTypeId === archetype);
    if (!offer || this.minerals < offer.cost || this.units.length >= SQUAD_LIMITS.owned) return false;
    const deployed = this.units.filter(unit => unit.deployed).length < SQUAD_LIMITS.deployed;
    this.minerals -= offer.cost;
    this.createUnit(archetype, deployed);
    return true;
  }

  public ingredientsFor(recipeId: string): DroneInstanceData[] | null {
    const recipe = COMBINATION_RECIPES.find(item => item.id === recipeId);
    if (!recipe) return null;
    const selected: DroneInstanceData[] = [];
    for (const ingredient of recipe.ingredients) {
      const candidates = this.units.filter(unit => unit.archetype === ingredient.unitTypeId && !selected.includes(unit));
      if (candidates.length < ingredient.count) return null;
      selected.push(...candidates.slice(0, ingredient.count));
    }
    return selected;
  }

  public combine(recipeId: string): boolean {
    const recipe = COMBINATION_RECIPES.find(item => item.id === recipeId);
    const selected = this.ingredientsFor(recipeId);
    if (!recipe || !selected || this.minerals < recipe.cost ||
        this.units.length - selected.length + recipe.resultCount > SQUAD_LIMITS.owned) return false;
    const remaining = this.units.filter(unit => !selected.includes(unit));
    let deployedCount = remaining.filter(unit => unit.deployed).length;
    this.units = remaining;
    this.minerals -= recipe.cost;
    for (let i = 0; i < recipe.resultCount; i++) {
      const deployed = deployedCount < SQUAD_LIMITS.deployed;
      this.createUnit(recipe.resultUnitTypeId, deployed);
      if (deployed) deployedCount++;
    }
    return true;
  }

  public toggleDeployment(id: string): boolean {
    const unit = this.units.find(item => item.id === id);
    if (!unit) return false;
    if (!unit.deployed && this.units.filter(item => item.deployed).length >= SQUAD_LIMITS.deployed) return false;
    // Keep at least one combat unit so the run cannot become unwinnable.
    if (unit.deployed && this.units.filter(item => item.deployed).length <= 1) return false;
    unit.deployed = !unit.deployed;
    return true;
  }
}
