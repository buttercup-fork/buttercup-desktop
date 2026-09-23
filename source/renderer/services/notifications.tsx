import * as React from "react";
import { Classes, Intent, IToastProps, ProgressBar } from "@blueprintjs/core";
import { getToaster, getUpdateToaster } from "../components/Notifications";
import { logWarn } from "../library/log";
import { t } from "../../shared/i18n/trans";
import { setUpdateErrorDetails } from "../state/updateError";

export interface ProgressNotification {
    clear: (message: any, intent: Intent, timeout?: number) => void;
    setProgress: (progress: number) => void;
}

export function createProgressNotification(icon: IToastProps["icon"], initialAmount = 0): ProgressNotification {
    const key = `prog${Math.floor(Math.random() * 999999)}`;
    const update = (amount = initialAmount, timeout = 0) => {
        const toaster = getToaster();
        toaster.show({
            icon,
            message: (
                <ProgressBar
                    className={Classes.PROGRESS_NO_STRIPES}
                    intent={Intent.PRIMARY}
                    value={amount / 100}
                />
            ),
            timeout: 0
        }, key);
    };
    const clear = (message: any, intent: Intent, timeout: number) => {
        const toaster = getToaster();
        toaster.show({
            icon,
            intent,
            message,
            timeout
        }, key);
    };
    update();
    return {
        clear: (message: any, intent: Intent, timeout = 5000) => clear(message, intent, timeout),
        setProgress: (progress: number) => update(progress)
    };
}

export function showError(message: string) {
    showNotification(message, Intent.DANGER, 10000);
}

function showNotification(message: any, intent: Intent = Intent.NONE, timeout: number = 5000) {
    const toaster = getToaster();
    if (!toaster) {
        logWarn("No notifications toaster ready for notification:", message);;
    }
    toaster.show({
        message,
        intent,
        timeout
    });
}

export function showSuccess(message: string) {
    showNotification(message, Intent.SUCCESS);
}

let __copiedToastKey: string | null = null;
let __copiedToastCount = 0;

export function notifyCopied(message: string = t("notification.copied")) {
    const toaster = getToaster();
    if (!toaster) return;
    // Each copy gets its own key, with the previous copy toast dismissed, so rapid
    // successive copies replace rather than stack. Reusing one fixed key is not safe:
    // Blueprint only restarts a toast's timeout when its `timeout` prop changes, so
    // re-showing under the same key while the previous toast is still animating out
    // revives it with no timer left - and it then stays until "X" is clicked.
    if (__copiedToastKey) {
        toaster.dismiss(__copiedToastKey);
    }
    __copiedToastKey = `clipboard-copied-${++__copiedToastCount}`;
    toaster.show({
        className: "bcup-toast-compact",
        icon: "clipboard",
        message,
        intent: Intent.SUCCESS,
        timeout: 2500
    }, __copiedToastKey);
}

export function showUpdateAvailable(version: string, onUpdate: () => void, onCancel: () => void) {
    const toaster = getUpdateToaster();
    let closed = false;
    toaster.show({
        icon: "automatic-updates",
        intent: Intent.PRIMARY,
        message: t("update.available", { version }),
        timeout: 0,
        onDismiss: (didTimeoutExpire: boolean) => {
            if (closed) return;
            if (!didTimeoutExpire) onCancel();
        },
        action: {
            text: t("update.view"),
            onClick: () => {
                closed = true;
                onUpdate();
            },
        }
    }, "update-available");
}

export function showUpdateDownloaded(version: string, onUpdate: () => void, onCancel: () => void) {
    const toaster = getUpdateToaster();
    let closed = false;
    toaster.show({
        icon: "compressed",
        intent: Intent.PRIMARY,
        message: t("update.ready", { version }),
        timeout: 0,
        onDismiss: (didTimeoutExpire: boolean) => {
            if (closed) return;
            if (!didTimeoutExpire) onCancel();
        },
        action: {
            text: t("update.installed-restart"),
            onClick: () => {
                closed = true;
                onUpdate();
            },
        }
    }, "update-downloaded");
}

// electron-updater errors are raw network/HTTP messages (e.g. GitHub feed
// URLs, status codes, stack-ish text) - not fit for a toast. Showing the
// full text in the toast made it grow to take over the corner of the
// screen. Instead we classify it into a short, human summary and let the
// user expand a dialog with the original message when they want it.
function summariseUpdateError(message: string): string {
    if (/\b404\b/.test(message) || /ENOTFOUND|ECONNREFUSED/.test(message)) {
        return t("update.error.github-unavailable");
    }
    return t("update.error.generic");
}

export function showUpdateError(message: string) {
    const toaster = getUpdateToaster();
    toaster.show({
        message: summariseUpdateError(message),
        intent: Intent.DANGER,
        timeout: 15000,
        action: {
            text: t("update.error.details-button"),
            onClick: () => setUpdateErrorDetails(message)
        }
    });
}

export function showWarning(message: string) {
    showNotification(message, Intent.WARNING, 10000);
}
