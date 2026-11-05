import { UNIT_TYPES } from '../config/unitData';
import { matchesIngredient } from '../systems/SquadRoster';
import type { CombinationRecipe, DroneInstanceData } from '../types/game';

/** Resolve the same predicate used by transactions to real, obtainable unit names. */
export function recipeIngredientLines(recipe: CombinationRecipe, units: readonly DroneInstanceData[]): string[] {
  return recipe.ingredients.map(item => {
    const names = Object.values(UNIT_TYPES).filter(type => matchesIngredient({ archetype: type.id }, item))
      .map(type => type.name).join(' 또는 ');
    const star = recipe.ingredientStar === undefined ? '' : ` ★${recipe.ingredientStar}`;
    const owned = units.filter(unit => matchesIngredient(unit, item) &&
      (recipe.ingredientStar === undefined || unit.star === recipe.ingredientStar)).length;
    return `${names || '해당 유닛 없음'}${star} · 보유 ${owned} / 필요 ${item.count}`;
  });
}
