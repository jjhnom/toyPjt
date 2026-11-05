import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

// Load the pure TypeScript model without a browser or generated files.
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const require = name => name.startsWith('.') ? load(resolve(dirname(file), `${name}.ts`)) : nativeRequire(name);
  new Function('require', 'module', 'exports', source)(require, module, module.exports);
  return module.exports;
}
const { SquadRoster } = load(resolve('src/systems/SquadRoster.ts'));
const { SQUAD_LIMITS, COMBINATION_RECIPES, UNIT_MOVEMENT } = load(resolve('src/config/squadData.ts'));
const { DRONE_SPECS } = load(resolve('src/config/gameData.ts'));
const { UNIT_ART_FRAMES, UNIT_ART_CELL, UNIT_ART_COLUMNS } = load(resolve('src/ui/unitArt.ts'));
const { recipeIngredientLines } = load(resolve('src/ui/recipePresentation.ts'));
const snapshot = roster => JSON.stringify({ minerals: roster.minerals, units: roster.units });

test('every summon and recipe unit has distinct art within the shipped atlas', () => {
  assert.deepEqual(Object.keys(UNIT_ART_FRAMES).sort(), Object.keys(DRONE_SPECS).sort());
  const frames = Object.values(UNIT_ART_FRAMES);
  assert.equal(new Set(frames).size, frames.length);
  const png = readFileSync(resolve('src/assets/units-v3/units-atlas.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), UNIT_ART_COLUMNS * UNIT_ART_CELL);
  assert.equal(png.readUInt32BE(20), Math.ceil(frames.length / UNIT_ART_COLUMNS) * UNIT_ART_CELL);
  const manifest = JSON.parse(readFileSync(resolve('src/assets/units-v3/sources/manifest.json'), 'utf8'));
  assert.deepEqual(manifest.map(unit => unit.id).sort(), Object.keys(DRONE_SPECS).sort());
  for (const unit of manifest) {
    assert.equal(manifest.indexOf(unit), UNIT_ART_FRAMES[unit.id], unit.id);
    assert.ok(readFileSync(resolve('src/assets/units-v3/sources', unit.file)).length > 0, unit.id);
  }
});

test('summon charges once, assigns a unique ID, and rejects insufficient funds', () => {
  const roster = new SquadRoster(15);
  assert.equal(roster.summon('BASIC_LASER'), true);
  assert.equal(roster.minerals, 0);
  assert.equal(roster.units.length, 3);
  assert.equal(new Set(roster.units.map(u => u.id)).size, 3);
  const before = snapshot(roster);
  assert.equal(roster.summon('BASIC_LASER'), false);
  assert.equal(snapshot(roster), before);
});

test('full deployment sends summons to reserve; full ownership never charges', () => {
  const roster = new SquadRoster(10000);
  while (roster.units.length < SQUAD_LIMITS.owned) assert.equal(roster.summon('BASIC_LASER'), true);
  assert.equal(roster.units.filter(u => u.deployed).length, SQUAD_LIMITS.deployed);
  const before = snapshot(roster);
  assert.equal(roster.summon('BASIC_LASER'), false);
  assert.equal(snapshot(roster), before);
});

test('same-type combination consumes two distinct instances and creates a new ID', () => {
  const roster = new SquadRoster();
  const oldIds = roster.units.map(u => u.id);
  assert.equal(roster.combine('gatling'), true);
  assert.equal(roster.units.length, 1);
  assert.equal(roster.units[0].archetype, 'GATLING_BOT');
  assert.equal(roster.units[0].deployed, true);
  assert.equal(oldIds.includes(roster.units[0].id), false);
  const before = snapshot(roster);
  assert.equal(roster.combine('gatling'), false);
  assert.equal(snapshot(roster), before);
});

test('mixed-type combination consumes exactly the matching ingredients', () => {
  const roster = new SquadRoster(100);
  assert.equal(roster.summon('GATLING_BOT'), true);
  const survivor = roster.units[1].id;
  assert.equal(roster.combine('cryo'), true);
  assert.equal(roster.units.length, 2);
  assert.ok(roster.units.some(u => u.id === survivor));
  assert.ok(roster.units.some(u => u.archetype === 'STUN_BOT'));
  assert.equal(roster.minerals, 60);
});

test('paid recipe failure preserves ingredients; success deducts exact cost', () => {
  const roster = new SquadRoster(80);
  roster.stageIndex = 2;
  roster.summon('ROCKET_BOT');
  roster.summon('STUN_BOT');
  const before = snapshot(roster);
  assert.equal(roster.combine('blackhole'), false);
  assert.equal(snapshot(roster), before);
  roster.minerals = 10;
  assert.equal(roster.combine('blackhole'), true);
  assert.equal(roster.minerals, 0);
  assert.ok(roster.units.some(u => u.archetype === 'BLACKHOLE_MISSILE'));
});

test('deployment enforces the upper limit and keeps at least one combat unit', () => {
  const roster = new SquadRoster(1000);
  for (let i = 0; i < 5; i++) roster.summon('BASIC_LASER');
  const reserve = roster.units.find(u => !u.deployed);
  assert.equal(roster.toggleDeployment(reserve.id), false);
  assert.equal(roster.toggleDeployment(roster.units[0].id), true);
  assert.equal(roster.toggleDeployment(reserve.id), true);
  for (const unit of roster.units) if (unit.deployed) roster.toggleDeployment(unit.id);
  assert.equal(roster.units.filter(u => u.deployed).length, 1);
  assert.equal(roster.toggleDeployment('missing'), false);
});

test('combining at ownership capacity frees space and new runs reset inventory', () => {
  const roster = new SquadRoster(10000);
  while (roster.units.length < SQUAD_LIMITS.owned) roster.summon('BASIC_LASER');
  assert.equal(roster.combine('gatling'), true);
  assert.equal(roster.units.length, SQUAD_LIMITS.owned - 1);
  assert.ok(roster.units.filter(u => u.deployed).length <= SQUAD_LIMITS.deployed);
  const fresh = new SquadRoster();
  assert.equal(fresh.units.length, 2);
  assert.equal(fresh.minerals, 30);
});

test('every configured recipe is attainable, consumes distinct IDs, and produces a valid unit', () => {
  for (const recipe of COMBINATION_RECIPES) {
    const roster = new SquadRoster(10000);
    roster.units = [];
    for (const item of recipe.ingredients) {
      const type = Object.values(UNIT_TYPES).find(type => matchesIngredient({ archetype: type.id }, item));
      assert.ok(type, `ingredient exists for ${recipe.id}`);
      for (let i = 0; i < item.count; i++) roster.units.push({ id: `fixture_${roster.units.length}`, archetype: type.id,
        tier: type.tier, star: recipe.ingredientStar ?? 1, deployed: true });
    }
    const selected = roster.ingredientsFor(recipe.id);
    assert.equal(new Set(selected.map(u => u.id)).size, selected.length);
    const balance = roster.minerals;
    assert.equal(roster.combine(recipe.id), true);
    assert.equal(roster.units.length, recipe.resultCount);
    assert.equal(roster.minerals, balance - recipe.cost);
    assert.equal(roster.units[0].archetype, recipe.resultUnitTypeId);
    assert.ok(UNIT_MOVEMENT[recipe.resultUnitTypeId].preferredRange <= DRONE_SPECS[recipe.resultUnitTypeId].range);
  }
});

const { UNIT_TYPES } = load(resolve('src/config/unitData.ts'));
const { matchesIngredient } = load(resolve('src/systems/SquadRoster.ts'));

test('conditional recipe descriptions identify every real material and count only eligible units', () => {
  const roster = new SquadRoster(1000);
  const fixture = ids => ids.map((id, i) => ({ id: `fixture_${i}`, archetype: id, tier: UNIT_TYPES[id].tier, star: 1, deployed: true }));
  const recipe = id => COMBINATION_RECIPES.find(item => item.id === id);
  const cases = [
    ['phoenix', ['LAVA_GOLEM', 'LAVA_GOLEM', 'MOON_PRIEST'],
      ['용암 골렘 · 보유 2 / 필요 2', '달빛 사제 · 보유 1 / 필요 1']],
    ['thunder', ['STORM_ARCHER', 'STORM_ARCHER'], ['폭풍 궁수 · 보유 2 / 필요 2']],
    ['druid', ['GATLING_BOT', 'THORN_GUARD', 'MOON_PRIEST'],
      ['바람 순찰자 또는 가시 수호자 · 보유 2 / 필요 1', '달빛 사제 · 보유 1 / 필요 1']]
  ];
  for (const [id, types, lines] of cases) {
    roster.units = fixture(types);
    assert.deepEqual(recipeIngredientLines(recipe(id), roster.units), lines);
    assert.equal(roster.canCombine(id), true);
  }
  roster.units = fixture(['ROCKET_BOT', 'PHOENIX_LORD', 'BLACKHOLE_MISSILE', 'MOON_PRIEST']);
  assert.equal(recipeIngredientLines(recipe('phoenix'), roster.units)[0], '용암 골렘 · 보유 0 / 필요 2');
  assert.equal(roster.canCombine('phoenix'), false, 'T1 and T4 fire units cannot replace T2 lava golems');
  for (const forest of ['GATLING_BOT', 'THORN_GUARD']) {
    roster.units = fixture([forest, 'MOON_PRIEST']);
    assert.equal(roster.canCombine('druid'), true, `${forest} remains a valid alternative`);
  }
  for (const item of COMBINATION_RECIPES) {
    assert.equal(recipeIngredientLines(item, []).some(line => line.includes('해당 유닛 없음')), false, item.id);
  }
});

test('promotion descriptions show required stars and exclude other stars from owned counts', () => {
  const recipe = COMBINATION_RECIPES.find(item => item.id === 'promote_BASIC_LASER_1');
  const units = [1, 1, 2, 3].map((star, i) => ({ id: `fixture_${i}`, archetype: 'BASIC_LASER', tier: 1, star, deployed: false }));
  assert.deepEqual(recipeIngredientLines(recipe, units), ['숲의 사수 ★1 · 보유 2 / 필요 3']);
});

test('all units and recipes form an acyclic graph reachable from summonable T1 units', () => {
  const recipes = COMBINATION_RECIPES.filter(recipe => recipe.kind !== 'promotion');
  const reachable = new Set(Object.values(UNIT_TYPES).filter(unit => unit.summonable && unit.tier === 1).map(unit => unit.id));
  for (let pass = 0; pass < recipes.length; pass++) for (const recipe of recipes) {
    if (recipe.ingredients.every(item => [...reachable].some(id => matchesIngredient({ archetype: id }, item))))
      reachable.add(recipe.resultUnitTypeId);
  }
  assert.deepEqual([...reachable].sort(), Object.keys(UNIT_TYPES).sort());
  const dependencies = new Map();
  const signatures = new Set();
  for (const recipe of recipes) {
    assert.ok(UNIT_TYPES[recipe.resultUnitTypeId]);
    const deps = [];
    for (const ingredient of recipe.ingredients) {
      const candidates = Object.values(UNIT_TYPES).filter(unit => matchesIngredient({ archetype: unit.id }, ingredient));
      assert.ok(candidates.length > 0);
      for (const unit of candidates) {
        assert.ok(UNIT_TYPES[recipe.resultUnitTypeId].tier >= unit.tier, recipe.id);
        deps.push(unit.id);
      }
    }
    dependencies.set(recipe.resultUnitTypeId, [...(dependencies.get(recipe.resultUnitTypeId) ?? []), ...deps]);
    const signature = `${recipe.priority}:${JSON.stringify([...recipe.ingredients].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))}`;
    assert.equal(signatures.has(signature), false, recipe.id);
    signatures.add(signature);
  }
  function visit(id, path = new Set()) {
    assert.equal(path.has(id), false, `cycle at ${id}`);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency, new Set([...path, id]));
  }
  for (const unit of Object.values(UNIT_TYPES)) {
    assert.ok(DRONE_SPECS[unit.weaponId], unit.id);
    assert.equal(unit.tier, DRONE_SPECS[unit.id].tier);
    visit(unit.id);
  }
});

test('manual ingredients reject duplicates, missing IDs, wrong types, and wrong quantities without mutation', () => {
  const roster = new SquadRoster(100);
  const [first, second] = roster.units;
  for (const ids of [[first.id, first.id], [first.id, 'missing'], [first.id], [first.id, second.id, 'missing']]) {
    const before = snapshot(roster);
    assert.equal(roster.combine('gatling', ids), false);
    assert.equal(snapshot(roster), before);
  }
  assert.equal(roster.combine('gatling', [first.id, second.id]), true);
});

test('queries prefer reserves and promotion consumes three equal stars and raises instance stats', () => {
  const roster = new SquadRoster(1000);
  roster.units = [
    { id: 'a', archetype: 'STORM_ARCHER', tier: 2, star: 2, deployed: true },
    { id: 'b', archetype: 'STORM_ARCHER', tier: 2, star: 1, deployed: false },
    { id: 'c', archetype: 'STORM_ARCHER', tier: 2, star: 1, deployed: false }
  ];
  assert.deepEqual(roster.ingredientsFor('thunder').map(unit => unit.id), ['b', 'c']);
  assert.equal(roster.combine('thunder'), true);
  assert.ok(roster.units.some(unit => unit.id === 'a'));
  const basic = new SquadRoster(100);
  basic.summon('BASIC_LASER');
  assert.equal(basic.combine('promote_BASIC_LASER_1'), true);
  assert.equal(basic.units.length, 1);
  assert.equal(basic.units[0].star, 2);
  assert.equal(basic.combine('promote_BASIC_LASER_1'), false);
});

test('high-tier offers unlock in stage 3, sale preserves one deployed unit, and full inventory retains vouchers', () => {
  const roster = new SquadRoster(10000);
  assert.equal(roster.summon('STUN_BOT'), false);
  roster.stageIndex = 2;
  assert.equal(roster.summon('STUN_BOT'), true);
  while (roster.units.length < SQUAD_LIMITS.owned) roster.summon('BASIC_LASER');
  roster.freeSummons = 1;
  const minerals = roster.minerals;
  assert.equal(roster.summon('BASIC_LASER'), false);
  assert.equal(roster.freeSummons, 1);
  assert.equal(roster.minerals, minerals);
  const reserve = roster.units.find(unit => !unit.deployed);
  assert.equal(roster.sell(reserve.id), true);
  assert.equal(roster.summon('BASIC_LASER'), true);
  assert.equal(roster.freeSummons, 0);
  assert.equal(roster.minerals, minerals + 10);
  for (const unit of [...roster.units]) roster.sell(unit.id);
  assert.equal(roster.units.filter(unit => unit.deployed).length, 1);
});
