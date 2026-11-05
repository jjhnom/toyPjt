import { STAGES, getStageScaling } from '../config/stageData';
import { SQUAD_LIMITS } from '../config/squadData';
import { UNIT_TYPES } from '../config/unitData';
import type { RunCheckpoint, RoomNode } from '../types/game';

export const RUN_SAVE_KEY = 'smash.run-checkpoint.v1';
type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type CheckpointLoad = { status: 'ready'; checkpoint: RunCheckpoint }
  | { status: 'empty' | 'invalid' | 'unavailable' };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const directions = [['top', 0, -1], ['bottom', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const;

/** Reject incomplete, incompatible, and mid-stage saves before mutating a run. */
export function isRunCheckpoint(value: unknown): value is RunCheckpoint {
  if (!record(value) || value.version !== 1 || !integer(value.savedAt) || !record(value.stats) ||
      !record(value.roster) || !record(value.leaderHealth) || !Array.isArray(value.unitHealth)) return false;
  const stats = value.stats, roster = value.roster, health = value.leaderHealth;
  if (!integer(stats.stageIndex) || stats.stageIndex >= STAGES.length || stats.bossesDefeated !== stats.stageIndex ||
      !integer(stats.roomsCleared) || stats.roomsCleared < stats.stageIndex || !integer(stats.enemiesDefeated) ||
      stats.bossDefeated !== false || !positive(stats.damageMultiplier) || !positive(stats.attackSpeedMultiplier) ||
      typeof stats.moveSpeedBonus !== 'number' || !Number.isFinite(stats.moveSpeedBonus) || stats.moveSpeedBonus < 0 ||
      !positive(health.maxHp) || !positive(health.currentHp) || health.currentHp > health.maxHp ||
      !integer(roster.minerals) || stats.mineralsCollected !== roster.minerals || !integer(roster.freeSummons) ||
      !integer(roster.nextId) || roster.nextId >= Number.MAX_SAFE_INTEGER || !Array.isArray(roster.units) ||
      roster.units.length < 1 || roster.units.length > SQUAD_LIMITS.owned) return false;
  const ids = new Set<string>();
  const deployed = new Map<string, number>();
  for (const unit of roster.units) {
    if (!record(unit) || typeof unit.id !== 'string' || !/^unit_[1-9]\d*$/.test(unit.id) || ids.has(unit.id) ||
        !integer(Number(unit.id.slice(5))) || Number(unit.id.slice(5)) > roster.nextId ||
        typeof unit.archetype !== 'string' || !Object.prototype.hasOwnProperty.call(UNIT_TYPES, unit.archetype) ||
        typeof unit.deployed !== 'boolean' || ![1, 2, 3].includes(unit.star as number)) return false;
    const type = UNIT_TYPES[unit.archetype as keyof typeof UNIT_TYPES];
    if (unit.tier !== type.tier) return false;
    ids.add(unit.id);
    if (unit.deployed) deployed.set(unit.id, Math.round(type.maxHp * (1 + 0.5 * ((unit.star as number) - 1))));
  }
  if (deployed.size < 1 || deployed.size > SQUAD_LIMITS.deployed || value.unitHealth.length !== deployed.size) return false;
  for (const unit of value.unitHealth) {
    if (!record(unit) || typeof unit.id !== 'string' || !deployed.has(unit.id) ||
        !positive(unit.currentHp) || unit.currentHp > deployed.get(unit.id)!) return false;
    deployed.delete(unit.id);
  }
  return validGrid(value.grid, stats.stageIndex);
}

function validGrid(value: unknown, index: number): boolean {
  const stage = STAGES[index];
  if (!Array.isArray(value) || value.length !== stage.gridHeight ||
      !value.every(row => Array.isArray(row) && row.length === stage.gridWidth)) return false;
  const startX = Math.floor(stage.gridWidth / 2), startY = Math.floor(stage.gridHeight / 2);
  const counts = { COMBAT: 0, ELITE: 0, EVENT: 0, RECOVERY: 0, BOSS: 0 };
  for (let y = 0; y < value.length; y++) for (let x = 0; x < value[y].length; x++) {
    const room = value[y][x];
    if (room === null) continue;
    const start = x === startX && y === startY;
    if (!record(room) || room.id !== `stage_${index}_room_${x}_${y}` || room.gridX !== x || room.gridY !== y ||
        typeof room.type !== 'string' || !Object.prototype.hasOwnProperty.call(counts, room.type) || !record(room.doors) ||
        room.cleared !== false || room.visited !== start || room.circleChoice !== undefined ||
        (start && room.type !== 'COMBAT')) return false;
    for (const [direction, dx, dy] of directions) {
      if (room.doors[direction] !== !!value[y + dy]?.[x + dx]) return false;
    }
    const expectedWaves = room.type === 'EVENT' || room.type === 'RECOVERY' ? 0 : room.type === 'BOSS' ? 1
      : (start ? 1 : 2) + getStageScaling(index).waveCountBonus;
    if (room.waveCount !== expectedWaves) return false;
    counts[room.type as keyof typeof counts]++;
  }
  if (!value[startY][startX] || counts.BOSS !== 1 || counts.EVENT !== 1 || counts.RECOVERY !== 1 ||
      counts.ELITE !== stage.eliteCount || Object.values(counts).reduce((sum, count) => sum + count, 0) !== stage.roomCount) return false;
  const grid = value as (RoomNode | null)[][];
  const start = grid[startY][startX]!;
  const distances = new Map([[start.id, 0]]);
  const queue = [start];
  let bossDistance = -1, maxDistance = 0;
  for (const room of queue) {
    const distance = distances.get(room.id)!;
    if (room.type === 'BOSS') bossDistance = distance;
    maxDistance = Math.max(maxDistance, distance);
    for (const [, dx, dy] of directions) {
      const neighbor = grid[room.gridY + dy]?.[room.gridX + dx];
      if (neighbor && !distances.has(neighbor.id)) {
        distances.set(neighbor.id, distance + 1);
        queue.push(neighbor);
      }
    }
  }
  return distances.size === stage.roomCount && bossDistance === maxDistance;
}

function browserStorage(): SaveStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
}

export class RunSaveManager {
  private suppressed = false;
  constructor(private readonly storage: SaveStorage | null = browserStorage()) {}

  public load(): CheckpointLoad {
    if (!this.storage || this.suppressed) return { status: 'unavailable' };
    try {
      const saved = this.storage.getItem(RUN_SAVE_KEY);
      if (saved === null) return { status: 'empty' };
      try {
        const checkpoint: unknown = JSON.parse(saved);
        // Legacy stage-start saves differ only in the old shop label; validate the entire grid afterwards.
        if (record(checkpoint) && Array.isArray(checkpoint.grid)) {
          for (const row of checkpoint.grid) if (Array.isArray(row)) {
            for (const room of row) if (record(room) && room.type === 'SHOP') room.type = 'EVENT';
          }
        }
        return isRunCheckpoint(checkpoint) ? { status: 'ready', checkpoint } : { status: 'invalid' };
      } catch { return { status: 'invalid' }; }
    } catch { return { status: 'unavailable' }; }
  }

  public save(checkpoint: RunCheckpoint): boolean {
    if (!this.storage) return false;
    try {
      if (!isRunCheckpoint(checkpoint)) { this.clear(); return false; }
      // One key replacement is atomic: no half-written grid or inventory.
      this.storage.setItem(RUN_SAVE_KEY, JSON.stringify(checkpoint));
      this.suppressed = false;
      return true;
    } catch {
      // Do not offer an obsolete stage if a newer checkpoint could not be written.
      this.clear();
      return false;
    }
  }

  public clear(): boolean {
    this.suppressed = true;
    if (!this.storage) return false;
    try { this.storage.removeItem(RUN_SAVE_KEY); this.suppressed = false; return true; }
    catch { return false; }
  }
}

export const runSaveManager = new RunSaveManager();
