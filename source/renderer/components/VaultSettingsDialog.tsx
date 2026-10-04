import React, { Fragment, useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useState as useHookState } from "@hookstate/core";
import {
    Alignment,
    Button,
    ButtonGroup,
    Callout,
    Classes,
    Dialog,
    FormGroup,
    Icon,
    InputGroup,
    Intent,
    NumericInput,
    Switch,
    Text
} from "@blueprintjs/core";
import { VaultFormatID, VaultSourceStatus } from "buttercup";
import { ConfirmDialog } from "./prompt/ConfirmDialog";
import { t } from "../../shared/i18n/trans";
import { SHOW_VAULT_SETTINGS } from "../state/vaultSettings";
import { naiveClone } from "../../shared/library/clone";
import { setBusy } from "../state/app";
import { VAULT_SETTINGS_DEFAULT } from "../../shared/symbols";
import { useSourceDetails } from "../hooks/vault";
import { changeMasterPassword, getVaultSettings, saveVaultSettings } from "../services/vaultSettings";
import { logErr, logInfo, logWarn } from "../library/log";
import { VaultSettingsLocal } from "../types";
import { showError, showSuccess, showWarning } from "../services/notifications";
import { convertVaultToFormat } from "../actions/format";

const PAGE_BACKUP = "backup";
const PAGE_FORMAT = "format";
const PAGE_BIOMETRIC = "biometric";
const PAGE_PASSWORD = "password";

const ContentNotice = styled.div`
    margin-top: 12px;
`;
const ContentNoticeIcon = styled(Icon)`
    margin-right: 8px;
`;
const DialogFreeWidth = styled(Dialog)`
    width: 85%;
    max-width: 800px;
    min-width: 600px;
    height: 100%;
    min-height: 400px;
    max-height: 700px;
`;
const FormatContainer = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    flex: 0 0 auto;
    width: 50%;
    padding: 24px;
    width: calc(100%-48px);
    height: calc(100%-48px);
`;
const FormatDescriptionContainer = styled.div`
    width: 50%;
    padding: 24px;
    flex: 0 0 auto;
    text-align: center;
`;
const FormatDescriptionText = styled(Text)`
    margin-bottom: 8px;
`;
const FormatTitle = styled(Text)`
    font-size: 18px;
    font-weight: bold;
    margin-top: 16px;
`;
const PageContent = styled.div`
    flex: 1 1 auto;
    box-sizing: border-box;
    padding-left: 16px;
    padding-right: 16px;
`;
const SettingsContent = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
`;
const SettingsMenu = styled(ButtonGroup)`
    width: 100%;
`;
const SettingsSidebar = styled.div`
    width: 140px;
    flex: 0 0 auto;
    margin-right: 6px;
`;
const SplitSection = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
`;

export function VaultSettingsDialog() {
    const showSettingsState = useHookState(SHOW_VAULT_SETTINGS);
    const [currentPage, setCurrentPage] = useState(PAGE_FORMAT);
    const [dirty, setDirty] = useState(false);
    const [settings, _setSettings] = useState<VaultSettingsLocal>(naiveClone(VAULT_SETTINGS_DEFAULT));
    const [
        sourceDetails,
        updateSourceDescription
    ] = useSourceDetails(showSettingsState.get());
    const { id: sourceID, name: vaultName, format: vaultFormat, state = VaultSourceStatus.Locked } = sourceDetails || {};
    const [promptFormatB, setPromptFormatB] = useState<boolean>(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [promptPasswordChange, setPromptPasswordChange] = useState<boolean>(false);
    const clearPasswords = useCallback(() => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    }, []);
    const setSettings = useCallback((settings: VaultSettingsLocal) => {
        _setSettings(settings);
        setDirty(true);
    }, [_setSettings]);
    const close = useCallback(() => {
        showSettingsState.set("");
        setCurrentPage(PAGE_FORMAT);
        clearPasswords();
    }, [clearPasswords]);
    const save = useCallback(() => {
        setBusy(true);
        saveVaultSettings(sourceID, settings)
            .then(() => {
                showSuccess(t("notification.vault-settings-saved"));
                logInfo("Saved vault settings");
                setDirty(false);
                setBusy(false);
                close();
            })
            .catch(err => {
                setBusy(false);
                showError(t("notification.error.vault-settings-save"));
                logErr("Failed saving vault settings", err);
            });
    }, [settings, sourceID]);
    const changeFormatToB = useCallback(() => {
        convertVaultToFormat(sourceID, VaultFormatID.B).then(() => {
            updateSourceDescription();
        });
    }, [sourceID, updateSourceDescription]);
    const changePassword = useCallback(() => {
        setBusy(true);
        changeMasterPassword(sourceID, currentPassword, newPassword)
            .then(result => {
                setBusy(false);
                if (result.ok === false) {
                    logWarn(`Master password not changed: ${result.reason}`);
                    showError(
                        result.reason === "not-unlocked"
                            ? t("vault-settings.not-unlocked")
                            : t(`vault-settings.password.error.${result.reason}`)
                    );
                    return;
                }
                logInfo("Changed vault master password");
                clearPasswords();
                // Plain-text toast: escaping would turn the path's slashes into entities
                showSuccess(t("vault-settings.password.success", { path: result.backupPath, interpolation: { escapeValue: false } }));
                if (result.biometrics === "removed") {
                    showWarning(t("vault-settings.password.biometrics-removed"));
                }
            })
            .catch(err => {
                setBusy(false);
                logErr("Failed changing vault master password", err);
                showError(`${t("vault-settings.password.error.failed")}: ${err?.message ?? t("notification.error.unknown-error")}`);
            });
    }, [clearPasswords, currentPassword, newPassword, sourceID]);
    const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
    const canChangePassword = currentPassword.length > 0 && newPassword.length > 0 && newPassword === confirmPassword;
    useEffect(() => {
        if (!sourceID) return;
        getVaultSettings(sourceID)
            .then(settings => {
                _setSettings(naiveClone(settings));
                setDirty(false);
            })
            .catch(err => {
                showError(t("notification.error.vault-settings-load"));
                logErr("Failed loading vault settings", err);
                showSettingsState.set("");
            });
    }, [sourceID]);
    // Pages
    const pageFormat = () => (
        <>
            <FormGroup label={t("vault-settings.format.title")}>
                <Callout icon="info-sign">
                    <div dangerouslySetInnerHTML={{ __html: t("vault-settings.format.description") }} />
                </Callout>
                {state === VaultSourceStatus.Unlocked && (
                    <SplitSection>
                        <FormatContainer>
                            <Icon icon="data-connection" size={60} />
                            <FormatTitle>{t("vault-settings.format.format-type", { format: vaultFormat?.toUpperCase() })}</FormatTitle>
                        </FormatContainer>
                        <FormatDescriptionContainer>
                            <FormatDescriptionText>
                                {vaultFormat === VaultFormatID.A ? t("vault-settings.format.a-description") : t("vault-settings.format.b-description")}
                            </FormatDescriptionText>
                            {vaultFormat === VaultFormatID.A && (
                                <>
                                    <FormatDescriptionText dangerouslySetInnerHTML={{ __html: t("vault-settings.format.a-upgrade-b") }} />
                                    <Button
                                        text={t("vault-settings.format.upgrade-button")}
                                        icon="circle-arrow-up"
                                        intent={Intent.DANGER}
                                        onClick={() => setPromptFormatB(true)}
                                    />
                                </>
                            )}
                        </FormatDescriptionContainer>
                    </SplitSection>
                ) || (
                    <ContentNotice>
                        <ContentNoticeIcon icon="disable" />
                        <span>{t("vault-settings.not-unlocked")}</span>
                    </ContentNotice>
                )}
            </FormGroup>
        </>
    );
    const pageBackup = () => (
        <>
            <FormGroup label={t("vault-settings.backup.title")}>
                <Callout icon="info-sign">
                    <div dangerouslySetInnerHTML={{ __html: t("vault-settings.backup.description") }} />
                </Callout>
                <Switch
                    checked={settings.localBackup}
                    label={t("vault-settings.backup.switch")}
                    onChange={(evt: React.ChangeEvent<HTMLInputElement>) => setSettings({
                        ...naiveClone(settings),
                        localBackup: evt.target.checked
                    })}
                />
            </FormGroup>
            <FormGroup label={t("vault-settings.backup.path.label")} helperText={t("vault-settings.backup.path.helper")}>
                <InputGroup
                    disabled={!settings.localBackup}
                    placeholder={t("vault-settings.backup.path.placeholder")}
                    onChange={(evt: React.ChangeEvent<HTMLInputElement>) => setSettings({
                        ...naiveClone(settings),
                        localBackupLocation: evt.target.value || null
                    })}
                    value={settings.localBackupLocation || ""}
                />
            </FormGroup>
        </>
    );
    const pageBiometric = () => (
        <>
            <Callout icon="info-sign">
                <div dangerouslySetInnerHTML={{ __html: t("vault-settings.biometric.description") }} />
            </Callout>
            {state === VaultSourceStatus.Unlocked && (
                <>
                    <FormGroup label={t("vault-settings.biometric.enable-password-prompt-timeout.label")} helperText={t("vault-settings.biometric.enable-password-prompt-timeout.helper")}>
                        <NumericInput
                            allowNumericCharactersOnly
                            min={0}
                            value={settings.biometricForcePasswordMaxInterval}
                            placeholder={t("vault-settings.biometric.enable-password-prompt-timeout.placeholder")}
                            onValueChange={(valueAsNumber: number, valueAsString: string) => {
                                setSettings({
                                    ...naiveClone(settings),
                                    biometricForcePasswordMaxInterval: valueAsString
                                })
                            }}
                        />
                    </FormGroup>
                    <FormGroup label={t("vault-settings.biometric.enable-password-prompt-count.label")} helperText={t("vault-settings.biometric.enable-password-prompt-count.helper")}>
                        <NumericInput
                            allowNumericCharactersOnly
                            min={0}
                            onValueChange={(valueAsNumber: number, valueAsString: string) => {
                                setSettings({
                                    ...naiveClone(settings),
                                    biometricForcePasswordCount: valueAsString
                                })
                            }}
                            placeholder={t("vault-settings.biometric.enable-password-prompt-count.placeholder")}
                            value={settings.biometricForcePasswordCount}
                        />
                    </FormGroup>
                </>
            ) || (
                <ContentNotice>
                    <ContentNoticeIcon icon="disable" />
                    <span>{t("vault-settings.not-unlocked")}</span>
                </ContentNotice>
            )}
        </>
    )
    const pagePassword = () => (
        <>
            <Callout icon="warning-sign" intent={Intent.WARNING}>
                <div dangerouslySetInnerHTML={{ __html: t("vault-settings.password.description") }} />
            </Callout>
            {state === VaultSourceStatus.Unlocked && (
                <ContentNotice>
                    <FormGroup label={t("vault-settings.password.current")}>
                        <InputGroup
                            autoComplete="off"
                            onChange={(evt: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(evt.target.value)}
                            type="password"
                            value={currentPassword}
                        />
                    </FormGroup>
                    <FormGroup label={t("vault-settings.password.new")}>
                        <InputGroup
                            autoComplete="new-password"
                            onChange={(evt: React.ChangeEvent<HTMLInputElement>) => setNewPassword(evt.target.value)}
                            type="password"
                            value={newPassword}
                        />
                    </FormGroup>
                    <FormGroup
                        helperText={passwordsMismatch ? t("vault-settings.password.mismatch") : undefined}
                        intent={passwordsMismatch ? Intent.DANGER : Intent.NONE}
                        label={t("vault-settings.password.confirm")}
                    >
                        <InputGroup
                            autoComplete="new-password"
                            intent={passwordsMismatch ? Intent.DANGER : Intent.NONE}
                            onChange={(evt: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(evt.target.value)}
                            type="password"
                            value={confirmPassword}
                        />
                    </FormGroup>
                    <Button
                        disabled={!canChangePassword}
                        icon="key"
                        intent={Intent.DANGER}
                        onClick={() => setPromptPasswordChange(true)}
                        text={t("vault-settings.password.change-button")}
                    />
                </ContentNotice>
            ) || (
                <ContentNotice>
                    <ContentNoticeIcon icon="disable" />
                    <span>{t("vault-settings.not-unlocked")}</span>
                </ContentNotice>
            )}
        </>
    );
    return (
        <Fragment>
            <DialogFreeWidth isOpen={!!showSettingsState.get()} onClose={close}>
                <div className={Classes.DIALOG_HEADER}>{t("vault-settings.title", { title: vaultName || "" })}</div>
                <div className={Classes.DIALOG_BODY}>
                    {showSettingsState.get() && (
                        <SettingsContent>
                            <SettingsSidebar>
                                <SettingsMenu
                                    alignText={Alignment.LEFT}
                                    vertical
                                >
                                    <Button
                                        active={currentPage === PAGE_FORMAT}
                                        icon="database"
                                        onClick={() => setCurrentPage(PAGE_FORMAT)}
                                        text={t("vault-settings.format.title")}
                                    />
                                    <Button
                                        active={currentPage === PAGE_BACKUP}
                                        icon="duplicate"
                                        onClick={() => setCurrentPage(PAGE_BACKUP)}
                                        text={t("vault-settings.backup.title")}
                                    />
                                    <Button
                                        active={currentPage === PAGE_BIOMETRIC}
                                        icon="desktop"
                                        onClick={() => setCurrentPage(PAGE_BIOMETRIC)}
                                        text={t("vault-settings.biometric.title")}
                                    />
                                    <Button
                                        active={currentPage === PAGE_PASSWORD}
                                        icon="key"
                                        onClick={() => setCurrentPage(PAGE_PASSWORD)}
                                        text={t("vault-settings.password.title")}
                                    />
                                </SettingsMenu>
                            </SettingsSidebar>
                            <PageContent>
                                {currentPage === PAGE_FORMAT && pageFormat()}
                                {currentPage === PAGE_BACKUP && pageBackup()}
                                {currentPage === PAGE_BIOMETRIC && pageBiometric()}
                                {currentPage === PAGE_PASSWORD && pagePassword()}
                            </PageContent>
                        </SettingsContent>
                    )}
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Button
                            disabled={!dirty}
                            intent={Intent.PRIMARY}
                            onClick={() => save()}
                            title={t("preferences.button.save-title")}
                        >
                            {t("preferences.button.save")}
                        </Button>
                        <Button
                            onClick={close}
                            title={t("preferences.button.cancel-title")}
                        >
                            {t("preferences.button.cancel")}
                        </Button>
                    </div>
                </div>
            </DialogFreeWidth>
            <ConfirmDialog
                confirmIntent={Intent.DANGER}
                onClose={(confirmed: boolean) => {
                    if (confirmed) {
                        changeFormatToB();
                    }
                    setPromptFormatB(false);
                }}
                open={promptFormatB}
                title={t("vault-settings.format.confirm-title")}
            >
                <p>{t("vault-settings.format.confirm-body")}</p>
            </ConfirmDialog>
            <ConfirmDialog
                confirmIntent={Intent.DANGER}
                confirmText={t("vault-settings.password.change-button")}
                onClose={(confirmed: boolean) => {
                    setPromptPasswordChange(false);
                    if (confirmed) {
                        changePassword();
                    }
                }}
                open={promptPasswordChange}
                title={t("vault-settings.password.confirm-title")}
            >
                <p>{t("vault-settings.password.confirm-body")}</p>
            </ConfirmDialog>
        </Fragment>
    );
}
