import React, { useCallback, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import cn from "classnames";
import styled from "styled-components";
import { Colors, Intent } from "@blueprintjs/core";
import { VaultSourceID, VaultSourceStatus } from "buttercup";
import { useSingleState } from "react-obstate";
import { VaultEditor } from "./VaultEditor";
import { VaultSearchManager } from "./search/VaultSearchManager";
import { SearchProvider } from "./search/SearchContext";
import { ConfirmDialog } from "./prompt/ConfirmDialog";
import { VAULTS_STATE } from "../state/vaults";
import { showAddVaultMenu } from "../state/addVault";
import { handleError } from "../actions/error";
import { useTheme } from "../hooks/theme";
import { ErrorBoundary } from "./ErrorBoundary";
import { Tab, VaultTabs } from "./navigation/VaultTabs";
import { setVaultSourcesOrder } from "../actions/vaultOrder";
import { removeVaultSource } from "../actions/removeVault";
import { unlockVaultSource } from "../actions/unlockVault";
import { logErr } from "../library/log";
import { t } from "../../shared/i18n/trans";
import { showSuccess } from "../services/notifications";
import { lockVaultSource } from "../actions/lockVault";
import { Theme } from "../types";

const PrimaryContainer = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: stretch;
`;
const ContentContainer = styled.div`
    margin-top: 1px;
    flex: 10 10 auto;
    height: 100%;
`;
// @buttercup/ui's <Tabs> only paints a background behind the tabs/add-button
// themselves, not the full width of its (flex-stretched) container - leaving
// a strip of unpainted background visible to the right of the last tab.
// Matching that background here removes the seam regardless of tab count.
const TabBarBackground = styled.div`
    background-color: ${Colors.LIGHT_GRAY4};

    &.bp4-dark {
        background-color: ${Colors.DARK_GRAY1};
    }
`;

export function VaultManagement() {
    const { id = null } = useParams();
    const history = useHistory();
    const themeType = useTheme();
    const [removingSourceID, setRemovingSourceID] = useState<VaultSourceID | null>(null);
    const [currentTitle, setCurrentTitle] = useState<VaultSourceID | null>(null);
    const [vaults] = useSingleState(VAULTS_STATE, "vaultsList");
    const [, setCurrentVault] = useSingleState(VAULTS_STATE, "currentVault");
    const handleSourceUnlockRequest = useCallback((sourceID: VaultSourceID) => {
        const vault = vaults.find(vault => vault.id === sourceID);
        if (!vault) return;
        if (vault.state === VaultSourceStatus.Locked) {
            unlockVaultSource(sourceID).catch(handleError);
        }
    }, [vaults]);
    const handleSourceAdd = useCallback(() => {
        showAddVaultMenu(true);
    }, [history]);
    const handleSourceLock = useCallback((sourceID: VaultSourceID) => {
        const vault = vaults.find(vault => vault.id === sourceID);
        if (!vault) return;
        if (vault.state === VaultSourceStatus.Unlocked) {
            lockVaultSource(sourceID).catch(handleError);
        }
    }, [vaults]);
    const handleSourceSelect = useCallback((sourceID: VaultSourceID) => {
        history.push(`/source/${sourceID}`);
        setCurrentVault(sourceID);
    }, [history, id, setCurrentVault]);
    // Keep the active vault in sync with the route, so arriving here from the
    // tray / app menu (which navigate without going through a tab click) still
    // points the rest of the app - password prompt, facade updates - at the
    // right vault.
    useEffect(() => {
        if (id) {
            setCurrentVault(id);
        }
    }, [id, setCurrentVault]);
    // Ctrl/Cmd+Tab (and Ctrl/Cmd+PageDown / +PageUp) cycle through the vault tabs.
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
            let delta = 0;
            if (event.key === "Tab") {
                delta = event.shiftKey ? -1 : 1;
            } else if (event.key === "PageDown") {
                delta = 1;
            } else if (event.key === "PageUp") {
                delta = -1;
            } else {
                return;
            }
            if (vaults.length < 2) return;
            event.preventDefault();
            const currentIndex = Math.max(vaults.findIndex(vault => vault.id === id), 0);
            const nextIndex = (currentIndex + delta + vaults.length) % vaults.length;
            handleSourceSelect(vaults[nextIndex].id);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [vaults, id, handleSourceSelect]);
    const handleSourcesReoder = useCallback((newTabsOrder: Array<Tab>) => {
        setVaultSourcesOrder(newTabsOrder.map(tab => tab.id)).catch(err => {
            logErr("Failed reordering vaults", err);
        });
    }, []);
    const handleSourceRemove = useCallback((sourceID: VaultSourceID) => {
        setRemovingSourceID(sourceID);
        setCurrentTitle(vaults.find(source => source.id === sourceID)?.name ?? "");
    }, [vaults]);
    const handleSourceRemoveConfirm = useCallback((remove: boolean) => {
        if (remove && removingSourceID) {
            removeVaultSource(removingSourceID)
                .then(() => {
                    showSuccess(t("notification.vault-removed", { name: currentTitle }));
                })
                .catch(err => {
                    logErr("Failed removing source", err);
                });
        }
        setRemovingSourceID(null);
        setCurrentTitle(null);
    }, [removingSourceID]);
    return (
        <PrimaryContainer>
            <SearchProvider>
                <TabBarBackground className={cn({
                    "bp4-dark": themeType === Theme.Dark
                })}>
                    <VaultTabs
                        onAddVault={handleSourceAdd}
                        onLockVault={handleSourceLock}
                        onRemoveVault={handleSourceRemove}
                        onReorder={handleSourcesReoder}
                        onSelectVault={handleSourceSelect}
                        onUnlockVault={handleSourceUnlockRequest}
                        sourceID={id}
                    />
                </TabBarBackground>
                <ContentContainer className={cn({
                    "bp4-dark": themeType === Theme.Dark
                })}>
                    {id && (
                        <ErrorBoundary>
                            {id && (
                                <VaultEditor onUnlockRequest={() => handleSourceUnlockRequest(id)} sourceID={id} />
                            )}
                        </ErrorBoundary>
                    )}
                </ContentContainer>
                <VaultSearchManager sourceID={id} />
            </SearchProvider>
            <ConfirmDialog
                cancelText={t("vault-management.remove-vault-dialog.cancel-button")}
                confirmText={t("vault-management.remove-vault-dialog.remove-button")}
                confirmIntent={Intent.WARNING}
                onClose={handleSourceRemoveConfirm}
                open={!!removingSourceID}
                title={t("vault-management.remove-vault-dialog.title")}
            >
                {t("vault-management.remove-vault-dialog.description", { title: currentTitle })}
            </ConfirmDialog>
        </PrimaryContainer>
    );
}
