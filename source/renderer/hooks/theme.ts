import * as React from "react";
import { getThemeType, onThemeUpdated } from "../library/theme";
import { Theme } from "../types";

const { useEffect, useState } = React;

export function useTheme(): Theme {
    const [theme, setTheme] = useState<Theme>(getThemeType());
    useEffect(() => onThemeUpdated(setTheme), []);
    return theme;
}
