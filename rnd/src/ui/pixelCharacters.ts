import type { DroneArchetype, EnemyArchetype } from '../types/game';
import { ELEMENT_COLORS, UNIT_TYPES } from '../config/unitData';

export const unitTexture = (type: DroneArchetype): string => `unit_${type}`;
export const unitPortrait = (type: DroneArchetype): string => `portrait_${type}`;
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
  rect(2, 14, 12, 1, '#070d15aa'); rect(4, 13, 8, 2, '#070d1577');
  if (kind === 'LEADER') {
    rect(4, 7 + bob, 8, 6 - bob, '#352b56'); rect(5, 7 + bob, 6, 5 - bob, '#8662ad');
    rect(5, 8 + bob, 2, 4 - bob, '#ad8fce'); rect(7, 11, 4, 1, '#e2c47c');
    rect(6, 4 + bob, 5, 4, skin); rect(8, 6 + bob, 1, 1, dark); rect(10, 6 + bob, 1, 1, dark);
    rect(4, 3 + bob, 9, 2, '#c9a65f'); rect(5, 1 + bob, 7, 2, '#76559d'); rect(7, bob, 4, 2, '#9d7cc1');
    rect(5, 12, 2, 2 + bob, wood); rect(9, 12, 2, 3 - bob, wood);
    rect(13, 4, 1, 10, '#b39160'); rect(12, 2, 3, 3, '#a3edff'); rect(13, 2, 1, 2, '#e8ffff');
    rect(3, 8 + bob, 2, 3, skin);
    return;
  }
  const unit = UNIT_TYPES[kind as DroneArchetype];
  const legacy = ['BASIC_LASER', 'GATLING_BOT', 'ROCKET_BOT', 'STUN_BOT', 'PIERCE_BEAM', 'BLACKHOLE_MISSILE', 'CHAIN_LIGHTNING'];
  if (unit && !legacy.includes(kind)) {
    const color = `#${ELEMENT_COLORS[unit.elements[0]].toString(16).padStart(6, '0')}`;
    const accent = `#${ELEMENT_COLORS[unit.elements[1] ?? unit.elements[0]].toString(16).padStart(6, '0')}`;
    rect(5, 12, 2, 2 + bob, wood); rect(9, 12, 2, 3 - bob, wood);
    rect(4, 7 + bob, 8, 6 - bob, dark); rect(5, 7 + bob, 6, 5 - bob, color);
    rect(6, 4 + bob, 4, 4, skin); rect(7, 6 + bob, 1, 1, dark); rect(9, 6 + bob, 1, 1, dark);
    if (unit.role === 'VANGUARD') {
      rect(4, 3 + bob, 8, 2, accent); rect(2, 8, 4, 5, accent); rect(3, 9, 2, 3, dark);
      rect(12, 5, 1, 8, light); rect(11, 10, 3, 1, wood);
    } else if (unit.role === 'MELEE') {
      rect(4, 2 + bob, 8, 3, color); rect(5, 4 + bob, 6, 2, dark); rect(7, 5 + bob, 3, 1, light);
      rect(12, 8, 1, 5, light); rect(2, 8, 1, 4, light);
    } else if (unit.role === 'RANGED') {
      rect(5, 2 + bob, 6, 3, color); rect(12, 5, 1, 8, wood); rect(13, 6, 1, 6, accent);
    } else {
      rect(4, 4 + bob, 8, 1, color); rect(5, 2 + bob, 6, 2, color); rect(7, bob, 3, 2, accent);
      rect(12, 4, 1, 10, wood); rect(11, 2 + bob, 3, 3, accent);
      if (unit.role === 'SUPPORT') { rect(7, 8, 1, 4, light); rect(6, 9, 3, 1, light); }
    }
    if (unit.tier >= 3) { rect(3, 7, 1, 6, accent); rect(11, 7, 1, 6, accent); }
    if (unit.tier === 4) { rect(5, 0, 1, 3, light); rect(10, 0, 1, 3, light); }
    return;
  }
  if (kind === 'SPORE_SHOOTER' || kind === 'SUMMONER' || kind === 'EXPLODER') {
    const color = kind === 'EXPLODER' ? '#ef8953' : kind === 'SUMMONER' ? '#88cfe1' : '#91ac66';
    rect(4, 7 + bob, 8, 6 - bob, color); rect(5, 3 + bob, 6, 5, color);
    rect(3, 2 + bob, 10, 2, dark); rect(6, 5 + bob, 1, 1, light); rect(9, 5 + bob, 1, 1, light);
    rect(12, 4, 1, 10, wood); rect(11, 2, 3, 3, color);
    return;
  }
  if (kind === 'SWARMER') {
    rect(4, 7 - bob, 8, 1, '#1e3030'); rect(2, 9 - bob, 12, 5 + bob, '#3e755b');
    rect(3, 8 - bob, 10, 5, '#77af69'); rect(4, 8 - bob, 4, 2, '#b2d885');
    rect(5, 11 - bob, 2, 2, dark); rect(10, 11 - bob, 2, 2, dark);
    rect(5, 11 - bob, 1, 1, '#ffeeb0'); rect(10, 11 - bob, 1, 1, '#ffeeb0');
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
