import React from "react";
import { Position, Toaster } from "@blueprintjs/core";
import { createGlobalStyle } from "styled-components";

const { useCallback } = React;

// Blueprint toasts have a 300px min-width. Short confirmation toasts (e.g.
// "Copied!") only need to be as wide as their text.
const ToastStyles = createGlobalStyle`
    .bp3-toast.bcup-toast-compact,
    .bp4-toast.bcup-toast-compact {
        min-width: auto;
    }
    .bcup-toast-compact .bp3-toast-message,
    .bcup-toast-compact .bp4-toast-message {
        white-space: nowrap;
    }
`;

let __toasterRef: Toaster,
    __updateToasterRef: Toaster;

export function getToaster(): Toaster {
    return __toasterRef;
}

export function getUpdateToaster(): Toaster {
    return __updateToasterRef;
}

export function Notifications() {
    const onRef = useCallback((toasterRef: Toaster) => {
        __toasterRef = toasterRef;
    }, []);
    const onUpdateRef = useCallback((toasterRef: Toaster) => {
        __updateToasterRef = toasterRef;
    }, []);
    return (
        <>
            <ToastStyles />
            <Toaster position={Position.TOP_RIGHT} usePortal={false} ref={onRef} />
            <Toaster position={Position.BOTTOM_RIGHT} usePortal={false} ref={onUpdateRef} />
        </>
    );
}
