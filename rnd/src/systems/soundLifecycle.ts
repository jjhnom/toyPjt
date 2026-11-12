import type { SoundManager } from './SoundManager';
interface GameEvents {
    on(event: string, callback: () => void): unknown;
    off(event: string, callback: () => void): unknown;
    once(event: string, callback: () => void): unknown;
}
const bindings = new WeakMap<SoundManager, () => void>();
/** One application binding, kept across Scenes and removed when the Game is destroyed. */
export function installSoundLifecycle(manager: SoundManager, events: GameEvents, doc: Document = document, win: Window = window): () => void {
    const existing = bindings.get(manager);
    if (existing)
        return existing;
    const gesture = () => { void manager.unlockFromUserGesture(); };
    const hidden = () => { void manager.suspendForBackground('game'); };
    const visible = () => { void manager.resumeAfterForeground('game'); };
    const visibility = () => { if (doc.hidden)
        void manager.suspendForBackground('document');
    else
        void manager.resumeAfterForeground('document'); };
    const pagehide = () => { void manager.suspendForBackground('page'); };
    const pageshow = () => { void manager.resumeAfterForeground('page'); };
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
