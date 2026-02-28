import * as React from "react";

type ScreenDevice = "mobile" | "tablet" | "desktop";
type ScreenOrientation = "portrait" | "landscape";
type ScreenRatioBucket = "ultra_tall" | "tall" | "standard" | "wide" | "ultra_wide";

type ScreenProfile = {
  width: number;
  height: number;
  ratio: number;
  orientation: ScreenOrientation;
  ratioBucket: ScreenRatioBucket;
  device: ScreenDevice;
  hasCoarsePointer: boolean;
  isMobileSignal: boolean;
  isTouchSignal: boolean;
};

const MOBILE_MAX_WIDTH = 767;
const TABLET_MAX_WIDTH = 1180;
const WIDE_RATIO = 1.45;
const ULTRA_WIDE_RATIO = 1.9;
const TALL_RATIO = 0.72;
const ULTRA_TALL_RATIO = 0.58;

const getViewport = () => {
  if (typeof window === "undefined") return { width: 1280, height: 720 };
  const viewport = window.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
  return { width, height };
};

const hasCoarsePointer = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
};

const hasTouchPoints = () => {
  if (typeof navigator === "undefined") return false;
  return Number(navigator.maxTouchPoints || 0) > 0;
};

const resolveRatioBucket = (ratio: number): ScreenRatioBucket => {
  if (ratio <= ULTRA_TALL_RATIO) return "ultra_tall";
  if (ratio <= TALL_RATIO) return "tall";
  if (ratio >= ULTRA_WIDE_RATIO) return "ultra_wide";
  if (ratio >= WIDE_RATIO) return "wide";
  return "standard";
};

const resolveDevice = ({
  width,
  height,
  coarsePointer,
}: {
  width: number;
  height: number;
  coarsePointer: boolean;
}): ScreenDevice => {
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);
  if (shortest <= MOBILE_MAX_WIDTH) return "mobile";
  if (shortest <= TABLET_MAX_WIDTH) return "tablet";
  if (coarsePointer && longest <= 1400) return "tablet";
  return "desktop";
};

const buildScreenProfile = (): ScreenProfile => {
  const { width, height } = getViewport();
  const innerWidth = typeof window === "undefined"
    ? width
    : Math.max(1, Math.round(window.innerWidth || width));
  const ratio = width / Math.max(1, height);
  const coarsePointer = hasCoarsePointer();
  const touchSignal = coarsePointer || hasTouchPoints();
  // Keep mobile-specific layout tied to viewport width so touch laptops/tablets
  // do not accidentally receive phone-only UI treatment.
  const mobileSignal = innerWidth <= MOBILE_MAX_WIDTH;
  const orientation: ScreenOrientation = width >= height ? "landscape" : "portrait";
  return {
    width,
    height,
    ratio,
    orientation,
    ratioBucket: resolveRatioBucket(ratio),
    device: resolveDevice({ width, height, coarsePointer }),
    hasCoarsePointer: coarsePointer,
    isMobileSignal: mobileSignal,
    isTouchSignal: touchSignal,
  };
};

const applyScreenProfileToDocument = (profile: ScreenProfile) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.device = profile.device;
  root.dataset.orientation = profile.orientation;
  root.dataset.ratio = profile.ratioBucket;
  root.dataset.touch = profile.isTouchSignal ? "true" : "false";
  root.style.setProperty("--ae-screen-width", `${profile.width}`);
  root.style.setProperty("--ae-screen-height", `${profile.height}`);
  root.style.setProperty("--ae-screen-ratio", profile.ratio.toFixed(4));
  root.classList.toggle("mobile", profile.isMobileSignal);
  root.classList.toggle("touch", profile.isTouchSignal);
};

const clearScreenProfileFromDocument = () => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  delete root.dataset.device;
  delete root.dataset.orientation;
  delete root.dataset.ratio;
  delete root.dataset.touch;
  root.style.removeProperty("--ae-screen-width");
  root.style.removeProperty("--ae-screen-height");
  root.style.removeProperty("--ae-screen-ratio");
  root.classList.remove("mobile");
  root.classList.remove("touch");
};

export const useScreenProfile = () => {
  const [profile, setProfile] = React.useState<ScreenProfile>(() => buildScreenProfile());

  React.useEffect(() => {
    let frame = 0;
    const sync = () => {
      const next = buildScreenProfile();
      applyScreenProfileToDocument(next);
      setProfile(next);
    };

    const onResize = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });
    const pointerMedia = window.matchMedia("(pointer: coarse)");
    pointerMedia.addEventListener("change", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      pointerMedia.removeEventListener("change", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      clearScreenProfileFromDocument();
    };
  }, []);

  return profile;
};
