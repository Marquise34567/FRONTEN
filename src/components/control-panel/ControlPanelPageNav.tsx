import { motion } from "framer-motion"
import { Bot, ChevronDown, Cpu, Flame, Globe2, Landmark, LayoutDashboard, ShieldAlert, TrendingUp, Wrench, KeyRound } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

type ControlPanelPage = {
  key: "overview" | "emotion" | "audience" | "growth" | "infrastructure" | "security" | "algorithm" | "bank" | "ops" | "blacksite"
  label: string
  path: string
  Icon: typeof LayoutDashboard
}

const CONTROL_PANEL_PAGES: ControlPanelPage[] = [
  { key: "overview", label: "Overview", path: "/dev/control-panel/overview", Icon: LayoutDashboard },
  { key: "emotion", label: "Emotion", path: "/dev/control-panel/emotion", Icon: Flame },
  { key: "audience", label: "Audience Intel", path: "/dev/control-panel/audience", Icon: Globe2 },
  { key: "growth", label: "Growth Intel", path: "/dev/control-panel/growth", Icon: TrendingUp },
  { key: "infrastructure", label: "Infrastructure", path: "/dev/control-panel/infrastructure", Icon: Cpu },
  { key: "security", label: "Security", path: "/dev/control-panel/security", Icon: ShieldAlert },
  { key: "algorithm", label: "Algorithm", path: "/dev/control-panel/algorithm", Icon: Bot },
  { key: "ops", label: "Ops Tools", path: "/dev/control-panel/ops", Icon: Wrench },
  { key: "bank", label: "The Bank", path: "/dev/control-panel/bank", Icon: Landmark },
  { key: "blacksite", label: "Secret Panel", path: "/dev/control-panel/blacksite", Icon: KeyRound }
]

const resolveCurrentPath = (pathname: string) => {
  const exact = CONTROL_PANEL_PAGES.find((item) => item.path === pathname)
  if (exact) return exact
  if (pathname === "/dev/control-panel") return CONTROL_PANEL_PAGES[0]
  return CONTROL_PANEL_PAGES.find((item) => pathname.startsWith(item.path)) || CONTROL_PANEL_PAGES[0]
}

type ControlPanelPageNavProps = {
  title: string
  subtitle: string
}

const ControlPanelPageNav = ({ title, subtitle }: ControlPanelPageNavProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const current = resolveCurrentPath(location.pathname)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-[radial-gradient(130%_140%_at_85%_-10%,hsl(204_95%_58%/0.26),transparent_48%),linear-gradient(160deg,hsl(216_30%_9%/0.88)_0%,hsl(216_35%_6%/0.94)_100%)] p-4 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -left-10 top-6 h-28 w-28 rounded-full bg-sky-500/20 blur-2xl" />
      <div className="pointer-events-none absolute right-8 top-2 h-16 w-16 rounded-full bg-cyan-400/20 blur-2xl" />
      <button
        type="button"
        onClick={() => navigate("/x-quantum-control-9")}
        className="absolute right-3 top-3 inline-flex h-8 items-center gap-1 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15 px-2.5 text-[11px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25 focus-visible:border-fuchsia-200/60 focus-visible:bg-fuchsia-500/25"
        aria-label="Open operator deck"
        title="Operator deck"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Secret Panel
      </button>

      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-200/80">Control Panel</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">{title}</h2>
            <p className="text-sm text-slate-300/80">{subtitle}</p>
          </div>
          <label className="relative inline-flex h-11 min-w-[220px] items-center overflow-hidden rounded-xl border border-sky-300/20 bg-slate-900/60 px-3 text-sm text-slate-100">
            <span className="mr-2 text-xs uppercase tracking-[0.2em] text-slate-300/70">Page</span>
            <select
              value={current.path}
              onChange={(event) => navigate(event.target.value)}
              className="h-full w-full cursor-pointer appearance-none bg-transparent pr-6 text-sm text-slate-100 outline-none"
              aria-label="Control panel page selector"
            >
              {CONTROL_PANEL_PAGES.map((page) => (
                <option key={page.key} value={page.path} className="bg-slate-900 text-slate-100">
                  {page.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-300" />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {CONTROL_PANEL_PAGES.map((page) => {
            const active = page.path === current.path
            return (
              <button
                key={page.key}
                type="button"
                onClick={() => navigate(page.path)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition ${
                  active
                    ? "border-sky-300/50 bg-sky-400/20 text-sky-100 shadow-[0_0_18px_hsl(201_96%_46%/0.25)]"
                    : "border-slate-700/80 bg-slate-900/40 text-slate-300 hover:border-sky-300/40 hover:text-slate-100"
                }`}
              >
                <page.Icon className="h-4 w-4" />
                {page.label}
              </button>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

export default ControlPanelPageNav
