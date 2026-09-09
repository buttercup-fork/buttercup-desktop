import React, { useCallback, useMemo, useRef } from "react";
import { Allotment } from "allotment";
import styled from "styled-components";
import { EntriesList } from "./EntriesList";
import { EntryDetails } from "./EntryDetails";
import { GroupsList } from "./GroupsList";

import "./styles/vault-ui.sass";

const SPLIT_SIZES_KEY = "bcup:vault-split-sizes";
const PANE_COUNT = 3;
const MIN_VALID_PANE = 20;

const GridWrapper = styled.div`
    position: relative;
    height: 100%;
`;

function readSavedSizes(): Array<number> | undefined {
    try {
        const raw = window.localStorage.getItem(SPLIT_SIZES_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        if (
            Array.isArray(parsed) &&
            parsed.length === PANE_COUNT &&
            parsed.every((size) => Number.isFinite(size) && size >= MIN_VALID_PANE)
        ) {
            return parsed;
        }
    } catch (err) {
        /* ignore malformed / unavailable storage */
    }
    return undefined;
}

export const VaultUI = () => {
    // Read once on mount; allotment treats these as proportions, so the ratio is
    // what persists across window sizes (upstream #1367).
    const defaultSizes = useMemo(readSavedSizes, []);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleChange = useCallback((sizes: Array<number>) => {
        if (
            sizes.length !== PANE_COUNT ||
            !sizes.every((size) => Number.isFinite(size) && size >= MIN_VALID_PANE)
        ) {
            return;
        }
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            try {
                window.localStorage.setItem(SPLIT_SIZES_KEY, JSON.stringify(sizes));
            } catch (err) {
                /* ignore unavailable storage */
            }
        }, 400);
    }, []);

    return (
        <GridWrapper>
            <Allotment defaultSizes={defaultSizes} onChange={handleChange}>
                <Allotment.Pane>
                    <GroupsList />
                </Allotment.Pane>
                <Allotment.Pane className="split-pane-entries">
                    <EntriesList />
                </Allotment.Pane>
                <Allotment.Pane className="split-pane-entry-details">
                    <EntryDetails />
                </Allotment.Pane>
            </Allotment>
        </GridWrapper>
    );
};
