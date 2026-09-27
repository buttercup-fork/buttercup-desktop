import * as React from "react";
import { HashRouter as Router, Switch, Route } from "react-router-dom";
import styled, { ThemeProvider } from "styled-components";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { THEME_DARK, THEME_LIGHT } from "./styles/themes";
import { getThemeProp } from "./styles/theme";
import { VaultManagement } from "./components/VaultManagement";
import { AutoNav } from "./components/navigation/AutoNav";
import { AddVaultLanding } from "./components/AddVaultLanding";
import { LoadingScreen } from "./components/navigation/LoadingScreen";
import { PasswordPrompt } from "./components/PasswordPrompt";
import { AddVaultMenu } from "./components/AddVaultMenu";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { BrowserAccessDialog } from "./components/standalone/BrowserAccessDialog";
import { Notifications } from "./components/Notifications";
import { FileHostConnectionNotice } from "./components/standalone/FileHostConnectionNotice";
import { CreateNewFilePrompt } from "./components/standalone/CreateNewFilePrompt";
import { UpdateDialog } from "./components/standalone/UpdateDialog";
import { UpdateErrorDialog } from "./components/standalone/UpdateErrorDialog";
import { AboutDialog } from "./components/standalone/AboutDialog";
import { BiometricRegistrationDialog } from "./components/standalone/BiometricRegistrationDialog";
import { GoogleReAuthDialog } from "./components/standalone/GoogleReAuthDialog";
import { VaultSettingsDialog } from "./components/VaultSettingsDialog";
import { useTheme } from "./hooks/theme";
import { userCopiedText } from "./actions/clipboard";
import { Theme } from "./types";

const BaseContainer = styled.div`
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: ${props => getThemeProp(props, "base.bgColor")};
`;

export function App() {
    const themeType = useTheme();
    return (
        <ThemeProvider
            theme={themeType === Theme.Dark ? THEME_DARK: THEME_LIGHT}
        >
                <DndProvider backend={HTML5Backend}>
                    <BaseContainer className={`theme-${themeType}`} onCopy={() => userCopiedText(document.getSelection()?.toString() ?? "")}>
                        <Router>
                            <Switch>
                                <Route path="/add-vault">
                                    <AddVaultLanding />
                                </Route>
                                <Route path="/source/:id">
                                    <VaultManagement />
                                </Route>
                                <Route path="/">
                                    <AutoNav />
                                </Route>
                            </Switch>
                            <>
                                <PasswordPrompt />
                                <FileHostConnectionNotice />
                                <BrowserAccessDialog />
                                <CreateNewFilePrompt />
                                <AddVaultMenu />
                                <PreferencesDialog />
                                <VaultSettingsDialog />
                                <GoogleReAuthDialog />
                                <UpdateDialog />
                                <UpdateErrorDialog />
                                <AboutDialog />
                                <BiometricRegistrationDialog />
                                <Notifications />
                                <LoadingScreen />
                            </>
                        </Router>
                    </BaseContainer>
                </DndProvider>
        </ThemeProvider>
    );
}
