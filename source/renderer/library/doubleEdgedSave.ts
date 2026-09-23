interface SaveCycleState<T> {
    saving: boolean;
    dirty: boolean;
    latestPayload: T;
    waiters: Array<{ resolve: () => void; reject: (err: unknown) => void }>;
}

/**
 * Build a per-key "double-edged" debounced save function around `performSave`.
 *
 * Unlike a typical trailing-edge debounce (wait, then save once), the first
 * save for a key starts immediately. If further saves for the same key come
 * in while one is still in flight, they aren't queued individually - they
 * collapse into a single "dirty" flag holding only the latest payload. Once
 * the in-flight save finishes, exactly one more save fires (if dirty) to
 * catch up, rather than firing once per request or dropping the update
 * entirely. This is the behaviour requested in buttercup/buttercup-core#182.
 */
export function createDoubleEdgedSaver<K, T>(
    performSave: (key: K, payload: T) => Promise<void>
): (key: K, payload: T) => Promise<void> {
    const states = new Map<K, SaveCycleState<T>>();

    function getState(key: K): SaveCycleState<T> {
        let state = states.get(key);
        if (!state) {
            state = { saving: false, dirty: false, latestPayload: null, waiters: [] };
            states.set(key, state);
        }
        return state;
    }

    async function runCycle(key: K, state: SaveCycleState<T>): Promise<void> {
        state.saving = true;
        state.dirty = false;
        const payload = state.latestPayload;
        const waiters = state.waiters;
        state.waiters = [];
        try {
            await performSave(key, payload);
            waiters.forEach(({ resolve }) => resolve());
        } catch (err) {
            waiters.forEach(({ reject }) => reject(err));
            throw err;
        } finally {
            state.saving = false;
            if (state.dirty) {
                // More updates arrived while this save was in flight - catch
                // up with one more save rather than dropping them.
                runCycle(key, state).catch(() => {
                    /* already routed to its own waiters above */
                });
            }
        }
    }

    return function save(key: K, payload: T): Promise<void> {
        const state = getState(key);
        state.latestPayload = payload;
        if (state.saving) {
            state.dirty = true;
            return new Promise<void>((resolve, reject) => {
                state.waiters.push({ resolve, reject });
            });
        }
        return runCycle(key, state);
    };
}
