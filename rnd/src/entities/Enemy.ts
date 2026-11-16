import Phaser from 'phaser';
import { enemyTexture, enemyAnimation } from '../ui/pixelCharacters';
import { ARENA_BOUNDS, ENEMY_SPECS } from '../config/gameData';
import { HealthComponent } from '../components/HealthComponent';
import { MovementComponent } from '../components/MovementComponent';
import { EnemyArchetype, EnemySpec } from '../types/game';
import { ENEMY_POOL_SIZE } from '../config/stageData';
import { BurnComponent } from '../components/BurnComponent';
import { PoisonComponent } from '../components/PoisonComponent';
import type { DamageObserver } from '../systems/CombatMeasurements';
import { BOSS_PROFILES } from '../config/bossData';
import type { BossId } from '../types/game';
import { BOSS_ATLAS,BOSS_VISUALS,bossPoseFrame } from '../config/bossVisualData';
import type { BossPose } from '../config/bossVisualData';
import {BOSS_MOTION_ATLAS,BOSS_MOTION_ORIGIN_Y,BossMotion,bossMotionFrame,bossMotionAtlas} from '../ui/BossMotion';
import {MONSTER_ATLAS} from '../config/monsterData';
import type {RegionalMonster,MonsterSpecial} from '../config/monsterData';

export type EnemyAttackCallback = (enemy: Enemy, damage: number) => void;
export type EnemySpecialKind = MonsterSpecial|'EXPLODE';
export type EnemySpecialCallback = (enemy: Enemy, kind: EnemySpecialKind) => void;
export type BurnTickCallback = (enemy: Enemy, damage: number, sourceUnitId?: string) => void;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private static nextLifeId = 0;
  public lifeId = 0;
  public rewardsClaimed = false;
  public spec: EnemySpec = ENEMY_SPECS.SWARMER;
  public monster:RegionalMonster|null=null;
  private regionalArt=false;
  public health!: HealthComponent;
  public movement!: MovementComponent;
  public readonly burn = new BurnComponent();
  public readonly poison = new PoisonComponent();
  public onBurnTick?: BurnTickCallback;
  public onPoisonTick?: BurnTickCallback;

  private targetX = ARENA_BOUNDS.centerX;
  private targetY = ARENA_BOUNDS.centerY;
  private flashUntil = 0;
  private baseScale = 1;
  private lastAttackAt = 0;
  private attackAnimUntil = 0;
  private dashUntil = 0;
  private nextDashAt = 0;
  private onAttackPlayer?: EnemyAttackCallback;
  public onSpecial?: EnemySpecialCallback;
  public targetUnitId: string | null = null;
  private nextSpecialAt = 0;
  private chargeAngle = 0;
  public bossId: BossId | null = null;
  private chargeWindupMs = 0;
  private bossChargeMs = 0;
  public bossVisual?: Phaser.GameObjects.Image;
  private bossCastVisualMs = 0;
  private bossAttackVisualMs = 0;
  private bossVisualFailed = false;
  private readonly bossMotion=new BossMotion();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, enemyTexture('SWARMER'), 0);
    this.setDepth(20);
    this.health = new HealthComponent(this.spec.maxHp);
  }

  public spawn(
    archetype: EnemyArchetype,
    x: number,
    y: number,
    hpMultiplier = 1,
    onAttackPlayer?: EnemyAttackCallback,
    damageMultiplier = 1,
    speedMultiplier = 1
  ): void {
    this.lifeId = ++Enemy.nextLifeId;
    this.rewardsClaimed = false;
    this.burn.clear();
    this.poison.clear();
    this.onSpecial = undefined;
    this.monster=null;this.regionalArt=false;
    this.bossId = null; this.chargeWindupMs = this.bossChargeMs = 0;
    this.bossCastVisualMs=this.bossAttackVisualMs=0;
    this.bossVisualFailed=false;
    this.bossMotion.reset(x,y);
    this.bossVisual?.setVisible(false);
    const base = ENEMY_SPECS[archetype];
    this.spec = { ...base, speed: base.speed * speedMultiplier, contactDamage: Math.round(base.contactDamage * damageMultiplier) };
    this.onAttackPlayer = onAttackPlayer;
    this.enableBody(true, x, y, true, true);
    this.setPosition(x, y);
    this.setDepth(20);
    this.setAlpha(1);
    this.setVisible(true);

    const textureKey = enemyTexture(archetype);
    const animKey = enemyAnimation(archetype);

    this.setTexture(textureKey, 0);
    this.clearTint();
    if (this.scene.anims.exists(animKey)) {
      this.play(animKey, true);
    }

    const baseSize = archetype === 'BOSS_CORE' ? 104 : archetype === 'ELITE_BRUTE' ? 72 : 52;
    const desiredDiameter = this.spec.radius * 2.3;
    this.baseScale = desiredDiameter / baseSize;
    this.setScale(this.baseScale);

    const scaledHp = Math.round(this.spec.maxHp * hpMultiplier);
    this.health.reset(scaledHp);

    const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
    arcadeBody.setEnable(true);
    const bodyRadius = baseSize * 0.36;
    const bodyOffset = (baseSize - bodyRadius * 2) * 0.5;
    arcadeBody.setCircle(bodyRadius, bodyOffset, bodyOffset);
    arcadeBody.setBounce(0.35, 0.35);
    arcadeBody.setCollideWorldBounds(true);

    if (!this.movement) {
      this.movement = new MovementComponent(arcadeBody, this.spec.speed);
    } else {
      this.movement.baseSpeed = this.spec.speed;
      this.movement.clearModifiers();
    }

    this.flashUntil = 0;
    this.lastAttackAt = 0;
    this.attackAnimUntil = 0;
    this.dashUntil = 0;
    this.nextDashAt = this.scene.time.now + Phaser.Math.Between(1800, 3200);
    this.nextSpecialAt = this.scene.time.now + 1600;
    this.targetUnitId = null;
    this.chargeAngle = 0;
    arcadeBody.setVelocity(0, 0);
  }

  public applyRegionalMonster(monster:RegionalMonster):void {
    if(this.spec.archetype==='BOSS_CORE'||this.spec.archetype==='ELITE_BRUTE')return;
    this.monster=monster;
    const suffix=this.spec.archetype==='TANK'?' · 중갑':this.spec.archetype==='CHASER'?' · 돌진':this.spec.archetype==='EXPLODER'?' · 자폭':'';
    this.spec={...this.spec,name:monster.name+suffix};
    this.regionalArt=!!this.scene.textures?.exists(MONSTER_ATLAS);
    if(this.regionalArt){this.anims.stop();this.setTexture(MONSTER_ATLAS,monster.id+'_0');}
  }

  public setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  public applyBossProfile(id: BossId): void {
    this.bossId=id;this.setTint(BOSS_PROFILES[id].color);
    // The visual image never owns physics. Keep the original sprite/body/scale contract intact.
    if(this.scene.textures?.exists(BOSS_ATLAS)){
      try{
        if(!this.bossVisual)this.bossVisual=this.scene.add.image(this.x,this.y,BOSS_ATLAS,bossPoseFrame(id,'idle'))
          .setOrigin(.5,2/3).setDepth(20.5).setName('boss-visual');
        this.setAlpha(0);this.updateBossVisual(0,this.scene.time.now);
      }catch{this.bossVisualFailed=true;this.setAlpha(1);this.bossVisual?.setVisible(false);}
    }
  }
  public windUpBossCast(warningMs:number):void {this.bossCastVisualMs=Math.max(this.bossCastVisualMs,warningMs);this.bossMotion.cast(warningMs);this.updateBossVisual(0,this.scene.time.now);}
  public showBossImpact():void {this.bossAttackVisualMs=180;this.bossMotion.impact(this.bossId==='desert_emperor'&&this.scene.textures.exists(bossMotionAtlas(this.bossId)));this.updateBossVisual(0,this.scene.time.now);}
  public get isBossCharging():boolean {return this.bossChargeMs>0;}
  public windUpCharge(warningMs: number): void { this.chargeWindupMs = warningMs; this.movement.stop();this.windUpBossCast(warningMs); }

  private updateBossVisual(delta:number,time:number):void {
    this.bossCastVisualMs=Math.max(0,this.bossCastVisualMs-delta);this.bossAttackVisualMs=Math.max(0,this.bossAttackVisualMs-delta);
    if(!this.bossVisual||!this.bossId||this.bossVisualFailed)return;
    try{
    // The king's third pose fires a spell; use idle plus the real dash/trail for his charge.
    const pose:BossPose=this.bossChargeMs>0?(this.bossId==='twilight_king'?'idle':'charge')
      :this.bossAttackVisualMs>0?'charge':this.chargeWindupMs>0||this.bossCastVisualMs>0?'cast':'idle';
    const expanded=this.bossId==='desert_emperor'&&this.scene.textures.exists(bossMotionAtlas(this.bossId));
    const animated=expanded||this.scene.textures.exists(BOSS_MOTION_ATLAS);
    this.bossMotion.advance(this.bossId,delta,this.x,this.y,this.bossChargeMs>0,Math.cos(this.chargeAngle)<0,expanded);
    const texture=expanded?bossMotionAtlas(this.bossId):animated?BOSS_MOTION_ATLAS:BOSS_ATLAS;
    const frame=animated?bossMotionFrame(this.bossId,this.bossMotion.frameIndex):bossPoseFrame(this.bossId,pose);
    if(this.bossVisual.texture.key!==texture||this.bossVisual.frame.name!==frame)this.bossVisual.setTexture(texture,frame);
    this.bossVisual.setPosition(this.x,this.y).setVisible(this.active).setAlpha(1)
      .setOrigin(.5,animated?BOSS_MOTION_ORIGIN_Y:2/3)
      .setDisplaySize(BOSS_VISUALS[this.bossId].displaySize,BOSS_VISUALS[this.bossId].displaySize)
      .setFlipX(animated?this.bossMotion.facingLeft:this.bossChargeMs>0?Math.cos(this.chargeAngle)<0:this.flipX);
    if(!animated&&this.attackAnimUntil>time)this.bossVisual.setScale(this.bossVisual.scaleX*1.1,this.bossVisual.scaleY*1.1);
    if(this.flashUntil>time)this.bossVisual.setTintFill(0xffffff);
    else if(this.movement.slowFactor<1)this.bossVisual.setTint(0xc8eeff);
    else this.bossVisual.clearTint();
    }catch{this.bossVisualFailed=true;this.setAlpha(1);this.bossVisual.setVisible(false);}
  }

  public beginCharge(x: number, y: number, _time: number): void {
    this.chargeAngle = Math.atan2(y - this.y, x - this.x);
    this.chargeWindupMs = 0; this.bossChargeMs = 600;
    this.updateBossVisual(0,this.scene.time.now);
  }

  public receiveDamage(
    amount: number,
    time: number,
    slowFactor = 1,
    slowDurationMs = 0
  ): boolean {
    if (!this.active) return false;

    if (slowFactor < 1 && slowDurationMs > 0 && this.movement) {
      this.movement.applySlow(slowFactor, slowDurationMs, time);
    }

    this.health.takeDamage(amount, time, 0);
    this.setTintFill(0xffffff);
    this.bossVisual?.setTintFill(0xffffff);
    this.flashUntil = time + 65;

    if (this.health.isDead) {
      this.deactivate();
      return true;
    }
    return false;
  }

  public deactivate(): void {
    this.burn.clear();
    this.poison.clear();
    if (this.movement) {
      this.movement.stop();
    }
    this.clearTint();
    this.disableBody(true, true);
    this.bossVisual?.setVisible(false);
  }

  public override update(time: number, delta: number): void {
    if (!this.active || !this.movement) return;
    while (this.onBurnTick && this.burn.consumeTick(time)) {
      this.onBurnTick(this, this.burn.damage, this.burn.sourceUnitId);
      if (!this.active) return;
    }
    while (this.onPoisonTick && this.poison.consumeTick(time)) {
      this.onPoisonTick(this, this.poison.damage, this.poison.sourceUnitId);
      if (!this.active) return;
    }

    // 피격 점멸 및 슬로우 색상 복원
    if (this.flashUntil > 0 && time >= this.flashUntil) {
      this.flashUntil = 0;
      if (this.movement.slowFactor < 1.0) {
        this.setTint(0x67e8f9);
      } else {
        if (this.bossId) this.setTint(BOSS_PROFILES[this.bossId].color); else this.clearTint();
      }
    } else if (this.flashUntil === 0) {
      if (this.movement.slowFactor < 1.0) {
        this.setTint(0x67e8f9);
      } else {
        if (this.bossId) this.setTint(BOSS_PROFILES[this.bossId].color); else this.clearTint();
      }
    }

    // 공격 모션 스케일 복원
    if (this.attackAnimUntil > 0) {
      if (time < this.attackAnimUntil) {
        this.setScale(this.baseScale * 1.28);
      } else {
        this.attackAnimUntil = 0;
        this.setScale(this.baseScale);
      }
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // 러셔/정예/보스 돌진 가속 패턴
    const canDash =
      this.spec.archetype === 'CHASER' ||
      this.spec.archetype === 'ELITE_BRUTE';
    if (canDash && time >= this.nextDashAt && dist < 340) {
      this.dashUntil = time + 380;
      this.nextDashAt = time + Phaser.Math.Between(2400, 3800);
    }

    const chargingBoss = this.spec.archetype === 'BOSS_CORE' && this.bossChargeMs > 0;
    const speedMultiplier = (this.spec.archetype === 'BOSS_CORE' ? chargingBoss : time < this.dashUntil) ? 1.75 : 1.0;
    this.bossChargeMs = Math.max(0,this.bossChargeMs-delta);
    this.movement.baseSpeed = this.spec.speed * speedMultiplier;
    const ranged = this.spec.archetype === 'SPORE_SHOOTER' || this.spec.archetype === 'SUMMONER';
    if (this.chargeWindupMs > 0 || (ranged && dist < 240)) this.movement.stop();
    else this.movement.moveAlongAngle(chargingBoss ? this.chargeAngle : angle, time);
    this.chargeWindupMs = Math.max(0,this.chargeWindupMs-delta);
    this.movement.update(time, delta);
    this.setFlipX(dx < 0);

    if (time >= this.nextSpecialAt && this.onSpecial) {
      if(this.monster?.skill){
        const skill=this.monster.skill;
        if(dist<skill.range){this.nextSpecialAt=time+skill.cooldownMs;this.attackAnimUntil=time+180;this.onSpecial(this,skill.kind);}
      }else if (this.spec.archetype === 'SPORE_SHOOTER' && dist < 450) {
        this.nextSpecialAt = time + 2200;
        this.onSpecial(this, 'SHOT');
      } else if (this.spec.archetype === 'EXPLODER' && dist < 140) {
        this.nextSpecialAt = Number.POSITIVE_INFINITY;
        this.onSpecial(this, 'EXPLODE');
      } else if (this.spec.archetype === 'SUMMONER') {
        this.nextSpecialAt = time + 6000;
        this.onSpecial(this, 'SUMMON');
      }
    }

    // 근접 공격 사거리 진입 시 능동 공격 판정 및 물어뜯기 모션
    const attackRange = this.spec.radius + 28;
    if (dist <= attackRange && time - this.lastAttackAt >= 680) {
      this.lastAttackAt = time;
      this.attackAnimUntil = time + 150;
      if (this.onAttackPlayer) {
        this.onAttackPlayer(this, this.spec.contactDamage);
      }
    }
    if(this.regionalArt&&this.monster){const frame=this.monster.id+'_'+Math.floor(time/160)%4;if(this.frame.name!==frame)this.setFrame(frame);}
    this.updateBossVisual(delta,time);
  }

  public override destroy(fromScene?:boolean):void {
    this.bossVisual?.destroy();this.bossVisual=undefined;super.destroy(fromScene);
  }
}

export class EnemyGroup extends Phaser.Physics.Arcade.Group {
  public onAttackPlayer?: EnemyAttackCallback;
  public damageObserver?: DamageObserver;

  constructor(scene: Phaser.Scene, onAttackPlayer?: EnemyAttackCallback, private readonly onBurnTick?: BurnTickCallback,
    private readonly onPoisonTick?: BurnTickCallback) {
    super(scene.physics.world, scene, {
      classType: Enemy,
      maxSize: ENEMY_POOL_SIZE,
      runChildUpdate: true
    });
    this.onAttackPlayer = onAttackPlayer;
    scene.sys.updateList.add(this as unknown as Phaser.GameObjects.GameObject);
  }

  public spawnEnemy(
    archetype: EnemyArchetype,
    x: number,
    y: number,
    hpMultiplier = 1,
    damageMultiplier = 1,
    speedMultiplier = 1
  ): Enemy | null {
    const enemy = this.get(x, y, enemyTexture('SWARMER')) as Enemy | null;
    if (!enemy) return null;
    enemy.spawn(archetype, x, y, hpMultiplier, this.onAttackPlayer, damageMultiplier, speedMultiplier);
    enemy.health.damageObserver = this.damageObserver;
    enemy.onBurnTick = this.onBurnTick;
    enemy.onPoisonTick = this.onPoisonTick;
    return enemy;
  }

  public updateTargetForAll(x: number, y: number): void {
    const children = this.getChildren();
    for (let i = 0; i < children.length; i++) {
      const enemy = children[i] as Enemy;
      if (enemy.active) {
        enemy.setTargetPosition(x, y);
      }
    }
  }
}
