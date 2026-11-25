import { IconName, MaybeElement } from "@blueprintjs/core";
import { EntryType } from "buttercup";

export const defaultType = EntryType.Login;

// The New Entry menu. No Website: a Login has the URL field now (B-811, C-101);
// stored Website entries still open and show as a Login.
export const types: Array<{
    type: EntryType;
    icon: IconName | MaybeElement;
    default?: boolean;
}> = [
    {
        type: EntryType.Login,
        icon: "id-number",
        default: true
    },
    {
        type: EntryType.CreditCard,
        icon: "credit-card"
    },
    {
        type: EntryType.Note,
        icon: "annotation"
    },
    {
        type: EntryType.SSHKey,
        icon: "key"
    }
];
