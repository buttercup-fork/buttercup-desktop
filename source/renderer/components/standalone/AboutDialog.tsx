import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useState as useHookState } from "@hookstate/core";
import { Button, Classes, Colors, Dialog, Icon, IconName } from "@blueprintjs/core";
import { SHOW_ABOUT } from "../../state/about";
import { CORE_VERSION } from "../../library/version";
import { logErr } from "../../library/log";
import { copyAboutDetails, getAboutInfo, openAboutLink } from "../../services/about";
import { t } from "../../../shared/i18n/trans";
import { AboutInfo, AboutLinkID, UpdateStatus } from "../../types";

const BUTTERCUP_IMG = require("../../../../resources/images/buttercup-256.png").default;

// How long "Copied" shows before the button reads "Copy details" again
const COPIED_TIME = 1500;

const PROJECT_LINKS: Array<{ id: AboutLinkID; icon: IconName }> = [
    { id: "website", icon: "globe-network" },
    { id: "releases", icon: "document" },
    { id: "issues", icon: "flag" },
    { id: "security", icon: "shield" }
];

// The app's teal, in Blueprint's palette: 6:1 on the light dialog, 7:1 on the dark one
const AboutDialogFrame = styled(Dialog)`
    width: 500px;
    padding-bottom: 0;
    --about-surface: ${Colors.WHITE};
    --about-surface-hover: ${Colors.LIGHT_GRAY4};
    --about-border: ${Colors.LIGHT_GRAY3};
    --about-link: ${Colors.TURQUOISE2};
    --about-ok: ${Colors.GREEN2};
    &.${Classes.DARK}, .${Classes.DARK} & {
        --about-surface: ${Colors.DARK_GRAY3};
        --about-surface-hover: ${Colors.DARK_GRAY4};
        --about-border: ${Colors.DARK_GRAY5};
        --about-link: ${Colors.TURQUOISE4};
        --about-ok: ${Colors.GREEN5};
    }
`;
const Header = styled.div`
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 24px 24px 16px;
`;
const Logo = styled.img`
    width: 52px;
    height: 52px;
    flex-shrink: 0;
`;
// The dialog's name for screen readers ("About Buttercup"); the heading shows "Buttercup"
const HiddenLabel = styled.span`
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
`;
const Title = styled.h3`
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    line-height: 28px;
`;
const Subtitle = styled.p`
    margin: 2px 0 0;
    font-size: 14px;
`;
const Status = styled.div`
    margin: 0 24px;
    padding: 10px 12px;
    border-radius: 4px;
    background: var(--about-surface);
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 14px;
    line-height: 20px;
`;
const StatusText = styled.span`
    flex-grow: 1;
`;
const Facts = styled.dl`
    margin: 12px 24px 0;
    padding: 12px 0;
    border-top: 1px solid var(--about-border);
    border-bottom: 1px solid var(--about-border);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    dt {
        font-size: 13px;
    }
    dd {
        margin: 2px 0 0;
        font-size: 15px;
        font-variant-numeric: tabular-nums;
    }
`;
const SectionTitle = styled.h4`
    margin: 18px 0 8px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
`;
const Tiles = styled.div`
    padding: 0 24px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
`;
const Tile = styled.a`
    height: 40px;
    padding: 0 12px;
    border-radius: 4px;
    background: var(--about-surface);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
    /* Doubled class: Blueprint's ".bp4-dark a" would win otherwise */
    &&,
    &&:hover {
        color: inherit;
        text-decoration: none;
    }
    &&:hover {
        background: var(--about-surface-hover);
    }
    .${Classes.ICON} {
        color: inherit;
    }
`;
const Link = styled.a`
    font-size: 13px;
    &&,
    &&:hover {
        color: var(--about-link);
    }
`;
const Footer = styled.div`
    margin-top: 20px;
    padding: 12px 16px 12px 24px;
    border-top: 1px solid var(--about-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
`;
const FooterButtons = styled.div`
    display: flex;
    gap: 8px;
    .copy-details {
        min-width: 112px;
    }
`;

function checkedTime(status: UpdateStatus): string {
    return new Date(status.checkedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function UpdateLine(props: { status: UpdateStatus; onOpenReleases: () => void }) {
    const { status, onOpenReleases } = props;
    switch (status.state) {
        case "up-to-date":
            return (
                <>
                    <Icon icon="tick-circle" color="var(--about-ok)" />
                    <StatusText>
                        {t("about.update.up-to-date")}{" "}
                        <span className={Classes.TEXT_MUTED}>
                            · {t("about.update.checked-at", { time: checkedTime(status) })}
                        </span>
                    </StatusText>
                </>
            );
        case "available":
            return (
                <>
                    <Icon icon="circle-arrow-up" color="var(--about-link)" />
                    <StatusText>
                        {t("about.update.available", { version: status.version })}
                    </StatusText>
                    <Link
                        href="#"
                        onClick={(evt) => {
                            evt.preventDefault();
                            onOpenReleases();
                        }}
                    >
                        {t("about.update.open-releases")}
                    </Link>
                </>
            );
        case "off":
            return (
                <>
                    <Icon icon="info-sign" className={Classes.TEXT_MUTED} />
                    <StatusText>
                        {t("about.update.off")}{" "}
                        <span className={Classes.TEXT_MUTED}>· {t("about.update.off-detail")}</span>
                    </StatusText>
                </>
            );
        case "failed":
            return (
                <>
                    <Icon icon="warning-sign" className={Classes.TEXT_MUTED} />
                    <StatusText>{t("about.update.failed")}</StatusText>
                </>
            );
        case "checking":
            return (
                <>
                    <Icon icon="refresh" className={Classes.TEXT_MUTED} />
                    <StatusText>{t("about.update.checking")}</StatusText>
                </>
            );
        default:
            return (
                <>
                    <Icon icon="info-sign" className={Classes.TEXT_MUTED} />
                    <StatusText>{t("about.update.not-checked")}</StatusText>
                </>
            );
    }
}

export function AboutDialog() {
    const showDialogState = useHookState(SHOW_ABOUT);
    const isOpen = showDialogState.get();
    const [info, setInfo] = useState<AboutInfo>(null);
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout>>(null);
    const close = useCallback(() => {
        showDialogState.set(false);
    }, []);
    // Read the facts each time the dialog opens: the update status changes
    useEffect(() => {
        if (!isOpen) return;
        let mounted = true;
        getAboutInfo()
            .then((newInfo) => {
                if (mounted) setInfo(newInfo);
            })
            .catch((err) => {
                logErr("Failed reading the About information", err);
            });
        return () => {
            mounted = false;
        };
    }, [isOpen]);
    useEffect(() => () => clearTimeout(copiedTimer.current), []);
    const openLink = useCallback((id: AboutLinkID) => {
        openAboutLink(id).catch((err) => logErr(`Failed opening the About link: ${id}`, err));
    }, []);
    const copyDetails = useCallback(() => {
        copyAboutDetails(CORE_VERSION)
            .then(() => {
                setCopied(true);
                clearTimeout(copiedTimer.current);
                copiedTimer.current = setTimeout(() => setCopied(false), COPIED_TIME);
            })
            .catch((err) => logErr("Failed copying the About details", err));
    }, []);
    return (
        <AboutDialogFrame isOpen={isOpen} onClose={close} aria-labelledby="about-dialog-title">
            <Header>
                <Logo src={BUTTERCUP_IMG} alt="" />
                <div>
                    <HiddenLabel id="about-dialog-title">{t("about.label")}</HiddenLabel>
                    <Title>Buttercup</Title>
                    {info && (
                        <Subtitle className={Classes.TEXT_MUTED}>
                            {t("about.version-maintainer", { version: info.version })}
                        </Subtitle>
                    )}
                </div>
            </Header>
            {info && (
                <>
                    <Status role="status">
                        <UpdateLine
                            status={info.update}
                            onOpenReleases={() => openLink("releases")}
                        />
                    </Status>
                    <Facts>
                        <div>
                            <dt className={Classes.TEXT_MUTED}>{t("about.core")}</dt>
                            <dd data-testid="about-core">{CORE_VERSION}</dd>
                        </div>
                        <div>
                            <dt className={Classes.TEXT_MUTED}>{t("about.platform")}</dt>
                            <dd data-testid="about-platform">
                                {t("about.platform-value", {
                                    platform: info.platform,
                                    arch: info.arch,
                                    install: t(`about.install.${info.install}`)
                                })}
                            </dd>
                        </div>
                    </Facts>
                </>
            )}
            <SectionTitle className={Classes.TEXT_MUTED}>{t("about.links.title")}</SectionTitle>
            <Tiles>
                {PROJECT_LINKS.map(({ id, icon }) => (
                    <Tile
                        key={id}
                        href="#"
                        onClick={(evt) => {
                            evt.preventDefault();
                            openLink(id);
                        }}
                    >
                        <Icon icon={icon} />
                        {t(`about.links.${id}`)}
                    </Tile>
                ))}
            </Tiles>
            <Footer>
                <Link
                    href="#"
                    onClick={(evt) => {
                        evt.preventDefault();
                        openLink("licence");
                    }}
                >
                    {t("about.licence")}
                </Link>
                <FooterButtons>
                    <Button
                        className="copy-details"
                        icon={copied ? <Icon icon="tick" color="var(--about-ok)" /> : "duplicate"}
                        onClick={copyDetails}
                        title={t("about.copy-details-title")}
                    >
                        <span aria-live="polite">
                            {copied ? t("about.copied") : t("about.copy-details")}
                        </span>
                    </Button>
                    <Button onClick={close} title={t("about.dialog.close-button-title")}>
                        {t("about.dialog.close-button")}
                    </Button>
                </FooterButtons>
            </Footer>
        </AboutDialogFrame>
    );
}
