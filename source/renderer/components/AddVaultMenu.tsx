import * as React from "react";
import styled from "styled-components";
import { Button, Callout, Card, Checkbox, Classes, Dialog, Elevation, FormGroup, InputGroup, Intent, Switch } from "@blueprintjs/core";
import { useState as useHookState } from "@hookstate/core";
import path from "path-posix";
import { FileSystemInterface } from "@buttercup/file-interface";
import { SHOW_ADD_VAULT } from "../state/addVault";
import { setBusy } from "../state/app";
import { authDropbox } from "../actions/dropbox";
import { testWebDAV } from "../actions/webdav";
import { getFSInstance } from "../library/fsInterface";
import { FileChooser } from "./standalone/FileChooser";
import { addNewVaultTarget, getFileVaultParameters } from "../actions/addVault";
import { showError, showSuccess } from "../services/notifications";
import { authenticateGoogleDrive, getGoogleDriveAuthURL, waitForGoogleAuthCode } from "../services/authGoogle";
import { createEmptyVault as createEmptyGoogleDriveVault } from "../services/googleDrive";
import { showWarning } from "../services/notifications";
import { getIconForProvider } from "../library/icons";
import { getThemeProp } from "./vault/utils/theme";
import { copyText } from "../actions/clipboard";
import { t } from "../../shared/i18n/trans";
import { isInsecureWebDAVURL } from "../../shared/library/webdav";
import {
    checkNewMasterPassword,
    MASTER_PASSWORD_MIN_LENGTH,
    MASTER_PASSWORD_RECOMMENDED_LENGTH
} from "../../shared/library/masterPasswordPolicy";
import { DatasourceConfig, SourceType } from "../types";

interface WebDAVCredentialsState {
    url: string;
    username: string;
    password: string;
}

const { Fragment, useCallback, useEffect, useState } = React;

const EMPTY_DATASOURCE_CONFIG: DatasourceConfig = { type: null };
const EMPTY_WEBDAV_CREDENTIALS: WebDAVCredentialsState = { url: "", username: "", password: "" };
const PAGE_TYPE = "type";
const PAGE_AUTH = "auth";
const PAGE_CHOOSE = "choose";
const PAGE_CONFIRM = "confirm";

const VAULT_TYPES = [
    {
        i18n: "source-type.file",
        type: SourceType.File,
        icon: getIconForProvider(SourceType.File)
    },
    {
        i18n: "source-type.dropbox",
        type: SourceType.Dropbox,
        icon: getIconForProvider(SourceType.Dropbox)
    },
    {
        i18n: "source-type.googledrive",
        type: SourceType.GoogleDrive,
        icon: getIconForProvider(SourceType.GoogleDrive)
    },
    {
        i18n: "source-type.webdav",
        type: SourceType.WebDAV,
        icon: getIconForProvider(SourceType.WebDAV),
        // A black logo on transparent: drawn in the theme's colour (B-717)
        monochrome: true
    }
];

const DialogFreeWidth = styled(Dialog)`
    width: auto !important;
`;
const LoadingContainer = styled.div`
    width: 460px;
    height: 300px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
`;
const TypeIcons = styled.div`
    margin: 18px 30px;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
`;
const TypeIcon = styled(Card)`
    flex: 0 0 auto;
    width: 110px;
    margin: 8px;
    padding: 5px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;
const TypeIconImage = styled.img`
    width: 80%;
    height: auto;
`;
// The logo's shape as a mask, filled with the theme colour
const TypeIconMask = styled.div<{ $src: string }>`
    width: 80%;
    aspect-ratio: 1;
    background-color: ${p => getThemeProp(p, "addVault.webdavLogo")};
    mask: url("${p => p.$src}") center / contain no-repeat;
`;
const TypeText = styled.div`
    margin-top: 3px;
    width: 100%;
    text-align: center;
    color: grey;
`;
// Fixed width: the dialog sizes to its content, so a changing rule message would resize it
const PasswordFormGroup = styled(FormGroup)`
    width: 320px;
`;
const WideFormGroup = styled(FormGroup)`
    display: flex;
    justify-content: center;
    input {
        width: 350px !important;
    }
    label {
        width: 130px !important;
    }
`;
// As wide as a label plus its input in the WebDAV form above
const InsecureCallout = styled(Callout)`
    max-width: 480px;
    margin: 0 auto 15px;
    p {
        margin-bottom: 10px;
    }
`;

export function AddVaultMenu() {
    const showAddVault = useHookState(SHOW_ADD_VAULT);
    const [previousShowAddVault, setPreviousShowAddVault] = useState(false);
    const [currentPage, setCurrentPage] = useState(PAGE_TYPE);
    const [selectedType, setSelectedType] = useState<SourceType | null>(null);
    const [selectedRemotePath, setSelectedRemotePath] = useState<string | null>(null);
    const [datasourcePayload, setDatasourcePayload] = useState<DatasourceConfig>({ ...EMPTY_DATASOURCE_CONFIG });
    const [fsInstance, setFsInstance] = useState<FileSystemInterface | null>(null);
    const [createNew, setCreateNew] = useState(false);
    const [vaultPassword, setVaultPassword] = useState("");
    const [webdavCredentials, setWebDAVCredentials] = useState<WebDAVCredentialsState>({ ...EMPTY_WEBDAV_CREDENTIALS });
    // B-684: plain http to another computer sends the WebDAV password in clear
    // text, so it needs the user's explicit OK before anything is sent
    const [allowInsecureWebDAV, setAllowInsecureWebDAV] = useState(false);
    const webdavInsecure = isInsecureWebDAVURL(webdavCredentials.url);
    const [authenticatingGoogleDrive, setAuthenticatingGoogleDrive] = useState(false);
    const [vaultFilenameOverride, setVaultFilenameOverride] = useState<string | null>(null);
    useEffect(() => {
        const newValue = showAddVault.get();
        if (previousShowAddVault !== newValue) {
            setPreviousShowAddVault(showAddVault.get());
            if (newValue) {
                setCurrentPage(PAGE_TYPE);
            }
        }
    }, [showAddVault.get(), previousShowAddVault]);
    const close = useCallback(() => {
        showAddVault.set(false);
        setFsInstance(null);
        setCurrentPage(PAGE_TYPE);
        setDatasourcePayload({ ...EMPTY_DATASOURCE_CONFIG });
        setWebDAVCredentials({ ...EMPTY_WEBDAV_CREDENTIALS });
        setAllowInsecureWebDAV(false);
        setVaultPassword("");
        setAuthenticatingGoogleDrive(false);
        setVaultFilenameOverride(null);
    }, []);
    // The dialog's built-in Escape-to-close only fires when focus sits inside its
    // React subtree; the vault-type page has nothing focusable, so Escape was
    // dropped. A document-level listener while the dialog is open covers it.
    useEffect(() => {
        if (!showAddVault.get()) return undefined;
        const handleEscape = (evt: KeyboardEvent) => {
            if (evt.key === "Escape") {
                close();
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [showAddVault.get(), close]);
    const handleVaultTypeClick = useCallback(async type => {
        setSelectedType(type);
        if (type === SourceType.File) {
            setCurrentPage(PAGE_AUTH);
            const result = await getFileVaultParameters();
            if (!result) {
                close();
                return;
            }
            const { filename, createNew } = result;
            if (!filename) {
                close();
                return;
            }
            setDatasourcePayload({
                ...datasourcePayload,
                type,
                path: filename
            });
            setCreateNew(createNew);
            setCurrentPage(PAGE_CONFIRM);
        } else if (type === SourceType.Dropbox) {
            setBusy(true);
            setCurrentPage(PAGE_AUTH);
            const token = await authDropbox();
            setBusy(false);
            if (!token) {
                close();
                return;
            }
            setDatasourcePayload({
                ...datasourcePayload,
                type,
                token
            });
            setFsInstance(getFSInstance(type, { token }));
            setCurrentPage(PAGE_CHOOSE);
        } else if (type === SourceType.GoogleDrive) {
            setDatasourcePayload({
                ...datasourcePayload,
                type
            });
            setCurrentPage(PAGE_AUTH);
        } else if (type === SourceType.WebDAV) {
            setDatasourcePayload({
                ...datasourcePayload,
                type
            });
            setCurrentPage(PAGE_AUTH);
        }
    }, [datasourcePayload]);
    const handleAuthSubmit = useCallback(async () => {
        if (selectedType === SourceType.GoogleDrive) {
            try {
                const { accessToken, refreshToken } = await authenticateGoogleDrive();
                setDatasourcePayload({
                    ...datasourcePayload,
                    token: accessToken,
                    refreshToken
                });
                setFsInstance(getFSInstance(SourceType.GoogleDrive, {
                    token: accessToken
                }));
                setCurrentPage(PAGE_CHOOSE);
            } catch (err) {
                console.error(err);
                showWarning(`${t("add-vault-menu.google-auth-error")}: ${err.message}`);
                setAuthenticatingGoogleDrive(false);
            }
        } else if (selectedType === SourceType.WebDAV) {
            // Checked before the connection test and the file chooser, which
            // both send the password
            if (webdavInsecure && !allowInsecureWebDAV) {
                showError(t("add-vault-menu.loader.webdav-auth.insecure-blocked"));
                return;
            }
            setBusy(true);
            try {
                await testWebDAV(webdavCredentials.url, webdavCredentials.username, webdavCredentials.password);
            } catch (err) {
                showError(err.message);
                setBusy(false);
                return;
            }
            setBusy(false);
            const newPayload: { endpoint: string; allowInsecure?: boolean } = {
                endpoint: webdavCredentials.url
            };
            if (webdavInsecure) {
                newPayload.allowInsecure = true;
            }
            if (webdavCredentials.username && webdavCredentials.password) {
                Object.assign(newPayload, {
                    username: webdavCredentials.username,
                    password: webdavCredentials.password
                });
            }
            setDatasourcePayload({
                ...datasourcePayload,
                ...newPayload
            });
            setFsInstance(getFSInstance(SourceType.WebDAV, newPayload));
            setCurrentPage(PAGE_CHOOSE);
        }
    }, [selectedType, datasourcePayload, webdavCredentials, webdavInsecure, allowInsecureWebDAV]);
    const handleAuthURLCopy = useCallback(async () => {
        if (selectedType === SourceType.GoogleDrive) {
            try {
                await copyText(await getGoogleDriveAuthURL());
                showSuccess(t("add-vault-menu.copy-auth-link.url-copied"));
            } catch (err) {
                showError(err.message);
                return;
            }
            try {
                const { accessToken, refreshToken } = await waitForGoogleAuthCode();
                setDatasourcePayload({
                    ...datasourcePayload,
                    token: accessToken,
                    refreshToken
                });
                setFsInstance(getFSInstance(SourceType.GoogleDrive, {
                    token: accessToken
                }));
                setCurrentPage(PAGE_CHOOSE);
            } catch (err) {
                console.error(err);
                showWarning(`${t("add-vault-menu.google-auth-error")}: ${err.message}`);
                setAuthenticatingGoogleDrive(false);
            }
        }
    }, [selectedType, datasourcePayload]);
    const handleSelectedPathChange = useCallback((parentIdentifier: string | number | null, identifier: string, isNew: boolean, fileName: string | null) => {
        if (selectedType === SourceType.GoogleDrive) {
            setSelectedRemotePath(JSON.stringify([parentIdentifier, identifier]));
            setVaultFilenameOverride(fileName);
        } else {
            if (!identifier) {
                setSelectedRemotePath(null);
            } else {
                setSelectedRemotePath(path.join(parentIdentifier || "/", identifier));
            }
        }
        setCreateNew(isNew);
    }, [selectedType]);
    const handleVaultFileSelect = useCallback(() => {
        if (selectedType === SourceType.Dropbox) {
            setDatasourcePayload({
                ...datasourcePayload,
                path: selectedRemotePath
            });
            setCurrentPage(PAGE_CONFIRM);
        } else if (selectedType === SourceType.GoogleDrive) {
            // We don't set the Google Drive datasource properties yet because we don't know
            // if we need to create a new file or not. Google Drive uses file IDs and not
            // names, so the data in state potentially isn't correct yet.
            setCurrentPage(PAGE_CONFIRM);
        } else if (selectedType ===  SourceType.WebDAV) {
            setDatasourcePayload({
                ...datasourcePayload,
                path: selectedRemotePath
            });
            setCurrentPage(PAGE_CONFIRM);
        }
    }, [selectedRemotePath, selectedType, datasourcePayload]);
    // Rules for a new vault's password (B-758); an existing vault keeps its own
    const newPasswordProblem = createNew ? checkNewMasterPassword(vaultPassword) : null;
    const canConfirm = vaultPassword.length > 0 && !newPasswordProblem;
    const handleFinalConfirm = useCallback(async () => {
        // Before anything is created: a new Google Drive vault is written from here
        if (vaultPassword.length === 0 || (createNew && checkNewMasterPassword(vaultPassword))) return;
        const datasource = { ...datasourcePayload };
        if (selectedType === SourceType.GoogleDrive && selectedRemotePath && datasource.token) {
            const [parentIdentifier, identifier] = JSON.parse(selectedRemotePath);
            datasource.fileID = createNew
                ? await createEmptyGoogleDriveVault(datasource.token as string, parentIdentifier, identifier, vaultPassword)
                : identifier;
        }
        addNewVaultTarget(datasource, vaultPassword, createNew, vaultFilenameOverride);
        close(); // This also clears sensitive state items
    }, [datasourcePayload, vaultPassword, selectedType, selectedRemotePath, createNew]);
    // Pages
    const pageType = () => (
        <>
            <p>{t("add-vault-menu.choose-type-prompt")}</p>
            <TypeIcons>
                {VAULT_TYPES.map(vaultType => (
                    <TypeIcon key={vaultType.type} interactive elevation={Elevation.TWO} onClick={() => handleVaultTypeClick(vaultType.type)}>
                        {vaultType.monochrome ? (
                            <TypeIconMask $src={vaultType.icon} aria-hidden="true" />
                        ) : (
                            <TypeIconImage src={vaultType.icon} />
                        )}
                        <TypeText>{t(vaultType.i18n)}</TypeText>
                    </TypeIcon>
                ))}
            </TypeIcons>
        </>
    );
    const pageAuth = () => (
        <>
            {selectedType === SourceType.File && (
                <LoadingContainer>
                    <i>{t("add-vault-menu.loader.file-prompt")}</i>
                </LoadingContainer>
            )}
            {selectedType === SourceType.Dropbox && (
                <LoadingContainer>
                    <i>{t("add-vault-menu.loader.dropbox-auth")}</i>
                </LoadingContainer>
            )}
            {selectedType === SourceType.GoogleDrive && (
                <>
                    <p dangerouslySetInnerHTML={{ __html: t("add-vault-menu.loader.google-auth.instr-1") }} />
                    <p dangerouslySetInnerHTML={{ __html: t("add-vault-menu.loader.google-auth.instr-2") }} />
                    <p dangerouslySetInnerHTML={{ __html: t("add-vault-menu.loader.google-auth.instr-3") }} />
                </>
            )}
            {selectedType === SourceType.WebDAV && (
                <>
                    <WideFormGroup
                        inline
                        label={t("add-vault-menu.loader.webdav-auth.url-label")}
                    >
                        <InputGroup
                            placeholder="https://..."
                            onChange={evt => {
                                setWebDAVCredentials({
                                    ...webdavCredentials,
                                    url: evt.target.value
                                });
                                // An OK given for one address doesn't carry over to another
                                setAllowInsecureWebDAV(false);
                            }}
                            onKeyDown={evt => {
                                if (evt.key === "Enter" && webdavCredentials.url) {
                                    handleAuthSubmit();
                                }
                            }}
                            value={webdavCredentials.url}
                            autoFocus
                        />
                    </WideFormGroup>
                    {webdavInsecure && (
                        <InsecureCallout
                            data-testid="webdav-insecure-warning"
                            intent={Intent.WARNING}
                            title={t("add-vault-menu.loader.webdav-auth.insecure-title")}
                        >
                            <p>{t("add-vault-menu.loader.webdav-auth.insecure-warning")}</p>
                            <Checkbox
                                checked={allowInsecureWebDAV}
                                label={t("add-vault-menu.loader.webdav-auth.insecure-allow")}
                                onChange={evt => setAllowInsecureWebDAV((evt.target as HTMLInputElement).checked)}
                            />
                        </InsecureCallout>
                    )}
                    <WideFormGroup
                        inline
                        label={t("add-vault-menu.loader.webdav-auth.username-label")}
                    >
                        <InputGroup
                            placeholder={t("add-vault-menu.loader.webdav-auth.username-plc")}
                            onChange={evt => setWebDAVCredentials({
                                ...webdavCredentials,
                                username: evt.target.value
                            })}
                            value={webdavCredentials.username}
                        />
                    </WideFormGroup>
                    <WideFormGroup
                        inline
                        label={t("add-vault-menu.loader.webdav-auth.password-label")}
                    >
                        <InputGroup
                            placeholder={t("add-vault-menu.loader.webdav-auth.password-plc")}
                            onChange={evt => setWebDAVCredentials({
                                ...webdavCredentials,
                                password: evt.target.value
                            })}
                            onKeyDown={evt => {
                                if (evt.key === "Enter" && webdavCredentials.url) {
                                    handleAuthSubmit();
                                }
                            }}
                            type="password"
                            value={webdavCredentials.password}
                        />
                    </WideFormGroup>
                </>
            )}
        </>
    );
    const pageChoose = () => (
        <>
            <p>{t("add-vault-menu.choose-file-prompt")}</p>
            <FileChooser
                allowUpload={selectedType === SourceType.GoogleDrive}
                callback={handleSelectedPathChange}
                fsInterface={fsInstance}
            />
        </>
    );
    const pageConfirm = () => (
        <>
            {createNew && (
                <p>{t("add-vault-menu.confirm.new-password")}</p>
            )}
            {!createNew && (
                <p>{t("add-vault-menu.confirm.existing-password")}</p>
            )}
            <PasswordFormGroup
                helperText={
                    createNew ? (
                        <span id="new-password-rules" data-testid="new-password-rules">
                            {newPasswordProblem === "common" && vaultPassword.length > 0
                                ? t("master-password-policy.common")
                                : t("master-password-policy.hint", {
                                      min: MASTER_PASSWORD_MIN_LENGTH,
                                      recommended: MASTER_PASSWORD_RECOMMENDED_LENGTH
                                  })}
                        </span>
                    ) : undefined
                }
                intent={newPasswordProblem === "common" ? Intent.DANGER : Intent.NONE}
            >
                <InputGroup
                    id="password"
                    aria-describedby={createNew ? "new-password-rules" : undefined}
                    intent={newPasswordProblem === "common" ? Intent.DANGER : Intent.NONE}
                    placeholder={t("add-vault-menu.confirm.password-placeholder")}
                    type="password"
                    value={vaultPassword}
                    onChange={evt => setVaultPassword(evt.target.value)}
                    onKeyDown={evt => {
                        if (evt.key === "Enter" && canConfirm) {
                            handleFinalConfirm();
                        }
                    }}
                    autoFocus
                />
            </PasswordFormGroup>
        </>
    );
    // Output
    return (
        <DialogFreeWidth isOpen={showAddVault.get()} onClose={close}>
            <div className={Classes.DIALOG_HEADER}>{t("add-vault-menu.title")}</div>
            <div className={Classes.DIALOG_BODY}>
                {currentPage === PAGE_TYPE && pageType()}
                {currentPage === PAGE_AUTH && pageAuth()}
                {currentPage === PAGE_CHOOSE && pageChoose()}
                {currentPage === PAGE_CONFIRM && pageConfirm()}
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    {currentPage === PAGE_CHOOSE && (
                        <Button
                            disabled={!selectedRemotePath}
                            intent={Intent.PRIMARY}
                            onClick={handleVaultFileSelect}
                            title={t("add-vault-menu.page-choose-next-title")}
                        >
                            {t("add-vault-menu.page-choose-next")}
                        </Button>
                    )}
                    {currentPage === PAGE_AUTH && selectedType === SourceType.GoogleDrive && (
                        <Fragment>
                            <Button
                                intent={Intent.NONE}
                                onClick={handleAuthURLCopy}
                                title={t("add-vault-menu.copy-auth-link.title")}
                            >
                                {t("add-vault-menu.copy-auth-link.button")}
                            </Button>
                            <Button
                                disabled={authenticatingGoogleDrive}
                                intent={Intent.PRIMARY}
                                onClick={handleAuthSubmit}
                                title={t("add-vault-menu.google-auth-button-title")}
                            >
                                {t("add-vault-menu.google-auth-button")}
                            </Button>
                        </Fragment>
                    )}
                    {currentPage === PAGE_AUTH && selectedType === SourceType.WebDAV && (
                        <Button
                            disabled={!webdavCredentials.url || (webdavInsecure && !allowInsecureWebDAV)}
                            intent={Intent.PRIMARY}
                            onClick={handleAuthSubmit}
                            title={t("add-vault-menu.webdav-continue-title")}
                        >
                            {t("add-vault-menu.webdav-continue")}
                        </Button>
                    )}
                    {currentPage === PAGE_CONFIRM && (
                        <Button
                            disabled={!canConfirm}
                            intent={Intent.PRIMARY}
                            onClick={handleFinalConfirm}
                            title={t("add-vault-menu.page-confirm-finish-title")}
                        >
                            {t("add-vault-menu.page-confirm-finish")}
                        </Button>
                    )}
                    <Button
                        onClick={close}
                        title={t("add-vault-menu.page-confirm-cancel-title")}
                    >
                        {t("add-vault-menu.page-confirm-cancel")}
                    </Button>
                </div>
            </div>
        </DialogFreeWidth>
    );
}
