import { getStageDefinition } from '../config/stageData';
import { RELIC_LIMIT, isRelicId } from '../config/relicData';
import type { RelicReward } from '../types/game';

export function parseRelicSource(value: unknown): { stageIndex: number; gridX: number; gridY: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^stage_(0|[1-9]\d*)_room_(0|[1-9]\d*)_(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;
  const [stageIndex, gridX, gridY] = match.slice(1).map(Number), stage = getStageDefinition(stageIndex);
  if (!stage || gridX >= stage.gridWidth || gridY >= stage.gridHeight ||
      (gridX === Math.floor(stage.gridWidth / 2) && gridY === Math.floor(stage.gridHeight / 2))) return null;
  return { stageIndex, gridX, gridY };
}

export function isRelicRewards(value: unknown, stageIndex: number): value is RelicReward[] {
  if (!Array.isArray(value) || value.length > RELIC_LIMIT) return false;
  const sources = new Set<string>(), relics = new Set<string>();
  const counts = new Map<number, number>();
  for (const reward of value) {
    if (typeof reward !== 'object' || reward === null || Array.isArray(reward)) return false;
    const source = parseRelicSource(reward.sourceRoomId);
    if (!source || source.stageIndex > stageIndex || sources.has(reward.sourceRoomId) ||
        (reward.relicId !== null && (!isRelicId(reward.relicId) || relics.has(reward.relicId)))) return false;
    const count = (counts.get(source.stageIndex) ?? 0) + 1;
    if (count > getStageDefinition(source.stageIndex)!.eliteCount) return false;
    counts.set(source.stageIndex, count);
    sources.add(reward.sourceRoomId);
    if (reward.relicId !== null) relics.add(reward.relicId);
  }
  return true;
}
