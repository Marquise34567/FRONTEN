import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            BETA
          </span>
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/pricing">
            <Button variant="ghost" size="sm" className="rounded-full px-5 text-muted-foreground hover:text-foreground">
              Pricing
            </Button>
          </Link>
          <Link to="/editor">
            <Button variant="ghost" size="sm" className="rounded-full px-5 text-muted-foreground hover:text-foreground">
              Editor
            </Button>
          </Link>
          {user ? (
            <Button onClick={handleLogout} size="sm" className="rounded-full px-5 bg-foreground text-background hover:bg-foreground/90">
              Log out
            </Button>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="rounded-full px-5 text-muted-foreground hover:text-foreground">
                  Log in
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="rounded-full px-5 bg-foreground text-background hover:bg-foreground/90">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/50 text-foreground md:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="mx-auto mt-3 flex w-full max-w-6xl flex-col gap-2 rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg md:hidden">
          <Link to="/pricing">
            <Button variant="ghost" size="sm" className="w-full justify-center rounded-full text-muted-foreground hover:text-foreground">
              Pricing
            </Button>
          </Link>
          <Link to="/editor">
            <Button variant="ghost" size="sm" className="w-full justify-center rounded-full text-muted-foreground hover:text-foreground">
              Editor
            </Button>
          </Link>
          {user ? (
            <Button onClick={handleLogout} size="sm" className="w-full justify-center rounded-full bg-foreground text-background hover:bg-foreground/90">
              Log out
            </Button>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="w-full justify-center rounded-full text-muted-foreground hover:text-foreground">
                  Log in
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="w-full justify-center rounded-full bg-foreground text-background hover:bg-foreground/90">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : null}
    </nav>
  );
};

export default Navbar;
