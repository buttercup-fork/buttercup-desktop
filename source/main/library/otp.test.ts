import { EntryPropertyValueType, Group, Vault, VaultSource, init } from "buttercup";
import { extractVaultOTPItems } from "./otp";

const OTP_URL = "otpauth://totp/Site:user?secret=JBSWY3DPEHPK3PXP&issuer=Site";

function addOTPEntry(group: Group, title: string) {
    return group
        .createEntry(title)
        .setProperty("url", `https://${title.toLowerCase()}.example`)
        .setProperty("OTP", OTP_URL)
        .setPropertyValueType("OTP", EntryPropertyValueType.OTP);
}

function sourceWith(vault: Vault): VaultSource {
    // Only `id` and `vault` are read
    return { id: "source-1", vault } as unknown as VaultSource;
}

beforeAll(() => {
    init();
});

test("lists the OTPs of live entries", () => {
    const vault = Vault.createWithDefaults();
    const entry = addOTPEntry(vault.findGroupsByTitle("General")[0], "Live");
    const otps = extractVaultOTPItems(sourceWith(vault));
    expect(otps).toHaveLength(1);
    expect(otps[0]).toMatchObject({
        entryID: entry.id,
        entryProperty: "OTP",
        otpURL: OTP_URL,
        sourceID: "source-1"
    });
});

test("leaves out entries in the Trash (B-727)", () => {
    const vault = Vault.createWithDefaults();
    const live = addOTPEntry(vault.findGroupsByTitle("General")[0], "Live");
    const trash = vault.getTrashGroup();
    const trashed = addOTPEntry(vault.findGroupsByTitle("General")[0], "Deleted");
    trashed.moveToGroup(trash);
    // A folder deleted with an entry inside it
    const folder = vault.findGroupsByTitle("General")[0].createGroup("Old folder");
    const nested = addOTPEntry(folder, "Nested");
    folder.moveTo(trash);
    expect(trashed.isInTrash()).toBe(true);
    expect(nested.isInTrash()).toBe(true);
    const ids = extractVaultOTPItems(sourceWith(vault)).map((otp) => otp.entryID);
    expect(ids).toEqual([live.id]);
});
