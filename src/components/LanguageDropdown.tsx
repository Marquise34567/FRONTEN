import i18n from "@/i18n";
import { LANGUAGE_OPTIONS } from "@/locales/resources";
import { useTranslation } from "react-i18next";

const normalizeLanguageCode = (language: string | undefined | null) => {
  if (!language) return "en";
  const [code] = String(language).toLowerCase().split("-");
  return code || "en";
};

type LanguageDropdownProps = {
  className?: string;
};

const LanguageDropdown = ({ className }: LanguageDropdownProps) => {
  const { t } = useTranslation("common");
  const activeLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  return (
    <label className={className}>
      <span className="sr-only">{t("common.language")}</span>
      <select
        value={activeLanguage}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
        className="w-full rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-foreground outline-none transition-colors focus-visible:border-primary/60"
        aria-label={t("common.language")}
        title={t("common.language")}
      >
        {LANGUAGE_OPTIONS.map((language) => (
          <option key={language.code} value={language.code} className="text-black">
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LanguageDropdown;

