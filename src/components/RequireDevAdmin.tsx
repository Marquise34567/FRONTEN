import { ReactNode } from "react";
import { useMe } from "@/hooks/use-me";
import NotFound from "@/pages/NotFound";

const RequireDevAdmin = ({ children }: { children: ReactNode }) => {
  const { data, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!data?.flags?.dev) {
    return <NotFound />;
  }

  return <>{children}</>;
};

export default RequireDevAdmin;

