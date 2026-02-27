import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/use-me";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDevAccount = Boolean(me?.flags?.dev);
  const showControlPanel = Boolean(user && isDevAccount);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/88 px-[max(env(safe-area-inset-left),var(--ae-main-px,1rem))] py-3 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-white sm:text-lg">
          <span>AutoEditor</span>
          <span className="rounded-full border border-cyan-200/30 bg-cyan-400/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-100">
            BETA
          </span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/pricing" className="rounded-full px-3 py-1.5 text-sm text-slate-300 transition hover:text-white">
            Pricing
          </Link>
          <Link to="/editor" className="rounded-full px-3 py-1.5 text-sm text-slate-300 transition hover:text-white">
            Editor
          </Link>
          <Link to="/analytics" className="rounded-full px-3 py-1.5 text-sm text-slate-300 transition hover:text-white">
            Analytics
          </Link>
          {showControlPanel ? (
            <Link to="/control-panel" className="rounded-full px-3 py-1.5 text-sm text-cyan-100 transition hover:text-cyan-50">
              Control Panel
            </Link>
          ) : null}

          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="rounded-full">
                  Dashboard
                </Button>
              </Link>
              <Button onClick={handleLogout} size="sm" className="rounded-full bg-white text-black hover:bg-white/90">
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="outline" size="sm" className="rounded-full">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="rounded-full bg-white text-black hover:bg-white/90">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="relative md:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-white/[0.03] text-slate-100"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          {mobileMenuOpen ? (
            <div className="absolute right-0 mt-2 flex w-56 flex-col gap-2 rounded-2xl border border-white/12 bg-[rgba(7,11,18,0.98)] p-3 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.9)]">
              <Link to="/pricing" className="rounded-full px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04]">
                Pricing
              </Link>
              <Link to="/editor" className="rounded-full px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04]">
                Editor
              </Link>
              <Link to="/analytics" className="rounded-full px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04]">
                Analytics
              </Link>
              {user ? (
                <>
                  <Link to="/dashboard" className="rounded-full px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04]">
                    Dashboard
                  </Link>
                  <Button onClick={handleLogout} size="sm" className="w-full rounded-full bg-white text-black hover:bg-white/90">
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="outline" size="sm" className="w-full rounded-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button size="sm" className="w-full rounded-full bg-white text-black hover:bg-white/90">
                      Sign Up
                    </Button>
                  </Link>
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
