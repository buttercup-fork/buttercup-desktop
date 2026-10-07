import React, { useCallback } from "react";
import styled from "styled-components";
import { useState as useHookState } from "@hookstate/core";
import { Button, Card, Classes, Dialog, Intent } from "@blueprintjs/core";
import { muteCurrentUpdate, startCurrentUpdate } from "../../services/update";
import { CURRENT_UPDATE, SHOW_UPDATE_DIALOG } from "../../state/update";
import { openLinkExternally } from "../../actions/link";
import { t } from "../../../shared/i18n/trans";
import { sanitiseReleaseNotes } from "../../library/sanitise";

const ReleaseHeading = styled.h2`
    margin-top: 0px;
`;

// Release notes are HTML from the release (sanitised before display); Blueprint's tight default line
// height made them hard to read (#1016)
const ReleaseNotes = styled.div`
    line-height: 1.5;
    max-height: 50vh;
    overflow-y: auto;

    p,
    ul,
    ol {
        margin: 0 0 10px;
    }

    li {
        margin-bottom: 4px;
    }

    > :last-child {
        margin-bottom: 0;
    }
`;

export function UpdateDialog() {
    const showDialogState = useHookState(SHOW_UPDATE_DIALOG);
    const currentUpdateState = useHookState(CURRENT_UPDATE);
    const currentUpdate = currentUpdateState.get();
    const version = currentUpdate ? currentUpdate.version : null;
    const close = useCallback(() => {
        showDialogState.set(false);
        currentUpdateState.set(null);
        muteCurrentUpdate();
    }, []);
    const update = useCallback(() => {
        showDialogState.set(false);
        startCurrentUpdate();
    }, []);
    const updateContentRef = useCallback(node => {
        if (!node) return;
        try {
            const anchors = [...node.getElementsByTagName("a")];
            anchors.forEach(anchor => {
                anchor.addEventListener("click", event => {
                    event.preventDefault();
                    openLinkExternally(event.target.href);
                });
            });
        } catch (err) {}
    }, []);
    return (
        <Dialog isOpen={showDialogState.get() && !!currentUpdateState.get()} onClose={close}>
            <div className={Classes.DIALOG_HEADER}>{t("update.dialog.title", { version })}</div>
            <div className={Classes.DIALOG_BODY}>
                {currentUpdate && (
                    <ReleaseHeading>{currentUpdate.releaseName}</ReleaseHeading>
                )}
                {currentUpdate && (
                    <Card>
                        <ReleaseNotes dangerouslySetInnerHTML={{ __html: sanitiseReleaseNotes(currentUpdate.releaseNotes as string) }} ref={updateContentRef} />
                    </Card>
                )}
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <Button
                        intent={Intent.PRIMARY}
                        onClick={update}
                        title={t("update.dialog.download-button-title")}
                    >
                        {t("update.dialog.download-button")}
                    </Button>
                    <Button
                        onClick={close}
                        title={t("update.dialog.close-button-title")}
                    >
                        {t("update.dialog.close-button")}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}
