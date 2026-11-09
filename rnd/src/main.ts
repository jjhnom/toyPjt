import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameData';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { SquadScene } from './scenes/SquadScene';
import { RewardScene } from './scenes/RewardScene';
import { SummoningCircleScene } from './scenes/SummoningCircleScene';
import { EndlessChoiceScene } from './scenes/EndlessChoiceScene';
import { CodexScene } from './scenes/CodexScene';
import { LegacyScene } from './scenes/LegacyScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#090b10',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  input: {
    activePointers: 2
  },
  scene: [BootScene, MenuScene, GameScene, SquadScene, SummoningCircleScene, EndlessChoiceScene, LegacyScene, CodexScene, RewardScene, GameOverScene]
};

export const game = new Phaser.Game(config);
