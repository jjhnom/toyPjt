import Phaser from 'phaser';
import { pixelPanel, fantasyButton, paintPanel, pixelIcon, FANTASY } from '../ui/fantasyTheme';
import { unitPortrait } from '../ui/pixelCharacters';
import { createCombatHudStatus, readCombatHudStatus } from '../ui/combatStatus';
import type { CombatHudStatus } from '../ui/combatStatus';
import {
  ARENA_BOUNDS,
  GAME_HEIGHT,
  GAME_WIDTH,
  ENEMY_SPECS,
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
  RunStats,
  RoomRunCheckpoint
} from '../types/game';
import type { CircleChoice, DroneArchetype, DamageSourceKind } from '../types/game';
import { heroXpForEnemy, heroXpToNext } from '../config/heroData';
import { HERO_CLASSES } from '../config/heroClassData';
import { legacyProfile } from '../systems/LegacyProfile';
import { UNIT_COMBAT_STYLES, UNIQUE_SKILLS, UNIT_PROJECTILE_SKILLS, UNIT_SKILL_DESCRIPTIONS } from '../config/skillData';
import { ROOM_REWARD, SQUAD_LIMITS, SUPPORT_HEAL_INTERVAL_MS } from '../config/squadData';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { ActiveSkillButton } from '../ui/ActiveSkillButton';
import { MUTATIONS } from '../config/mutationData';
import type { MutationId } from '../types/game';
import type { ServiceQuote, SupplyChoice } from '../types/game';
import { BOSS_IDS, BOSS_PROFILES, isBossId, planBossAttack } from '../config/bossData';
import { codexManager } from '../systems/CodexManager';
import { resolveSynergies, SYNERGY_IDS } from '../config/synergyData';
import { STAGES, getStageScaling, SPAWN_INTERVAL_MS, STAGE_RECOVERY_RATIO, SUMMONING_CIRCLE } from '../config/stageData';
import { endlessRecordManager } from '../systems/EndlessRecordManager';
import { StageProgression } from '../systems/StageProgression';
import { EncounterHazards, HazardKind } from '../entities/EncounterHazards';
import { runSaveManager } from '../systems/RunSaveManager';
import { killReward, roomClearReward, waveEnemyTypes } from '../systems/EncounterRules';
import { CombatMeasurements } from '../systems/CombatMeasurements';
import { RevivalPause } from '../systems/RevivalPause';

interface SpawnRequest { archetype: EnemyArchetype; x: number; y: number; hp: number; damage: number; speed: number }

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
  private activeSkillButton!: ActiveSkillButton;

  private doors: Record<DoorDirection, DoorVisual> = {} as Record<DoorDirection, DoorVisual>;
  private arenaGraphics!: Phaser.GameObjects.Graphics;
  private arenaArtwork!: Phaser.GameObjects.Image;
  private unitOverlayGraphics!: Phaser.GameObjects.Graphics;
  private skillGroundGraphics!: Phaser.GameObjects.Graphics;
  private lightningGraphics!: Phaser.GameObjects.Graphics;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private hpBarGraphics!: Phaser.GameObjects.Graphics;

  private hudRoomText!: Phaser.GameObjects.Text;
  private hudWaveText!: Phaser.GameObjects.Text;
  private hudMineralText!: Phaser.GameObjects.Text;
  private hudHpText!: Phaser.GameObjects.Text;
  private hudSquadText!: Phaser.GameObjects.Text;
  private hudFpsText!: Phaser.GameObjects.Text;
  private hudHeroName!: Phaser.GameObjects.Text;
  private hudHeroXpText!: Phaser.GameObjects.Text;
  private hudHeroXpBar!: Phaser.GameObjects.Graphics;
  private lastHeroLevel = -1;
  private lastHeroXp = -1;
  private centerBannerText!: Phaser.GameObjects.Text;
  private bannerSubtitle!: Phaser.GameObjects.Text;
  private bannerContainer!: Phaser.GameObjects.Container;
  private hudUnitBars!: Phaser.GameObjects.Graphics;
  private hudUnitPortraits: Phaser.GameObjects.Image[] = [];
  private hudUnitStatusTexts: Phaser.GameObjects.Text[] = [];
  private hudUnitSkillIcons: Phaser.GameObjects.Image[] = [];
  private hudUnitStatuses: CombatHudStatus[] = [];
  private hudUnitLastKinds: string[] = [];
  private hudUnitLastSeconds: number[] = [];
  private hudTeamCount!: Phaser.GameObjects.Text;
  private hudStatusRows: { portrait: Phaser.GameObjects.Image; title: Phaser.GameObjects.Text; state: Phaser.GameObjects.Text }[] = [];
  private bossHud!: Phaser.GameObjects.Container;
  private bossHudLabel!: Phaser.GameObjects.Text;
  private bossHudBar!: Phaser.GameObjects.Graphics;
  private bossHudLastHp = -1;
  private hudStatusDetail!: Phaser.GameObjects.Container;
  private hudStatusTitle!: Phaser.GameObjects.Text;
  private selectedHudUnitId: string | null = null;
  private nextStatusDetailAt = 0;
  private lastHudHp = -1;
  private lastHudMaxHp = -1;
  private lastAliveCount = -1;

  private currentWave = 0;
  private totalWavesInRoom = 0;
  private nextWaveTimerMs = 0;
  private enteringTimerMs = 0;
  private lightningClearAt = 0;
  private rewardModalOpen = false;
  private runEnded = false;
  private backgroundPaused = false;
  private readonly chainHitLives = new Set<number>();
  private readonly splitFireConfig: BulletFireConfig = {
    unitTypeId: 'STORM_ARCHER', isFragment: true,
    x: 0, y: 0, angle: 0, speed: 0, damage: 0, color: 0xffffff,
    aoeRadius: 0, slowFactor: 1, slowDurationMs: 0, pierceCount: 0, chainCount: 0
  };
  private doorCooldownMs = 0;
  private progression = new StageProgression();
  private pendingSpawns: SpawnRequest[] = [];
  private spawnTimerMs = 0;
  private hazards!: EncounterHazards;
  private bossPatternLeft = 0;
  private bossPatternNumber = 0;
  private saveStatusText!: Phaser.GameObjects.Text;
  private runId = '';
  private combatMeasurements: CombatMeasurements | null = null;
  private lastCombatReport: ReturnType<CombatMeasurements['report']> | null = null;
  private readonly revivalPause = new RevivalPause();

  private stats: RunStats = {
    stageIndex: 0,
    bossesDefeated: 0,
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

  public create(data: { resume?: boolean } = {}): void {
    const loaded = data.resume ? runSaveManager.load() : null;
    if (data.resume && loaded?.status !== 'ready') {
      this.runEnded = true;
      this.scene.start('MenuScene', { message: '저장 데이터를 읽을 수 없습니다. 새 모험을 시작할 수 있습니다.' });
      return;
    }
    const checkpoint = loaded?.status === 'ready' ? loaded.checkpoint : null;
    this.runId = checkpoint?.version === 2 ? checkpoint.runId : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    if (!data.resume) runSaveManager.clear();
    this.stats = checkpoint ? { ...checkpoint.stats } : {
      stageIndex: 0,
      bossesDefeated: 0,
      roomsCleared: 0,
      enemiesDefeated: 0,
      mineralsCollected: 30,
      bossDefeated: false,
      damageMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      moveSpeedBonus: 0
    };
    this.rewardModalOpen = false;
    this.combatMeasurements = null;
    this.lastCombatReport = null;
    this.revivalPause.clear();
    this.input.enabled = true;
    this.runEnded = false;
    this.backgroundPaused = false;
    this.lightningClearAt = 0;
    this.physics.world.resume();
    this.doorCooldownMs = 0;
    this.progression = new StageProgression();
    this.progression.index = this.stats.stageIndex;
    this.progression.bossesDefeated = this.stats.bossesDefeated;
    this.progression.endlessChoice = checkpoint?.endlessChoice ?? 'none';
    this.progression.mutation = checkpoint?.mutation ?? 'NONE';
    this.progression.nextMutation = checkpoint?.nextMutation ?? 'NONE';
    if (checkpoint?.version === 2 && checkpoint.phase === 'stage-cleared') this.progression.state = 'STAGE_CLEARED';
    this.pendingSpawns = [];
    this.spawnTimerMs = 0;
    this.bossPatternLeft = 0;
    this.bossPatternNumber = 0;

    // 물리 월드 경계를 아레나 내부로 설정
    this.physics.world.setBounds(
      ARENA_BOUNDS.left,
      ARENA_BOUNDS.top,
      ARENA_BOUNDS.width,
      ARENA_BOUNDS.height
    );

    this.gridManager = new RoomGridManager(this.progression.current, checkpoint?.grid);
    if (checkpoint?.version === 2) this.gridManager.restoreCurrentRoom(checkpoint.currentRoomId);

    // 배경 및 아레나 그래픽 레이어 (depth 0으로 설정하여 유닛 가림 방지)
    this.arenaGraphics = this.add.graphics().setDepth(0);
    this.arenaArtwork = this.add.image(ARENA_BOUNDS.centerX, ARENA_BOUNDS.centerY, 'art_dungeon')
      .setDisplaySize(ARENA_BOUNDS.width + 40, ARENA_BOUNDS.height + 40).setDepth(1).setName('dungeon-art');
    this.unitOverlayGraphics = this.add.graphics().setDepth(28);
    this.skillGroundGraphics = this.add.graphics().setDepth(16);
    this.lightningGraphics = this.add.graphics().setDepth(32);

    // 오브젝트 풀링 그룹 초기화
    this.bullets = new BulletGroup(this, (unit, x, y, angle) => this.particles.emitTrail(unit, x, y, angle));
    this.enemies = new EnemyGroup(this, (enemy: Enemy, damage: number) => {
      if (this.runEnded || this.rewardModalOpen || this.progression.state !== 'PLAYING') return;
      if (enemy.targetUnitId) {
        const target = this.squad.drones.find(drone => drone.id === enemy.targetUnitId);
        if (target && !target.health.isDead) {
          const damaged = target.health.takeDamage(damage, this.time.now, 650);
          if (damaged && target.archetype === 'THORN_GUARD') {
            this.particles.emitSkill('reflect', target.x, target.y, target.archetype);
            if (enemy.receiveDamage(Math.round(damage * 0.4), this.time.now)) this.handleEnemyKilled(enemy, target.id);
          }
        }
        return;
      }
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
    }, (enemy, damage, sourceUnitId) => {
      if (this.runEnded || this.rewardModalOpen || this.backgroundPaused || this.progression.state !== 'PLAYING'
        || this.roomState !== 'LOCKED_WAVES') return;
      this.particles.emitHit('LAVA_GOLEM', enemy.x, enemy.y);
      this.damageTexts.spawnText(enemy.x, enemy.y - 25, damage, '#ff8a2a');
      if (enemy.receiveDamage(damage, this.time.now)) this.handleEnemyKilled(enemy, sourceUnitId);
    }, (enemy, damage, sourceUnitId) => {
      if (this.runEnded || this.rewardModalOpen || this.backgroundPaused || this.progression.state !== 'PLAYING'
        || this.roomState !== 'LOCKED_WAVES') return;
      this.particles.emitSkill('poison', enemy.x, enemy.y, 'THORN_GUARD');
      this.damageTexts.spawnText(enemy.x, enemy.y - 25, damage, '#b2f06a');
      if (enemy.receiveDamage(damage, this.time.now)) this.handleEnemyKilled(enemy, sourceUnitId);
    });
    this.damageTexts = new DamageTextGroup(this);
    this.particles = new EffectParticleGroup(this);
    this.hazards = new EncounterHazards(this, (kind, x, y, radius, damage, sourceLife) =>
      this.resolveHazard(kind, x, y, radius, damage, sourceLife));

    // 사방 문(Door) 및 다음 방 타입 뱃지 생성
    this.createDoors();

    // 본체와 독립 전투 유닛 분대 초기화
    legacyProfile.flush();
    const legacy=legacyProfile.snapshot();
    this.squad = new PlayerSquad(
      this,
      ARENA_BOUNDS.centerX,
      ARENA_BOUNDS.centerY,
      (cfg: BulletFireConfig) => {
        const fired = this.bullets.fireBullet(cfg);
        this.combatMeasurements?.recordShot(!!fired);
        if (fired) this.particles.emitCast(cfg.unitTypeId ?? 'BASIC_LASER', cfg.x, cfg.y, cfg.angle);
      },
      () => this.handlePlayerDeath(),
      (amount: number) => {
        this.damageTexts.spawnText(
          this.squad.leader.x,
          this.squad.leader.y - 24,
          `-${amount}`,
          '#f87171'
        );
        if (amount >= 18) this.cameras.main.shake(90, 0.005);
        this.refreshHud();
      },
      (kind, x, y, unit) => this.particles.emitSkill(kind, x, y, unit),
      checkpoint?undefined:{classId:legacy.profile.selectedClass,permanent:legacy.profile.ranks}
    );
    if (checkpoint) {
      // Discard the new-run projection before hydrating saved IDs and archetypes.
      for (const drone of this.squad.drones) drone.destroy();
      this.squad.drones = [];
      this.squad.roster.restore(checkpoint.roster, this.stats.stageIndex);
      this.squad.restoreHero(checkpoint.hero);
      this.squad.syncRoster();
      this.squad.health.reset(checkpoint.leaderHealth.maxHp);
      this.squad.health.currentHp = checkpoint.leaderHealth.currentHp;
      this.squad.restoreRelicHealing(checkpoint.relicHealRemainingMs);
      for (const drone of this.squad.drones) {
        drone.health.currentHp = checkpoint.unitHealth.find(unit => unit.id === drone.id)!.currentHp;
        drone.lastHealAt = this.time.now;
      }
    }

    codexManager.recordUnits(this.squad.roster.units.map(unit=>unit.archetype));
    legacyProfile.recordBosses(this.squad.hero.classId,this.stats.bossesDefeated);
    for(const id of BOSS_IDS.slice(0,Math.min(this.stats.bossesDefeated,BOSS_IDS.length)))codexManager.recordBoss(id);

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
      this.squad.movement.stop();
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
    const onPaused = () => { this.activeSkillButton.cancel(); this.revivalPause.capture(this.squad.drones, this.time.now); };
    const onResumed = () => this.revivalPause.queueResume();
    this.events.on(Phaser.Scenes.Events.PAUSE, onPaused);
    this.events.on(Phaser.Scenes.Events.RESUME, onResumed);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
      this.events.off(Phaser.Scenes.Events.PAUSE, onPaused);
      this.events.off(Phaser.Scenes.Events.RESUME, onResumed);
      this.revivalPause.clear();
      this.joystick.destroy();
      this.activeSkillButton.destroy();
      this.tweens.killTweensOf(this.bannerContainer);
      this.scene.stop('SquadScene');
      this.scene.stop('SummoningCircleScene');
      this.scene.stop('EndlessChoiceScene');
      this.scene.stop('CodexScene');
      this.scene.stop('RewardScene');
    });

    // 시작 룸 진입
    const completedCheckpoint = checkpoint?.version === 2 && checkpoint.phase !== 'stage-start';
    this.enterRoom(this.gridManager.getCurrentRoom(), null, checkpoint !== null);
    this.showStageBanner();
    if (checkpoint?.version === 2) {
      for (const drone of this.squad.drones) {
        const health = checkpoint.unitHealth.find(unit => unit.id === drone.id)!;
        drone.reviveAt = health.currentHp === 0 ? this.time.now + health.reviveRemainingMs : 0;
        drone.lastHealAt = this.time.now - SUPPORT_HEAL_INTERVAL_MS + health.healRemainingMs;
        const cooldown = this.majorSkillCooldown(drone.archetype);
        drone.lastSkillAt = this.time.now - cooldown + health.skillRemainingMs;
        drone.setActive(!drone.health.isDead).setVisible(!drone.health.isDead);
      }
    }
    if (checkpoint) {
      this.saveStatusText.setText(loaded?.status === 'ready' && loaded.recovered
        ? '최근 저장 손상 · 이전 정상 지점에서 복구했습니다'
        : `S${this.stats.stageIndex + 1} ${completedCheckpoint ? '방 클리어' : '시작'} 저장 · 이어하는 중`);
      if (completedCheckpoint) {
        this.roomState = 'CLEARED';
        this.updateDoorsVisual(this.gridManager.getCurrentRoom(), this.progression.state !== 'PLAYING');
        if (this.progression.endlessChoice === 'exit') { this.finishExpedition(); return; }
        if (this.progression.endlessChoice === 'pending') this.openEndlessChoice();
        else this.openSquadModal('저장된 정비 상태입니다 · 보상은 이미 반영되었습니다', checkpoint.version === 2 && checkpoint.phase === 'stage-cleared');
      }
      this.refreshHud();
    } else { this.squad.roster.recordEconomy('stageStart'); this.saveCheckpoint(); }
    if (this.progression.index >= 5) endlessRecordManager.recordReached(this.progression.index);
    if (new URLSearchParams(window.location.search).has('metrics')) this.startCombatMeasurement();
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
    const ability=HERO_CLASSES[this.squad.hero.classId];
    this.activeSkillButton = new ActiveSkillButton(this, () => {
      const active = !this.runEnded && !this.rewardModalOpen && !this.backgroundPaused && this.scene.isActive()
        && this.progression.state === 'PLAYING' && this.roomState === 'LOCKED_WAVES';
      if (this.squad.castCommandHeal(active)) this.updateHudVitals();
      else if (active && !this.squad.health.isDead && this.squad.activeRemaining() <= 0) this.showBanner(`${ability.activeName} · 적용할 대상이 없습니다`);
    }, () => { this.joystick?.reset(); this.squad.movement.stop(); },{name:ability.activeName,label:ability.activeLabel});
    fantasyButton(this, 642, 1230, 112, 88, '중단\n타이틀', () => this.returnToTitle(),
      {fontSize:22,hitWidth:112,hitHeight:100}).setDepth(65).setName('return-title');
    this.saveStatusText = this.add.text(24, 155, '', {
      fontFamily: FANTASY.font, fontSize: '12px', color: '#d9b969'
    }).setDepth(65);
    fantasyButton(this, 398, 1230, 112, 88, '원정\n정비', () => {
      if (this.roomState === 'CLEARED' && !this.rewardModalOpen && !this.runEnded) this.openSquadModal();
      else this.showBanner('전투 종료 후 정비할 수 있습니다');
    }, {fontSize:22,hitWidth:112,hitHeight:100}).setDepth(65).setName('squad-open');
    const dock=this.add.graphics().setDepth(50);
    dock.fillStyle(0x201c2d,0.98).fillRect(0,1080,720,100);
    dock.fillStyle(0x231d32,0.99).fillRect(0,1180,720,100);
    dock.lineStyle(2,0x897496).lineBetween(0,1080,720,1080);
    dock.lineStyle(1,0x51415e).lineBetween(0,1180,720,1180);
    this.add.rectangle(360,1130,720,100,0,0).setDepth(50).setInteractive()
      .on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,e:Phaser.Types.Input.EventData)=>e.stopPropagation());
    pixelPanel(this, 12, 10, 534, 142, FANTASY.panel, FANTASY.gold).setDepth(50);
    pixelPanel(this, 554, 10, 154, 142, FANTASY.panel, FANTASY.edge).setDepth(50);
    pixelPanel(this, 24, 22, 68, 68, 0x263344, FANTASY.gold).setDepth(51);
    this.add.image(58, 56, 'spr_player_leader', 0).setScale(0.85).setDepth(52);
    const ornaments = this.add.graphics().setDepth(52);
    paintPanel(ornaments, 370, 22, 162, 48, 0x131e2b, 0x566675);
    pixelIcon(ornaments, 'gem', 382, 36, 1.6);
    pixelIcon(ornaments, 'heart', 96, 29, 1);
    this.add.text(411, 26, '마력석', { fontFamily: FANTASY.font, fontSize: '11px', color: FANTASY.muted }).setDepth(53);
    this.add.text(568, 17, '미니맵', { fontFamily: FANTASY.font, fontSize: '12px', color: FANTASY.muted }).setDepth(53);
    this.hpBarGraphics = this.add.graphics().setDepth(52);
    this.minimapGraphics = this.add.graphics().setDepth(52);
    const label = (x: number, y: number, size: number, color = FANTASY.cream) => this.add.text(x, y, '', {
      fontFamily: FANTASY.font, fontSize: `${size}px`, fontStyle: 'bold', color, resolution: 2
    }).setDepth(53);
    this.hudRoomText = label(112, 70, 19);
    this.hudWaveText = label(112, 95, 16, '#d6bc83');
    this.hudHpText = label(234, 51, 16).setOrigin(0.5);
    this.hudHeroName = label(112, 10, 20, '#dec8f2').setName('hero-name');
    this.hudHeroXpText = label(24, 94, 12, '#cfb7ff').setName('hero-xp');
    this.hudHeroXpBar = this.add.graphics().setDepth(54);
    this.lastHeroLevel = this.lastHeroXp = -1;
    this.hudMineralText = label(411, 40, 24, '#f3c64d');
    this.hudSquadText = label(24, 1086, 18, '#e4d5ed');
    this.hudTeamCount = label(548,1086,18,'#c2b4d1').setOrigin(1,0).setName('squad-living');
    this.hudFpsText = label(555, 1250, 12, FANTASY.muted)
      .setVisible(new URLSearchParams(window.location.search).has('debug'));
    this.hudUnitBars = this.add.graphics().setDepth(54);
    this.hudUnitPortraits = [];
    this.hudUnitStatusTexts = []; this.hudUnitSkillIcons = []; this.hudUnitStatuses = [];
    this.hudUnitLastKinds = []; this.hudUnitLastSeconds = [];
    this.selectedHudUnitId = null; this.nextStatusDetailAt = 0;
    for (let i = 0; i < SQUAD_LIMITS.deployed; i++) {
      pixelPanel(this,24+i*86,1108,78,64,0x211b31,0x655275).setDepth(51);
      const portrait = this.add.image(63+i*86,1138,unitPortrait('BASIC_LASER'))
        .setDisplaySize(60,60).setDepth(53).setVisible(false);
      this.hudUnitPortraits.push(portrait);
      this.hudUnitStatusTexts.push(label(63+i*86,1149,18).setOrigin(0.5)
        .setStroke('#080c16', 4).setDepth(56).setVisible(false));
      this.hudUnitSkillIcons.push(this.add.image(85+i*86,1120,'skill_shield')
        .setDisplaySize(16,16).setDepth(55).setVisible(false));
      this.hudUnitStatuses.push(createCombatHudStatus());
      this.hudUnitLastKinds.push(''); this.hudUnitLastSeconds.push(-1);
    }
    fantasyButton(this,630,1130,108,88,'상세 ›',()=>{
      if(this.rewardModalOpen||this.runEnded||this.backgroundPaused||!this.squad.drones.length)return;
      this.selectedHudUnitId=this.selectedHudUnitId?null:this.squad.drones[0].id;
      this.nextStatusDetailAt=0;this.updateStatusDetail();
    },{fontSize:24,hitHeight:100}).setDepth(65).setName('squad-status-open');
    this.hudStatusDetail = this.add.container(24,286).setDepth(70).setVisible(false).setName('squad-status-detail');
    const statusPanel = pixelPanel(this,0,0,672,714,FANTASY.slate,FANTASY.edge);
    const statusHit = this.add.rectangle(336,357,672,714,0,0).setInteractive()
      .on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    this.hudStatusTitle = label(24,18,28).setText('분대 상태 · 전투는 계속됩니다');
    this.hudStatusRows=[];
    this.hudStatusDetail.add([statusPanel,statusHit,this.hudStatusTitle]);
    for(let i=0;i<SQUAD_LIMITS.deployed;i++){
      const y=80+i*86;
      const portrait=this.add.image(58,y+30,unitPortrait('BASIC_LASER')).setDisplaySize(62,62);
      const rowTitle=label(104,y,24).setWordWrapWidth(540).setName(`squad-detail-title-${i}`);
      const rowState=label(104,y+32,20,'#c9bbd7').setWordWrapWidth(534).setName(`squad-detail-state-${i}`);
      this.hudStatusRows.push({portrait,title:rowTitle,state:rowState});
      this.hudStatusDetail.add([portrait,rowTitle,rowState]);
    }
    const closeStatus = fantasyButton(this,336,646,616,100,'상태 닫기',()=>{
      this.selectedHudUnitId = null; this.hudStatusDetail.setVisible(false);
    },{fontSize:28}).setName('squad-status-close');
    this.hudStatusDetail.add(closeStatus);
    this.bossHud=this.add.container(24,116).setDepth(60).setVisible(false).setName('boss-hud');
    this.bossHudLabel=label(10,4,16,'#edc6d9');
    this.bossHudBar=this.add.graphics();
    this.bossHud.add([pixelPanel(this,0,0,508,40,0x352033,0xa96e87),this.bossHudBar,this.bossHudLabel]);
    this.bossHudLastHp=-1;
    this.lastHudHp = this.lastHudMaxHp = this.lastAliveCount = -1;
    this.bannerContainer = this.add.container(360, 302).setDepth(48).setAlpha(0);
    const plate = pixelPanel(this, -250, -48, 500, 96, 0x18232e, FANTASY.gold);
    this.centerBannerText = label(0, -13, 25).setOrigin(0.5).setAlign('center').setWordWrapWidth(450);
    this.bannerSubtitle = label(0, 23, 16, '#c6d2d7').setOrigin(0.5).setWordWrapWidth(450);
    this.bannerContainer.add([plate, this.centerBannerText, this.bannerSubtitle]);
  }

  private drawArenaForRoom(room: RoomNode): void {
    const g = this.arenaGraphics;
    g.clear();
    const palette = this.progression.current.palette;
    const tint = [0xffffff, 0xdbe8c1, 0xffd3b4, 0xc1eaff, 0xe3c8ff][this.progression.index] ?? 0xffffff;
    this.arenaArtwork.setTint(tint);
    g.fillStyle(room.type === 'BOSS' ? 0x201725 : palette.background).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Painted walls sit around the arena; physics and door triggers use the
    // existing bounds. All room decoration is part of the background texture.
  }

  private enterRoom(room: RoomNode, enteredFrom: DoorDirection | null, restoringCheckpoint = false): void {
    this.squad.roster.economy.roomId = room.id;
    this.roomState = 'ENTERING';
    this.enteringTimerMs = 450;
    this.doorCooldownMs = 900;

    this.clearEncounter();
    this.revivalPause.clear();
    if (!restoringCheckpoint) this.squad.recoverForRoomEntry();

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
    if (enteredFrom === null) {
      for (const drone of this.squad.drones) this.particles.emitSkill('summon', drone.x, drone.y, drone.archetype);
    }

    const meta = ROOM_TYPE_META[room.type];
    this.showBanner(`[${room.gridX + 1}, ${room.gridY + 1}] ${meta.label}`);

    this.updateDoorsVisual(room, false);
    this.refreshHud();
  }

  private clearEncounter(): void {
    this.activeSkillButton.cancel();
    this.selectedHudUnitId = null;
    this.hudStatusDetail.setVisible(false);
    this.pendingSpawns.length = 0;
    this.spawnTimerMs = 0;
    this.currentWave = 0;
    this.totalWavesInRoom = 0;
    this.nextWaveTimerMs = 0;
    this.bossPatternLeft = 0;
    this.bossPatternNumber = 0;
    this.hazards.clear();
    this.lightningGraphics.clear();
    this.unitOverlayGraphics.clear();
    this.skillGroundGraphics.clear();
    this.squad.clearCombatEffects();
    this.lightningClearAt = 0;
    this.chainHitLives.clear();
    for (const group of [this.damageTexts, this.particles]) {
      for (const child of group.getChildren()) {
        (child as Phaser.GameObjects.Sprite).setActive(false).setVisible(false);
      }
    }
    const activeBullets = this.bullets.getChildren();
    for (let i = 0; i < activeBullets.length; i++) {
      (activeBullets[i] as Bullet).deactivate();
    }
    const activeEnemies = this.enemies.getChildren();
    for (let i = 0; i < activeEnemies.length; i++) {
      (activeEnemies[i] as Enemy).deactivate();
    }

  }

  private startRoomLogic(room: RoomNode): void {
    if (room.cleared) {
      this.setRoomClearedState(room, false);
      this.saveCheckpoint();
      return;
    }

    if (room.type === 'RECOVERY') {
      room.cleared = true;
      this.stats.roomsCleared += 1;
      const recovery = this.squad.recoverAtSpring();
      this.damageTexts.spawnText(
        this.squad.leader.x,
        this.squad.leader.y - 30,
        `+${recovery.leaderHealed} HP 회복!`,
        '#34d399'
      );
      this.particles.emitShockwave(this.squad.leader.x, this.squad.leader.y, 110, 0x8ca56a);
      soundManager.playPowerup();
      this.setRoomClearedState(room, false);
      this.showBanner(`치유의 샘\n본체 +${recovery.leaderHealed} HP · 동료 ${recovery.unitsRecovered}기 회복`);
      this.saveCheckpoint();
      return;
    }

    if (room.type === 'EVENT') {
      this.openSummoningCircle(room);
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
    const stage = this.progression.current;
    const types = waveEnemyTypes(stage, room, this.currentWave, this.totalWavesInRoom);
    if (room.type === 'EVENT') {
      this.showBanner('봉인 해제 시작\n수호자를 물리치고 소환진을 정화하세요');
      for (let i = 0; i < types.length; i++) {
        const escort = this.getPerimeterSpawnPoint(i);
        this.queueEnemy(types[i], escort.x, escort.y);
      }
      this.refreshHud();
      return;
    }
    if (room.type === 'BOSS') {
      this.showBanner(`${stage.bossName}\n${isBossId(stage.bossId) ? BOSS_PROFILES[stage.bossId].hint : '공격 예고를 피해 이동하세요'}`);
      this.queueEnemy(types[0], ARENA_BOUNDS.centerX, ARENA_BOUNDS.top + 110);
      for (let i = 1; i < types.length; i++) {
        const pos = this.getPerimeterSpawnPoint(i - 1);
        this.queueEnemy(types[i], pos.x, pos.y);
      }
      this.bossPatternLeft = 2400;
      this.refreshHud();
      return;
    }

    for (let i = 0; i < types.length; i++) {
      const pos = this.getPerimeterSpawnPoint(types[i] === 'ELITE_BRUTE' ? 99 : i);
      this.queueEnemy(types[i], pos.x, pos.y);
    }

    this.refreshHud();
  }

  private queueEnemy(archetype: EnemyArchetype, x: number, y: number): void {
    const scaling = getStageScaling(this.progression.index, this.progression.mutation);
    const room = this.gridManager.getCurrentRoom();
    const local = (1 + 0.4 * this.gridManager.getDepth(room)) * (1 + 0.05 * Math.max(0, this.currentWave - 1));
    const boss = archetype === 'BOSS_CORE';
    this.pendingSpawns.push({ archetype, x, y,
      hp: (boss ? scaling.bossHpMult : scaling.enemyHpMult) * local,
      damage: boss ? scaling.bossDamageMult : scaling.enemyDamageMult,
      speed: scaling.enemySpeedMult });
  }

  private processSpawns(delta: number): void {
    this.spawnTimerMs -= delta;
    if (!this.pendingSpawns.length || this.spawnTimerMs > 0) return;
    const scaling = getStageScaling(this.progression.index, this.progression.mutation);
    if (this.enemies.countActive(true) >= scaling.maxActiveEnemies) return;
    const spawn = this.pendingSpawns[0];
    const enemy = this.enemies.spawnEnemy(spawn.archetype, spawn.x, spawn.y, spawn.hp, spawn.damage, spawn.speed);
    if (!enemy) return; // Required spawns remain queued when the pool is exhausted.
    if (spawn.archetype === 'BOSS_CORE' && isBossId(this.progression.current.bossId)) enemy.applyBossProfile(this.progression.current.bossId);
    enemy.onSpecial = (source, kind) => this.onEnemySpecial(source, kind);
    this.pendingSpawns.shift();
    this.spawnTimerMs = SPAWN_INTERVAL_MS * scaling.spawnIntervalMult;
  }

  private onEnemySpecial(enemy: Enemy, kind: 'SHOT' | 'EXPLODE' | 'SUMMON'): void {
    if (this.runEnded || this.rewardModalOpen || this.progression.state !== 'PLAYING') return;
    const target = this.squad.drones.find(drone => drone.id === enemy.targetUnitId);
    this.hazards.add(kind, kind === 'EXPLODE' || kind === 'SUMMON' ? enemy.x : target?.x ?? this.squad.leader.x,
      kind === 'EXPLODE' || kind === 'SUMMON' ? enemy.y : target?.y ?? this.squad.leader.y,
      enemy.spec.contactDamage, enemy.lifeId);
  }

  private resolveHazard(kind: HazardKind, x: number, y: number, radius: number, damage: number, sourceLife: number): void {
    if (this.runEnded || this.rewardModalOpen || this.progression.state !== 'PLAYING') return;
    if (kind === 'CHARGE') {
      const boss = (this.enemies.getChildren() as Enemy[]).find(enemy => enemy.active && enemy.lifeId === sourceLife);
      boss?.beginCharge(x, y, this.time.now);
      return;
    }
    if (kind === 'SUMMON') {
      const source = (this.enemies.getChildren() as Enemy[]).find(enemy => enemy.active && enemy.lifeId === sourceLife);
      if (!source || this.pendingSpawns.length >= 12) return;
      this.queueEnemy('SWARMER', x - 30, y);
      this.queueEnemy('SWARMER', x + 30, y);
      return;
    }
    if ((this.squad.leader.x - x) ** 2 + (this.squad.leader.y - y) ** 2 < radius ** 2) {
      this.squad.receiveContactDamage(damage, this.time.now);
      if (this.runEnded) return;
      if (kind === 'FROST') this.squad.movement.applySlow(0.65, 800, this.time.now);
    }
    for (const drone of this.squad.drones) {
      if (!drone.health.isDead && (drone.x - x) ** 2 + (drone.y - y) ** 2 < radius ** 2)
        drone.health.takeDamage(damage, this.time.now, 650);
    }
  }

  private updateBossPatterns(delta: number): void {
    const boss = (this.enemies.getChildren() as Enemy[]).find(enemy => enemy.active && enemy.spec.archetype === 'BOSS_CORE');
    if (!boss) return;
    this.bossPatternLeft = Math.max(0,this.bossPatternLeft-Math.max(0,delta));
    if (this.bossPatternLeft > 0 || !isBossId(this.progression.current.bossId)) return;
    const stage = this.progression.current;
    const phase = Math.min(stage.bossPhases, 1 + Math.floor((1 - boss.health.ratio) * stage.bossPhases));
    if(!isBossId(stage.bossId))return;
    const plan=planBossAttack(stage.bossId,phase,this.bossPatternNumber++,
      {x:boss.x,y:boss.y,speed:boss.spec.speed},this.squad.leader);
    this.bossPatternLeft=plan.intervalMs;
    for(const attack of plan.attacks) {
      const added=this.hazards.add(attack.kind,attack.x,attack.y,boss.spec.contactDamage,boss.lifeId,attack);
      if(added&&attack.kind==='CHARGE')boss.windUpCharge(attack.warningMs);
    }
    this.hudWaveText.setText(`${stage.bossName} · PHASE ${phase}/${stage.bossPhases}`);
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
          neighbor.sideSupply ? `보급${neighbor.cleared ? '✓' : ''}` : neighbor.cleared ? `${meta.badgeText}✓` : meta.badgeText
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
    this.combatMeasurements?.recordContact();

    const now = this.time.now;
    const sourceUnitId = bullet.sourceUnitId;
    const sourceKind = bullet.sourceKind;
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
    this.particles.emitHit(bullet.unitTypeId, enemy.x, enemy.y);

    if (killed) {
      this.handleEnemyKilled(enemy, sourceUnitId, sourceKind);
      if (this.runEnded || this.progression.state !== 'PLAYING') return;
    }

    const poison = !bullet.isFragment && sourceKind !== 'hero' && UNIT_PROJECTILE_SKILLS[bullet.unitTypeId]?.poison;
    if (poison && enemy.active) {
      enemy.poison.apply(Math.max(1, Math.round(bullet.damage * poison.damageRatio)), now,
        poison.durationMs, poison.tickMs, sourceUnitId);
      this.particles.emitSkill('poison', enemy.x, enemy.y, bullet.unitTypeId);
    }
    if (bullet.splitPending) this.splitProjectile(bullet, enemy);

    // 2. 범위 폭발(AoE) 처리 (로켓 봇 / 블랙홀 유도탄)
    if (bullet.aoeRadius > 0) {
      this.particles.emitExplosion(bullet.unitTypeId, enemy.x, enemy.y, bullet.aoeRadius);
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
            this.handleEnemyKilled(other, sourceUnitId, sourceKind);
            if (this.runEnded || this.progression.state !== 'PLAYING') return;
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
        now,
        bullet.unitTypeId,
        sourceUnitId,
        sourceKind
      );
    }

    // 4. 관통(Pierce) 여부에 따른 탄환 소멸
    if (bullet.remainingPierces > 0) {
      bullet.remainingPierces -= 1;
    } else {
      bullet.deactivate();
    }
  }

  private splitProjectile(parent: Bullet, hitEnemy: Enemy): void {
    parent.splitPending = false;
    const skill = UNIT_PROJECTILE_SKILLS[parent.unitTypeId]?.split;
    if (!skill) return;
    const cfg = this.splitFireConfig;
    cfg.sourceUnitId = parent.sourceUnitId;
    cfg.sourceKind = parent.sourceKind;
    cfg.unitTypeId = parent.unitTypeId;
    cfg.x = hitEnemy.x; cfg.y = hitEnemy.y;
    cfg.speed = parent.flightSpeed;
    cfg.damage = Math.max(1, Math.round(parent.damage * skill.damageRatio));
    cfg.ignoredEnemyLifeId = hitEnemy.lifeId;
    let previousLife = -1;
    let emitted = false;
    for (let branch = 0; branch < skill.count; branch++) {
      let nearest: Enemy | null = null;
      let distanceSq = skill.radius ** 2;
      for (const child of this.enemies.getChildren()) {
        const enemy = child as Enemy;
        if (!enemy.active || enemy.lifeId === previousLife || parent.hitEnemyLives.has(enemy.lifeId)) continue;
        const dSq = (enemy.x - hitEnemy.x) ** 2 + (enemy.y - hitEnemy.y) ** 2;
        if (dSq <= distanceSq) { nearest = enemy; distanceSq = dSq; }
      }
      if (!nearest) break;
      previousLife = nearest.lifeId;
      cfg.angle = Math.atan2(nearest.y - hitEnemy.y, nearest.x - hitEnemy.x);
      const fired = this.bullets.fireBullet(cfg);
      this.combatMeasurements?.recordShot(!!fired);
      if (!fired) break;
      emitted = true;
    }
    if (emitted) this.particles.emitSkill('split', hitEnemy.x, hitEnemy.y, parent.unitTypeId);
  }

  private triggerChainLightning(
    startEnemy: Enemy,
    chains: number,
    chainDamage: number,
    slowFactor: number,
    slowDurationMs: number,
    now: number,
    unitTypeId: DroneArchetype = 'CHAIN_LIGHTNING',
    sourceUnitId?: string,
    sourceKind: DamageSourceKind = sourceUnitId ? 'unit' : 'environment'
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

      this.particles.emitLightning(currentX, currentY, nearest.x, nearest.y, UNIT_COMBAT_STYLES[unitTypeId].color, c);
      currentX = nearest.x;
      currentY = nearest.y;

      const killed = nearest.receiveDamage(chainDamage, now, slowFactor, slowDurationMs);
      this.particles.emitHit(unitTypeId, nearest.x, nearest.y);
      this.damageTexts.spawnText(nearest.x, nearest.y - 16, chainDamage, '#67e8f9');
      if (killed) {
        this.handleEnemyKilled(nearest, sourceUnitId, sourceKind);
        if (this.runEnded || this.progression.state !== 'PLAYING') return;
      }
    }
  }

  private handleEnemyKilled(enemy: Enemy, sourceUnitId?: string,
    sourceKind: DamageSourceKind = sourceUnitId ? 'unit' : 'environment'): void {
    if (this.runEnded || this.rewardModalOpen || this.progression.state !== 'PLAYING' || enemy.rewardsClaimed) return;
    enemy.rewardsClaimed = true;
    this.stats.enemiesDefeated += 1;
    if (sourceKind === 'unit') this.squad.onKill(sourceUnitId);
    const levels = this.squad.recordHeroKill(sourceKind, heroXpForEnemy(enemy.spec.archetype));
    if (levels > 0) {
      this.damageTexts.spawnText(this.squad.leader.x, this.squad.leader.y - 36, `Lv.${this.squad.hero.level}`, '#cfb7ff');
      this.particles.emitSkill('buff', this.squad.leader.x, this.squad.leader.y, 'SPARK_SPIRIT');
    }
    this.squad.roster.grantReward(killReward(enemy.spec.archetype, this.progression.index, undefined, this.progression.mutation), 0, 'kill', enemy.spec.archetype);
    this.particles.emitBurst(enemy.x, enemy.y, 0xf2c17c, 8, 190);
    soundManager.playExplosion();
    if (enemy.spec.archetype === 'BOSS_CORE') {
      this.finishRoom(this.gridManager.getCurrentRoom());
      return;
    }
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
    legacyProfile.recordBosses(this.squad.hero.classId,this.stats.bossesDefeated);
    const saveCleared = runSaveManager.clear();
    this.joystick.reset();
    (this.squad.leader.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.pendingSpawns.length = 0;
    this.hazards.clear();
    this.refreshHud();
    soundManager.playExplosion();
    this.particles.emitShockwave(this.squad.leader.x, this.squad.leader.y, 140, 0xef4444);
    this.scene.start('GameOverScene', {
      victory: false,
      saveWarning: saveCleared ? undefined : '저장 삭제 실패 · 저장소 권한을 확인하세요',
      stats: this.stats,
      hero: this.squad.heroSnapshot(),
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
    const reward = roomClearReward(room.type, this.progression.index, this.progression.mutation);
    this.squad.roster.grantReward(reward, 0, 'room', room.type);
    if (room.type === 'EVENT') {
      this.squad.roster.grantReward(0, SUMMONING_CIRCLE.vouchers, 'circle', 'CHALLENGE');
      this.saveCheckpoint();
      this.openSquadModal(`봉인 해제 성공 · T1 소환권 +1 · 보상 +${reward} ◆`);
      return;
    }
    this.saveCheckpoint();
    this.openSquadModal(`정화 보상 +${reward} ◆ · 소환과 조합으로 분대를 구성하세요`);
  }

  private openSummoningCircle(room: RoomNode): void {
    if (this.rewardModalOpen || this.runEnded || room.cleared || room.circleChoice) return;
    this.rewardModalOpen = true;
    this.joystick.reset();
    this.squad.movement.stop();
    this.input.enabled = false;
    this.scene.launch('SummoningCircleScene', {
      reward: Math.round(ROOM_REWARD.combat * getStageScaling(this.progression.index, this.progression.mutation).rewardMult),
      guardianName: ENEMY_SPECS[SUMMONING_CIRCLE.guardian].name,
      escortName: ENEMY_SPECS[this.progression.current.enemyPoolIds[0]].name,
      onChoose: (choice: CircleChoice) => this.chooseSummoningCircle(room, choice)
    });
    this.scene.pause();
  }

  private chooseSummoningCircle(room: RoomNode, choice: CircleChoice): void {
    if (this.runEnded || !this.rewardModalOpen || this.gridManager.getCurrentRoom() !== room ||
      room.cleared || room.circleChoice || !['SAFE', 'CHALLENGE', 'SKIP'].includes(choice)) return;
    room.circleChoice = choice;
    this.rewardModalOpen = false;
    if (choice === 'CHALLENGE') {
      this.roomState = 'LOCKED_WAVES';
      this.currentWave = 0;
      this.totalWavesInRoom = 1;
      this.nextWaveTimerMs = 200;
      this.updateDoorsVisual(room, true);
      this.refreshHud();
    } else {
      room.cleared = true;
      this.stats.roomsCleared++;
      this.setRoomClearedState(room, false);
      if (choice === 'SAFE') {
        this.squad.roster.grantReward(0, SUMMONING_CIRCLE.vouchers, 'circle', 'SAFE');
        this.saveCheckpoint();
        this.openSquadModal('소환진의 힘을 회수했습니다 · T1 무료 지정 소환권 +1');
        return;
      }
      this.showBanner('소환진을 지나갑니다\n열린 문으로 이동하세요');
      this.saveCheckpoint();
    }
    this.input.enabled = !this.backgroundPaused;
    if (!this.backgroundPaused) this.scene.resume();
  }

  private openSquadModal(message = '소환 · 조합 · 출전 관리', stageClear = false): void {
    if (this.rewardModalOpen || this.runEnded) return;
    this.rewardModalOpen = true;
    this.joystick.reset();
    (this.squad.leader.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.input.enabled = false;
    this.scene.launch('SquadScene', {
      roster: this.squad.roster,
      hero: this.squad.hero,
      squad: this.squad,
      supplyRoom: this.gridManager.grid.flat().find(room => room?.sideSupply && room.cleared && room.supplyChoice === undefined) ?? null,
      onSupply: (choice: SupplyChoice) => {
        if (this.runEnded || !this.rewardModalOpen || this.backgroundPaused || this.roomState !== 'CLEARED') return false;
        const pending = this.gridManager.grid.flat().find(room => room?.sideSupply && room.cleared && room.supplyChoice === undefined);
        return !!pending && this.squad.roster.claimSupply(pending, choice);
      },
      onService: (quote: ServiceQuote) => this.squad.buyService(quote,
        !this.runEnded && this.rewardModalOpen && !this.backgroundPaused && this.roomState === 'CLEARED'),
      message,
      closeLabel: stageClear ? `다음 스테이지로 · ${this.progression.next?.name}` : undefined,
      stageSummary: stageClear ? `STAGE ${this.progression.index + 1} CLEAR → ${this.progression.next?.name}` : undefined,
      onChanged: () => {
        if (this.runEnded || !this.rewardModalOpen) return false;
        this.squad.syncRoster();
        return this.saveCheckpoint();
      },
      onClose: () => {
        if (this.runEnded || !this.rewardModalOpen) return;
        this.squad.syncRoster();
        if (stageClear) this.advanceStage();
        else this.saveCheckpoint();
        this.rewardModalOpen = false;
        this.input.enabled = !this.backgroundPaused;
        this.refreshHud();
        if (!this.backgroundPaused) this.scene.resume();
      }
    });
    this.scene.pause();
  }

  private finishRoom(room: RoomNode): void {
    if (room.cleared || this.runEnded || this.progression.state !== 'PLAYING') return;
    if (room.type === 'EVENT' && room.circleChoice !== 'CHALLENGE') return;
    room.cleared = true;
    this.stats.roomsCleared++;
    soundManager.playPowerup();
    if (room.type === 'ELITE') this.squad.roster.offerRelic(room);
    if (room.type !== 'BOSS') {
      // A completed encounter cannot keep damaging or buffing the squad after management closes.
      this.hazards.clear();
      for (const child of this.bullets.getChildren()) (child as Bullet).deactivate();
      this.squad.clearCombatEffects();
      this.skillGroundGraphics.clear();
      this.setRoomClearedState(room, true);
      return;
    }
    const result = this.progression.clearBoss();
    if (!result) return;
    if(isBossId(this.progression.current.bossId))codexManager.recordBoss(this.progression.current.bossId);
    this.clearEncounter();
    this.roomState = 'CLEARED';
    this.updateDoorsVisual(room, true);
    this.stats.bossesDefeated = this.progression.bossesDefeated;
    legacyProfile.recordBosses(this.squad.hero.classId,this.stats.bossesDefeated);
    if (this.progression.index >= 4) this.stats.bossDefeated = true;
    this.squad.roster.grantReward(result.minerals, result.freeSummons, 'boss', this.progression.current.bossId);
    this.squad.roster.recordEconomy('stageEnd');
    if (result.choiceRequired) { this.refreshHud(); this.saveCheckpoint(); this.openEndlessChoice(); return; }
    if (result.victory) {
      this.runEnded = true;
      const saveCleared = runSaveManager.clear();
      this.stats.bossDefeated = true;
      this.refreshHud();
      this.scene.start('GameOverScene', { victory: true, stats: this.stats, droneSummary: this.getDroneSummaryList(),
        hero: this.squad.heroSnapshot(),
        saveWarning: saveCleared ? undefined : '저장 삭제 실패 · 저장소 권한을 확인하세요' });
      return;
    }
    this.saveCheckpoint();
    this.openSquadModal(`보상 +${result.minerals} ◆ · T1 무료 소환권 +1 · 다음 진입 시 HP 40% 회복`, true);
  }

  private advanceStage(): void {
    const fromEndlessChoice = this.progression.index >= 4 && this.progression.endlessChoice === 'continue';
    if (this.runEnded || !this.progression.beginTransition()) return;
    if (fromEndlessChoice) this.squad.roster.grantReward(0, 1, 'boss', 'endless-continue');
    this.clearEncounter();
    this.joystick.reset();
    this.squad.movement.clearModifiers();
    this.squad.health.heal(Math.round(this.squad.health.maxHp * STAGE_RECOVERY_RATIO));
    this.stats.stageIndex = this.progression.index;
    this.squad.roster.stageIndex = this.progression.index;
    this.gridManager = new RoomGridManager(this.progression.current);
    this.progression.finishTransition();
    this.enterRoom(this.gridManager.getCurrentRoom(), null);
    this.squad.roster.recordEconomy('stageStart');
    this.showStageBanner();
    this.saveCheckpoint();
    if (this.progression.index >= 5) endlessRecordManager.recordReached(this.progression.index);
  }

  private openEndlessChoice(): void {
    if (this.runEnded || this.rewardModalOpen || this.progression.endlessChoice !== 'pending') return;
    this.rewardModalOpen = true;
    this.joystick.reset(); this.squad.movement.stop(); this.input.enabled = false;
    this.scene.launch('EndlessChoiceScene', { stageNumber: this.progression.index + 1, canContinue: !!this.progression.next,
      onChoose: (choice: 'continue' | 'exit', mutation: MutationId) => {
        if (this.runEnded || !this.rewardModalOpen || !this.progression.selectEndless(choice, mutation)) return false;
        if (!this.saveCheckpoint()) { this.progression.endlessChoice = 'pending'; this.progression.nextMutation = 'NONE'; return false; }
        this.rewardModalOpen = false;
        if (choice === 'exit') this.finishExpedition();
        else this.openSquadModal('무한 원정 준비 · 책을 덮으면 소환권 +1 · 본체 HP 40% 회복', true);
        return true;
      },
      onTitle: () => {
        if (this.runEnded || this.backgroundPaused || this.progression.endlessChoice !== 'pending') return false;
        if (!this.saveCheckpoint()) return false;
        this.rewardModalOpen = false; this.returnToTitle(); return true;
      } });
    this.scene.pause();
  }

  private finishExpedition(): void {
    if (this.runEnded) return;
    if (this.progression.index >= 5) endlessRecordManager.recordReached(this.progression.index);
    legacyProfile.recordBosses(this.squad.hero.classId,this.stats.bossesDefeated);
    this.runEnded = true; const saveCleared = runSaveManager.clear();
    this.stats.bossDefeated = true; this.refreshHud();
    this.scene.start('GameOverScene', { victory: true, stats: this.stats, droneSummary: this.getDroneSummaryList(),
      hero: this.squad.heroSnapshot(), safeLimit: !this.progression.next,
      saveWarning: saveCleared ? undefined : '저장 삭제 실패 · 저장소 권한을 확인하세요' });
  }

  private majorSkillCooldown(archetype: DroneArchetype): number {
    return archetype === 'PHOENIX_LORD' ? UNIQUE_SKILLS.phoenix.cooldownMs
      : archetype === 'EARTH_DEITY' ? UNIQUE_SKILLS.deity.cooldownMs : 0;
  }

  public getEconomyReport() {
    return this.squad.roster.economy.report();
  }

  public startCombatMeasurement(): void {
    this.lastCombatReport = null;
    this.combatMeasurements = new CombatMeasurements();
    this.squad.setCombatMeasurements(this.combatMeasurements);
    this.enemies.damageObserver = this.combatMeasurements.enemyDamage;
    for (const child of this.enemies.getChildren()) (child as Enemy).health.damageObserver = this.enemies.damageObserver;
  }

  public getCombatReport() {
    if (this.combatMeasurements) return this.combatMeasurements.report();
    const report = this.lastCombatReport;
    return report ? { ...report, leader: { ...report.leader }, allies: { ...report.allies }, enemies: { ...report.enemies },
      healing: report.healing.map(row => ({ ...row })), revivals: { ...report.revivals },
      projectiles: { ...report.projectiles } } : null;
  }

  public stopCombatMeasurement(): void {
    this.lastCombatReport = this.combatMeasurements?.report() ?? this.lastCombatReport;
    this.combatMeasurements = null;
    this.squad.setCombatMeasurements(null);
    this.enemies.damageObserver = undefined;
    for (const child of this.enemies.getChildren()) (child as Enemy).health.damageObserver = undefined;
  }

  private saveCheckpoint(): boolean {
    const room = this.gridManager.getCurrentRoom();
    const stageStart = this.roomState === 'ENTERING' && !this.gridManager.grid.some(row => row.some(node => node?.cleared));
    if (this.runEnded || (!stageStart && (this.roomState !== 'CLEARED' || !room.cleared)) ||
        this.progression.state === 'STAGE_TRANSITION') return false;
    const phase = stageStart ? 'stage-start' : this.progression.state === 'STAGE_CLEARED' ? 'stage-cleared' : 'room-cleared';
    legacyProfile.recordBosses(this.squad.hero.classId,this.stats.bossesDefeated);
    codexManager.recordUnits(this.squad.roster.units.map(unit=>unit.archetype));
    const checkpoint: RoomRunCheckpoint = {
      version: 2, runId: this.runId, phase, currentRoomId: room.id,
      mode: this.progression.index >= 5 ? 'endless' : 'campaign', endlessChoice: this.progression.endlessChoice,
      mutation: this.progression.mutation, nextMutation: this.progression.nextMutation,
      savedAt: Date.now(), stats: { ...this.stats, mineralsCollected: this.squad.roster.minerals }, roster: this.squad.roster.snapshot(),
      hero: this.squad.heroSnapshot(),
      leaderHealth: { currentHp: this.squad.health.currentHp, maxHp: this.squad.health.maxHp },
      relicHealRemainingMs: this.squad.relicHealingRemaining(),
      unitHealth: this.squad.drones.map(drone => ({ id: drone.id, currentHp: drone.health.currentHp,
        reviveRemainingMs: this.revivalPause.remainingMs(drone, this.time.now),
        healRemainingMs: Math.min(SUPPORT_HEAL_INTERVAL_MS, Math.max(0, SUPPORT_HEAL_INTERVAL_MS - (this.time.now - drone.lastHealAt))),
        skillRemainingMs: this.majorSkillCooldown(drone.archetype) > 0
          ? Math.min(this.majorSkillCooldown(drone.archetype),
            Math.max(0, this.majorSkillCooldown(drone.archetype) - (this.time.now - drone.lastSkillAt))) : 0 })),
      grid: this.gridManager.grid
    };
    const saved = runSaveManager.save(checkpoint);
    this.saveStatusText.setText(saved ? `S${this.stats.stageIndex + 1} ${stageStart ? '시작' : '정비'} 자동 저장 · 중단 시 이 지점에서 재개`
      : '자동 저장 실패 · 이전 저장 유지 · 권한/용량 확인');
    this.saveStatusText.setColor(saved ? '#d9b969' : '#f87171');
    return saved;
  }

  private returnToTitle(): void {
    if (this.runEnded || this.rewardModalOpen || this.backgroundPaused) return;
    this.runEnded = true;
    this.joystick.reset();
    this.squad.movement.stop();
    this.clearEncounter();
    this.scene.start('MenuScene', { message: runSaveManager.load().status === 'ready'
      ? '이어하기는 마지막 자동 저장 지점에서 재개합니다.' : '저장된 지점이 없습니다. 새 모험을 시작할 수 있습니다.' });
  }

  private showStageBanner(): void {
    const stage = this.progression.current;
    const newEnemies = stage.newEnemyIds.map(id => ENEMY_SPECS[id].name).join(' · ');
    this.showBanner(`STAGE ${stage.index + 1} — ${stage.name}${newEnemies ? `\n새로운 적: ${newEnemies}` : ''}`);
  }

  private showBanner(text: string): void {
    const [title, ...detail] = text.split('\n');
    this.centerBannerText.setText(title).setY(detail.length ? -13 : 0).setFontSize(title.length > 24 ? 21 : 25);
    this.bannerSubtitle.setText(detail.join(' · '));
    this.tweens.killTweensOf(this.bannerContainer);
    this.bannerContainer.setAlpha(0);
    this.tweens.add({
      targets: this.bannerContainer, alpha: 0.98, duration: 140, hold: 850, yoyo: true
    });
  }

  private refreshHud(): void {
    this.stats.mineralsCollected = this.squad.roster.minerals;
    const room = this.gridManager.getCurrentRoom();
    const meta = ROOM_TYPE_META[room.type];

    this.hudRoomText.setText(
      `${this.progression.index >= 5 ? `S${this.progression.index + 1} ∞` : `S${this.progression.index + 1}/${STAGES.length}`} ${this.progression.current.name} · ${room.sideSupply ? '보급고' : meta.badgeText}${this.progression.mutation !== 'NONE' ? ` · ${MUTATIONS[this.progression.mutation].name}` : ''}`
    );

    if (this.roomState === 'LOCKED_WAVES') {
      const aliveCount = this.enemies.countActive(true);
      this.hudWaveText.setText(
        `WAVE ${this.currentWave}/${this.totalWavesInRoom}  ·  적 ${aliveCount}기  ·  전투 중`
      );
      this.hudWaveText.setColor('#f87171');
    } else {
      this.hudWaveText.setText(this.roomState === 'ENTERING' ? '회랑 진입 중 · 전투를 준비하세요' : '구역 확보 · 열린 문으로 이동하세요');
      this.hudWaveText.setColor('#b5c68a');
    }

    this.updateHudVitals();
    this.hudMineralText.setText(`${this.stats.mineralsCollected}`).setFontSize(this.stats.mineralsCollected >= 100000 ? 19 : 24);
    const synergy=resolveSynergies(this.squad.roster.units);
    this.hudSquadText.setText(
      `출전 ${this.squad.drones.length}/${SQUAD_LIMITS.deployed} · 보유 ${this.squad.roster.units.length}/${SQUAD_LIMITS.owned} · 시너지 ${SYNERGY_IDS.filter(id=>synergy.counts[id]>=2).length}/3`
    );

    this.drawMinimap();
  }

  private updateHudVitals(): void {
    const hero = this.squad.hero;
    if (hero.level !== this.lastHeroLevel || hero.xp !== this.lastHeroXp) {
      this.lastHeroLevel = hero.level; this.lastHeroXp = hero.xp;
      const next = heroXpToNext(hero.level), ratio = next > 0 ? hero.xp / next : 1;
      this.hudHeroName.setText(`${HERO_CLASSES[hero.classId].name} · Lv.${hero.level}`);
      this.hudHeroXpText.setText(next > 0 ? `XP ${hero.xp}/${next}` : 'XP MAX');
      this.hudHeroXpBar.clear().fillStyle(0x182032).fillRect(24, 110, 68, 4)
        .fillStyle(0xb78cff).fillRect(24, 110, Math.round(68 * ratio), 4);
    }
    const hp = this.squad.health.currentHp, maxHp = this.squad.health.maxHp;
    if (hp !== this.lastHudHp || maxHp !== this.lastHudMaxHp) {
      this.lastHudHp = hp; this.lastHudMaxHp = maxHp;
      const width = Math.round(230 * Phaser.Math.Clamp(this.squad.health.ratio, 0, 1));
      this.hpBarGraphics.clear();
      this.hpBarGraphics.fillStyle(0xb79a62).fillRect(111, 36, 240, 30);
      this.hpBarGraphics.fillStyle(0x150f1b).fillRect(114, 39, 234, 24);
      if (width > 0) {
        this.hpBarGraphics.fillStyle(hp / maxHp > 0.25 ? FANTASY.hp : 0xf17b53).fillRect(116, 41, width, 20);
        this.hpBarGraphics.fillStyle(0xffb09c, 0.45).fillRect(116, 41, width, 4);
      }
      this.hudHpText.setText(`HP ${hp} / ${maxHp}`);
    }
    const alive = this.enemies.countActive(true);
    if (alive !== this.lastAliveCount && this.roomState === 'LOCKED_WAVES') {
      this.hudWaveText.setText(`WAVE ${this.currentWave}/${this.totalWavesInRoom}  ·  적 ${alive}기  ·  전투 중`);
    }
    this.lastAliveCount = alive;
    this.hudUnitBars.clear();
    let living=0;
    for (let i = 0; i < this.hudUnitPortraits.length; i++) {
      const image = this.hudUnitPortraits[i], drone = this.squad.drones[i];
      image.setVisible(!!drone);
      const text = this.hudUnitStatusTexts[i], icon = this.hudUnitSkillIcons[i];
      text.setVisible(false); icon.setVisible(false);
      if (!drone) { this.hudUnitLastKinds[i] = ''; continue; }
      if(!drone.health.isDead)living++;
      const status = this.hudUnitStatuses[i];
      readCombatHudStatus(drone, this.time.now, this.roomState === 'LOCKED_WAVES', status);
      if (image.name !== drone.archetype) { image.setTexture(unitPortrait(drone.archetype)); image.name = drone.archetype; }
      image.setAlpha(drone.health.isDead ? 0.3 : 1);
      const x = 32+i*86;
      this.hudUnitBars.fillStyle(0x100f1b).fillRect(x,1164,62,6);
      this.hudUnitBars.fillStyle(0xdc727c).fillRect(x,1164,Math.round(62*drone.health.ratio),6);
      if (status.skillName && status.kind !== 'revive') {
        icon.setTexture(drone.archetype === 'PHOENIX_LORD' ? 'skill_glyph_feather' : 'skill_shield')
          .setTint(drone.archetype === 'PHOENIX_LORD' ? 0xffb55a : 0x9ceeff).setVisible(true);
        if (status.kind !== 'waiting') {
          this.hudUnitBars.fillStyle(0x080f18).fillRect(x,1173,62,4);
          this.hudUnitBars.fillStyle(status.kind === 'ready' ? 0xb2f06a : 0xffd65c)
            .fillRect(x,1173,Math.round(62*status.progress),4);
        }
      }
      text.setVisible(status.kind !== 'none');
      if (status.kind !== this.hudUnitLastKinds[i] || status.seconds !== this.hudUnitLastSeconds[i]) {
        text.setText(status.kind === 'revive' ? status.seconds > 0 ? `${status.seconds}초` : '곧'
          : status.kind === 'cooldown' ? `${status.seconds}초` : status.kind === 'ready' ? '준비' : '대기');
        text.setColor(status.kind === 'revive' ? '#ffaba0' : status.kind === 'ready' ? '#b2f06a' : '#ffe6a0');
        this.hudUnitLastKinds[i] = status.kind; this.hudUnitLastSeconds[i] = status.seconds;
      }
      if (status.kind === 'revive') this.hudUnitBars.lineStyle(2,0xa35c74).strokeRoundedRect(x-8,1108,78,64,5);
    }
    const livingLabel=`생존 ${living}/${this.squad.drones.length}`;
    if(this.hudTeamCount.text!==livingLabel)this.hudTeamCount.setText(livingLabel)
      .setColor(living<this.squad.drones.length?'#f1a6b7':'#c2b4d1');
    this.updateBossHud();
    this.updateStatusDetail();
  }

  private updateStatusDetail(): void {
    const index = this.squad.drones.findIndex(drone => drone.id === this.selectedHudUnitId);
    this.hudStatusDetail.setVisible(index >= 0);
    if (index < 0) { this.selectedHudUnitId = null; return; }
    if (this.time.now < this.nextStatusDetailAt) return;
    this.nextStatusDetailAt = this.time.now + 100;
    for(let i=0;i<this.hudStatusRows.length;i++){
      const row=this.hudStatusRows[i],drone=this.squad.drones[i];
      row.portrait.setVisible(!!drone);row.title.setVisible(!!drone);row.state.setVisible(!!drone);
      if(!drone)continue;
      const status=this.hudUnitStatuses[i];
      row.portrait.setTexture(unitPortrait(drone.archetype)).setAlpha(drone.health.isDead?0.35:1);
      row.title.setText(`${drone.spec.name} ★${drone.star} · HP ${drone.health.currentHp}/${drone.health.maxHp}`);
      let line=status.kind==='revive'?`전투 불능 · 자동 부활 ${status.seconds}초`
        :status.kind==='cooldown'?`${status.skillName} · 재사용 대기 ${status.seconds}초`
        :status.kind==='ready'?`${status.skillName} · 준비 완료`
        :status.kind==='waiting'?`${status.skillName} · 비전투 대기`:UNIT_SKILL_DESCRIPTIONS[drone.archetype];
      if(status.shieldHp>0)line+=` · 보호막 ${status.shieldHp} (${status.shieldSeconds}초)`;
      row.state.setText(line).setColor(status.kind==='revive'?'#ffaba0':'#c9bbd7');
    }
  }

  private updateBossHud():void {
    let boss:Enemy|null=null;
    for(const enemy of this.enemies.getChildren() as Enemy[]){
      if(enemy.active&&enemy.spec.archetype==='BOSS_CORE'&&!enemy.health.isDead){boss=enemy;break;}
    }
    this.bossHud.setVisible(!!boss);
    if(!boss){this.bossHudLastHp=-1;return;}
    if(this.bossHudLastHp===boss.health.currentHp)return;
    this.bossHudLastHp=boss.health.currentHp;
    const stage=this.progression.current,ratio=boss.health.ratio;
    const phase=Math.min(stage.bossPhases,1+Math.floor((1-ratio)*stage.bossPhases));
    this.bossHudLabel.setText(`${stage.bossName} · PHASE ${phase}/${stage.bossPhases} · HP ${Math.ceil(ratio*100)}%`);
    this.bossHudBar.clear().fillStyle(0x160f20).fillRect(10,29,488,6)
      .fillStyle(0xdb6675).fillRect(10,29,Math.round(488*ratio),6);
  }

  private drawMinimap(): void {
    this.minimapGraphics.clear();
    const cellSize = 17;
    const gap = 3;
    const startX = Math.round(631 - (this.progression.current.gridWidth * 20 - 3) / 2);
    const startY = Math.round(89 - (this.progression.current.gridHeight * 20 - 3) / 2);

    for (let y = 0; y < this.progression.current.gridHeight; y++) {
      for (let x = 0; x < this.progression.current.gridWidth; x++) {
        const node = this.gridManager.grid[y][x];
        if (!node) continue;
        const rx = startX + x * (cellSize + gap);
        const ry = startY + y * (cellSize + gap);
        const meta = ROOM_TYPE_META[node.type];

        const isCurrent =
          x === this.gridManager.currentX && y === this.gridManager.currentY;

        if (node.doors.right) this.minimapGraphics.fillStyle(0x8496a2, 0.6).fillRect(rx + cellSize, ry + 7, gap, 3);
        if (node.doors.bottom) this.minimapGraphics.fillStyle(0x8496a2, 0.6).fillRect(rx + 7, ry + cellSize, 3, gap);
        this.minimapGraphics.fillStyle(
          meta.color,
          node.visited || node.type === 'BOSS' ? 0.95 : 0.55
        );
        this.minimapGraphics.fillRect(rx, ry, cellSize, cellSize);

        if (isCurrent) {
          this.minimapGraphics.lineStyle(2, 0xc5f5ff, 1).strokeRect(rx - 2, ry - 2, cellSize + 4, cellSize + 4);
          this.minimapGraphics.fillStyle(0xf5ffff).fillRect(rx + 6, ry + 6, 5, 5);
        } else if (node.cleared) {
          this.minimapGraphics.lineStyle(1, 0x9ebd7c, 0.9);
          this.minimapGraphics.strokeRect(rx, ry, cellSize, cellSize);
        }
        if (!isCurrent && node.type === 'BOSS') this.minimapGraphics.fillStyle(0xffd29a).fillRect(rx + 5, ry + 4, 7, 6).fillRect(rx + 7, ry + 10, 3, 3);
        if (!isCurrent && node.type === 'RECOVERY') this.minimapGraphics.fillStyle(0xc8f5ce).fillRect(rx + 7, ry + 4, 3, 9).fillRect(rx + 4, ry + 7, 9, 3);
        if (!isCurrent && node.type === 'EVENT') this.minimapGraphics.lineStyle(1, 0xe5ccff)
          .strokeCircle(rx + 8, ry + 8, 5).lineBetween(rx + 8, ry + 2, rx + 8, ry + 14);
        if (!isCurrent && node.sideSupply) this.minimapGraphics.lineStyle(1, 0xffe6a4)
          .strokeRect(rx + 3, ry + 4, 11, 9).lineBetween(rx + 3, ry + 7, rx + 14, ry + 7);
      }
    }
  }

  public override update(time: number, delta: number): void {
    if (this.rewardModalOpen || this.runEnded || this.backgroundPaused || this.progression.state !== 'PLAYING') return;
    this.revivalPause.applyResume(this.squad.drones, time);
    this.combatMeasurements?.advance(delta, this.roomState === 'LOCKED_WAVES');
    this.particles.beginFrame();

    if (this.hudFpsText.visible) this.hudFpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);

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
      this.stats.moveSpeedBonus,
      this.roomState === 'LOCKED_WAVES'
    );
    this.activeSkillButton.update(this.roomState === 'LOCKED_WAVES' && !this.squad.health.isDead,
      this.squad.activeRemaining(), this.squad.activeDuration());

    // 적군 추적 타겟 좌표를 플레이어 리더 위치로 동기화
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const target = this.squad.findEnemyTarget(enemy.x, enemy.y);
      enemy.targetUnitId = target?.id ?? null;
      enemy.setTargetPosition(target?.x ?? this.squad.leader.x, target?.y ?? this.squad.leader.y);
    }
    this.hazards.update(delta);
    if (this.runEnded) return;

    // 적군 체력바 오버레이 렌더링
    this.drawUnitOverlays();
    this.updateHudVitals();

    const room = this.gridManager.getCurrentRoom();

    // 룸 상태 머신 (ENTERING -> LOCKED_WAVES -> CLEARED -> TRANSITION)
    if (this.roomState === 'ENTERING') {
      this.enteringTimerMs -= delta;
      if (this.enteringTimerMs <= 0) {
        this.startRoomLogic(room);
      }
    } else if (this.roomState === 'LOCKED_WAVES') {
      this.processSpawns(delta);
      this.updateBossPatterns(delta);
      const activeEnemies = this.enemies.countActive(true);

      if (this.currentWave < this.totalWavesInRoom) {
        if (activeEnemies === 0 && this.pendingSpawns.length === 0) {
          this.nextWaveTimerMs -= delta;
          if (this.nextWaveTimerMs <= 0) {
            this.spawnNextWave(room);
            this.nextWaveTimerMs = 1100;
          }
        }
      } else if (activeEnemies === 0 && this.pendingSpawns.length === 0 && !room.cleared) {
        this.finishRoom(room);
      }
    } else if (this.roomState === 'CLEARED' && this.doorCooldownMs <= 0) {
      this.checkDoorTransition();
    }
  }

  private drawUnitOverlays(): void {
    this.unitOverlayGraphics.clear();
    const ground = this.skillGroundGraphics;
    ground.clear();
    const room = this.gridManager.getCurrentRoom();
    if (room.type === 'EVENT') {
      const x = ARENA_BOUNDS.centerX, y = ARENA_BOUNDS.centerY;
      ground.lineStyle(2, room.cleared ? 0x64717c : 0xb78cff, 0.4)
        .strokeCircle(x, y, 62).strokeCircle(x, y, 48)
        .lineBetween(x - 42, y - 42, x + 42, y + 42).lineBetween(x - 42, y + 42, x + 42, y - 42);
    }
    if (this.squad.health.shieldHp > 0)
      ground.lineStyle(2, 0x9ceeff, 0.75).strokeCircle(this.squad.leader.x, this.squad.leader.y, 30);
    for (const drone of this.squad.drones) {
      if (drone.health.isDead) continue;
      if (drone.health.shieldHp > 0) ground.lineStyle(2, 0x9ceeff, 0.75).strokeCircle(drone.x, drone.y, 29);
      if (drone.attackBuffMultiplier > 1) {
        this.unitOverlayGraphics.fillStyle(0xffb55a).fillTriangle(drone.x + 20, drone.y - 24, drone.x + 26, drone.y - 15, drone.x + 14, drone.y - 15);
      }
      if (this.roomState === 'LOCKED_WAVES' && drone.archetype === 'LAVA_GOLEM') {
        ground.lineStyle(2, 0xff8a2a, 0.35).strokeCircle(drone.x, drone.y, UNIQUE_SKILLS.lava.radius);
      }
      this.unitOverlayGraphics.fillStyle(0x17252b).fillRect(drone.x - 18, drone.y - 30, 36, 4);
      this.unitOverlayGraphics.fillStyle(FANTASY.ally).fillRect(drone.x - 18, drone.y - 30, 36 * drone.health.ratio, 4);
    }

    // 적군 머리 위 체력바 (피격된 적 또는 정예/보스 상시 표시)
    const enemyChildren = this.enemies.getChildren();
    for (let i = 0; i < enemyChildren.length; i++) {
      const enemy = enemyChildren[i] as Enemy;
      if (!enemy.active) continue;
      if (enemy.burn.damage > 0 && this.time.now <= enemy.burn.until) {
        this.unitOverlayGraphics.fillStyle(0xff8a2a).fillRect(enemy.x - 4, enemy.y - enemy.spec.radius - 27, 8, 8);
        this.unitOverlayGraphics.fillStyle(0xffd05a).fillRect(enemy.x - 2, enemy.y - enemy.spec.radius - 30, 4, 9);
      }
      if (enemy.poison.damage > 0 && this.time.now <= enemy.poison.until) {
        this.unitOverlayGraphics.fillStyle(0x79d842)
          .fillCircle(enemy.x - 15, enemy.y - enemy.spec.radius - 24, 4)
          .fillRect(enemy.x - 18, enemy.y - enemy.spec.radius - 22, 6, 5);
      }
      if (enemy.movement.slowFactor < 1 && this.time.now <= enemy.movement.slowUntil) {
        this.unitOverlayGraphics.lineStyle(2, 0x67d8ff)
          .lineBetween(enemy.x + 11, enemy.y - enemy.spec.radius - 22, enemy.x + 21, enemy.y - enemy.spec.radius - 22)
          .lineBetween(enemy.x + 16, enemy.y - enemy.spec.radius - 27, enemy.x + 16, enemy.y - enemy.spec.radius - 17);
      }

      const isSpecial =
        enemy.spec.archetype === 'BOSS_CORE' || enemy.spec.archetype === 'ELITE_BRUTE';
      if (!isSpecial && enemy.health.ratio >= 0.999) continue;

      const barW = enemy.spec.archetype === 'BOSS_CORE' ? 76 : isSpecial ? 48 : 32;
      const barH = enemy.spec.archetype === 'BOSS_CORE' ? 7 : 5;
      const bx = enemy.x - barW * 0.5;
      const by = enemy.y - enemy.spec.radius - 14;

      this.unitOverlayGraphics.fillStyle(0x0f172a, 0.85);
      this.unitOverlayGraphics.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

      this.unitOverlayGraphics.fillStyle(FANTASY.danger, 1);
      this.unitOverlayGraphics.fillRect(
        bx,
        by,
        Math.max(2, barW * Phaser.Math.Clamp(enemy.health.ratio, 0, 1)),
        barH
      );
    }
  }

  private checkDoorTransition(): void {
    if (this.progression.state !== 'PLAYING' || this.runEnded || this.rewardModalOpen) return;
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
