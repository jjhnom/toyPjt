import { SIDE_SUPPLY } from '../config/expeditionFacilities';
import type { RoomNode } from '../types/game';
const offsets = [[0,-1],[0,1],[-1,0],[1,0]] as const;
/** Optional combat-room overlay, outside every shortest route to the boss; no graph/count changes. */
export function sideSupplyCandidate(grid: (RoomNode | null)[][], stageIndex: number): RoomNode | null {
  if (stageIndex < SIDE_SUPPLY.minStageIndex) return null;
  const start = grid[Math.floor(grid.length / 2)]?.[Math.floor(grid[0].length / 2)];
  const boss = grid.flat().find(room => room?.type === 'BOSS');
  if (!start || !boss) return null;
  const distances = (source: RoomNode) => {
    const result = new Map([[source.id, 0]]), queue = [source];
    for (const room of queue) for (const [dx,dy] of offsets) {
      const neighbor = grid[room.gridY + dy]?.[room.gridX + dx];
      if (neighbor && !result.has(neighbor.id)) { result.set(neighbor.id, result.get(room.id)! + 1); queue.push(neighbor); }
    }
    return result;
  };
  const fromStart = distances(start), fromBoss = distances(boss), bossDistance = fromStart.get(boss.id)!;
  return grid.flat().filter((room): room is RoomNode => !!room && room !== start && room.type === 'COMBAT' &&
    fromStart.get(room.id)! + fromBoss.get(room.id)! > bossDistance)
    .sort((a,b) => Number(Object.values(a.doors).filter(Boolean).length !== 1) - Number(Object.values(b.doors).filter(Boolean).length !== 1)
      || fromStart.get(b.id)! - fromStart.get(a.id)! || a.gridY - b.gridY || a.gridX - b.gridX)[0] ?? null;
}
