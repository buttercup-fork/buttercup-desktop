export class TimeoutError extends Error {
    constructor(message = "Timed out") {
        super(message);
        this.name = "TimeoutError";
    }
}

/**
 * Reject with a `TimeoutError` if `promise` has not settled within `ms`.
 *
 * The wrapped promise is not cancellable (there is no such thing for a bare
 * promise), so if it settles *after* the timeout the result is routed to
 * `onLateSettle` instead of being dropped silently.
 */
export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    options: { message?: string; onLateSettle?: (result: { value?: T; error?: any }) => void } = {}
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new TimeoutError(options.message));
        }, ms);
        promise.then(
            (value) => {
                if (settled) {
                    options.onLateSettle?.({ value });
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                if (settled) {
                    options.onLateSettle?.({ error });
                    return;
                }
                settled = true;
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}
