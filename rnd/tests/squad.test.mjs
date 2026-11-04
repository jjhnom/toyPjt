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
const snapshot = roster => JSON.stringify({ minerals: roster.minerals, units: roster.units });

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
      for (let i = 0; i < item.count; i++) assert.equal(roster.summon(item.unitTypeId), true);
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
