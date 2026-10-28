/**
 * Hand on only the result of the most recent call (B-668). Each call to the
 * returned function takes a promise; it settles like that promise if no newer
 * promise was passed in meanwhile, and never settles otherwise, so a slow older
 * result cannot overwrite a newer one.
 *
 * The password generator needs this only as a guard: its random source is
 * synchronous today, so one generation always finishes before the next click.
 */
export function latestOnly<T>(): (promise: Promise<T>) => Promise<T> {
    let latest = 0;
    return (promise: Promise<T>) => {
        latest += 1;
        const call = latest;
        return new Promise<T>((resolve, reject) => {
            promise.then(
                (value) => {
                    if (call === latest) resolve(value);
                },
                (err) => {
                    if (call === latest) reject(err);
                }
            );
        });
    };
}
