import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import LanguageDropdown from "@/components/LanguageDropdown";
import { useLiveStats } from "@/providers/LiveStatsProvider";
import { useMe } from "@/hooks/use-me";
import { isPaidTier, PLAN_CONFIG, type PlanTier } from "@/shared/planConfig";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { data: me } = useMe();
  const { snapshot, pulse, connected } = useLiveStats();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const rawTier = (me?.subscription?.tier as string | undefined) || "free";
  const tier: PlanTier = PLAN_CONFIG[rawTier as PlanTier] ? (rawTier as PlanTier) : "free";
  const isDevAccount = Boolean(me?.flags?.dev);
  const showFeedback = Boolean(user && (isDevAccount || isPaidTier(tier)));
  const showControlPanel = Boolean(user);
  const showLiveMiniBadges = Boolean(user && (snapshot || pulse));
  const activeUsers = pulse?.activeUsers ?? snapshot?.activeUsers ?? 0;
  const upgradesToday = snapshot?.upgradeSignals?.upgradedToday ?? pulse?.upgradedToday ?? 0;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/50 px-[max(env(safe-area-inset-left),var(--ae-main-px,1rem))] py-3 backdrop-blur-md md:py-4">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold font-display text-foreground sm:text-xl">AutoEditor</span>
          <span className="pill-badge text-[10px] py-0.5 px-2">
            <svg className="sparkle w-3 h-3 mr-1 inline-block" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M12 2l1.902 4.26L18.5 8l-4.598 1.74L12 14l-1.902-4.26L6.5 8l4.598-1.74L12 2z" fill="currentColor" />
            </svg>
            {t("brand.beta")}
          </span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {showLiveMiniBadges ? (
            <div className="hidden items-center gap-1 rounded-full border border-purple-300/30 bg-[#111325]/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-100 lg:inline-flex" title="Live active users from websocket/SSE feed">
              <span className={`inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-300" : "bg-amber-300"}`} />
              {activeUsers} live
            </div>
          ) : null}
          {showLiveMiniBadges ? (
            <div className="hidden items-center gap-1 rounded-full border border-cyan-300/25 bg-[#10131f]/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100 lg:inline-flex" title="Users upgraded today">
              {upgradesToday} upgrades
            </div>
          ) : null}
          <LanguageDropdown className="w-40" />
          <Link to="/pricing">
            <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground">
              {t("nav.pricing")}
            </Button>
          </Link>
          <Link to="/editor">
            <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground">
              {t("nav.editor")}
            </Button>
          </Link>
          {showFeedback ? (
            <Link to="/feedback">
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground">
                Video Feedback
              </Button>
            </Link>
          ) : null}
          {showControlPanel ? (
            <Link to="/control-panel">
              <Button variant="ghost" size="sm" className="rounded-full text-primary hover:text-primary">
                {t("nav.controlPanel")}
              </Button>
            </Link>
          ) : null}
          {user ? (
            <Button onClick={handleLogout} size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90">
              {t("nav.logout")}
            </Button>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                  {t("nav.signup")}
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="relative md:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/50 text-foreground"
            aria-label={mobileMenuOpen ? t("menu.close") : t("menu.open")}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          {mobileMenuOpen ? (
            <div className="absolute right-0 mt-2 flex w-56 flex-col gap-2 rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg">
              <LanguageDropdown />
              <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-full text-muted-foreground hover:text-foreground">
                <Link to="/pricing">{t("nav.pricing")}</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-full text-muted-foreground hover:text-foreground">
                <Link to="/editor">{t("nav.editor")}</Link>
              </Button>
              {showFeedback ? (
                <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-full text-muted-foreground hover:text-foreground">
                  <Link to="/feedback">Video Feedback</Link>
                </Button>
              ) : null}
              {showControlPanel ? (
                <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-full text-primary hover:text-primary">
                  <Link to="/control-panel">{t("nav.controlPanel")}</Link>
                </Button>
              ) : null}
              {user ? (
                <Button onClick={handleLogout} size="sm" className="w-full justify-center rounded-full bg-foreground text-background hover:bg-foreground/90">
                  {t("nav.logout")}
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-full text-muted-foreground hover:text-foreground">
                    <Link to="/login">{t("nav.login")}</Link>
                  </Button>
                  <Button asChild size="sm" className="w-full justify-center rounded-full bg-foreground text-background hover:bg-foreground/90">
                    <Link to="/signup">{t("nav.signup")}</Link>
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
