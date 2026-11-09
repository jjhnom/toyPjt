import Phaser from 'phaser';
import { DESIGN_TOKENS, FANTASY, paintButton } from './fantasyTheme';
import { countdownSeconds } from './combatStatus';

/** Release-to-cast input; each touch owns its arm and cancellation never casts. */
export class ActiveSkillButton {
  private readonly container: Phaser.GameObjects.Container;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private pointerId: number | null = null;
  private enabled = false;
  private remaining = 0;
  private duration = 18000;
  private lastTick = -1;
  private readonly releasedOutside = (pointer: Phaser.Input.Pointer) => { if (this.pointerId === pointer.id) this.cancel(); };
  private readonly cancelled = () => { this.cancel(); this.onInputCancelled(); };

  constructor(private readonly scene: Phaser.Scene, onCast: () => void, private readonly onInputCancelled: () => void,
    private readonly ability={name:'치유 파동',label:'생존 +10'}) {
    this.container = scene.add.container(520,1230).setDepth(65).setName('active-skill');
    this.graphics = scene.add.graphics();
    this.label = scene.add.text(0,-3,'',{fontFamily:FANTASY.font,fontSize:'19px',color:FANTASY.cream,
      resolution: 2, align: 'center', fontStyle: 'bold', lineSpacing: 2 }).setOrigin(0.5).setName('active-skill-label');
    const hit = scene.add.rectangle(0,0,112,100,0,0).setInteractive();
    this.container.add([this.graphics, hit, this.label]);
    hit.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.enabled && this.remaining <= 0 && this.pointerId === null) { this.pointerId = pointer.id; this.draw(); }
    });
    hit.on('pointerup', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      if (this.pointerId !== pointer.id) return;
      event.stopPropagation(); this.pointerId = null; this.draw();
      if (this.enabled && this.remaining <= 0) onCast();
    });
    hit.on('pointerout', (pointer: Phaser.Input.Pointer) => { if (this.pointerId === pointer.id) this.cancel(); });
    scene.input.on('pointerupoutside', this.releasedOutside);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.cancelled);
    scene.game.canvas.addEventListener('touchcancel', this.cancelled, true);
    scene.game.canvas.addEventListener('pointercancel', this.cancelled, true);
    this.draw();
  }
  public cancel(): void { if (this.pointerId !== null) { this.pointerId = null; this.draw(); } }
  public update(enabled: boolean, remaining: number, duration: number): void {
    const tick = Math.floor(remaining / 100);
    const changed = enabled !== this.enabled || duration !== this.duration || tick !== this.lastTick;
    this.enabled = enabled; this.remaining = remaining; this.duration = duration;
    if (!enabled || remaining > 0) this.pointerId = null;
    if (changed) { this.lastTick = tick; this.draw(); }
  }
  private draw(): void {
    this.graphics.clear();
    const ready=this.enabled&&this.remaining<=0;
    paintButton(this.graphics,-56,-44,112,88,ready,this.enabled,this.pointerId!==null);
    this.label.y = this.pointerId !== null ? -1 : -3;
    this.graphics.fillStyle(0x182032).fillRect(-43,33,86,4).fillStyle(0xa6d86a)
      .fillRect(-43,33,Math.round(86*(1-this.remaining/this.duration)),4);
    this.label.setColor(!this.enabled?DESIGN_TOKENS.state.disabledText:ready?DESIGN_TOKENS.text.onPrimary:FANTASY.cream)
      .setText(`${this.ability.name}\n${this.remaining>0?`${countdownSeconds(this.remaining)}초`:this.enabled?this.ability.label:'전투 중'}`);
  }
  public destroy(): void {
    this.scene.input.off('pointerupoutside', this.releasedOutside);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.cancelled);
    this.scene.game.canvas.removeEventListener('touchcancel', this.cancelled, true);
    this.scene.game.canvas.removeEventListener('pointercancel', this.cancelled, true);
    this.container.destroy();
  }
}
