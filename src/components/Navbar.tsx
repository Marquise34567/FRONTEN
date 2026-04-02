import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    setMobileOpen(false);
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-border/30 bg-background/55 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-xl font-bold font-display text-foreground">AutoEditor</span>
        <span className="text-[11px] font-semibold text-muted-foreground/70">+</span>
        <span className="pill-badge text-[10px] py-0.5 px-2">
          <svg className="sparkle w-3 h-3 mr-1 inline-block" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M12 2l1.902 4.26L18.5 8l-4.598 1.74L12 14l-1.902-4.26L6.5 8l4.598-1.74L12 2z" fill="currentColor" />
          </svg>
          BETA
        </span>
      </Link>

      <div className="hidden items-center gap-3 md:flex">
        <Link to="/pricing">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground rounded-full px-5">
            Pricing
          </Button>
        </Link>
        <Link to="/editor">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground rounded-full px-5">
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
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground rounded-full px-5">
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

      <div className="relative md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.1]"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {mobileOpen ? (
          <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/10 bg-[linear-gradient(170deg,#0f1324_0%,#10182f_100%)] p-2 shadow-[0_24px_40px_-28px_rgba(0,0,0,0.85)]">
            <Link to="/pricing" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" size="sm" className="mb-1 w-full justify-start rounded-lg text-muted-foreground hover:text-foreground">
                Pricing
              </Button>
            </Link>
            <Link to="/editor" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" size="sm" className="mb-1 w-full justify-start rounded-lg text-muted-foreground hover:text-foreground">
                Editor
              </Button>
            </Link>
            {user ? (
              <Button
                onClick={handleLogout}
                size="sm"
                className="w-full justify-start rounded-lg bg-foreground text-background hover:bg-foreground/90"
              >
                Log out
              </Button>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" size="sm" className="mb-1 w-full justify-start rounded-lg text-muted-foreground hover:text-foreground">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full justify-start rounded-lg bg-foreground text-background hover:bg-foreground/90">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : null}
      </div>
    </nav>
  );
};

export default Navbar;
