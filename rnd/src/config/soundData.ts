export type SoundGroup = 'sfx' | 'ui';
export type SoundId = 'shoot' | 'hit' | 'explosion' | 'powerup';
export interface SoundDefinition {
    group: SoundGroup;
    intervalMs: number;
    maxVoices: number;
    priority: number;
    wave: OscillatorType;
    startHz: number;
    endHz: number;
    sweepMs: number;
    envelopeMs: number;
    stopMs: number;
    gain: number;
}
export const MAX_SOUND_VOICES = 8;
export const SOUND_DEFINITIONS: Readonly<Record<SoundId, Readonly<SoundDefinition>>> = {
    shoot: { group: 'sfx', intervalMs: 40, maxVoices: 4, priority: 1, wave: 'triangle', startHz: 620, endHz: 180, sweepMs: 70, envelopeMs: 70, stopMs: 75, gain: .05 },
    hit: { group: 'sfx', intervalMs: 60, maxVoices: 3, priority: 1, wave: 'square', startHz: 220, endHz: 80, sweepMs: 50, envelopeMs: 50, stopMs: 55, gain: .04 },
    explosion: { group: 'sfx', intervalMs: 100, maxVoices: 3, priority: 2, wave: 'sawtooth', startHz: 140, endHz: 35, sweepMs: 180, envelopeMs: 180, stopMs: 190, gain: .09 },
    powerup: { group: 'ui', intervalMs: 120, maxVoices: 2, priority: 3, wave: 'sine', startHz: 380, endHz: 880, sweepMs: 220, envelopeMs: 230, stopMs: 240, gain: .08 }
};
