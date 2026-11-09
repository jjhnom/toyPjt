import { isSupportedStageIndex } from '../config/stageData';

export const ENDLESS_RECORD_KEY = 'smash.endless-record.v1';
type RecordStorage = Pick<Storage, 'getItem' | 'setItem'>;
function browserStorage(): RecordStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export class EndlessRecordManager {
  constructor(private readonly storage: RecordStorage | null = browserStorage()) {}
  public highestStage(): number {
    try {
      const data = JSON.parse(this.storage?.getItem(ENDLESS_RECORD_KEY) ?? 'null');
      return data?.version === 1 && Number.isSafeInteger(data.highestStage) &&
        isSupportedStageIndex(data.highestStage - 1) && data.highestStage >= 6 ? data.highestStage : 0;
    } catch { return 0; }
  }
  public recordReached(index: number): boolean {
    if (!isSupportedStageIndex(index) || index < 5 || !this.storage) return false;
    const stage = index + 1;
    if (stage <= this.highestStage()) return true;
    try { this.storage.setItem(ENDLESS_RECORD_KEY, JSON.stringify({ version: 1, highestStage: stage })); return true; }
    catch { return false; }
  }
}
export const endlessRecordManager = new EndlessRecordManager();
