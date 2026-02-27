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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 z-0 [contain:paint]" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(65% 48% at 48% 8%, rgba(52,240,208,0.26), transparent 70%), radial-gradient(58% 56% at 82% 24%, rgba(192,132,252,0.18), transparent 74%), hsl(240 15% 5%)",
          }}
        />

        {staticMode ? (
          <div
            className="absolute left-1/2 top-[18%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full opacity-20 blur-[72px]"
            style={{
              background: "radial-gradient(circle, rgba(52,240,208,0.42) 0%, rgba(192,132,252,0.16) 52%, transparent 78%)",
            }}
          />
        ) : (
          <>
            <motion.div
              className="absolute left-[14%] top-[16%] h-[28rem] w-[28rem] rounded-full opacity-[0.18] blur-[84px] transform-gpu [backface-visibility:hidden] will-change-transform"
              style={{
                background: "radial-gradient(circle, rgba(52,240,208,0.45) 0%, rgba(192,132,252,0.15) 56%, transparent 78%)",
              }}
              animate={{ x: [0, 24, 8, 0], y: [0, -20, -8, 0], opacity: [0.15, 0.22, 0.18, 0.15] }}
              transition={{ duration: 16, ease: [0.4, 0, 0.2, 1], repeat: Infinity }}
            />
            <motion.div
              className="absolute right-[12%] top-[32%] h-[24rem] w-[24rem] rounded-full opacity-[0.12] blur-[78px] transform-gpu [backface-visibility:hidden] will-change-transform"
              style={{
                background: "radial-gradient(circle, rgba(192,132,252,0.42) 0%, rgba(52,240,208,0.12) 52%, transparent 76%)",
              }}
              animate={{ x: [0, -18, -4, 0], y: [0, 14, 4, 0], opacity: [0.1, 0.16, 0.13, 0.1] }}
              transition={{ duration: 18, ease: [0.4, 0, 0.2, 1], repeat: Infinity }}
            />
          </>
        )}

        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 54%, hsl(240 15% 5% / 0.76) 100%)" }}
        />
      </div>

      <div className="relative z-10 [contain:layout_paint_style]">{children}</div>
    </div>
  );
};

export default GlowBackdrop;

