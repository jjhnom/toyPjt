import type { SoundManager } from './SoundManager';
interface GameEvents {
    on(event: string, callback: () => void): unknown;
    off(event: string, callback: () => void): unknown;
    once(event: string, callback: () => void): unknown;
}
interface MusicLifecycle {
    unlockFromUserGesture(): void;
    suspendForBackground(reason: string): void;
    resumeAfterForeground(reason: string): void;
    syncSettings(settings: ReturnType<SoundManager['getSettings']>): void;
    dispose(): void;
}
const bindings = new WeakMap<SoundManager, () => void>();
/** One application binding, kept across Scenes and removed when the Game is destroyed. */
export function installSoundLifecycle(manager: SoundManager, events: GameEvents, doc: Document = document, win: Window = window, music?: MusicLifecycle): () => void {
    const existing = bindings.get(manager);
    if (existing)
        return existing;
    const unsubscribe = music ? manager.subscribeSettings(settings => music.syncSettings(settings)) : undefined;
    const gesture = () => { music?.unlockFromUserGesture(); void manager.unlockFromUserGesture(); };
    const hidden = () => { music?.suspendForBackground('game'); void manager.suspendForBackground('game'); };
    const visible = () => { music?.resumeAfterForeground('game'); void manager.resumeAfterForeground('game'); };
    const visibility = () => {
        if (doc.hidden) {
            music?.suspendForBackground('document');
            void manager.suspendForBackground('document');
        } else {
            music?.resumeAfterForeground('document');
            void manager.resumeAfterForeground('document');
        }
    };
    const pagehide = () => { music?.suspendForBackground('page'); void manager.suspendForBackground('page'); };
    const pageshow = () => { music?.resumeAfterForeground('page'); void manager.resumeAfterForeground('page'); };
    let released = false;
    const cleanup = () => {
        if (released)
            return;
        released = true;
        bindings.delete(manager);
        for (const name of ['pointerup', 'keydown'])
            doc.removeEventListener(name, gesture);
        doc.removeEventListener('visibilitychange', visibility);
        win.removeEventListener('pagehide', pagehide);
        win.removeEventListener('pageshow', pageshow);
        events.off('hidden', hidden);
        events.off('visible', visible);
        events.off('destroy', cleanup);
        unsubscribe?.();
        music?.dispose();
        void manager.dispose();
    };
    // Phaser touchstart actions run before pointerup, so a first mute tap never creates an unused graph.
    for (const name of ['pointerup', 'keydown'])
        doc.addEventListener(name, gesture, { passive: true });
    doc.addEventListener('visibilitychange', visibility);
    win.addEventListener('pagehide', pagehide);
    win.addEventListener('pageshow', pageshow);
    events.on('hidden', hidden);
    events.on('visible', visible);
    events.once('destroy', cleanup);
    bindings.set(manager, cleanup);
    visibility();
    return cleanup;
}
