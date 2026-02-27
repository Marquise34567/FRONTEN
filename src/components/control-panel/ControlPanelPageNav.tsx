import { motion } from "framer-motion"
import {
  Bot,
  Cpu,
  Flame,
  Globe2,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ShieldAlert,
  TrendingUp,
  Wrench
} from "lucide-react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation("common")
  const location = useLocation()
  const navigate = useNavigate()
  const current = resolveCurrentPath(location.pathname)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: "easeOut" }}
      className="control-panel-nav-shell relative overflow-hidden rounded-3xl p-4 sm:p-5"
    >
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2">
              <p className="text-lg font-semibold tracking-tight text-slate-50">AutoEditor</p>
              <span className="pill-badge px-2 py-0.5 text-[10px]">
                <svg className="sparkle mr-1 inline-block h-3 w-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M12 2l1.902 4.26L18.5 8l-4.598 1.74L12 14l-1.902-4.26L6.5 8l4.598-1.74L12 2z" fill="currentColor" />
                </svg>
                {t("brand.beta")}
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300/70">Operator Command Center</p>
            <h2 className="font-['Sora'] text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.9rem]">{title}</h2>
            <p className="max-w-2xl text-sm text-slate-300/85">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-8 items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-400/15 px-3 text-[11px] font-semibold text-emerald-50">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
              Live sync
            </div>
            <div className="inline-flex h-8 items-center rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-100/90">
              {current.label}
            </div>
            <button
              type="button"
              onClick={() => navigate("/x-quantum-control-9")}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-amber-200/35 bg-amber-400/14 px-3 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-400/22 focus-visible:border-amber-100/55"
              aria-label="Open operator deck"
              title="Operator deck"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Secret Panel
            </button>
          </div>
        </div>

        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CONTROL_PANEL_PAGES.map((page) => {
            const active = page.path === current.path
            return (
              <button
                key={page.key}
                type="button"
                onClick={() => navigate(page.path)}
                data-active={active ? "true" : "false"}
                className="control-panel-nav-chip inline-flex h-10 snap-start items-center gap-2 rounded-xl px-3.5 text-sm"
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
