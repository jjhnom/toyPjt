import { STAGES, getStageScaling } from '../config/stageData';
import type { DoorDirection, RoomNode, StageDef } from '../types/game';

const OFFSETS: Record<DoorDirection, [number, number]> = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

export class RoomGridManager {
  public grid: (RoomNode | null)[][] = [];
  public currentX = 0;
  public currentY = 0;
  private distances = new Map<string, number>();
  private maxDistance = 1;

  constructor(public stage: StageDef = STAGES[0], savedGrid?: (RoomNode | null)[][]) {
    if (!savedGrid) { this.generateGrid(); return; }
    this.grid = savedGrid.map(row => row.map(room => room ? { ...room, doors: { ...room.doors } } : null));
    this.currentX = Math.floor(stage.gridWidth / 2);
    this.currentY = Math.floor(stage.gridHeight / 2);
    this.measureDistances();
  }

  public generateGrid(): void {
    const { gridWidth: width, gridHeight: height, roomCount } = this.stage;
    if (roomCount < 4 || roomCount > width * height) throw new Error('Invalid stage grid dimensions');
    this.grid = Array.from({ length: height }, () => Array<RoomNode | null>(width).fill(null));
    this.currentX = Math.floor(width / 2);
    this.currentY = Math.floor(height / 2);
    const nodes: RoomNode[] = [];
    const add = (x: number, y: number) => {
      const node: RoomNode = { id: `stage_${this.stage.index}_room_${x}_${y}`, gridX: x, gridY: y, type: 'COMBAT',
        doors: { top: false, bottom: false, left: false, right: false }, cleared: false, visited: false, waveCount: 2 };
      this.grid[y][x] = node;
      nodes.push(node);
    };
    add(this.currentX, this.currentY);
    while (nodes.length < roomCount) {
      const frontier: [number, number][] = [];
      for (const node of nodes) for (const [dx, dy] of Object.values(OFFSETS)) {
        const x = node.gridX + dx, y = node.gridY + dy;
        if (x >= 0 && x < width && y >= 0 && y < height && !this.grid[y][x]) frontier.push([x, y]);
      }
      const [x, y] = frontier[Math.floor(Math.random() * frontier.length)];
      add(x, y);
    }
    for (const node of nodes) for (const [direction, [dx, dy]] of Object.entries(OFFSETS)) {
      node.doors[direction as DoorDirection] = !!this.grid[node.gridY + dy]?.[node.gridX + dx];
    }
    const start = nodes[0];
    start.visited = true;
    const queue = this.measureDistances();
    const boss = queue[queue.length - 1];
    boss.type = 'BOSS';
    const special = nodes.filter(node => node !== start && node !== boss);
    for (let i = special.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [special[i], special[j]] = [special[j], special[i]];
    }
    special[0].type = 'EVENT';
    special[1].type = 'RECOVERY';
    special.slice(2, 2 + this.stage.eliteCount).forEach(node => { node.type = 'ELITE'; });
    const bonus = getStageScaling(this.stage.index).waveCountBonus;
    for (const node of nodes) node.waveCount = node.type === 'EVENT' || node.type === 'RECOVERY' ? 0
      : node.type === 'BOSS' ? 1 : (node === start ? 1 : 2) + bonus;
  }

  private measureDistances(): RoomNode[] {
    this.distances.clear();
    const start = this.getCurrentRoom();
    this.distances.set(start.id, 0);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      for (const [dx, dy] of Object.values(OFFSETS)) {
        const neighbor = this.grid[node.gridY + dy]?.[node.gridX + dx];
        if (!neighbor || this.distances.has(neighbor.id)) continue;
        this.distances.set(neighbor.id, this.distances.get(node.id)! + 1);
        queue.push(neighbor);
      }
    }
    const boss = queue[queue.length - 1];
    this.maxDistance = Math.max(1, this.distances.get(boss.id)!);
    return queue;
  }

  public getCurrentRoom(): RoomNode { return this.grid[this.currentY][this.currentX]!; }
  public getDepth(room: RoomNode): number { return (this.distances.get(room.id) ?? 0) / this.maxDistance; }

  public getAdjacentRoom(dir: DoorDirection): RoomNode | null {
    if (!this.getCurrentRoom().doors[dir]) return null;
    const [dx, dy] = OFFSETS[dir];
    return this.grid[this.currentY + dy]?.[this.currentX + dx] ?? null;
  }

  public moveTo(dir: DoorDirection): RoomNode | null {
    const target = this.getAdjacentRoom(dir);
    if (!target) return null;
    this.currentX = target.gridX;
    this.currentY = target.gridY;
    target.visited = true;
    return target;
  }
}
