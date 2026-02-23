import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/50 backdrop-blur-md border-b border-border/30">
        <Link to="/" className="flex items-center gap-2">
        <span className="text-xl font-bold font-display text-foreground">AutoEditor</span>
        <span className="pill-badge text-[10px] py-0.5 px-2">
          <svg className="sparkle w-3 h-3 mr-1 inline-block" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M12 2l1.902 4.26L18.5 8l-4.598 1.74L12 14l-1.902-4.26L6.5 8l4.598-1.74L12 2z" fill="currentColor" />
          </svg>
          BETA
        </span>
      </Link>
      <div className="flex items-center gap-3">
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
    </nav>
  );
};

export default Navbar;
