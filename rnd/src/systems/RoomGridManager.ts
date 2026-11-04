import { GRID_SIZE } from '../config/gameData';
import { DoorDirection, RoomNode } from '../types/game';

export class RoomGridManager {
  public grid: (RoomNode | null)[][] = [];
  public currentX = Math.floor(GRID_SIZE / 2);
  public currentY = Math.floor(GRID_SIZE / 2);

  constructor() {
    this.generateGrid();
  }

  public generateGrid(): void {
    this.grid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: (RoomNode | null)[] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        row.push({
          id: `room_${x}_${y}`,
          gridX: x,
          gridY: y,
          type: 'COMBAT',
          doors: {
            top: y > 0,
            bottom: y < GRID_SIZE - 1,
            left: x > 0,
            right: x < GRID_SIZE - 1
          },
          cleared: false,
          visited: false,
          waveCount: 2
        });
      }
      this.grid.push(row);
    }

    const startX = Math.floor(GRID_SIZE / 2);
    const startY = Math.floor(GRID_SIZE / 2);
    this.currentX = startX;
    this.currentY = startY;

    // 특수 방 배치 (정예, 상점, 회복, 보스)
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const node = this.grid[y][x]!;
        const manhattan = Math.abs(x - startX) + Math.abs(y - startY);

        if (x === startX && y === startY) {
          node.type = 'COMBAT';
          node.waveCount = 1;
          node.visited = true;
        } else if (x === GRID_SIZE - 1 && y === 0) {
          node.type = 'BOSS';
          node.waveCount = 1;
        } else if (x === 0 && y === GRID_SIZE - 1) {
          node.type = 'BOSS';
          node.waveCount = 1;
        } else if ((x === startX && y === startY - 1) || (x === 1 && y === 3)) {
          node.type = 'ELITE';
          node.waveCount = 2;
        } else if ((x === startX + 1 && y === startY) || (x === 1 && y === 1)) {
          node.type = 'SHOP';
          node.waveCount = 0;
        } else if ((x === startX - 1 && y === startY) || (x === 3 && y === 3)) {
          node.type = 'RECOVERY';
          node.waveCount = 0;
        } else if (manhattan >= 3) {
          node.type = (x + y) % 2 === 0 ? 'ELITE' : 'COMBAT';
          node.waveCount = node.type === 'ELITE' ? 3 : 2;
        } else {
          node.type = 'COMBAT';
          node.waveCount = 2;
        }
      }
    }
  }

  public getCurrentRoom(): RoomNode {
    return this.grid[this.currentY][this.currentX]!;
  }

  public getAdjacentRoom(dir: DoorDirection): RoomNode | null {
    let nx = this.currentX;
    let ny = this.currentY;
    if (dir === 'top') ny -= 1;
    if (dir === 'bottom') ny += 1;
    if (dir === 'left') nx -= 1;
    if (dir === 'right') nx += 1;

    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
      return null;
    }
    return this.grid[ny][nx];
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
