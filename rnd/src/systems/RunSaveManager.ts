import { STAGES, getStageScaling, getStageDefinition, isSupportedStageIndex, isMutationAvailable } from '../config/stageData';
import { SQUAD_LIMITS, SUPPORT_HEAL_INTERVAL_MS, UNIT_REVIVE_DELAY_MS } from '../config/squadData';
import { UNIQUE_SKILLS } from '../config/skillData';
import { UNIT_TYPES } from '../config/unitData';
import type { RunCheckpoint, RoomNode, DroneInstanceData } from '../types/game';
import { isHeroSnapshot } from './HeroProgression';
import { emptyUpgrades, isUpgradeLevels } from '../config/upgradeData';
import { resolveUpgradeEffects, upgradedUnitMaxHp } from './UpgradeEffects';
import { isRelicRewards, parseRelicSource } from './RelicRewards';
import { RELIC_HEAL_INTERVAL_MS } from '../config/relicData';
import { validAwakening, SUPPLY_CHOICES } from '../config/expeditionFacilities';
import { sideSupplyCandidate } from './SideSupply';

export const RUN_SAVE_KEY = 'smash.run-checkpoint.v1';
export const RUN_SAVE_BACKUP_KEY = 'smash.run-checkpoint.backup';
type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type CheckpointLoad = { status: 'ready'; checkpoint: RunCheckpoint; recovered?: boolean }
  | { status: 'empty' | 'invalid' | 'unavailable' };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const remaining = (value: unknown, max: number): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const directions = [['top', 0, -1], ['bottom', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const;

/** Validate the complete snapshot before mutating any live state. */
export function isRunCheckpoint(value: unknown): value is RunCheckpoint {
  if (!record(value) || ![1, 2].includes(value.version as number) || !integer(value.savedAt) || !record(value.stats) ||
      !record(value.roster) || !record(value.leaderHealth) || !Array.isArray(value.unitHealth)) return false;
  const modern = value.version === 2;
  if (modern && (typeof value.runId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.runId) ||
      !['stage-start', 'room-cleared', 'stage-cleared'].includes(value.phase as string) ||
      typeof value.currentRoomId !== 'string')) return false;
  const stats = value.stats, roster = value.roster, health = value.leaderHealth;
  if (roster.relicRewards !== undefined && !isRelicRewards(roster.relicRewards, stats.stageIndex as number)) return false;
  if (value.relicHealRemainingMs !== undefined && (!remaining(value.relicHealRemainingMs, RELIC_HEAL_INTERVAL_MS) ||
      (!roster.relicRewards?.some(reward => reward.relicId === 'SEED_CHALICE') && value.relicHealRemainingMs !== RELIC_HEAL_INTERVAL_MS))) return false;
  if (roster.upgrades !== undefined && !isUpgradeLevels(roster.upgrades)) return false;
  const effects = resolveUpgradeEffects(roster.upgrades ?? emptyUpgrades());
  if (value.hero !== undefined && (!isHeroSnapshot(value.hero) ||
      value.hero.kills.hero + value.hero.kills.unit + value.hero.kills.environment > (stats.enemiesDefeated as number))) return false;
  const bossCleared = modern && value.phase === 'stage-cleared';
  const mode = value.mode === undefined ? 'campaign' : value.mode;
  const choice = value.endlessChoice === undefined ? 'none' : value.endlessChoice;
  const mutation = value.mutation === undefined ? 'NONE' : value.mutation;
  const nextMutation = value.nextMutation === undefined ? 'NONE' : value.nextMutation;
  const choiceStage = bossCleared && (stats.stageIndex as number) >= 4;
  if (!isSupportedStageIndex(stats.stageIndex) ||
      !isMutationAvailable(stats.stageIndex, mutation) ||
      (choice === 'continue' ? !isMutationAvailable(stats.stageIndex + 1, nextMutation) : nextMutation !== 'NONE') ||
      !['campaign', 'endless'].includes(mode as string) || !['none', 'pending', 'continue', 'exit'].includes(choice as string) ||
      (mode === 'endless' ? !modern || stats.stageIndex < 5 : stats.stageIndex >= STAGES.length) ||
      (choiceStage ? !['pending', 'continue', 'exit'].includes(choice as string) : choice !== 'none') ||
      (choice === 'continue' && !getStageDefinition(stats.stageIndex + 1)) ||
      stats.bossesDefeated !== stats.stageIndex + Number(bossCleared) ||
      !integer(stats.roomsCleared) || stats.roomsCleared < stats.stageIndex || !integer(stats.enemiesDefeated) ||
      stats.bossDefeated !== (stats.stageIndex >= 5 || choiceStage) || !positive(stats.damageMultiplier) || !positive(stats.attackSpeedMultiplier) ||
      typeof stats.moveSpeedBonus !== 'number' || !Number.isFinite(stats.moveSpeedBonus) || stats.moveSpeedBonus < 0 ||
      !positive(health.maxHp) || !positive(health.currentHp) || health.currentHp > health.maxHp ||
      !integer(roster.minerals) || stats.mineralsCollected !== roster.minerals || !integer(roster.freeSummons) ||
      !integer(roster.nextId) || roster.nextId >= Number.MAX_SAFE_INTEGER || !Array.isArray(roster.units) ||
      roster.units.length < 1 || roster.units.length > SQUAD_LIMITS.owned) return false;
  const ids = new Set<string>();
  const deployed = new Map<string, number>();
  const skillCooldowns = new Map<string, number>();
  for (const unit of roster.units) {
    if (!record(unit) || typeof unit.id !== 'string' || !/^unit_[1-9]\d*$/.test(unit.id) || ids.has(unit.id) ||
        !integer(Number(unit.id.slice(5))) || Number(unit.id.slice(5)) > roster.nextId ||
        typeof unit.archetype !== 'string' || !Object.prototype.hasOwnProperty.call(UNIT_TYPES, unit.archetype) ||
        typeof unit.deployed !== 'boolean' || ![1, 2, 3].includes(unit.star as number)) return false;
    const type = UNIT_TYPES[unit.archetype as keyof typeof UNIT_TYPES];
    if (unit.tier !== type.tier || !validAwakening(unit as unknown as DroneInstanceData)) return false;
    ids.add(unit.id);
    if (unit.deployed) {
      deployed.set(unit.id, upgradedUnitMaxHp(type.id, unit.star as number, effects.squadHealth, unit.awakening as number | undefined));
      skillCooldowns.set(unit.id, unit.archetype === 'PHOENIX_LORD' ? UNIQUE_SKILLS.phoenix.cooldownMs
        : unit.archetype === 'EARTH_DEITY' ? UNIQUE_SKILLS.deity.cooldownMs : 0);
    }
  }
  if (deployed.size < 1 || deployed.size > SQUAD_LIMITS.deployed || value.unitHealth.length !== deployed.size) return false;
  for (const unit of value.unitHealth) {
    if (!record(unit) || typeof unit.id !== 'string' || !deployed.has(unit.id) ||
        typeof unit.currentHp !== 'number' || !Number.isFinite(unit.currentHp) || unit.currentHp < 0 ||
        unit.currentHp > deployed.get(unit.id)! || (!modern && unit.currentHp === 0)) return false;
    if (modern && (!remaining(unit.reviveRemainingMs, UNIT_REVIVE_DELAY_MS) ||
        !remaining(unit.healRemainingMs, SUPPORT_HEAL_INTERVAL_MS) ||
        !remaining(unit.skillRemainingMs, skillCooldowns.get(unit.id)!) ||
        (unit.currentHp > 0 && unit.reviveRemainingMs !== 0) ||
        (value.phase === 'stage-start' && unit.currentHp === 0))) return false;
    deployed.delete(unit.id);
  }
  if (!validGrid(value.grid, stats.stageIndex, modern ? value : undefined)) return false;
  // Historical sources retain canonical coordinates; current-stage sources must be actual cleared elites.
  for (const reward of roster.relicRewards ?? []) {
    const source = parseRelicSource(reward.sourceRoomId)!;
    if (source.stageIndex === stats.stageIndex) {
      const room = (value.grid as (RoomNode | null)[][])[source.gridY][source.gridX];
      if (room?.type !== 'ELITE' || !room.cleared) return false;
    }
  }
  return true;
}

function validGrid(value: unknown, index: number, checkpoint?: Record<string, unknown>): boolean {
  const stage = getStageDefinition(index)!;
  if (!Array.isArray(value) || value.length !== stage.gridHeight ||
      !value.every(row => Array.isArray(row) && row.length === stage.gridWidth)) return false;
  const startX = Math.floor(stage.gridWidth / 2), startY = Math.floor(stage.gridHeight / 2);
  const counts = { COMBAT: 0, ELITE: 0, EVENT: 0, RECOVERY: 0, BOSS: 0 };
  const stageStart = !checkpoint || checkpoint.phase === 'stage-start';
  let current: RoomNode | undefined;
  let cleared = 0;
  for (let y = 0; y < value.length; y++) for (let x = 0; x < value[y].length; x++) {
    const room = value[y][x];
    if (room === null) continue;
    const start = x === startX && y === startY;
    if (!record(room) || room.id !== `stage_${index}_room_${x}_${y}` || room.gridX !== x || room.gridY !== y ||
        typeof room.type !== 'string' || !Object.prototype.hasOwnProperty.call(counts, room.type) || !record(room.doors) ||
        typeof room.cleared !== 'boolean' || typeof room.visited !== 'boolean' ||
        (stageStart && (room.cleared || room.visited !== start || room.circleChoice !== undefined)) ||
        (!stageStart && (room.cleared !== room.visited || (start && !room.cleared))) ||
        (start && room.type !== 'COMBAT')) return false;
    if (!stageStart) {
      if (room.type === 'EVENT' && room.cleared) {
        if (!['SAFE', 'CHALLENGE', 'SKIP'].includes(room.circleChoice as string)) return false;
      } else if (room.circleChoice !== undefined) return false;
      if (room.type === 'BOSS' && room.cleared !== (checkpoint!.phase === 'stage-cleared')) return false;
    }
    if (room.cleared) cleared++;
    if (checkpoint?.currentRoomId === room.id) current = room as unknown as RoomNode;
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
  const supplyRooms = grid.flat().filter((room): room is RoomNode => !!room && room.sideSupply !== undefined);
  if (supplyRooms.length > 1 || supplyRooms.some(room => room.sideSupply !== true ||
    sideSupplyCandidate(grid, index)?.id !== room.id)) return false;
  for (const room of grid.flat()) if (room?.supplyChoice !== undefined && (!room.sideSupply || !room.cleared ||
    !SUPPLY_CHOICES.includes(room.supplyChoice))) return false;
  const start = grid[startY][startX]!;
  if (checkpoint && (!current || (stageStart && current !== start) || (!stageStart && !current.cleared) ||
      (checkpoint.phase === 'stage-cleared' && current.type !== 'BOSS') ||
      (checkpoint.phase === 'room-cleared' && current.type === 'BOSS') ||
      (record(checkpoint.stats) && (checkpoint.stats.roomsCleared as number) < index + cleared))) return false;
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
  if (distances.size !== stage.roomCount || bossDistance !== maxDistance) return false;
  if (!stageStart) {
    // Every visited room must be reachable through visited rooms, not through an uncleared encounter.
    const reached = new Set([start.id]), visitedQueue = [start];
    for (const room of visitedQueue) for (const [, dx, dy] of directions) {
      const neighbor = grid[room.gridY + dy]?.[room.gridX + dx];
      if (neighbor?.visited && !reached.has(neighbor.id)) { reached.add(neighbor.id); visitedQueue.push(neighbor); }
    }
    if (reached.size !== cleared) return false;
  }
  return true;
}

function browserStorage(): SaveStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
}

function decodeCheckpoint(saved: string | null): RunCheckpoint | null {
  if (saved === null) return null;
  try {
    const checkpoint: unknown = JSON.parse(saved);
    if (record(checkpoint) && checkpoint.version === 1 && Array.isArray(checkpoint.grid)) {
      for (const row of checkpoint.grid) if (Array.isArray(row)) {
        for (const room of row) if (record(room) && room.type === 'SHOP') room.type = 'EVENT';
      }
    }
    return isRunCheckpoint(checkpoint) ? checkpoint : null;
  } catch { return null; }
}

const ENDED_RUN = '{"ended":true}';

export class RunSaveManager {
  private suppressed = false;
  constructor(private readonly storage: SaveStorage | null = browserStorage()) {}

  public load(): CheckpointLoad {
    if (!this.storage || this.suppressed) return { status: 'unavailable' };
    try {
      const saved = this.storage.getItem(RUN_SAVE_KEY);
      if (saved === ENDED_RUN) return { status: 'empty' };
      const checkpoint = decodeCheckpoint(saved);
      if (checkpoint) return { status: 'ready', checkpoint };
      const backupText = this.storage.getItem(RUN_SAVE_BACKUP_KEY);
      const backup = decodeCheckpoint(backupText);
      if (backup) return { status: 'ready', checkpoint: backup, recovered: true };
      return { status: saved === null && backupText === null ? 'empty' : 'invalid' };
    } catch { return { status: 'unavailable' }; }
  }

  public save(checkpoint: RunCheckpoint): boolean {
    if (!this.storage) return false;
    if (this.suppressed && !this.clear()) return false;
    try {
      if (!isRunCheckpoint(checkpoint)) return false;
      const previous = this.storage.getItem(RUN_SAVE_KEY);
      if (decodeCheckpoint(previous)) {
        // Backup quota failure must not prevent replacing the primary snapshot.
        try { this.storage.setItem(RUN_SAVE_BACKUP_KEY, previous!); } catch { /* Keep the older backup. */ }
      }
      // One key replacement is atomic: no half-written grid or inventory.
      this.storage.setItem(RUN_SAVE_KEY, JSON.stringify(checkpoint));
      this.suppressed = false;
      return true;
    } catch {
      // Preserve the last complete snapshot, and tell the player the new one failed.
      return false;
    }
  }

  public clear(): boolean {
    this.suppressed = true;
    if (!this.storage) return false;
    // Tombstone first: partial deletion cannot resurrect a finished run via its backup.
    try { this.storage.setItem(RUN_SAVE_KEY, ENDED_RUN); } catch { /* Try deletion as well. */ }
    try {
      this.storage.removeItem(RUN_SAVE_BACKUP_KEY);
      this.storage.removeItem(RUN_SAVE_KEY);
      this.suppressed = false;
      return true;
    } catch { return false; }
  }
}

export const runSaveManager = new RunSaveManager();
