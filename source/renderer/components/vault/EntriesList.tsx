import React, { useContext, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { HotKeys } from "react-hotkeys";
import { NonIdealState } from "@blueprintjs/core";
import { Entry } from "./Entry";
import { useCurrentEntries, useGroups } from "./hooks/vault";
import { PaneContainer, PaneHeader, PaneContent, PaneFooter } from "./Pane";
import AddEntry from "./AddEntry";
import { VaultContext } from "./VaultContext";
import { getFacadeField } from "./utils/ui";
import { t } from "../../../shared/i18n/trans";
import { copyText } from "../../actions/clipboard";
import { notifyCopied } from "../../services/notifications";

interface EntriesListProps {
    className?: string;
}

export const EntriesList = ({ className }: EntriesListProps) => {
    const {
        entries,
        selectedEntryID,
        onSelectEntry,
        filters,
        onEntriesFilterTermChange,
        onEntriesFilterSortModeChange
    } = useCurrentEntries();
    const { onUserCopy, readOnly } = useContext(VaultContext);
    const { selectedGroupID, trashSelected } = useGroups();
    const ref = useRef<HTMLInputElement | null>(null);
    // react-hotkeys captures the handler closures when the list first gains focus
    // and does not refresh them on re-render (no `allowChanges`). Closing over
    // `entries` / `selectedEntryID` directly therefore makes a hotkey act on the
    // *previously* selected entry (buttercup/buttercup-desktop#1384). Read the
    // live values through a ref so the captured handlers always see current state.
    const liveRef = useRef({ entries, selectedEntryID, onSelectEntry });
    liveRef.current = { entries, selectedEntryID, onSelectEntry };
    // Keyboard navigation changes the selection first; the matching row's DOM node
    // only exists after the re-render, so focus is moved here (not inline in the
    // handler, where `ref.current` still points at the previously selected row -
    // which is what made Enter jump the selection back to that row).
    const pendingRowFocusRef = useRef(false);
    useEffect(() => {
        if (!pendingRowFocusRef.current) return;
        pendingRowFocusRef.current = false;
        if (ref.current) {
            ref.current.focus();
        }
    }, [selectedEntryID]);
    const selectRow = (entryID: string) => {
        const { selectedEntryID, onSelectEntry } = liveRef.current;
        if (entryID === selectedEntryID) {
            // Selection unchanged: the row is already rendered, so the effect
            // above won't run - focus it directly.
            if (ref.current) {
                ref.current.focus();
            }
            return;
        }
        pendingRowFocusRef.current = true;
        onSelectEntry(entryID);
    };
    const keyMap = {
        arrowUp: "up",
        arrowDown: "down",
        enter: "enter",
        copyUsername: ["ctrl+b", "command+b"],
        copyPassword: ["ctrl+c", "command+c"]
    };
    const handleNavigation = (event, step) => {
        event.preventDefault();
        const { entries, selectedEntryID } = liveRef.current;
        if (entries.length === 0) return;
        const currentIndex = entries.findIndex((entry) => entry.id === selectedEntryID);
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextEntry =
            step < 0
                ? entries[baseIndex === 0 ? entries.length - 1 : baseIndex - 1]
                : entries[(baseIndex + 1) % entries.length];
        selectRow(nextEntry.id);
    };
    const getSelectedEntry = () => {
        const { entries, selectedEntryID } = liveRef.current;
        return entries.find((entry) => entry.id === selectedEntryID) ?? null;
    };
    const copySelectedField = (property: "username" | "password") => {
        const entry = getSelectedEntry();
        if (!entry) return;
        const value = getFacadeField(entry, property);
        if (!value) return;
        // Use the native clipboard via IPC rather than the execCommand textarea
        // hack, which steals and then drops DOM focus - that left the entries
        // list unfocused so the *next* shortcut press was ignored (and beeped).
        copyText(value);
        notifyCopied(
            property === "username"
                ? t("notification.copied-username")
                : t("notification.copied-password")
        );
        if (onUserCopy) {
            onUserCopy(value);
        }
    };
    const handlers = {
        arrowUp: (event) => handleNavigation(event, -1),
        arrowDown: (event) => handleNavigation(event, 1),
        enter: (event) => {
            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }
            const { entries, selectedEntryID } = liveRef.current;
            const entry =
                (selectedEntryID && entries.find((e) => e.id === selectedEntryID)) || entries[0];
            if (!entry) return;
            selectRow(entry.id);
        },
        copyUsername: (e) => {
            e.preventDefault();
            copySelectedField("username");
        },
        copyPassword: (e) => {
            e.preventDefault();
            copySelectedField("password");
        }
    };

    return (
        <PaneContainer className={className}>
            <PaneHeader
                title={
                    trashSelected
                        ? t("vault-ui.entries-list.trash")
                        : t("vault-ui.entries-list.documents")
                }
                count={entries.length}
                filter={filters}
                onTermChange={(term) => onEntriesFilterTermChange(term)}
                onSortModeChange={(sortMode) => onEntriesFilterSortModeChange(sortMode)}
            />
            <PaneContent>
                {entries.length > 0 && (
                    <HotKeys keyMap={keyMap} handlers={handlers} tabIndex={1}>
                        {entries.map((entry, entryIndex) => (
                            <Entry
                                tabIndex={entryIndex + 2}
                                entry={entry}
                                key={entry.id}
                                onClick={(e) => onSelectEntry(entry.id)}
                                selected={selectedEntryID === entry.id}
                                innerRef={(el) => {
                                    if (selectedEntryID === entry.id) {
                                        ref.current = el;
                                    }
                                }}
                            />
                        ))}
                    </HotKeys>
                )}
                {entries.length === 0 && filters.term !== "" && (
                    <NonIdealState title={t("vault-ui.entries-list.filters-no-matches")} />
                )}
                {entries.length === 0 && trashSelected && (
                    <NonIdealState title={t("vault-ui.entries-list.trash-empty")} icon="trash" />
                )}
                {entries.length === 0 && !filters.term && !trashSelected && (
                    <NonIdealState
                        title={t("vault-ui.entries-list.no-entries")}
                        description={t("vault-ui.entries-list.create-one-cta")}
                        icon="id-number"
                    />
                )}
            </PaneContent>
            <PaneFooter>
                <AddEntry disabled={trashSelected || readOnly || !selectedGroupID} />
            </PaneFooter>
        </PaneContainer>
    );
};
