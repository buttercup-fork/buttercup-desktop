import * as React from "react";
import { useSingleState } from "react-obstate";
import styled from "styled-components";
import { Button, Classes, Dialog } from "@blueprintjs/core";
import { UPDATE_ERROR, setUpdateErrorDetails } from "../../state/updateError";
import { copyText } from "../../actions/clipboard";
import { showSuccess } from "../../services/notifications";
import { t } from "../../../shared/i18n/trans";

const { useCallback } = React;

const DetailsBlock = styled.pre`
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
`;

export function UpdateErrorDialog() {
    const [message, setMessage] = useSingleState(UPDATE_ERROR, "message");
    const close = useCallback(() => {
        setMessage(null);
    }, []);
    const copy = useCallback(async () => {
        await copyText(message as string);
        showSuccess(t("notification.copied"));
    }, [message]);
    return (
        <Dialog isOpen={!!message} onClose={close}>
            <div className={Classes.DIALOG_HEADER}>{t("update.error-dialog.title")}</div>
            <div className={Classes.DIALOG_BODY}>
                <p>{t("update.error-dialog.instruction")}</p>
                <DetailsBlock>{message}</DetailsBlock>
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <Button onClick={copy}>
                        {t("update.error-dialog.copy-button")}
                    </Button>
                    <Button
                        onClick={close}
                        title={t("update.error-dialog.close-button-title")}
                    >
                        {t("update.error-dialog.close-button")}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}
