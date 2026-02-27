import { Palette } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_THEME_OPTIONS, useThemeStore } from "@/stores/useThemeStore";

export default function ThemeSwitcher() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  if (APP_THEME_OPTIONS.length <= 1) {
    return (
      <div className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 text-xs text-slate-300">
        <Palette className="h-3.5 w-3.5 text-cyan-100" />
        {APP_THEME_OPTIONS[0]?.label || "Dark Premium"}
      </div>
    );
  }

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
      <SelectTrigger className="h-10 w-[188px] rounded-2xl border-[rgba(52,240,208,0.26)] bg-[rgba(8,8,13,0.75)] text-xs text-slate-100 hover:border-[rgba(52,240,208,0.46)]">
        <span className="inline-flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
          <SelectValue placeholder="Theme" />
        </span>
      </SelectTrigger>
      <SelectContent className="border-[rgba(52,240,208,0.24)] bg-[#0b0b11]/96 text-slate-100 backdrop-blur-xl">
        {APP_THEME_OPTIONS.map((option) => (
          <SelectItem key={option.id} value={option.id} className="py-2">
            <div className="flex flex-col">
              <span className="text-sm text-slate-100">{option.label}</span>
              <span className="text-[11px] text-slate-400">{option.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

