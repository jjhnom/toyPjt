import { IComponent } from '../types/game';

export class HealthComponent implements IComponent {
  public maxHp: number;
  public currentHp: number;
  public invulnerableUntil = 0;
  private onDeathCallback?: () => void;
  private onDamagedCallback?: (amount: number, current: number, max: number) => void;

  constructor(
    maxHp: number,
    onDeath?: () => void,
    onDamaged?: (amount: number, current: number, max: number) => void
  ) {
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.onDeathCallback = onDeath;
    this.onDamagedCallback = onDamaged;
  }

  public reset(maxHp: number): void {
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.invulnerableUntil = 0;
  }

  public takeDamage(amount: number, currentTime = 0, iFrameMs = 0): boolean {
    if (this.currentHp <= 0) return false;
    if (currentTime > 0 && currentTime < this.invulnerableUntil) return false;

    const finalDamage = Math.max(1, Math.round(amount));
    this.currentHp = Math.max(0, this.currentHp - finalDamage);

    if (iFrameMs > 0 && currentTime > 0) {
      this.invulnerableUntil = currentTime + iFrameMs;
    }

    if (this.onDamagedCallback) {
      this.onDamagedCallback(finalDamage, this.currentHp, this.maxHp);
    }

    if (this.currentHp <= 0 && this.onDeathCallback) {
      this.onDeathCallback();
    }

    return true;
  }

  public heal(amount: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
  }

  public get ratio(): number {
    return this.maxHp > 0 ? this.currentHp / this.maxHp : 0;
  }

  public get isDead(): boolean {
    return this.currentHp <= 0;
  }

  public update(_time: number, _delta: number): void {
    // 상태 타이머는 타임스탬프 비교로 처리하여 GC 오버헤드 방지
  }

  public destroy(): void {
    this.onDeathCallback = undefined;
    this.onDamagedCallback = undefined;
  }
}
