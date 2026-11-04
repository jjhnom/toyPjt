import type { DroneArchetype, EnemyArchetype } from '../types/game';

export const unitTexture = (type: DroneArchetype): string => `unit_${type}`;
export const unitAnimation = (type: DroneArchetype): string => `walk_${type}`;
export const enemyTexture = (type: EnemyArchetype): string => `enemy_${type}`;
export const enemyAnimation = (type: EnemyArchetype): string => `walk_${type}`;

type PixelRect = (x: number, y: number, w: number, h: number, color: string) => void;

/** Draw on a 16px logical grid; only integer rectangles, no filtered imagery. */
export function drawCharacter(ctx: CanvasRenderingContext2D, kind: string, frame: number, width: number, height: number): void {
  const scale = Math.floor(Math.min(width, height) / 16);
  const ox = Math.floor((width - scale * 16) / 2);
  const oy = Math.floor((height - scale * 16) / 2);
  const rect: PixelRect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * scale, oy + y * scale, w * scale, h * scale);
  };
  const bob = frame % 2;
  const dark = '#172029', light = '#efe0b7', skin = '#e6b887', wood = '#98734d';
  rect(3, 14, 10, 1, '#111a21');
  if (kind === 'SWARMER') {
    rect(4, 7 - bob, 8, 1, '#1e3030'); rect(2, 9 - bob, 12, 5 + bob, '#3e755b');
    rect(3, 8 - bob, 10, 5, '#77af69'); rect(4, 8 - bob, 4, 2, '#b2d885');
    rect(5, 11 - bob, 1, 2, dark); rect(10, 11 - bob, 1, 2, dark);
    return;
  }
  if (kind === 'TANK' || kind === 'ELITE_BRUTE' || kind === 'BOSS_CORE') {
    const boss = kind === 'BOSS_CORE', elite = kind === 'ELITE_BRUTE';
    const armor = boss ? '#886092' : elite ? '#627363' : '#888b7b';
    rect(3, 5, 10, 8, dark); rect(4, 5 + bob, 8, 7 - bob, armor);
    rect(2, 7, 3, 5, armor); rect(11, 7, 3, 5, armor);
    rect(5, 2 + bob, 6, 5, armor); rect(6, 4 + bob, 4, 3, '#303841');
    rect(6, 5 + bob, 1, 1, boss ? '#ffb166' : '#e5cb80'); rect(9, 5 + bob, 1, 1, '#ffb166');
    rect(4, 12, 3, 2, '#46534b'); rect(9, 12, 3, 2, '#46534b');
    rect(5, 8, 6, 1, '#b6b69a'); rect(7, 9, 2, 2, boss ? '#ef9c8e' : '#c4d1b4');
    if (boss || elite) {
      rect(3, 1, 2, 3, '#d7c59a'); rect(11, 1, 2, 3, '#d7c59a');
      rect(2, 0, 2, 2, '#f3ddb0'); rect(12, 0, 2, 2, '#f3ddb0');
      rect(0, 8, 2, 5, boss ? '#b16a79' : '#8f7960');
    }
    return;
  }
  const goblin = kind === 'CHASER';
  const archer = kind === 'BASIC_LASER' || kind === 'GATLING_BOT' || kind === 'PIERCE_BEAM';
  const fire = kind === 'ROCKET_BOT', frost = kind === 'STUN_BOT', storm = kind === 'CHAIN_LIGHTNING';
  const master = kind === 'BLACKHOLE_MISSILE';
  const robe = goblin ? '#806449' : kind === 'GATLING_BOT' ? '#47776a' : kind === 'PIERCE_BEAM' ? '#768b93'
    : archer ? '#66815a' : fire ? '#b56347' : frost ? '#608fa1' : storm ? '#a58b51' : '#766294';
  rect(5, 12, 2, 2 + bob, '#604837'); rect(9, 12, 2, 3 - bob, '#604837');
  rect(4, 7 + bob, 8, 6 - bob, dark); rect(5, 7 + bob, 6, 5 - bob, robe);
  rect(6, 8 + bob, 2, 3 - bob, '#ffffff22');
  rect(6, 4 + bob, 4, 4, goblin ? '#a3bd77' : skin);
  rect(7, 6 + bob, 1, 1, dark); rect(9, 6 + bob, 1, 1, dark);
  if (archer || goblin) {
    rect(5, 3 + bob, 6, 2, robe); rect(4, 4 + bob, 2, 3, robe);
    rect(8, 2 + bob, 2, 2, '#adbf83');
    rect(12, 5 + bob, 1, 7, wood); rect(13, 6 + bob, 1, 5, '#cdbb87');
    rect(11, 8 + bob, 3, 1, skin);
    if (kind === 'GATLING_BOT') {
      rect(3, 7 + bob, 2, 5, wood); rect(3, 5 + bob, 1, 3, light);
      rect(10, 1 + bob, 1, 3, '#e4cf8c'); rect(11, 0 + bob, 1, 2, '#e4cf8c');
    }
    if (kind === 'PIERCE_BEAM') { rect(5, 2 + bob, 6, 1, '#e5cb80'); rect(6, 0 + bob, 1, 2, '#f0de9e'); }
  } else {
    rect(4, 4 + bob, 8, 1, robe); rect(5, 2 + bob, 6, 2, robe); rect(7, 0 + bob, 3, 2, robe);
    rect(7, 3 + bob, 3, 1, '#d8ba73');
    rect(12, 4, 1, 10, wood); rect(11, 2 + bob, 3, 3, dark);
    rect(12, 2 + bob, 1, 2, fire ? '#ffd58a' : frost ? '#b6e5e3' : '#d5b4ef');
    rect(3, 8 + bob, 2, 3, skin);
    if (master || storm) { rect(5, 10, 6, 1, '#dccb87'); rect(2, 1 + bob, 1, 1, light); }
  }
  rect(5, 11, 6, 1, wood); rect(7, 11, 1, 1, '#e2c77d');
}
