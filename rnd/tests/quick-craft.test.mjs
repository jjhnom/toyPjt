import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers/skill-fixture.mjs';

const { SquadRoster, quickCraftPlans } = load('src/systems/SquadRoster.ts');
const { UNIT_TYPES } = load('src/config/unitData.ts');
const { SQUAD_LIMITS } = load('src/config/squadData.ts');

test('every quick quote can be reproduced with actual paid summons and combinations at the same price', () => {
  for (const stage of [0, 1, 2, 3, 4]) {
    const plans = quickCraftPlans(stage);
    assert.equal(plans.size, Object.keys(UNIT_TYPES).length);
    for (const [id, plan] of plans) {
      assert.equal(plan.unitTypeId, id);
      assert.equal(plan.totalCost, plan.summonCost + plan.combinationCost);
      const manual = new SquadRoster(plan.totalCost);
      manual.units = []; manual.stageIndex = stage;
      for (const material of plan.summons) for (let i = 0; i < material.count; i++) {
        assert.equal(manual.summon(material.unitTypeId), true, `stage ${stage} ${id}: ${material.unitTypeId}`);
      }
      for (const step of plan.combinations) for (let i = 0; i < step.count; i++) {
        assert.equal(manual.combine(step.recipeId), true, `stage ${stage} ${id}: ${step.recipeId}`);
      }
      assert.equal(manual.minerals, 0, id);
      assert.equal(manual.units.length, 1, id);
      assert.equal(manual.units[0].archetype, id);
      assert.equal(manual.units[0].star, 1);
    }
  }
});

test('quotes compare direct offers, intermediate recipes and eligible query materials without bypassing direct summon gates', () => {
  const early = quickCraftPlans(0), late = quickCraftPlans(2);
  assert.equal(early.get('GATLING_BOT').totalCost, 30);
  assert.equal(early.get('STUN_BOT').totalCost, 45);
  assert.equal(late.get('STUN_BOT').totalCost, 40);
  assert.equal(early.get('BLACKHOLE_MISSILE').totalCost, 95);
  assert.equal(early.get('WORLD_DRUID').totalCost, 115);
  assert.equal(early.get('PHOENIX_LORD').totalCost, 250);
  assert.equal(early.get('EARTH_DEITY').totalCost, 295);
  assert.equal(early.get('WORLD_DRUID').combinations.some(step => step.recipeId === 'gatling'), true);
  assert.equal(early.get('STUN_BOT').summons.some(item => item.unitTypeId === 'STUN_BOT'), false);
  assert.equal(late.get('STUN_BOT').summons.some(item => item.unitTypeId === 'STUN_BOT'), true);
});

test('quick craft charges exactly once and preserves all existing IDs, stars, deployment and vouchers', () => {
  const roster = new SquadRoster(250);
  roster.freeSummons = 3; roster.units[0].star = 3;
  const existing = structuredClone(roster.units), lastId = roster.snapshot().nextId;
  assert.equal(roster.quickCraft('PHOENIX_LORD', 250), true);
  assert.equal(roster.minerals, 0);
  assert.deepEqual(roster.units.slice(0, 2), existing);
  assert.equal(roster.freeSummons, 3);
  assert.deepEqual(roster.units.at(-1), { id: `unit_${lastId + 1}`, archetype: 'PHOENIX_LORD', tier: 4, star: 1, deployed: true });
  const before = roster.snapshot();
  assert.equal(roster.quickCraft('PHOENIX_LORD', 250), false);
  assert.deepEqual(roster.snapshot(), before);
});

test('failures and stale quotes preserve the entire roster, currency, vouchers and ID high-water mark', () => {
  const roster = new SquadRoster(1000);
  roster.freeSummons = 2;
  for (const [id, price] of [['PHOENIX_LORD', 0], ['PHOENIX_LORD', -1], ['PHOENIX_LORD', NaN],
    ['PHOENIX_LORD', Infinity], ['unknown', 250], ['__proto__', 250]]) {
    const before = roster.snapshot();
    assert.equal(roster.quickCraft(id, price), false);
    assert.deepEqual(roster.snapshot(), before);
  }
  roster.stageIndex = 2;
  const before = roster.snapshot();
  assert.equal(roster.quickCraft('STUN_BOT', 45), false);
  assert.deepEqual(roster.snapshot(), before);
});

test('only one final inventory slot is needed; full deployment sends the result to reserves', () => {
  const roster = new SquadRoster(10000);
  while (roster.units.length < SQUAD_LIMITS.owned - 1) roster.summon('BASIC_LASER');
  assert.equal(roster.quickCraft('EARTH_DEITY', 295), true);
  assert.equal(roster.units.length, 16);
  assert.equal(roster.units.at(-1).deployed, false);
  assert.equal(roster.units.filter(unit => unit.deployed).length, 6);
  const before = roster.snapshot();
  assert.equal(roster.quickCraft('BASIC_LASER', 15), false);
  assert.deepEqual(roster.snapshot(), before);
});

test('returned quotes cannot change the next quote or transaction price', () => {
  const quote = quickCraftPlans(0).get('PHOENIX_LORD');
  quote.totalCost = 0; quote.summons.length = 0;
  const roster = new SquadRoster(0);
  assert.equal(roster.quickCraft('PHOENIX_LORD', quote.totalCost), false);
  assert.equal(quickCraftPlans(0).get('PHOENIX_LORD').totalCost, 250);
});
