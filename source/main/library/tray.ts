import path from "path";
import { isLinux, isWindows } from "../../shared/library/platform";
import { getRootProjectPath } from "./paths";

export function getIconPath(): string {
    const trayPath = isWindows() ? "tray.ico" : isLinux() ? "tray-linux.png" : "trayTemplate.png";
    const root = getRootProjectPath();
    return path.join(root, "resources/icons", trayPath);
}

export function getWindowIconPath(): string {
    const iconFile = isWindows() ? "icon.ico" : isLinux() ? "icons/256x256.png" : "icon.icns";
    const root = getRootProjectPath();
    return path.join(root, "resources/build", iconFile);
}
