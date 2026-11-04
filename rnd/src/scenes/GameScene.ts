import Phaser from 'phaser';
import { dungeonFloor, pixelPanel, FANTASY } from '../ui/fantasyTheme';
import {
  ARENA_BOUNDS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRID_SIZE,
  ROOM_TYPE_META,
} from '../config/gameData';
import { Bullet, BulletGroup } from '../entities/Bullet';
import { DamageTextGroup } from '../entities/DamageTextPool';
import { EffectParticleGroup } from '../entities/EffectParticlePool';
import { Enemy, EnemyGroup } from '../entities/Enemy';
import { PlayerSquad } from '../entities/PlayerSquad';
import { RoomGridManager } from '../systems/RoomGridManager';
import { soundManager } from '../systems/SoundManager';
import {
  BulletFireConfig,
  DoorDirection,
  EnemyArchetype,
  RoomNode,
  RoomState,
  RunStats
} from '../types/game';
import { ROOM_REWARD, SQUAD_LIMITS } from '../config/squadData';
import { VirtualJoystick } from '../ui/VirtualJoystick';

interface DoorVisual {
  direction: DoorDirection;
  sprite: Phaser.GameObjects.Image;
  badgeBg: Phaser.GameObjects.Rectangle;
  badgeText: Phaser.GameObjects.Text;
  triggerZone: Phaser.Geom.Rectangle;
  enabled: boolean;
}

export class GameScene extends Phaser.Scene {
  private gridManager!: RoomGridManager;
  private roomState: RoomState = 'ENTERING';
  private squad!: PlayerSquad;
  private bullets!: BulletGroup;
  private enemies!: EnemyGroup;
  private damageTexts!: DamageTextGroup;
  private particles!: EffectParticleGroup;
  private joystick!: VirtualJoystick;

  private doors: Record<DoorDirection, DoorVisual> = {} as Record<DoorDirection, DoorVisual>;
  private arenaGraphics!: Phaser.GameObjects.Graphics;
  private unitOverlayGraphics!: Phaser.GameObjects.Graphics;
  private lightningGraphics!: Phaser.GameObjects.Graphics;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private hpBarGraphics!: Phaser.GameObjects.Graphics;

  private hudRoomText!: Phaser.GameObjects.Text;
  private hudWaveText!: Phaser.GameObjects.Text;
  private hudMineralText!: Phaser.GameObjects.Text;
  private hudHpText!: Phaser.GameObjects.Text;
  private hudSquadText!: Phaser.GameObjects.Text;
  private hudFpsText!: Phaser.GameObjects.Text;
  private centerBannerText!: Phaser.GameObjects.Text;

  private currentWave = 0;
  private totalWavesInRoom = 0;
  private nextWaveTimerMs = 0;
  private enteringTimerMs = 0;
  private lightningClearAt = 0;
  private rewardModalOpen = false;
  private runEnded = false;
  private backgroundPaused = false;
  private readonly chainHitLives = new Set<number>();
  private doorCooldownMs = 0;

  private stats: RunStats = {
    roomsCleared: 0,
    enemiesDefeated: 0,
    mineralsCollected: 30,
    bossDefeated: false,
    damageMultiplier: 1.0,
    attackSpeedMultiplier: 1.0,
    moveSpeedBonus: 0
  };

  constructor() {
    super('GameScene');
  }

  public create(): void {
    this.stats = {
      roomsCleared: 0,
      enemiesDefeated: 0,
      mineralsCollected: 30,
      bossDefeated: false,
      damageMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      moveSpeedBonus: 0
    };
    this.rewardModalOpen = false;
    this.input.enabled = true;
    this.runEnded = false;
    this.backgroundPaused = false;
    this.lightningClearAt = 0;
    this.physics.world.resume();
    this.doorCooldownMs = 0;

    // 물리 월드 경계를 아레나 내부로 설정
    this.physics.world.setBounds(
      ARENA_BOUNDS.left,
      ARENA_BOUNDS.top,
      ARENA_BOUNDS.width,
      ARENA_BOUNDS.height
    );

    this.gridManager = new RoomGridManager();

    // 배경 및 아레나 그래픽 레이어 (depth 0으로 설정하여 유닛 가림 방지)
    this.arenaGraphics = this.add.graphics().setDepth(0);
    this.unitOverlayGraphics = this.add.graphics().setDepth(28);
    this.lightningGraphics = this.add.graphics().setDepth(32);

    // 오브젝트 풀링 그룹 초기화
    this.bullets = new BulletGroup(this);
    this.enemies = new EnemyGroup(this, (enemy: Enemy, damage: number) => {
      if (this.runEnded || this.rewardModalOpen) return;
      const hit = this.squad.receiveContactDamage(damage, this.time.now);
      if (hit) {
        this.particles.emitBurst(
          (enemy.x + this.squad.leader.x) * 0.5,
          (enemy.y + this.squad.leader.y) * 0.5,
          0xef4444,
          6,
          150
        );
        soundManager.playHit();
      }
    });
    this.damageTexts = new DamageTextGroup(this);
    this.particles = new EffectParticleGroup(this);

    // 사방 문(Door) 및 다음 방 타입 뱃지 생성
    this.createDoors();

    // 본체와 독립 전투 유닛 분대 초기화
    this.squad = new PlayerSquad(
      this,
      ARENA_BOUNDS.centerX,
      ARENA_BOUNDS.centerY,
      (cfg: BulletFireConfig) => {
        this.bullets.fireBullet(cfg);
      },
      () => this.handlePlayerDeath(),
      (amount: number) => {
        this.damageTexts.spawnText(
          this.squad.leader.x,
          this.squad.leader.y - 24,
          `-${amount}`,
          '#f87171'
        );
        this.cameras.main.shake(110, 0.008);
        this.refreshHud();
      }
    );

    // 충돌 및 오버랩 파이프라인 연결
    // 1) 적 유닛 간 가벼운 충돌로 무리 겹침 방지
    this.physics.add.collider(this.enemies, this.enemies);

    // 2) 투사체 vs 적 충돌
    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      this.onBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // 3) 적 vs 플레이어 본체 충돌
    this.physics.add.overlap(
      this.squad.leader,
      this.enemies,
      this.onEnemyTouchPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // HUD & 가상 조이스틱 생성
    this.createHud();
    this.joystick = new VirtualJoystick(this);

    const onHidden = () => {
      if (this.runEnded) return;
      this.backgroundPaused = true;
      this.joystick.reset();
      this.input.enabled = false;
      this.scene.pause();
    };
    const onVisible = () => {
      this.backgroundPaused = false;
      this.joystick.reset();
      if (!this.rewardModalOpen && !this.runEnded) {
        this.input.enabled = true;
        this.scene.resume();
      }
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, onVisible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
      this.joystick.destroy();
      this.scene.stop('SquadScene');
      this.scene.stop('RewardScene');
    });

    // 시작 룸 진입
    this.enterRoom(this.gridManager.getCurrentRoom(), null);
  }

  private createDoors(): void {
    const cx = ARENA_BOUNDS.centerX;
    const cy = ARENA_BOUNDS.centerY;

    const configs: {
      dir: DoorDirection;
      x: number;
      y: number;
      tex: string;
      badgeX: number;
      badgeY: number;
      zone: Phaser.Geom.Rectangle;
    }[] = [
      {
        dir: 'top',
        x: cx,
        y: ARENA_BOUNDS.top,
        tex: 'tex_door_h',
        badgeX: cx,
        badgeY: ARENA_BOUNDS.top + 30,
        zone: new Phaser.Geom.Rectangle(cx - 58, ARENA_BOUNDS.top - 10, 116, 48)
      },
      {
        dir: 'bottom',
        x: cx,
        y: ARENA_BOUNDS.bottom,
        tex: 'tex_door_h',
        badgeX: cx,
        badgeY: ARENA_BOUNDS.bottom - 30,
        zone: new Phaser.Geom.Rectangle(cx - 58, ARENA_BOUNDS.bottom - 38, 116, 48)
      },
      {
        dir: 'left',
        x: ARENA_BOUNDS.left,
        y: cy,
        tex: 'tex_door_v',
        badgeX: ARENA_BOUNDS.left + 48,
        badgeY: cy,
        zone: new Phaser.Geom.Rectangle(ARENA_BOUNDS.left - 10, cy - 58, 48, 116)
      },
      {
        dir: 'right',
        x: ARENA_BOUNDS.right,
        y: cy,
        tex: 'tex_door_v',
        badgeX: ARENA_BOUNDS.right - 48,
        badgeY: cy,
        zone: new Phaser.Geom.Rectangle(ARENA_BOUNDS.right - 38, cy - 58, 48, 116)
      }
    ];

    for (let i = 0; i < configs.length; i++) {
      const c = configs[i];
      const sprite = this.add.image(c.x, c.y, c.tex).setDepth(15);
      const badgeBg = this.add
        .rectangle(c.badgeX, c.badgeY, 78, 28, 0x0f172a, 0.92)
        .setStrokeStyle(2, 0x38bdf8)
        .setDepth(16);
      const badgeText = this.add
        .text(c.badgeX, c.badgeY, '', {
          fontFamily: FANTASY.font,
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffffff'
        })
        .setOrigin(0.5)
        .setDepth(17);

      this.doors[c.dir] = {
        direction: c.dir,
        sprite,
        badgeBg,
        badgeText,
        triggerZone: c.zone,
        enabled: false
      };
    }
  }

  private createHud(): void {
    this.add.text(430, GAME_HEIGHT - 130, '소환의 서', {
      fontFamily: FANTASY.font, fontSize: '25px', color: '#efe4c4', backgroundColor: '#3c5140', padding: { x: 18, y: 14 }
    }).setDepth(65).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.roomState === 'CLEARED' && !this.rewardModalOpen && !this.runEnded) this.openSquadModal();
      else this.showBanner('전투 종료 후 정비할 수 있습니다');
    });
    pixelPanel(this, 10, 8, GAME_WIDTH - 20, 145).setDepth(50);

    this.hpBarGraphics = this.add.graphics().setDepth(51);
    this.minimapGraphics = this.add.graphics().setDepth(52);

    this.hudRoomText = this.add
      .text(24, 18, '', {
        fontFamily: FANTASY.font,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#efe4c4'
      })
      .setDepth(52);

    this.hudWaveText = this.add
      .text(24, 48, '', {
        fontFamily: FANTASY.font,
        fontSize: '16px',
        color: '#d9b969'
      })
      .setDepth(52);

    this.hudHpText = this.add
      .text(24, 82, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff'
      })
      .setDepth(53);

    this.hudMineralText = this.add
      .text(290, 82, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#facc15'
      })
      .setDepth(52);

    this.hudSquadText = this.add
      .text(24, 116, '', {
        fontFamily: FANTASY.font,
        fontSize: '14px',
        wordWrap: { width: 520 },
        color: '#b5bda3'
      })
      .setDepth(52);

    this.hudFpsText = this.add
      .text(GAME_WIDTH - 155, 122, 'FPS: 60', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#64748b'
      })
      .setDepth(52);

    this.centerBannerText = this.add
      .text(ARENA_BOUNDS.centerX, ARENA_BOUNDS.centerY - 120, '', {
        fontFamily: FANTASY.font,
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0f172a',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(48)
      .setAlpha(0);
  }

  private drawArenaForRoom(room: RoomNode): void {
    const g = this.arenaGraphics;
    g.clear();
    g.fillStyle(0x151d25).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dungeonFloor(g, ARENA_BOUNDS.left, ARENA_BOUNDS.top, ARENA_BOUNDS.width, ARENA_BOUNDS.height);
    // Thick stone walls and corner braziers frame the playable dungeon floor.
    g.lineStyle(12, 0x47514b).strokeRect(ARENA_BOUNDS.left - 6, ARENA_BOUNDS.top - 6, ARENA_BOUNDS.width + 12, ARENA_BOUNDS.height + 12);
    g.lineStyle(3, 0x829077).strokeRect(ARENA_BOUNDS.left - 12, ARENA_BOUNDS.top - 12, ARENA_BOUNDS.width + 24, ARENA_BOUNDS.height + 24);
    for (const x of [ARENA_BOUNDS.left - 25, ARENA_BOUNDS.right + 13]) {
      for (const y of [ARENA_BOUNDS.top + 28, ARENA_BOUNDS.bottom - 48]) {
        g.fillStyle(0x3b302c).fillRect(x, y, 12, 24);
        g.fillStyle(0xb87242).fillRect(x - 3, y - 10, 18, 16);
        g.fillStyle(0xf2c879).fillRect(x + 2, y - 15, 8, 15);
        g.fillStyle(0xffe6a0).fillRect(x + 4, y - 8, 4, 6);
      }
    }
    if (room.type === 'BOSS') {
      g.lineStyle(4, 0x99768d).strokeRect(240, 420, 240, 240);
      g.lineStyle(2, 0x9c8264).strokeRect(260, 440, 200, 200);
    }
  }

  private enterRoom(room: RoomNode, enteredFrom: DoorDirection | null): void {
    this.roomState = 'ENTERING';
    this.enteringTimerMs = 450;
    this.doorCooldownMs = 900;

    // 잔여 투사체 및 적 비활성화
    const activeBullets = this.bullets.getChildren();
    for (let i = 0; i < activeBullets.length; i++) {
      (activeBullets[i] as Bullet).deactivate();
    }
    const activeEnemies = this.enemies.getChildren();
    for (let i = 0; i < activeEnemies.length; i++) {
      (activeEnemies[i] as Enemy).deactivate();
    }

    this.drawArenaForRoom(room);

    // 진입 방향에 맞춰 플레이어 위치 배치
    let spawnX = ARENA_BOUNDS.centerX;
    let spawnY = ARENA_BOUNDS.centerY;
    if (enteredFrom === 'top') {
      spawnY = ARENA_BOUNDS.bottom - 70;
    } else if (enteredFrom === 'bottom') {
      spawnY = ARENA_BOUNDS.top + 70;
    } else if (enteredFrom === 'left') {
      spawnX = ARENA_BOUNDS.right - 70;
    } else if (enteredFrom === 'right') {
      spawnX = ARENA_BOUNDS.left + 70;
    }
    this.squad.setPositionImmediate(spawnX, spawnY);

    const meta = ROOM_TYPE_META[room.type];
    this.showBanner(`[${room.gridX + 1}, ${room.gridY + 1}] ${meta.label}`);

    this.updateDoorsVisual(room, false);
    this.refreshHud();
  }

  private startRoomLogic(room: RoomNode): void {
    if (room.cleared) {
      this.setRoomClearedState(room, false);
      return;
    }

    if (room.type === 'RECOVERY') {
      room.cleared = true;
      this.stats.roomsCleared += 1;
      const healAmount = Math.round(this.squad.health.maxHp * 0.45);
      this.squad.health.heal(healAmount);
      this.damageTexts.spawnText(
        this.squad.leader.x,
        this.squad.leader.y - 30,
        `+${healAmount} HP 회복!`,
        '#34d399'
      );
      this.particles.emitShockwave(this.squad.leader.x, this.squad.leader.y, 110, 0x8ca56a);
      soundManager.playPowerup();
      this.setRoomClearedState(room, false);
      return;
    }

    if (room.type === 'SHOP') {
      room.cleared = true;
      this.stats.roomsCleared += 1;
      this.setRoomClearedState(room, false);
      this.openShopModal();
      return;
    }

    // COMBAT / ELITE / BOSS 방: 문 잠금 및 웨이브 시작
    this.roomState = 'LOCKED_WAVES';
    this.currentWave = 0;
    this.totalWavesInRoom = room.waveCount;
    this.nextWaveTimerMs = 200;
    this.updateDoorsVisual(room, true);
    this.refreshHud();
  }

  private spawnNextWave(room: RoomNode): void {
    this.currentWave += 1;
    const depthScale = 1 + this.stats.roomsCleared * 0.14;

    if (room.type === 'BOSS') {
      this.showBanner('황혼의 마왕이 깨어납니다!');
      this.enemies.spawnEnemy(
        'BOSS_CORE',
        ARENA_BOUNDS.centerX,
        ARENA_BOUNDS.top + 110,
        depthScale
      );
      for (let i = 0; i < 4; i++) {
        const pos = this.getPerimeterSpawnPoint(i);
        this.enemies.spawnEnemy('SWARMER', pos.x, pos.y, depthScale);
      }
      this.refreshHud();
      return;
    }

    const baseCount = room.type === 'ELITE' ? 6 + this.currentWave * 2 : 5 + this.currentWave * 2;
    for (let i = 0; i < baseCount; i++) {
      const pos = this.getPerimeterSpawnPoint(i);
      let arch: EnemyArchetype = 'SWARMER';
      if (i % 4 === 0) arch = 'CHASER';
      if (i % 6 === 5) arch = 'TANK';
      this.enemies.spawnEnemy(arch, pos.x, pos.y, depthScale);
    }

    if (room.type === 'ELITE' && this.currentWave === this.totalWavesInRoom) {
      const pos = this.getPerimeterSpawnPoint(99);
      this.enemies.spawnEnemy('ELITE_BRUTE', pos.x, pos.y, depthScale);
    }

    this.enemies.updateTargetForAll(this.squad.leader.x, this.squad.leader.y);
    this.refreshHud();
  }

  private getPerimeterSpawnPoint(seedIndex: number): { x: number; y: number } {
    const pad = 42;
    const side = (seedIndex + Math.floor(Math.random() * 4)) % 4;
    let x = ARENA_BOUNDS.centerX;
    let y = ARENA_BOUNDS.centerY;

    if (side === 0) {
      x = Phaser.Math.Between(ARENA_BOUNDS.left + pad, ARENA_BOUNDS.right - pad);
      y = ARENA_BOUNDS.top + pad;
    } else if (side === 1) {
      x = Phaser.Math.Between(ARENA_BOUNDS.left + pad, ARENA_BOUNDS.right - pad);
      y = ARENA_BOUNDS.bottom - pad;
    } else if (side === 2) {
      x = ARENA_BOUNDS.left + pad;
      y = Phaser.Math.Between(ARENA_BOUNDS.top + pad, ARENA_BOUNDS.bottom - pad);
    } else {
      x = ARENA_BOUNDS.right - pad;
      y = Phaser.Math.Between(ARENA_BOUNDS.top + pad, ARENA_BOUNDS.bottom - pad);
    }

    // 플레이어와 너무 가까운 스폰 방지
    if (
      Phaser.Math.Distance.Between(x, y, this.squad.leader.x, this.squad.leader.y) < 130
    ) {
      x = ARENA_BOUNDS.centerX;
      y = ARENA_BOUNDS.top + pad;
    }

    return { x, y };
  }

  private setRoomClearedState(room: RoomNode, openRewardModal: boolean): void {
    this.roomState = 'CLEARED';
    this.updateDoorsVisual(room, false);
    this.refreshHud();

    if (openRewardModal) {
      this.showBanner('회랑 정화 완료\n소환의 서에서 동료를 맞이하세요');
      this.openCombatRewardModal(room);
    }
  }

  private updateDoorsVisual(room: RoomNode, locked: boolean): void {
    const dirs: DoorDirection[] = ['top', 'bottom', 'left', 'right'];

    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const dv = this.doors[dir];
      const hasNeighbor = room.doors[dir];
      const neighbor = this.gridManager.getAdjacentRoom(dir);

      if (!hasNeighbor || !neighbor) {
        dv.enabled = false;
        dv.sprite.setVisible(false);
        dv.badgeBg.setVisible(false);
        dv.badgeText.setVisible(false);
        continue;
      }

      dv.enabled = true;
      dv.sprite.setVisible(true);

      if (locked) {
        dv.sprite.setTint(0xbf8066);
        dv.sprite.setAlpha(0.95);
        dv.badgeBg.setVisible(false);
        dv.badgeText.setVisible(false);
      } else {
        const meta = ROOM_TYPE_META[neighbor.type];
        dv.sprite.setTint(0xc3c989);
        dv.sprite.setAlpha(0.95);
        dv.badgeBg.setVisible(true);
        dv.badgeBg.setStrokeStyle(2, meta.color);
        dv.badgeText.setVisible(true);
        dv.badgeText.setText(
          neighbor.cleared ? `${meta.badgeText}✓` : meta.badgeText
        );
        dv.badgeText.setColor(meta.hex);
      }
    }
  }

  private onBulletHitEnemy(
    bulletObj: Phaser.GameObjects.GameObject,
    enemyObj: Phaser.GameObjects.GameObject
  ): void {
    if (this.runEnded || this.rewardModalOpen) return;
    const bullet = bulletObj as Bullet;
    const enemy = enemyObj as Enemy;

    if (!bullet.active || !enemy.active) return;
    if (bullet.hitEnemyLives.has(enemy.lifeId)) return;
    bullet.hitEnemyLives.add(enemy.lifeId);

    const now = this.time.now;
    soundManager.playHit();

    // 1. 주 타겟 대미지 적용
    const killed = enemy.receiveDamage(
      bullet.damage,
      now,
      bullet.slowFactor,
      bullet.slowDurationMs
    );
    this.damageTexts.spawnText(
      enemy.x,
      enemy.y - 18,
      bullet.damage,
      bullet.aoeRadius > 0 ? '#fb923c' : '#efe4c4'
    );
    this.particles.emitBurst(bullet.x, bullet.y, bullet.bulletColor, 4, 120);

    if (killed) {
      this.handleEnemyKilled(enemy);
    }

    // 2. 범위 폭발(AoE) 처리 (로켓 봇 / 블랙홀 유도탄)
    if (bullet.aoeRadius > 0) {
      this.particles.emitShockwave(enemy.x, enemy.y, bullet.aoeRadius, bullet.bulletColor);
      soundManager.playExplosion();
      const allEnemies = this.enemies.getChildren();
      const radSq = bullet.aoeRadius * bullet.aoeRadius;
      const splashDmg = Math.max(1, Math.round(bullet.damage * 0.65));

      for (let i = 0; i < allEnemies.length; i++) {
        const other = allEnemies[i] as Enemy;
        if (!other.active || other === enemy) continue;
        const dx = other.x - enemy.x;
        const dy = other.y - enemy.y;
        if (dx * dx + dy * dy <= radSq) {
          const splashKilled = other.receiveDamage(
            splashDmg,
            now,
            bullet.slowFactor,
            bullet.slowDurationMs
          );
          this.damageTexts.spawnText(other.x, other.y - 14, splashDmg, '#fdba74');
          if (splashKilled) {
            this.handleEnemyKilled(other);
          }
        }
      }
    }

    // 3. 연쇄 번개(Chain Lightning) 처리 (T3 아크 연쇄 번개)
    if (bullet.remainingChains > 0) {
      this.triggerChainLightning(
        enemy,
        bullet.remainingChains,
        Math.round(bullet.damage * 0.75),
        bullet.slowFactor,
        bullet.slowDurationMs,
        now
      );
    }

    // 4. 관통(Pierce) 여부에 따른 탄환 소멸
    if (bullet.remainingPierces > 0) {
      bullet.remainingPierces -= 1;
    } else {
      bullet.deactivate();
    }
  }

  private triggerChainLightning(
    startEnemy: Enemy,
    chains: number,
    chainDamage: number,
    slowFactor: number,
    slowDurationMs: number,
    now: number
  ): void {
    this.chainHitLives.clear();
    this.chainHitLives.add(startEnemy.lifeId);
    this.lightningGraphics.clear();
    this.lightningGraphics.lineStyle(3, 0x67e8f9, 0.95);
    this.lightningClearAt = now + 110;

    let currentX = startEnemy.x;
    let currentY = startEnemy.y;
    const allEnemies = this.enemies.getChildren();

    for (let c = 0; c < chains; c++) {
      let nearest: Enemy | null = null;
      let minDistSq = 180 * 180;

      for (let i = 0; i < allEnemies.length; i++) {
        const cand = allEnemies[i] as Enemy;
        if (!cand.active || this.chainHitLives.has(cand.lifeId)) continue;
        const dx = cand.x - currentX;
        const dy = cand.y - currentY;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          nearest = cand;
        }
      }

      if (!nearest) break;
      this.chainHitLives.add(nearest.lifeId);

      this.lightningGraphics.lineBetween(currentX, currentY, nearest.x, nearest.y);
      currentX = nearest.x;
      currentY = nearest.y;

      const killed = nearest.receiveDamage(chainDamage, now, slowFactor, slowDurationMs);
      this.damageTexts.spawnText(nearest.x, nearest.y - 16, chainDamage, '#67e8f9');
      if (killed) {
        this.handleEnemyKilled(nearest);
      }
    }
  }

  private handleEnemyKilled(enemy: Enemy): void {
    this.stats.enemiesDefeated += 1;
    this.squad.roster.minerals += enemy.spec.mineralValue;
    this.particles.emitBurst(enemy.x, enemy.y, enemy.spec.color, 8, 190);
    soundManager.playExplosion();


    this.refreshHud();
  }

  private onEnemyTouchPlayer(
    _leaderObj: Phaser.GameObjects.GameObject,
    enemyObj: Phaser.GameObjects.GameObject
  ): void {
    const enemy = enemyObj as Enemy;
    if (!enemy.active || this.runEnded || this.rewardModalOpen) return;

    const now = this.time.now;
    this.squad.receiveContactDamage(enemy.spec.contactDamage, now);
  }

  private handlePlayerDeath(): void {
    if (this.runEnded) return;
    this.runEnded = true;
    this.refreshHud();
    soundManager.playExplosion();
    this.particles.emitShockwave(this.squad.leader.x, this.squad.leader.y, 140, 0xef4444);
    this.scene.start('GameOverScene', {
      victory: false,
      stats: this.stats,
      droneSummary: this.getDroneSummaryList()
    });
  }

  private getDroneSummaryList(): string[] {
    const list: string[] = [];
    for (let i = 0; i < this.squad.drones.length; i++) {
      list.push(this.squad.drones[i].spec.name);
    }
    return list;
  }

  private openCombatRewardModal(room: RoomNode): void {
    const reward = room.type === 'ELITE' ? ROOM_REWARD.elite : ROOM_REWARD.combat;
    this.squad.roster.minerals += reward;
    this.openSquadModal(`정화 보상 +${reward} ◆ · 소환과 조합으로 분대를 구성하세요`);
  }

  private openShopModal(): void {
    this.openSquadModal('여행자의 야영지 · 지정 소환 / 조합 / 출전 관리');
  }

  private openSquadModal(message = '소환 · 조합 · 출전 관리'): void {
    if (this.rewardModalOpen || this.runEnded) return;
    this.rewardModalOpen = true;
    this.joystick.reset();
    (this.squad.leader.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.input.enabled = false;
    this.scene.launch('SquadScene', {
      roster: this.squad.roster,
      message,
      onClose: () => {
        this.squad.syncRoster();
        this.rewardModalOpen = false;
        this.input.enabled = !this.backgroundPaused;
        this.refreshHud();
        if (!this.backgroundPaused) this.scene.resume();
      }
    });
    this.scene.pause();
  }

  private showBanner(text: string): void {
    this.centerBannerText.setText(text);
    this.centerBannerText.setAlpha(1);
    this.tweens.killTweensOf(this.centerBannerText);
    this.tweens.add({
      targets: this.centerBannerText,
      alpha: 0,
      delay: 1450,
      duration: 450
    });
  }

  private refreshHud(): void {
    this.stats.mineralsCollected = this.squad.roster.minerals;
    const room = this.gridManager.getCurrentRoom();
    const meta = ROOM_TYPE_META[room.type];

    this.hudRoomText.setText(
      `회랑 (${room.gridX + 1},${room.gridY + 1}) • ${meta.label}`
    );

    if (this.roomState === 'LOCKED_WAVES') {
      const aliveCount = this.enemies.countActive(true);
      this.hudWaveText.setText(
        `WAVE ${this.currentWave}/${this.totalWavesInRoom} • 잔여 적: ${aliveCount}기 (문 잠김)`
      );
      this.hudWaveText.setColor('#f87171');
    } else {
      this.hudWaveText.setText('구역 확보 완료 • 열린 사방 문으로 이동하여 다음 방 선택');
      this.hudWaveText.setColor('#b5c68a');
    }

    // 체력 바 갱신
    this.hpBarGraphics.clear();
    this.hpBarGraphics.fillStyle(0x283831, 1);
    this.hpBarGraphics.fillRoundedRect(24, 78, 240, 22, 6);
    const ratio = Phaser.Math.Clamp(this.squad.health.ratio, 0, 1);
    const barColor = ratio > 0.5 ? 0x8ca56a : ratio > 0.25 ? 0xf59e0b : 0xef4444;
    if (ratio > 0) {
      this.hpBarGraphics.fillStyle(barColor, 1);
      this.hpBarGraphics.fillRoundedRect(24, 78, Math.max(8, 240 * ratio), 22, 6);
    }
    this.hudHpText.setText(
      `HP ${this.squad.health.currentHp}/${this.squad.health.maxHp}`
    );

    this.hudMineralText.setText(`마력석: ${this.stats.mineralsCollected} ◆`);

    const droneNames = this.getDroneSummaryList();
    this.hudSquadText.setText(
      `출전 ${this.squad.drones.length}/${SQUAD_LIMITS.deployed} · 보유 ${this.squad.roster.units.length}/${SQUAD_LIMITS.owned}: ${droneNames.join(' · ')}`
    );

    this.drawMinimap();
  }

  private drawMinimap(): void {
    this.minimapGraphics.clear();
    const cellSize = 18;
    const gap = 3;
    const startX = GAME_WIDTH - 130;
    const startY = 14;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const node = this.gridManager.grid[y][x];
        if (!node) continue;
        const rx = startX + x * (cellSize + gap);
        const ry = startY + y * (cellSize + gap);
        const meta = ROOM_TYPE_META[node.type];

        const isCurrent =
          x === this.gridManager.currentX && y === this.gridManager.currentY;

        this.minimapGraphics.fillStyle(
          meta.color,
          node.visited || node.type === 'BOSS' ? 0.9 : 0.32
        );
        this.minimapGraphics.fillRoundedRect(rx, ry, cellSize, cellSize, 3);

        if (isCurrent) {
          this.minimapGraphics.lineStyle(2, 0xffffff, 1);
          this.minimapGraphics.strokeRoundedRect(rx - 1, ry - 1, cellSize + 2, cellSize + 2, 3);
        } else if (node.cleared) {
          this.minimapGraphics.lineStyle(1, 0x9ebd7c, 0.9);
          this.minimapGraphics.strokeRoundedRect(rx, ry, cellSize, cellSize, 3);
        }
      }
    }
  }

  public override update(time: number, delta: number): void {
    if (this.rewardModalOpen || this.runEnded) return;

    this.hudFpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);

    if (this.lightningClearAt > 0 && time >= this.lightningClearAt) {
      this.lightningClearAt = 0;
      this.lightningGraphics.clear();
    }

    if (this.doorCooldownMs > 0) {
      this.doorCooldownMs -= delta;
    }

    // 가상 조이스틱 및 플레이어 분대 업데이트
    this.joystick.update();
    this.squad.update(
      time,
      delta,
      this.joystick.dirX,
      this.joystick.dirY,
      this.enemies,
      this.stats.damageMultiplier,
      this.stats.attackSpeedMultiplier,
      this.stats.moveSpeedBonus
    );

    // 적군 추적 타겟 좌표를 플레이어 리더 위치로 동기화
    this.enemies.updateTargetForAll(this.squad.leader.x, this.squad.leader.y);

    // 적군 체력바 오버레이 렌더링
    this.drawUnitOverlays();

    const room = this.gridManager.getCurrentRoom();

    // 룸 상태 머신 (ENTERING -> LOCKED_WAVES -> CLEARED -> TRANSITION)
    if (this.roomState === 'ENTERING') {
      this.enteringTimerMs -= delta;
      if (this.enteringTimerMs <= 0) {
        this.startRoomLogic(room);
      }
    } else if (this.roomState === 'LOCKED_WAVES') {
      const activeEnemies = this.enemies.countActive(true);

      if (this.currentWave < this.totalWavesInRoom) {
        if (activeEnemies === 0) {
          this.nextWaveTimerMs -= delta;
          if (this.nextWaveTimerMs <= 0) {
            this.spawnNextWave(room);
            this.nextWaveTimerMs = 1100;
          }
        }
      } else if (activeEnemies === 0 && !room.cleared) {
        // 모든 웨이브 적 처치 완료 -> 룸 클리어!
        room.cleared = true;
        this.stats.roomsCleared += 1;
        soundManager.playPowerup();
        if (room.type === 'BOSS') {
          this.runEnded = true;
          this.stats.bossDefeated = true;
          this.refreshHud();
          this.scene.start('GameOverScene', {
            victory: true, stats: this.stats, droneSummary: this.getDroneSummaryList()
          });
          return;
        }
        this.setRoomClearedState(room, true);
      }
    } else if (this.roomState === 'CLEARED' && this.doorCooldownMs <= 0) {
      this.checkDoorTransition();
    }
  }

  private drawUnitOverlays(): void {
    this.unitOverlayGraphics.clear();

    // 적군 머리 위 체력바 (피격된 적 또는 정예/보스 상시 표시)
    const enemyChildren = this.enemies.getChildren();
    for (let i = 0; i < enemyChildren.length; i++) {
      const enemy = enemyChildren[i] as Enemy;
      if (!enemy.active) continue;

      const isSpecial =
        enemy.spec.archetype === 'BOSS_CORE' || enemy.spec.archetype === 'ELITE_BRUTE';
      if (!isSpecial && enemy.health.ratio >= 0.999) continue;

      const barW = enemy.spec.archetype === 'BOSS_CORE' ? 76 : isSpecial ? 48 : 32;
      const barH = enemy.spec.archetype === 'BOSS_CORE' ? 7 : 5;
      const bx = enemy.x - barW * 0.5;
      const by = enemy.y - enemy.spec.radius - 14;

      this.unitOverlayGraphics.fillStyle(0x0f172a, 0.85);
      this.unitOverlayGraphics.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

      this.unitOverlayGraphics.fillStyle(enemy.spec.color, 1);
      this.unitOverlayGraphics.fillRect(
        bx,
        by,
        Math.max(2, barW * Phaser.Math.Clamp(enemy.health.ratio, 0, 1)),
        barH
      );
    }
  }

  private checkDoorTransition(): void {
    const px = this.squad.leader.x;
    const py = this.squad.leader.y;

    const dirs: DoorDirection[] = ['top', 'bottom', 'left', 'right'];
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const dv = this.doors[dir];
      if (!dv.enabled) continue;

      if (dv.triggerZone.contains(px, py)) {
        this.roomState = 'TRANSITION';
        const nextRoom = this.gridManager.moveTo(dir);
        if (nextRoom) {
          this.enterRoom(nextRoom, dir);
        }
        break;
      }
    }
  }
}
