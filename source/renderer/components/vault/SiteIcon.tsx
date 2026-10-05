import React, { useEffect, useState } from "react";
import { ipcRenderer } from "electron";
import styled from "styled-components";
import { DEFAULT_ENTRY_TYPE, EntryType } from "buttercup";
import ICON_LOGIN from "../../../../resources/images/login.png";
import ICON_WEBSITE from "../../../../resources/images/website.png";
import ICON_NOTE from "../../../../resources/images/note.png";
import ICON_SSH from "../../../../resources/images/ssh.png";
import ICON_CREDITCARD from "../../../../resources/images/credit-card.png";
import { isIconDomain } from "./utils/domain";

const ICON_TYPES = {
    [EntryType.Login]: ICON_LOGIN,
    [EntryType.Website]: ICON_WEBSITE,
    [EntryType.SSHKey]: ICON_SSH,
    [EntryType.Note]: ICON_NOTE,
    [EntryType.CreditCard]: ICON_CREDITCARD
};

// One lookup per host for the whole window: the main process finds the icon
// (the page's <link rel="icon">, else /favicon.ico) and caches it on disk (#1071)
const __icons = new Map<string, Promise<string | null>>();

function getSiteIcon(domain: string): Promise<string | null> {
    const key = domain.toLowerCase();
    if (!__icons.has(key)) {
        __icons.set(
            key,
            ipcRenderer.invoke("get-site-icon", key).catch(() => null) as Promise<string | null>
        );
    }
    return __icons.get(key);
}

const FallbackIcon = styled.img<{ dynamicLoading: boolean }>`
    opacity: ${(props) => (props.dynamicLoading ? "0.5" : "1.0")};
`;
const IconContainer = styled.div`
    position: relative;
    > img {
        position: absolute;
        top: 0;
        left: 0;
    }
`;

export function SiteIcon(props) {
    const { className, domain = null, type = DEFAULT_ENTRY_TYPE } = props;
    // undefined: still looking, null: no icon (or icons are off)
    const [icon, setIcon] = useState<string | null | undefined>(
        isIconDomain(domain) ? undefined : null
    );
    useEffect(() => {
        if (!isIconDomain(domain)) {
            setIcon(null);
            return;
        }
        let current = true;
        setIcon(undefined);
        getSiteIcon(domain).then((found) => {
            if (current) setIcon(found);
        });
        return () => {
            current = false;
        };
    }, [domain]);
    return (
        <IconContainer className={className}>
            {icon ? (
                <img src={icon} alt="" />
            ) : (
                <FallbackIcon src={ICON_TYPES[type]} dynamicLoading={icon === undefined} />
            )}
        </IconContainer>
    );
}
