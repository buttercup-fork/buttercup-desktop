/**
 * How an error is written into a log line
 */
export type ErrorFormatter = (error: Error) => string;

// The error and its stack as the engine has it
const plainError: ErrorFormatter = (error) => (error.stack ? error.stack : error.toString());

export function serialiseLogItems(
    items: Array<any>,
    formatError: ErrorFormatter = plainError
): string {
    return items
        .reduce((output: string, next: any) => {
            let value: string = "";
            if (["number", "boolean", "string"].indexOf(typeof next) >= 0) {
                value = `${next}`;
            } else if (next instanceof Date) {
                value = next.toISOString();
            } else if (next instanceof Error) {
                value = formatError(next);
            } else if (typeof next === "undefined" || next === null) {
                // Do nothing
            } else {
                value = JSON.stringify(next);
            }
            return `${output} ${value}`;
        }, "")
        .trim();
}
