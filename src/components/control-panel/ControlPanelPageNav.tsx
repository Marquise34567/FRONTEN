import { motion } from "framer-motion"
import { Bot, ChevronDown, Cpu, Flame, Globe2, Landmark, LayoutDashboard, ShieldAlert, TrendingUp, Wrench } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

type ControlPanelPage = {
  key: "overview" | "emotion" | "audience" | "growth" | "infrastructure" | "security" | "algorithm" | "bank" | "ops"
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
  { key: "bank", label: "The Bank", path: "/dev/control-panel/bank", Icon: Landmark }
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
      className="glass-card relative overflow-hidden border-border/60 bg-[radial-gradient(130%_160%_at_92%_-18%,hsl(var(--glow-secondary)/0.2),transparent_46%),radial-gradient(140%_150%_at_7%_100%,hsl(var(--primary)/0.16),transparent_48%),linear-gradient(165deg,hsl(var(--card)/0.74)_0%,hsl(var(--card)/0.48)_100%)] p-4 sm:p-5"
    >
      <div className="pointer-events-none absolute -left-10 top-6 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
      <div className="pointer-events-none absolute right-8 top-2 h-16 w-16 rounded-full bg-sky-400/20 blur-2xl" />

      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="pill-badge text-[10px]">Control Panel</span>
            <h2 className="mt-2 text-2xl font-bold font-display tracking-tight text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <label className="relative inline-flex h-11 min-w-[220px] items-center overflow-hidden rounded-xl border border-border/60 bg-card/45 px-3 text-sm text-foreground">
            <span className="mr-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Page</span>
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
                    ? "border-primary/45 bg-primary/15 text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.2)]"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/35 hover:text-foreground"
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
