import { createScreenLockParser } from "./screenLock";

// What dbus-monitor printed on Ubuntu GNOME for lock (Super+L) and unlock, 2026-10-07
const GNOME_LOCK_AND_UNLOCK = `signal time=1791362971.554148 sender=org.freedesktop.DBus -> destination=:1.145 serial=2 path=/org/freedesktop/DBus; interface=org.freedesktop.DBus; member=NameAcquired
   string ":1.145"
signal time=1791362971.554259 sender=org.freedesktop.DBus -> destination=:1.145 serial=4 path=/org/freedesktop/DBus; interface=org.freedesktop.DBus; member=NameLost
   string ":1.145"
signal time=1791363016.170078 sender=:1.35 -> destination=(null destination) serial=2048 path=/org/gnome/ScreenSaver; interface=org.gnome.ScreenSaver; member=ActiveChanged
   boolean true
signal time=1791363016.174532 sender=:1.89 -> destination=(null destination) serial=27 path=/org/gnome/ScreenSaver; interface=org.gnome.ScreenSaver; member=ActiveChanged
   boolean true
signal time=1791363016.176902 sender=:1.32 -> destination=(null destination) serial=412 path=/org/gnome/SessionManager/Presence; interface=org.gnome.SessionManager.Presence; member=StatusChanged
   uint32 3
signal time=1791363021.181960 sender=:1.35 -> destination=(null destination) serial=2108 path=/org/gnome/ScreenSaver; interface=org.gnome.ScreenSaver; member=WakeUpScreen
signal time=1791363021.193657 sender=:1.35 -> destination=(null destination) serial=2109 path=/org/gnome/ScreenSaver; interface=org.gnome.ScreenSaver; member=ActiveChanged
   boolean false
signal time=1791363021.194632 sender=:1.89 -> destination=(null destination) serial=29 path=/org/gnome/ScreenSaver; interface=org.gnome.ScreenSaver; member=ActiveChanged
   boolean false
`;

function feed(text: string) {
    const changes: Array<boolean> = [];
    const parse = createScreenLockParser((locked) => changes.push(locked));
    text.split("\n").forEach(parse);
    return changes;
}

describe("createScreenLockParser", () => {
    test("reports one lock and one unlock for GNOME's doubled signals", () => {
        expect(feed(GNOME_LOCK_AND_UNLOCK)).toEqual([true, false]);
    });

    test("ignores startup messages and other signals", () => {
        const lines = GNOME_LOCK_AND_UNLOCK.split("\n").slice(0, 4).join("\n");
        expect(feed(lines)).toEqual([]);
    });

    test("understands KDE's and Cinnamon's interface names", () => {
        for (const iface of ["org.freedesktop.ScreenSaver", "org.cinnamon.ScreenSaver"]) {
            const text = `signal time=1.0 sender=:1.2 -> destination=(null destination) serial=1 path=/x; interface=${iface}; member=ActiveChanged\n   boolean true\n`;
            expect(feed(text)).toEqual([true]);
        }
    });

    test("ignores ActiveChanged from something that isn't a screen saver", () => {
        const text =
            "signal time=1.0 sender=:1.2 -> destination=(null destination) serial=1 path=/x; interface=org.example.Thing; member=ActiveChanged\n   boolean true\n";
        expect(feed(text)).toEqual([]);
    });

    test("a value line belongs to the signal right before it", () => {
        const text = [
            "signal time=1.0 sender=:1.2 -> destination=(null destination) serial=1 path=/org/gnome/ScreenSaver; interface=org.gnome.ScreenSaver; member=WakeUpScreen",
            "   boolean true",
            ""
        ].join("\n");
        expect(feed(text)).toEqual([]);
    });
});
