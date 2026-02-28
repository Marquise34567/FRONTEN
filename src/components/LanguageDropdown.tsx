import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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

const LANGUAGE_PROMPT_DURATION_MS = 5000;

const LanguageDropdown = ({ className }: LanguageDropdownProps) => {
  const { t } = useTranslation("common");
  const activeLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  // show the animated side prompt briefly, but only on the landing page
  const location = useLocation();
  const isLanding = location.pathname === "/";
  const [showPrompt, setShowPrompt] = useState(isLanding);
  // show the actual <select> only when user opts to change
  const [showSelect, setShowSelect] = useState(false);
  const rootClassName = className ? className : "w-full";

  useEffect(() => {
    if (!isLanding) {
      setShowPrompt(false);
      setShowSelect(false);
      return;
    }
    const id = setTimeout(() => setShowPrompt(false), LANGUAGE_PROMPT_DURATION_MS);
    return () => clearTimeout(id);
  }, [isLanding]);

  const handleChange = (value: string) => {
    void i18n.changeLanguage(value);
    setShowSelect(false);
    setShowPrompt(false);
  };

  return (
    <div className={rootClassName} style={{ position: "relative" }}>
      {/* Animated side prompt */}
      {showPrompt && (
        <div
          role="dialog"
          aria-live="polite"
          className="block"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.5rem)",
            zIndex: 55,
            width: "min(22rem, calc(100vw - 2rem))",
          }}
        >
          <div
            className="rounded-xl border border-primary/60 bg-card/40 px-5 py-3 text-sm text-foreground shadow-[0_28px_72px_-18px_hsl(var(--primary)/0.9)] bg-gradient-to-br from-primary/10 to-glow-secondary/12 animate-pulse-glow"
            style={{ animation: "ae-slide-in 420ms ease-out, ae-popup-pulse 3s ease-in-out infinite", display: "flex", gap: "0.8rem", alignItems: "center", width: "100%", maxWidth: "100%" }}
          >
            <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 12h20M12 2c2.5 3 2.5 9 0 12M12 22c-2.5-3-2.5-9 0-12" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="font-semibold text-foreground text-sm" style={{ textShadow: "0 0 18px hsl(var(--primary) / 0.28)" }}>
                {t("common.language")}
              </div>
              <div className="text-xs text-muted-foreground">Do you want to change your language?</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1 text-xs text-white shadow-[0_6px_18px_-6px_hsl(var(--primary)/0.6)]"
                onClick={() => {
                  setShowSelect(true);
                  setShowPrompt(false);
                }}
              >
                Change
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-xs"
                onClick={() => setShowPrompt(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* actual select - shown only when user requests it */}
      {showSelect && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 0.5rem)", zIndex: 55, width: "min(20rem, calc(100vw - 2rem))" }}>
          <label className="block rounded-xl border border-border/60 bg-card/90 p-3 shadow-[0_18px_40px_-18px_hsl(var(--primary)/0.7)]" style={{ animation: "ae-slide-in 420ms ease-out" }}>
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">{t("common.language")}</span>
            <select
              value={activeLanguage}
              onChange={(event) => handleChange(event.target.value)}
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
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-xs"
                onClick={() => setShowSelect(false)}
              >
                Close
              </button>
            </div>
          </label>
        </div>
      )}

      <style>{`
    @keyframes ae-slide-in {
      from { transform: translateX(-20px); opacity: 0 }
      to { transform: translateX(0); opacity: 1 }
    }
    @keyframes ae-popup-pulse {
      0% { transform: translateY(0) scale(1) }
      50% { transform: translateY(-4px) scale(1.035) }
      100% { transform: translateY(0) scale(1) }
    }
  `}</style>
    </div>
  );
};

export default LanguageDropdown;
