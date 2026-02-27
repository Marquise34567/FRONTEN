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

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
      <SelectTrigger className="h-10 w-[178px] rounded-2xl border-white/10 bg-black/40 text-xs text-slate-100 hover:border-purple-300/35">
        <span className="inline-flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-purple-200" />
          <SelectValue placeholder="Theme" />
        </span>
      </SelectTrigger>
      <SelectContent className="border-white/15 bg-[#0b0d15]/96 text-slate-100 backdrop-blur-xl">
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
