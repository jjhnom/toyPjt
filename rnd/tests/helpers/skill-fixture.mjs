import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);
class Sprite {
  constructor(scene, x = 0, y = 0, texture = '') {
    Object.assign(this, { scene, x, y, active: true, visible: true, rotation: 0, alpha: 1, texture });
    this.body = {
      setCircle: (radius, x, y) => { this.body.radius = radius; this.body.offset = { x, y }; },
      setCollideWorldBounds() {}, setEnable() {}, setBounce() {},
      setVelocity: (x, y) => { this.body.velocity = { x, y }; }, reset() {}
    };
    this.anims = { stop() {} };
  }
  setDepth(value) { this.depth = value; return this; }
  setFlipX(value) { this.flipX = value; return this; }
  setFlip(x, y) { this.flipX = x; this.flipY = y; return this; }
  setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; }
  setScale(value) { this.scaleX = this.scaleY = value; return this; }
  setDisplaySize(width, height) { this.displayWidth = width; this.displayHeight = height; return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setActive(value) { this.active = value; return this; }
  setVisible(value) { this.visible = value; return this; }
  setRotation(value) { this.rotation = value; return this; }
  setTintFill(value) { this.tint = value; return this; }
  setTint(value) { this.tint = value; return this; }
  clearTint() { this.tint = undefined; return this; }
  setTexture(value) { this.texture = value; return this; }
  setAlpha(value) { this.alpha = value; return this; }
  play() { return this; }
  enableBody(_reset, x, y, active, visible) { return this.setPosition(x, y).setActive(active).setVisible(visible); }
  disableBody() { return this.setActive(false).setVisible(false); }
  destroy() { this.destroyed = true; this.active = false; }
}
class Group {
  constructor(scene, config) { this.scene = scene; this.config = config; this.children = []; }
  get(x, y) {
    let item = this.children.find(child => !child.active);
    if (!item && this.children.length < this.config.maxSize) {
      item = new this.config.classType(this.scene, x, y); this.children.push(item);
    }
    return item ?? null;
  }
  getChildren() { return this.children; }
  countActive() { return this.children.filter(item => item.active).length; }
}
const phaser = {
  GameObjects: { Sprite, Group }, Physics: { Arcade: { Sprite, Group } },
  Math: { Clamp: (v, min, max) => Math.max(min, Math.min(max, v)), Between: (min, max) => (min + max) / 2,
    Distance: { Squared: (x, y, a, b) => (x - a) ** 2 + (y - b) ** 2 },
    Angle: { Between: (x, y, a, b) => Math.atan2(b - y, a - x) } }
};
const cache = new Map();
export function load(path) {
  const file = resolve(path);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const require = name => name === 'phaser' ? { __esModule: true, default: phaser }
    : name.startsWith('.') ? load(resolve(dirname(file), `${name}.ts`)) : nativeRequire(name);
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}

export function fixture(archetypes) {
  const { PlayerSquad } = load('src/entities/PlayerSquad.ts');
  const { UNIT_TYPES } = load('src/config/unitData.ts');
  const scene = { time: { now: 0 }, physics: { add: { sprite: (x, y) => new Sprite(scene, x, y) } },
    add: { existing() {} }, anims: { exists: () => false }, sys: { updateList: { add() {} } } };
  const events = [], shots = [];
  const squad = new PlayerSquad(scene, 360, 650, config => shots.push({ ...config }), () => {}, () => {},
    (...event) => events.push(event));
  squad.roster.units = archetypes.map((archetype, i) => ({ id: `skill_${i}`, archetype,
    tier: UNIT_TYPES[archetype].tier, deployed: true, star: 1 }));
  squad.syncRoster();
  for (const drone of squad.drones) drone.setPosition(360, 650);
  events.length = 0;
  const enemies = { getChildren: () => [] };
  const update = (time, active = true) => {
    scene.time.now = time;
    squad.update(time, 0, 0, 0, enemies, 1, 1, 0, active);
  };
  return { squad, scene, events, enemies, update, shots };
}
