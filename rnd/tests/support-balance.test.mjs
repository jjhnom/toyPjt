import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { UNIT_TYPES } = load('src/config/unitData.ts');

test('stage-three support adjustment is limited to herbal healing and scales with the existing stars and interval', () => {
  assert.equal(UNIT_TYPES.HERBAL_PRIEST.healAmount, 3);
  assert.equal(UNIT_TYPES.MOON_PRIEST.healAmount, 4);
  assert.equal(UNIT_TYPES.WORLD_DRUID.healAmount, 6);
  assert.equal(UNIT_TYPES.HERBAL_PRIEST.summonCost, 25);
  for (const star of [1, 2, 3]) {
    const { squad, update } = fixture(['HERBAL_PRIEST', 'BASIC_LASER', 'BASIC_LASER']);
    squad.drones[0].star = star;
    squad.health.currentHp = 50; squad.drones[1].health.currentHp = 10;
    squad.drones[2].health.takeDamage(10000, 1);
    update(2999, false);
    assert.equal(squad.health.currentHp, 50);
    update(3000, false);
    assert.equal(squad.health.currentHp, 50 + 3 * star);
    assert.equal(squad.drones[1].health.currentHp, 10 + 3 * star);
    assert.equal(squad.drones[2].health.currentHp, 0, 'regular support never revives a fallen ally');
    update(5999, false); assert.equal(squad.health.currentHp, 50 + 3 * star);
    update(6000, false); assert.equal(squad.health.currentHp, 50 + 6 * star);
  }
});
