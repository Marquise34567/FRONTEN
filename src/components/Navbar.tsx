import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/use-me";
import LanguageDropdown from "@/components/LanguageDropdown";
import { isControlPanelOwnerEmail } from "@/lib/controlPanelAccess";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { data: me } = useMe();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHeightPx, setNavHeightPx] = useState(72);
  const navRef = useRef<HTMLElement | null>(null);
  const showControlPanel = isControlPanelOwnerEmail(user?.email ?? me?.user?.email);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const updateNavHeight = () => {
      const nextHeight = Math.ceil(navRef.current?.getBoundingClientRect().height || 0);
      if (nextHeight > 0) setNavHeightPx(nextHeight);
    };

    updateNavHeight();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateNavHeight) : null;
    if (observer && navRef.current) observer.observe(navRef.current);
    window.addEventListener("resize", updateNavHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateNavHeight);
    };
  }, [scrolled, mobileMenuOpen]);

  return (
    <>
      <nav
        ref={navRef}
        className={
          `fixed top-0 left-0 right-0 z-50 px-[max(env(safe-area-inset-left),var(--ae-main-px,1rem))] backdrop-blur-md transition-all duration-300 ease-in-out ` +
          (scrolled
            ? "border-b border-border/30 bg-background/90 shadow-lg py-2"
            : "border-b border-border/30 bg-background/40 py-4")
        }
      >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2">
        <Link to="/" className="flex min-w-0 items-center gap-2 nav-slide">
          <span className={`truncate text-lg font-bold font-display text-foreground sm:text-xl transform transition-transform duration-300 ${scrolled ? 'scale-95' : 'scale-100'}`}>
            AutoEditor
          </span>
          <span className="pill-badge hidden px-2 py-0.5 text-[10px] sm:inline-flex">
            <svg className="sparkle w-3 h-3 mr-1 inline-block" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M12 2l1.902 4.26L18.5 8l-4.598 1.74L12 14l-1.902-4.26L6.5 8l4.598-1.74L12 2z" fill="currentColor" />
            </svg>
            {t("brand.beta")}
          </span>
        </Link>

        <div className="hidden items-center gap-2 md:flex nav-pop">
          <LanguageDropdown className="w-40" />
          <Link to="/pricing" className="inline-flex nav-float nav-float-pricing">
            <Button variant="ghost" size="sm" className="nav-cta-ghost">
              {t("nav.pricing")}
            </Button>
          </Link>
          {showControlPanel ? (
            <Link to="/dev/control-panel/overview">
              <Button variant="ghost" size="sm" className="rounded-full text-primary hover:text-primary">
                {t("nav.controlPanel")}
              </Button>
            </Link>
          ) : null}
          {user ? (
            <Button onClick={handleLogout} size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90 nav-cta">
              {t("nav.logout")}
            </Button>
          ) : (
            <>
              <Link to="/login" className="inline-flex nav-float nav-float-login">
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground nav-cta-ghost">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link to="/signup" className="inline-flex nav-float nav-float-signup">
                <Button size="sm" className="rounded-full text-background nav-cta nav-cta-siren">
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
            <div className="absolute right-0 mt-2 flex w-56 flex-col gap-2 rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg nav-menu-pop">
              <LanguageDropdown />
              <div className="relative group w-full">
                <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-full nav-cta-ghost">
                  <Link to="/pricing">{t("nav.pricing")}</Link>
                </Button>
                <span className="cta-note cta-note-mobile">Sign up to unlock pro features — free trial!</span>
              </div>
              {showControlPanel ? (
                <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-full text-primary hover:text-primary">
                  <Link to="/dev/control-panel">{t("nav.controlPanel")}</Link>
                </Button>
              ) : null}
              {user ? (
                <Button onClick={handleLogout} size="sm" className="w-full justify-center rounded-full bg-foreground text-background hover:bg-foreground/90">
                  {t("nav.logout")}
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-full text-muted-foreground hover:text-foreground nav-cta-ghost">
                    <Link to="/login">{t("nav.login")}</Link>
                  </Button>
                  <Button asChild size="sm" className="w-full justify-center rounded-full text-background nav-cta nav-cta-siren">
                    <Link to="/signup">{t("nav.signup")}</Link>
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
      </nav>
      <div aria-hidden className="w-full" style={{ height: `${navHeightPx}px` }} />
    </>
  );
};

export default Navbar;
