import { BrowserWindow } from "electron";
import {
    AttachmentDetails,
    AttachmentManager,
    consumeVaultFacade,
    createVaultFacade,
    Credentials,
    Entry,
    EntryID,
    EntryType,
    GroupID,
    TextDatasource,
    Vault,
    VaultFacade,
    VaultFormatID,
    VaultManager,
    VaultSource,
    VaultSourceID,
    VaultSourceStatus,
    init
} from "buttercup";
import { exportVaultToCSV } from "@buttercup/exporter";
import { describeSource } from "../library/sources";
import { getVaultLocationKey } from "../library/vaultLocation";
import { clearFacadeCache } from "./facades";
import { notifyWindowsOfSourceUpdate } from "./windows";
import { getVaultCacheStorage, getVaultStorage } from "./storage";
import { updateSearchCaches } from "./search";
import { setAutoLockSuspended, startAutoVaultLockTimer } from "./autoLock";
import { logErr, logInfo } from "../library/log";
import { attachSourceEncryptedListeners } from "./backup";
import { extractVaultOTPItems } from "../library/otp";
import { isDamagedVaultError } from "../library/vaultErrors";
import { offerOfflineCopyRestore } from "./damagedVault";
import { t } from "../../shared/i18n/trans";
import { OTP, SourceType, VaultSourceDescription } from "../types";

// Latest edit per vault that isn't saved yet. Core's `format.dirty` can't tell
// us: Format B vaults don't set it for regular edits.
const __unsavedEdits = new Map<VaultSourceID, number>();
let __lastEdit = 0;
const __runningSaves = new Map<VaultSourceID, Promise<void>>();

const __watchedVaultSources: Array<VaultSourceID> = [];
let __vaultManager: VaultManager;

export async function addAttachment(
    sourceID: VaultSourceID,
    entryID: EntryID,
    filename: string,
    type: string,
    data: Buffer
) {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const entry = source.vault.findEntryByID(entryID);
    await source.attachmentManager.setAttachment(
        entry,
        AttachmentManager.newAttachmentID(),
        data,
        filename,
        type
    );
}

export async function addVault(
    name: string,
    sourceCredentials: Credentials,
    passCredentials: Credentials,
    type: SourceType,
    createNew: boolean = false,
    locationKey: string | null = null
): Promise<VaultSourceID> {
    const credsSecure = await sourceCredentials.toSecureString();
    const vaultManager = getVaultManager();
    const source = new VaultSource(name, type, credsSecure, {
        meta: locationKey ? { locationKey } : {}
    });
    await vaultManager.interruptAutoUpdate(async () => {
        await vaultManager.addSource(source);
        await source.unlock(passCredentials, { initialiseRemote: createNew });
        await vaultManager.dehydrateSource(source);
    });
    void startAutoVaultLockTimer();
    return source.id;
}

export async function attachVaultManagerWatchers() {
    const vaultManager = getVaultManager();
    vaultManager.on("autoUpdateFailed", ({ source, error }) => {
        logErr(`Auto update failed for source: ${source.id}`, error);
    });
    vaultManager.on("sourcesUpdated", async () => {
        sendSourcesToWindows();
        vaultManager.unlockedSources.forEach((source) => {
            if (!__watchedVaultSources.includes(source.id)) {
                source.on("updated", () => onVaultSourceUpdated(source));
                __watchedVaultSources.push(source.id);
            }
            attachSourceEncryptedListeners(source);
            storeLocationKey(source).catch((err) =>
                logErr(`Failed storing the location key of source: ${source.id}`, err)
            );
        });
        await updateSearchCaches(vaultManager.unlockedSources);
    });
}

/**
 * The vault already added from the same location, if any (#1172)
 */
export function findSourceByLocationKey(locationKey: string): VaultSourceDescription | null {
    const source = getVaultManager().sources.find((item) => item.meta.locationKey === locationKey);
    return source ? describeSource(source) : null;
}

/**
 * Vaults added before location keys existed get theirs once unlocked, when
 * their datasource (and so their location) is available (#1172)
 */
async function storeLocationKey(source: VaultSource) {
    if (source.meta.locationKey) return;
    // The datasource holds the location: file and WebDAV path, the WebDAV
    // settings, the Google Drive file ID
    const datasource = source._datasource as any;
    if (!datasource) return;
    const locationKey = getVaultLocationKey({
        type: source.type,
        path: datasource.path,
        fileID: datasource.fileID,
        endpoint: datasource._config?.endpoint,
        username: datasource._config?.username
    });
    if (!locationKey) return;
    source._meta = { ...source._meta, locationKey };
    await getVaultManager().dehydrateSource(source);
}

export async function changeSourceMasterPassword(
    sourceID: VaultSourceID,
    currentPassword: string,
    newPassword: string
): Promise<void> {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    logInfo(`changing master password: ${sourceID}`);
    await source.changeMasterPassword(currentPassword, newPassword);
    // The stored source credentials are encrypted with the master password: store them
    // again now rather than waiting on the "updated" event, so a restart can't see the
    // old ones next to a vault that uses the new password
    await vaultManager.dehydrateSource(source);
}

export async function convertVaultFormatAToB(sourceID: VaultSourceID): Promise<void> {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    logInfo(`converting source to format B: ${sourceID}`);
    await source.convert(VaultFormatID.B);
    await source.write();
}

export async function createNewEntry(
    sourceID: VaultSourceID,
    groupID: GroupID,
    type: EntryType,
    properties: Record<string, string>
): Promise<string> {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const group = source.vault.findGroupByID(groupID);
    const title = (properties.title || "").trim() || "Untitled";
    const entry = group.createEntry(title);
    entry.setAttribute(Entry.Attributes.FacadeType, type);
    for (const key in properties) {
        entry.setProperty(key, properties[key]);
    }
    await source.save();
    return entry.id;
}

export async function deleteAttachment(
    sourceID: VaultSourceID,
    entryID: EntryID,
    attachmentID: string
) {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const entry = source.vault.findEntryByID(entryID);
    await source.attachmentManager.removeAttachment(entry, attachmentID);
    await source.save();
}

export async function exportVault(sourceID: VaultSourceID): Promise<string> {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const exported = await exportVaultToCSV(source.vault);
    return exported;
}

/**
 * Encrypt the unlocked vault with the given password, for a backup copy, and check
 * that the result opens again with that password
 */
export async function exportSourceEncrypted(
    sourceID: VaultSourceID,
    password: string
): Promise<string> {
    const source = getVaultManager().getSourceForID(sourceID);
    const creds = Credentials.fromPassword(password);
    const tds = new TextDatasource(Credentials.fromPassword(password));
    const content = await tds.save(source.vault.format.getHistory(), creds);
    const check = new TextDatasource(Credentials.fromPassword(password));
    check.setContent(content);
    await check.load(Credentials.fromPassword(password));
    return content;
}

export function getAllOTPs(): Array<OTP> {
    const vaultManager = getVaultManager();
    return vaultManager.unlockedSources.reduce((otps: Array<OTP>, source: VaultSource) => {
        return [...otps, ...extractVaultOTPItems(source)];
    }, [] as Array<OTP>);
}

export async function getAttachmentData(
    sourceID: VaultSourceID,
    entryID: EntryID,
    attachmentID: string
): Promise<Buffer> {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const entry = source.vault.findEntryByID(entryID);
    return source.attachmentManager.getAttachment(entry, attachmentID) as Promise<Buffer>;
}

export async function getAttachmentDetails(
    sourceID: VaultSourceID,
    entryID: EntryID,
    attachmentID: string
): Promise<AttachmentDetails> {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const entry = source.vault.findEntryByID(entryID);
    return source.attachmentManager.getAttachmentDetails(entry, attachmentID);
}

export async function getEmptyVault(password: string): Promise<string> {
    const creds = Credentials.fromPassword(password);
    const vault = Vault.createWithDefaults();
    const tds = new TextDatasource(Credentials.fromPassword(password));
    return tds.save(vault.format.getHistory(), creds);
}

export async function getEntries(
    entries: Array<{ entryID: EntryID; sourceID: VaultSourceID }>
): Promise<Array<{ entry: Entry; sourceID: VaultSourceID }>> {
    const vaultManager = getVaultManager();
    return entries.reduce((output, item) => {
        const source = vaultManager.getSourceForID(item.sourceID);
        if (!source || source.status !== VaultSourceStatus.Unlocked) return output;
        return [
            ...output,
            {
                entry: source.vault.findEntryByID(item.entryID),
                sourceID: item.sourceID
            }
        ];
    }, []);
}

export function getSourceDescription(sourceID: VaultSourceID): VaultSourceDescription {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    return source ? describeSource(source) : null;
}

export function getSourceDescriptions(): Array<VaultSourceDescription> {
    const vaultManager = getVaultManager();
    return vaultManager.sources.map((source) => describeSource(source));
}

export function getSourceAttachmentsSupport(sourceID: VaultSourceID): boolean {
    const mgr = getVaultManager();
    const source = mgr.getSourceForID(sourceID);
    return source.supportsAttachments();
}

export function getSourceStatus(sourceID: VaultSourceID): VaultSourceStatus | null {
    const mgr = getVaultManager();
    const source = mgr.getSourceForID(sourceID);
    return (source && source.status) || null;
}

export function getUnlockedSourceIDs(): Array<VaultSourceID> {
    const mgr = getVaultManager();
    return mgr.unlockedSources.map((src) => src.id);
}

export function getUnlockedSourcesCount(): number {
    const mgr = getVaultManager();
    return mgr.unlockedSources.length;
}

export function getVaultFacadeBySource(sourceID: VaultSourceID): VaultFacade {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    if (!source) {
        throw new Error(`Cannot generate facade: No source found for ID: ${sourceID}`);
    } else if (source.status !== VaultSourceStatus.Unlocked) {
        throw new Error(`Cannot generate facade: Source is not unlocked: ${sourceID}`);
    }
    return createVaultFacade(source.vault);
}

export function getVaultFormat(sourceID: VaultSourceID): VaultFormatID {
    const mgr = getVaultManager();
    const source = mgr.getSourceForID(sourceID);
    if (source.status !== VaultSourceStatus.Unlocked) return null;
    return source.vault.format.getFormat().getFormatID();
}

function getVaultManager(): VaultManager {
    if (!__vaultManager) {
        init();
        __vaultManager = new VaultManager({
            cacheStorage: getVaultCacheStorage(),
            sourceStorage: getVaultStorage()
        });
    }
    return __vaultManager;
}

export async function loadVaultsFromDisk() {
    await getVaultManager().rehydrate();
}

export async function lockAllSources() {
    const vaultManager = getVaultManager();
    if (vaultManager.unlockedSources.length === 0) return;
    await Promise.all(
        vaultManager.unlockedSources.map(async (source) => {
            await source.lock();
            __unsavedEdits.delete(source.id);
        })
    );
}

export async function lockSource(sourceID: VaultSourceID) {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    if (source.status === VaultSourceStatus.Unlocked) {
        await source.lock();
        __unsavedEdits.delete(sourceID);
    }
}

export async function mergeVaults(targetSourceID: VaultSourceID, incomingVault: Vault) {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(targetSourceID);
    const incomingFacade = createVaultFacade(incomingVault);
    consumeVaultFacade(source.vault, incomingFacade, { mergeMode: true });
    await source.save();
}

export function onSourcesUpdated(callback: () => void): () => void {
    const vaultManager = getVaultManager();
    const innerCB = () => callback();
    vaultManager.on("sourcesUpdated", innerCB);
    return () => vaultManager.off("sourcesUpdated", innerCB);
}

function onVaultSourceUpdated(source: VaultSource) {
    clearFacadeCache(source.id);
    notifyWindowsOfSourceUpdate(source.id);
}

export async function removeSource(sourceID: VaultSourceID) {
    const vaultManager = getVaultManager();
    clearFacadeCache(sourceID);
    await vaultManager.removeSource(sourceID);
}

export async function saveSource(sourceID: VaultSourceID) {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const edit = __unsavedEdits.get(sourceID);
    await source.save();
    if (typeof edit === "number") markEditSaved(sourceID, edit);
}

export async function saveVaultFacade(sourceID: VaultSourceID, facade: VaultFacade): Promise<void> {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const edit = ++__lastEdit;
    __unsavedEdits.set(sourceID, edit);
    consumeVaultFacade(source.vault, facade);
    const saving = source.save().then(() => markEditSaved(sourceID, edit));
    __runningSaves.set(sourceID, saving);
    try {
        await saving;
    } finally {
        if (__runningSaves.get(sourceID) === saving) {
            __runningSaves.delete(sourceID);
        }
    }
}

/**
 * Wait (at most `timeout` ms) for running saves of the given vaults to finish,
 * whether they succeed or not.
 */
export async function waitForRunningSaves(sourceIDs: Array<VaultSourceID>, timeout: number) {
    const saves = sourceIDs
        .map((sourceID) => __runningSaves.get(sourceID))
        .filter(Boolean)
        .map((saving) => saving.catch(() => {}));
    if (saves.length === 0) return;
    let timer: NodeJS.Timeout;
    await Promise.race([
        Promise.all(saves),
        new Promise((resolve) => {
            timer = setTimeout(resolve, timeout);
        })
    ]);
    clearTimeout(timer);
}

/**
 * Unlocked vaults holding edits that haven't been saved: the save failed,
 * timed out or is still running. Locking or quitting would lose them (#1230).
 */
export function getUnsavedSourceIDs(): Array<VaultSourceID> {
    // Also keeps a quit during startup from creating the vault manager
    if (__unsavedEdits.size === 0) return [];
    const vaultManager = getVaultManager();
    return [...__unsavedEdits.keys()].filter(
        (sourceID) => vaultManager.getSourceForID(sourceID)?.status === VaultSourceStatus.Unlocked
    );
}

function markEditSaved(sourceID: VaultSourceID, edit: number) {
    // A newer edit may have arrived during the save: that one isn't saved yet
    if (__unsavedEdits.get(sourceID) === edit) {
        __unsavedEdits.delete(sourceID);
    }
}

export function sendSourcesToWindows() {
    const vaultManager = getVaultManager();
    const windows = BrowserWindow.getAllWindows();
    const sourceDescriptions = vaultManager.sources.map((source) => describeSource(source));
    for (const win of windows) {
        win.webContents.send("vaults-list", JSON.stringify(sourceDescriptions));
    }
}

export async function setSourceOrder(sourceID: VaultSourceID, newOrder: number) {
    const vaultManager = getVaultManager();
    await vaultManager.reorderSource(sourceID, newOrder);
    await vaultManager.dehydrate();
}

export async function setSourcesOrder(sourceIDs: Array<VaultSourceID>) {
    const vaultManager = getVaultManager();
    for (let i = 0; i < sourceIDs.length; i += 1) {
        const source = vaultManager.getSourceForID(sourceIDs[i]);
        source.order = i;
    }
    vaultManager.reorderSources();
    await vaultManager.dehydrate();
}

export async function testSourceMasterPassword(
    sourceID: VaultSourceID,
    password: string
): Promise<boolean> {
    const source = getVaultManager().getSourceForID(sourceID);
    return source.testMasterPassword(password);
}

export async function toggleAutoUpdate(autoUpdateEnabled: boolean = true) {
    // Editing an entry (auto-update disabled) also suspends auto-lock.
    setAutoLockSuspended(!autoUpdateEnabled);
    const vaultManager = getVaultManager();
    await vaultManager.enqueueStateChange(() => {});
    vaultManager.toggleAutoUpdating(autoUpdateEnabled);
}

export async function unlockSource(sourceID: VaultSourceID, password: string) {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    try {
        await source.unlock(Credentials.fromPassword(password));
    } catch (err) {
        if (!isDamagedVaultError(err)) throw err;
        logErr(`Vault file of '${sourceID}' is damaged`, err);
        if (!(await offerOfflineCopyRestore(source, password))) {
            throw new Error(t("error.vault-damaged"));
        }
    }
    // Arm auto-lock now rather than waiting for the next user-activity ping.
    void startAutoVaultLockTimer();
}

export async function updateExistingEntry(
    sourceID: VaultSourceID,
    entryID: EntryID,
    properties: Record<string, string>
): Promise<void> {
    const vaultManager = getVaultManager();
    const source = vaultManager.getSourceForID(sourceID);
    const entry = source.vault.findEntryByID(entryID);
    for (const key in properties) {
        entry.setProperty(key, properties[key]);
    }
    await source.save();
}
