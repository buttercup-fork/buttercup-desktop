import i18next, { TOptions } from "i18next";
import translations from "./translations/index";
import { DEFAULT_LANGUAGE } from "../symbols";

let __lastLanguage: string | null = null;

export async function changeLanguage(lang: string) {
    await i18next.changeLanguage(lang);
}

export async function initialise(lang: string) {
    __lastLanguage = lang;
    await i18next.init({
        lng: lang,
        fallbackLng: DEFAULT_LANGUAGE,
        debug: false,
        // Translations are shown as text (React escapes it, native dialogs and
        // notifications show it as is), so values must not be HTML-escaped:
        // an error toast showed &#39; for every quote (B-712). Strings rendered
        // with dangerouslySetInnerHTML take no values (trans.test.ts checks it)
        interpolation: { escapeValue: false },
        resources: Object.keys(translations).reduce(
            (output, lang) => ({
                ...output,
                [lang]: {
                    translation: translations[lang]
                }
            }),
            {}
        )
    });
}

export function onLanguageChanged(callback: (lang: string) => void): () => void {
    const cb = (lang: string) => {
        if (__lastLanguage === lang) return;
        __lastLanguage = lang;
        callback(lang);
    };
    i18next.on("languageChanged", cb);
    return () => {
        i18next.off("languageChanged", cb);
    };
}

export function t(key: string, options?: TOptions) {
    return i18next.t(key, options);
}
