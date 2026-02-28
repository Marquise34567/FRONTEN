import { motion } from "framer-motion"
import {
  Activity,
  BarChart3,
  Bot,
  ChevronDown,
  Cpu,
  Flame,
  Globe2,
  Landmark,
  LayoutDashboard,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

type ControlPanelPage = {
  key: "overview" | "analytics" | "emotion" | "audience" | "growth" | "infrastructure" | "security" | "algorithm" | "bank" | "ops"
  label: string
  path: string
  Icon: typeof LayoutDashboard
  accent: string
}

const CONTROL_PANEL_PAGES: ControlPanelPage[] = [
  {
    key: "overview",
    label: "Overview",
    path: "/dev/control-panel/overview",
    Icon: LayoutDashboard,
    accent: "from-sky-300/35 via-sky-300/5 to-transparent"
  },
  {
    key: "analytics",
    label: "Analytics",
    path: "/dev/control-panel/analytics",
    Icon: BarChart3,
    accent: "from-cyan-300/35 via-cyan-300/5 to-transparent"
  },
  {
    key: "emotion",
    label: "Emotion",
    path: "/dev/control-panel/emotion",
    Icon: Flame,
    accent: "from-fuchsia-300/35 via-fuchsia-300/5 to-transparent"
  },
  {
    key: "audience",
    label: "Audience Intel",
    path: "/dev/control-panel/audience",
    Icon: Globe2,
    accent: "from-emerald-300/35 via-emerald-300/5 to-transparent"
  },
  {
    key: "growth",
    label: "Growth Intel",
    path: "/dev/control-panel/growth",
    Icon: TrendingUp,
    accent: "from-lime-300/35 via-lime-300/5 to-transparent"
  },
  {
    key: "infrastructure",
    label: "Infrastructure",
    path: "/dev/control-panel/infrastructure",
    Icon: Cpu,
    accent: "from-indigo-300/35 via-indigo-300/5 to-transparent"
  },
  {
    key: "security",
    label: "Security",
    path: "/dev/control-panel/security",
    Icon: ShieldAlert,
    accent: "from-amber-300/35 via-amber-300/5 to-transparent"
  },
  {
    key: "algorithm",
    label: "Algorithm",
    path: "/dev/control-panel/algorithm",
    Icon: Bot,
    accent: "from-violet-300/35 via-violet-300/5 to-transparent"
  },
  {
    key: "ops",
    label: "Ops Tools",
    path: "/dev/control-panel/ops",
    Icon: Wrench,
    accent: "from-rose-300/35 via-rose-300/5 to-transparent"
  },
  {
    key: "bank",
    label: "The Bank",
    path: "/dev/control-panel/bank",
    Icon: Landmark,
    accent: "from-yellow-300/35 via-yellow-300/5 to-transparent"
  }
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
      className="control-panel-shell relative overflow-hidden p-4 sm:p-5"
    >
      <div className="pointer-events-none absolute -left-14 top-4 h-36 w-36 rounded-full bg-primary/18 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-4 h-24 w-24 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-44 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <span className="pill-badge text-[10px]">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Creator Command Surface
            </span>
            <h2 className="text-2xl font-bold font-display tracking-tight text-foreground">{title}</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="control-panel-status-chip">
                <Activity className="h-3.5 w-3.5 text-emerald-200" />
                Live telemetry stream
              </span>
              <span className="rounded-full border border-primary/30 bg-primary/12 px-2.5 py-1 text-primary">
                {current.label}
              </span>
            </div>
          </div>
          <label className="control-panel-nav-select relative inline-flex h-12 min-w-[240px] items-center overflow-hidden rounded-xl px-3 text-sm text-foreground">
            <span className="mr-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Panel</span>
            <select
              value={current.path}
              onChange={(event) => navigate(event.target.value)}
              className="h-full w-full cursor-pointer appearance-none bg-transparent pr-6 text-sm text-foreground outline-none"
              aria-label="Control panel page selector"
            >
              {CONTROL_PANEL_PAGES.map((page) => (
                <option key={page.key} value={page.path} className="bg-card text-foreground">
                  {page.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
          </label>
        </div>

        <div className="hidden grid-cols-2 gap-2 md:grid lg:grid-cols-3 xl:grid-cols-5">
          {CONTROL_PANEL_PAGES.map((page) => {
            const active = page.path === current.path
            return (
              <button
                key={page.key}
                type="button"
                onClick={() => navigate(page.path)}
                className={`control-panel-nav-button group relative overflow-hidden rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "control-panel-nav-button-active border-primary/55 bg-primary/20 text-foreground"
                    : "border-border/55 bg-card/45 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                }`}
              >
                <span className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r ${page.accent}`} />
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                  active ? "border-primary/45 bg-primary/20 text-primary" : "border-border/50 bg-card/65 text-muted-foreground"
                }`}>
                  <page.Icon className="h-4 w-4" />
                </span>
                <span className="ml-2 text-sm font-medium">{page.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
          {CONTROL_PANEL_PAGES.map((page) => {
            const active = page.path === current.path
            return (
              <button
                key={`mobile-${page.key}`}
                type="button"
                onClick={() => navigate(page.path)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? "border-primary/50 bg-primary/18 text-foreground"
                    : "border-border/55 bg-card/45 text-muted-foreground"
                }`}
              >
                <page.Icon className="h-3.5 w-3.5" />
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
