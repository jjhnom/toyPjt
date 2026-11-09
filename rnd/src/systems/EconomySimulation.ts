import { STAGES, stageClearReward } from '../config/stageData';
import { DRONE_SPECS } from '../config/gameData';
import { UNIT_TYPES } from '../config/unitData';
import { SUMMON_OFFERS } from '../config/squadData';
import { RoomGridManager } from './RoomGridManager';
import { SquadRoster, quickCraftPlans } from './SquadRoster';
import { killReward, roomClearReward, waveEnemyTypes, LIVE_KILL_REWARD_POLICY } from './EncounterRules';
import type { KillRewardPolicy } from './EncounterRules';
import type { DroneArchetype, RoomNode } from '../types/game';

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function simulateEconomy(seed = 42, policy: KillRewardPolicy = LIVE_KILL_REWARD_POLICY,
  route: 'all' | 'boss' = 'all', circle: 'SAFE' | 'CHALLENGE' | 'SKIP' = 'SAFE') {
  const roster = new SquadRoster();
  const targets: DroneArchetype[] = ['PIERCE_BEAM', 'WORLD_DRUID', 'PHOENIX_LORD', 'EARTH_DEITY', 'STORM_GENERAL'];
  const stages = STAGES.map(stage => {
    roster.stageIndex = stage.index;
    const startBalance = roster.minerals;
    const manager = new RoomGridManager(stage, undefined, seededRandom(seed + stage.index));
    const rooms = manager.grid.flat().filter((room): room is RoomNode => room !== null);
    const boss = rooms.find(room => room.type === 'BOSS')!;
    // BFS predecessor path, stable neighbor order, same grid for every reward policy.
    const queue = [manager.getCurrentRoom()], previous = new Map<string, RoomNode | null>([[queue[0].id, null]]);
    for (const room of queue) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const next = manager.grid[room.gridY + dy]?.[room.gridX + dx];
      if (next && !previous.has(next.id)) { previous.set(next.id, room); queue.push(next); }
    }
    const shortest: RoomNode[] = [];
    for (let room: RoomNode | null = boss; room; room = previous.get(room.id) ?? null) shortest.unshift(room);
    const selected = route === 'all' ? [...queue.filter(room => room !== boss), boss] : shortest;
    let kills = 0, purchased = false;
    const plan = quickCraftPlans(stage.index).get(targets[stage.index])!;
    for (const room of selected) {
      roster.economy.roomId = room.id;
      const combat = room.type === 'COMBAT' || room.type === 'ELITE' || room.type === 'BOSS'
        || (room.type === 'EVENT' && circle === 'CHALLENGE');
      if (combat) {
        const waves = room.type === 'EVENT' ? 1 : room.waveCount;
        for (let wave = 1; wave <= waves; wave++) for (const enemy of waveEnemyTypes(stage, room, wave, waves)) {
          roster.grantReward(killReward(enemy, stage.index, policy), 0, 'kill', enemy); kills++;
        }
        if (room.type === 'BOSS') roster.grantReward(stageClearReward(stage), stage.isFinal ? 0 : 1, 'boss');
        else roster.grantReward(roomClearReward(room.type, stage.index), 0, 'room');
      }
      if (room.type === 'EVENT' && circle !== 'SKIP') roster.grantReward(0, 1, 'circle', circle);
      if (!purchased) purchased = roster.quickCraft(targets[stage.index], plan.totalCost);
    }
    roster.recordEconomy('stageEnd');
    const total = roster.economy.report().stages.find(item => item.stageIndex === stage.index)!;
    return { stageName: stage.name, roomIds: selected.map(room => room.id),
      kills, startBalance, endBalance: roster.minerals, vouchers: roster.freeSummons,
      owned: roster.units.length, deployed: roster.units.filter(unit => unit.deployed).length,
      purchase: purchased ? targets[stage.index] : null, ...total };
  });
  return { kind: 'required-spawn-model', seed, policy, route, circle,
    assumptions: ['All required enemies die, including boss escorts before the boss.',
      'No duration-dependent summons, deaths, healing, aiming, DPS, or human play is simulated.',
      'At most one fixed target is quick-crafted per stage, at the first affordable room clear.',
      'All-room route lists first-clear rooms in BFS order; revisits between them yield no rewards.',
      'Vouchers are accumulated, not priced as minerals or spent by quick crafting.'],
    stages, ledger: roster.economy.report() };
}

export function recipeCostReport(stageIndex: number) {
  return [...quickCraftPlans(stageIndex).values()].map(plan => {
    const unit = UNIT_TYPES[plan.unitTypeId], weapon = DRONE_SPECS[unit.id];
    const offer = SUMMON_OFFERS.find(item => item.unitTypeId === unit.id);
    return { unitTypeId: unit.id, name: unit.name, tier: unit.tier, role: unit.role,
      cost: plan.totalCost, summonCost: plan.summonCost, combinationCost: plan.combinationCost,
      directCost: offer && (unit.tier < 3 || stageIndex >= 2) ? offer.cost : null,
      maxHp: unit.maxHp, healPerTargetPerTick: unit.healAmount,
      nominalSingleTargetDps: weapon.damage * 1000 / weapon.fireRateMs,
      caveat: 'Nominal attack only; excludes hit rate, range, projectiles, AoE, skills and support value.' };
  });
}
