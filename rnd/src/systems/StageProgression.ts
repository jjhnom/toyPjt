import { STAGES, stageClearReward } from '../config/stageData';
import type { StageDef, StageState } from '../types/game';

/** Run-level gate for boss rewards and transitions, independent of room state. */
export class StageProgression {
  public index = 0;
  public state: StageState = 'PLAYING';
  public bossesDefeated = 0;
  constructor(public readonly stages: StageDef[] = STAGES) {}
  public get current(): StageDef { return this.stages[this.index]; }
  public get next(): StageDef | undefined { return this.stages[this.index + 1]; }

  public clearBoss(): { victory: boolean; minerals: number; freeSummons: number } | null {
    if (this.state !== 'PLAYING') return null;
    this.state = 'STAGE_CLEARED';
    this.bossesDefeated++;
    const victory = this.current.isFinal || !this.next;
    return { victory, minerals: stageClearReward(this.current), freeSummons: victory ? 0 : 1 };
  }

  public beginTransition(): boolean {
    if (this.state !== 'STAGE_CLEARED' || this.current.isFinal || !this.next) return false;
    this.state = 'STAGE_TRANSITION';
    this.index++;
    return true;
  }

  public finishTransition(): void {
    if (this.state === 'STAGE_TRANSITION') this.state = 'PLAYING';
  }
}
