import { mkdir, writeFile } from 'node:fs/promises';
import { load } from './lib/load-typescript.mjs';

const { simulateEconomy, recipeCostReport } = load('src/systems/EconomySimulation.ts');
const { LIVE_KILL_REWARD_POLICY } = load('src/systems/EncounterRules.ts');
const seed = Number(process.argv[2] ?? 42);
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be a uint32');
const scenarios = [];
for (const route of ['all', 'boss']) for (const policy of ['linear', 'unscaled', 'sqrt']) {
  scenarios.push(simulateEconomy(seed, policy, route, 'SAFE'));
}
const report = { seed, livePolicy: LIVE_KILL_REWARD_POLICY, scenarios,
  recipeCosts: [0, 2].map(stageIndex => ({ stageIndex, units: recipeCostReport(stageIndex) })) };
await mkdir('artifacts/economy', { recursive: true });
await writeFile('artifacts/economy/simulation.json', JSON.stringify(report, null, 2) + '\n');
console.log('Required-spawn model; not measured gameplay. SAFE circle, one fixed craft target/stage.');
console.log(`Live kill reward policy: ${LIVE_KILL_REWARD_POLICY}; linear is the pre-roadmap baseline.`);
console.table(scenarios.flatMap(s => s.stages.map(stage => ({ route: s.route, policy: s.policy,
  stage: stage.stageIndex + 1, kills: stage.kills, income: stage.income, spent: stage.spent, balance: stage.endBalance }))));
console.log('Saved artifacts/economy/simulation.json');
