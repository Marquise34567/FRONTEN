import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

type GlowBackdropProps = {
  children: React.ReactNode;
};

const GlowBackdrop = ({ children }: GlowBackdropProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const staticMode = prefersReducedMotion || isMobile;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040607]">
      <div className="pointer-events-none absolute inset-0 z-0 [contain:paint]" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#040607_0%,#020304_100%)]" />

        {staticMode ? (
          <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(50%_55%_at_50%_0%,rgba(47,228,200,0.12),transparent_70%)]" />
        ) : (
          <>
            <motion.div
              className="absolute left-[10%] top-[10%] h-72 w-72 rounded-full opacity-[0.14] blur-[72px]"
              style={{ background: "radial-gradient(circle, rgba(47,228,200,0.5) 0%, transparent 72%)" }}
              animate={{ x: [0, 14, 0], y: [0, -12, 0], opacity: [0.11, 0.16, 0.11] }}
              transition={{ duration: 14, ease: [0.4, 0, 0.2, 1], repeat: Infinity }}
            />
            <motion.div
              className="absolute right-[14%] top-[20%] h-64 w-64 rounded-full opacity-[0.12] blur-[72px]"
              style={{ background: "radial-gradient(circle, rgba(180,119,255,0.45) 0%, transparent 72%)" }}
              animate={{ x: [0, -12, 0], y: [0, 10, 0], opacity: [0.09, 0.14, 0.09] }}
              transition={{ duration: 16, ease: [0.4, 0, 0.2, 1], repeat: Infinity }}
            />
          </>
        )}
      </div>

      <div className="relative z-10 [contain:layout_paint_style]">{children}</div>
    </div>
  );
};

export default GlowBackdrop;
