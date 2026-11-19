// HTML5 music peaks below 0.22 at the configured maximum. Reserve output headroom
// for it while leaving quiet Web Audio (SFX/UI) signals linear.
export const AUDIO_OUTPUT_CEILING = .72;
export const AUDIO_SOFT_KNEE = .5;
const CURVE_SIZE = 4097;
let curve: ReturnType<typeof Float32Array.from> | undefined;

export function limitAudioSample(sample: number): number {
    if (!Number.isFinite(sample)) return 0;
    const magnitude = Math.min(1, Math.abs(sample));
    if (magnitude <= AUDIO_SOFT_KNEE) return sample;
    const headroom = AUDIO_OUTPUT_CEILING - AUDIO_SOFT_KNEE;
    return Math.sign(sample) * (AUDIO_SOFT_KNEE + headroom * Math.tanh((magnitude - AUDIO_SOFT_KNEE) / headroom));
}

/** One fixed curve per module; no render-frame work or new audio context. */
export function createAudioOutputGuard(context: BaseAudioContext): WaveShaperNode | undefined {
    if (typeof context.createWaveShaper !== 'function') return;
    let node: WaveShaperNode | undefined;
    try {
        curve ??= Float32Array.from({ length: CURVE_SIZE }, (_, i) => limitAudioSample(i / (CURVE_SIZE - 1) * 2 - 1));
        node = context.createWaveShaper();
        node.curve = curve;
        // Avoid resampling-filter overshoot at the reserved output ceiling.
        node.oversample = 'none';
        return node;
    } catch {
        try { node?.disconnect(); } catch { /* An optional output stage cannot disable playback. */ }
        return;
    }
}
