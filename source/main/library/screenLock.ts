/**
 * Reads the text `dbus-monitor` prints for screen-saver signals and reports
 * when the screen locks or unlocks (B-9, #1160). Electron only reports a screen
 * lock on Windows and macOS. On Linux, GNOME, KDE, Cinnamon, MATE and Xfce all
 * send `ActiveChanged(boolean)` on their ScreenSaver interface. A signal looks
 * like this, the value on the line after it:
 *
 *   signal time=... sender=:1.35 -> destination=(null destination) serial=2048 path=/org/gnome/ScreenSaver; interface=org.gnome.ScreenSaver; member=ActiveChanged
 *      boolean true
 *
 * Several programs can announce the same change (GNOME sends it twice), so a
 * change is only reported when the state actually flips.
 * @param onChange Called with true when the screen locks, false when it unlocks
 * @returns A function that takes one output line at a time
 */
export function createScreenLockParser(
    onChange: (locked: boolean) => void
): (line: string) => void {
    let awaitingValue = false;
    let locked = false;
    return (line: string) => {
        if (line.startsWith("signal ")) {
            const interfaceName = /\binterface=([^;\s]+)/.exec(line)?.[1] ?? "";
            awaitingValue =
                /\bmember=ActiveChanged\s*$/.test(line) && /ScreenSaver$/.test(interfaceName);
            return;
        }
        if (!awaitingValue) return;
        const value = /^\s+boolean (true|false)\s*$/.exec(line)?.[1];
        if (!value) return;
        awaitingValue = false;
        const next = value === "true";
        if (next !== locked) {
            locked = next;
            onChange(next);
        }
    };
}
