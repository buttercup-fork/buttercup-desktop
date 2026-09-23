import * as React from "react";
import * as OTPAuth from "otpauth";
import { Button } from "@blueprintjs/core";
import { chooseQRImageFile, readClipboardQRImage } from "../../actions/qr";
import { decodeQRFromDataURL } from "../../library/qr";
import { showError, showSuccess, showWarning } from "../../services/notifications";
import { logErr } from "../../library/log";
import { t } from "../../../shared/i18n/trans";

const { useCallback, useState } = React;

export interface ScanOTPButtonProps {
    onScan: (otpURI: string) => void;
}

/**
 * Most 2FA setup pages only offer a QR code, with no "enter this key
 * manually" fallback text - so there was previously no way to get an OTP
 * into Buttercup without a separate scanner app. This button decodes a QR
 * code from whatever image is easiest to get hold of: a screenshot on the
 * clipboard (the common case - Win+Shift+S / Cmd+Shift+4-to-clipboard),
 * falling back to a file picker when the clipboard has no image.
 */
export function ScanOTPButton(props: ScanOTPButtonProps) {
    const { onScan } = props;
    const [scanning, setScanning] = useState(false);
    const handleScan = useCallback(async () => {
        setScanning(true);
        try {
            let imageDataURL = await readClipboardQRImage();
            if (!imageDataURL) {
                imageDataURL = await chooseQRImageFile();
            }
            if (!imageDataURL) {
                showWarning(t("vault-ui.custom-fields.otp-scan.no-image"));
                return;
            }
            const decoded = await decodeQRFromDataURL(imageDataURL);
            if (!decoded) {
                showWarning(t("vault-ui.custom-fields.otp-scan.not-found"));
                return;
            }
            try {
                OTPAuth.URI.parse(decoded);
            } catch (err) {
                showError(t("vault-ui.custom-fields.otp-scan.invalid"));
                return;
            }
            onScan(decoded);
            showSuccess(t("vault-ui.custom-fields.otp-scan.success"));
        } catch (err) {
            logErr("Failed scanning QR code for OTP", err);
            showError(t("vault-ui.custom-fields.otp-scan.error"));
        } finally {
            setScanning(false);
        }
    }, [onScan]);
    return (
        <Button
            icon="camera"
            loading={scanning}
            title={t("vault-ui.custom-fields.otp-scan.button-title")}
            onClick={handleScan}
        />
    );
}
