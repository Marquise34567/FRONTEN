import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANGUAGE, I18N_RESOURCES, SUPPORTED_LANGUAGES } from "@/locales/resources";

const RTL_LANGS = new Set(["ar", "he", "ur"]);

const normalizeLanguageCode = (language: string | undefined | null) => {
  if (!language) return DEFAULT_LANGUAGE;
  const [code] = String(language).toLowerCase().split("-");
  return code || DEFAULT_LANGUAGE;
};

const syncDocumentDirection = (language: string | undefined | null) => {
  if (typeof document === "undefined") return;
  const code = normalizeLanguageCode(language);
  document.documentElement.lang = code;
  document.documentElement.dir = RTL_LANGS.has(code) ? "rtl" : "ltr";
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: I18N_RESOURCES,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    returnNull: false,
    keySeparator: false,
    nsSeparator: false,
    load: "languageOnly",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ae_lang"
    },
    react: {
      useSuspense: false
    }
  });

i18n.on("languageChanged", (language) => {
  syncDocumentDirection(language);
});

syncDocumentDirection(i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE);

export default i18n;
