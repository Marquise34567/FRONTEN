import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:bg-[rgba(6,11,18,0.97)] group-[.toaster]:text-slate-100 group-[.toaster]:border-cyan-200/20 group-[.toaster]:shadow-[0_20px_56px_-34px_rgba(0,0,0,0.9)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:rounded-full group-[.toast]:bg-[linear-gradient(120deg,#2fe4c8,#2ab0ff,#b477ff)] group-[.toast]:text-white",
          cancelButton: "group-[.toast]:rounded-full group-[.toast]:bg-white/10 group-[.toast]:text-slate-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
