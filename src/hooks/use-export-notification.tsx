import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { ToastAction } from "@/components/ui/toast";

type NotificationPermissionState = NotificationPermission | "unsupported";
type PermissionRequestSource = "app_load" | "export_start" | "manual_enable";

export type ExportCompleteNotificationPayload = {
  jobId: string;
  title?: string | null;
  downloadUrl?: string | null;
  editorUrl?: string | null;
  event?: "ready" | "downloaded" | "review";
};

type ToastInvoker = (payload: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactElement;
  duration?: number;
  variant?: "default" | "destructive";
}) => unknown;

type UseExportNotificationOptions = {
  toast: ToastInvoker;
  appName?: string;
  logoUrl?: string;
  fallbackLogoUrl?: string;
  requestPermissionOnMount?: boolean;
  playSound?: boolean;
  flashTitle?: boolean;
};

const PROMPTED_STORAGE_KEY = "autoeditor_export_notification_prompted_v1";
const HINT_DISMISSED_STORAGE_KEY = "autoeditor_export_notification_hint_dismissed_v1";

const safeLocalStorageGet = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeLocalStorageSet = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (private mode / blocked storage).
  }
};

const canUseNotificationApi = () =>
  typeof window !== "undefined" && typeof Notification !== "undefined";

const toAbsoluteAssetUrl = (value: string) => {
  if (typeof window === "undefined") return value;
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
};

const canShowForegroundToast = () => {
  if (typeof document === "undefined") return true;
  return !document.hidden && document.hasFocus();
};

export const useExportNotification = ({
  toast,
  appName = "AutoEditor",
  logoUrl = "/logo.png",
  fallbackLogoUrl = "/favicon-32x32.png",
  requestPermissionOnMount = true,
  playSound = true,
  flashTitle = true,
}: UseExportNotificationOptions) => {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (!canUseNotificationApi()) return "unsupported";
    return Notification.permission;
  });
  const [showEnableHint, setShowEnableHint] = useState(false);
  const promptedRef = useRef(false);
  const notifiedKeysRef = useRef(new Set<string>());
  const queuedToastRef = useRef<Map<string, ExportCompleteNotificationPayload>>(new Map());
  const titleFlashTimerRef = useRef<number | null>(null);
  const titleFlashStopTimerRef = useRef<number | null>(null);
  const baseTitleRef = useRef<string>(typeof document !== "undefined" ? document.title : "");

  const resolvedLogoUrl = useMemo(() => toAbsoluteAssetUrl(logoUrl), [logoUrl]);
  const resolvedFallbackLogoUrl = useMemo(() => toAbsoluteAssetUrl(fallbackLogoUrl), [fallbackLogoUrl]);

  const clearTitleFlash = useCallback(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    if (titleFlashTimerRef.current !== null) {
      window.clearInterval(titleFlashTimerRef.current);
      titleFlashTimerRef.current = null;
    }
    if (titleFlashStopTimerRef.current !== null) {
      window.clearTimeout(titleFlashStopTimerRef.current);
      titleFlashStopTimerRef.current = null;
    }
    if (baseTitleRef.current) {
      document.title = baseTitleRef.current;
    }
  }, []);

  const startTitleFlash = useCallback(() => {
    if (!flashTitle || typeof document === "undefined" || typeof window === "undefined") return;
    if (!document.hidden) return;
    clearTitleFlash();
    baseTitleRef.current = document.title;
    let toggle = false;
    titleFlashTimerRef.current = window.setInterval(() => {
      toggle = !toggle;
      document.title = toggle
        ? "★ Video Ready! Download now"
        : baseTitleRef.current || `${appName} Editor`;
    }, 850);
    titleFlashStopTimerRef.current = window.setTimeout(() => {
      clearTitleFlash();
    }, 12_000);
  }, [appName, clearTitleFlash, flashTitle]);

  const playSuccessTone = useCallback(() => {
    if (!playSound || typeof window === "undefined") return;
    const AudioContextClass = (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      gain.connect(context.destination);

      const oscA = context.createOscillator();
      oscA.type = "sine";
      oscA.frequency.setValueAtTime(780, now);
      oscA.frequency.exponentialRampToValueAtTime(1040, now + 0.16);
      oscA.connect(gain);
      oscA.start(now);
      oscA.stop(now + 0.18);

      const oscB = context.createOscillator();
      oscB.type = "triangle";
      oscB.frequency.setValueAtTime(1040, now + 0.16);
      oscB.frequency.exponentialRampToValueAtTime(1320, now + 0.34);
      oscB.connect(gain);
      oscB.start(now + 0.16);
      oscB.stop(now + 0.36);

      window.setTimeout(() => {
        void context.close().catch(() => undefined);
      }, 500);
    } catch {
      // Browser blocked autoplay audio or no audio context; ignore.
    }
  }, [playSound]);

  const openExportTarget = useCallback((payload: ExportCompleteNotificationPayload) => {
    if (typeof window === "undefined") return;
    const prefersEditor = payload.event === "downloaded" || payload.event === "review";
    const destination = prefersEditor
      ? (payload.editorUrl || payload.downloadUrl)
      : (payload.downloadUrl || payload.editorUrl);
    if (!destination) return;
    window.focus();
    const opened = window.open(destination, "_blank", "noopener,noreferrer");
    if (!opened && payload.editorUrl) {
      window.location.href = payload.editorUrl;
    }
  }, []);

  const renderToast = useCallback((payload: ExportCompleteNotificationPayload) => {
    const fallbackTitle = "edited video";
    const trimmedTitle = String(payload.title || "").trim();
    const displayTitle = trimmedTitle || fallbackTitle;
    const hasDownload = Boolean(payload.downloadUrl);
    const event = payload.event ?? "ready";
    const toastHeading = event === "downloaded"
      ? "Download complete"
      : event === "review"
        ? "AI review needed"
        : "Your video is ready! Download now";
    const toastDescription = event === "downloaded"
      ? `${displayTitle} is saved to your device.`
      : event === "review"
        ? `${displayTitle} is ready for approval. Open the editor to review.`
        : `${displayTitle} is ready to ${hasDownload ? "download" : "open"} now.`;
    const shouldShowAction = Boolean(payload.downloadUrl || payload.editorUrl);

    toast({
      duration: 14_000,
      title: (
        <div className="flex items-center gap-2">
          <img
            src={logoUrl}
            alt={`${appName} Logo`}
            width={22}
            height={22}
            className="h-[22px] w-[22px] rounded-sm object-cover"
            onError={(event) => {
              if (event.currentTarget.src !== resolvedFallbackLogoUrl) {
                event.currentTarget.src = resolvedFallbackLogoUrl;
              }
            }}
          />
          <span>{toastHeading}</span>
        </div>
      ),
      description: toastDescription,
      action: shouldShowAction ? (
        <ToastAction
          altText={hasDownload ? "Download exported video" : "Open editor"}
          onClick={(event) => {
            event.preventDefault();
            openExportTarget(payload);
          }}
        >
          {hasDownload ? "Download" : "Open editor"}
        </ToastAction>
      ) : undefined,
    });
  }, [appName, logoUrl, openExportTarget, resolvedFallbackLogoUrl, toast]);

  const collectServiceWorkerRegistrations = useCallback(async () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return [] as ServiceWorkerRegistration[];
    const collected: ServiceWorkerRegistration[] = [];
    try {
      const direct = await navigator.serviceWorker.getRegistration();
      if (direct) collected.push(direct);
    } catch {
      // ignore lookup errors
    }
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (Array.isArray(registrations)) {
        collected.push(...registrations);
      }
    } catch {
      // ignore lookup errors
    }
    if (collected.length === 0 && typeof window !== "undefined") {
      try {
        const ready = await Promise.race<ServiceWorkerRegistration | null>([
          navigator.serviceWorker.ready.then((registration) => registration).catch(() => null),
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), 1400);
          }),
        ]);
        if (ready) collected.push(ready);
      } catch {
        // ignore ready-state failures
      }
    }
    const unique: ServiceWorkerRegistration[] = [];
    const seenScopes = new Set<string>();
    for (const registration of collected) {
      const scope = String(registration?.scope || "");
      if (seenScopes.has(scope)) continue;
      seenScopes.add(scope);
      unique.push(registration);
    }
    return unique;
  }, []);

  const showSystemNotification = useCallback(async (payload: ExportCompleteNotificationPayload) => {
    if (!canUseNotificationApi() || Notification.permission !== "granted") return false;
    const trimmedTitle = String(payload.title || "").trim();
    const videoTitle = trimmedTitle || "edited video";
    const event = payload.event ?? "ready";
    const notificationTitle = event === "downloaded"
      ? `Download Complete – ${appName}`
      : event === "review"
        ? `AI Review Needed – ${appName}`
        : `Video Export Complete – ${appName}`;
    const body = event === "downloaded"
      ? `Your ${videoTitle} is saved to your device. Click to return to the editor.`
      : event === "review"
        ? `Your ${videoTitle} is ready for approval. Click to open the editor.`
        : `Your ${videoTitle} is ready to download! Click to return to the editor.`;
    const tag = `autoeditor-export-${event}-${payload.jobId}`;

    const options: NotificationOptions & { badge?: string; vibrate?: number[] } = {
      body,
      icon: resolvedLogoUrl,
      badge: resolvedLogoUrl,
      tag,
      renotify: true,
      data: {
        downloadUrl: payload.downloadUrl || null,
        editorUrl: payload.editorUrl || null,
      },
      vibrate: [90, 40, 70],
      requireInteraction: true,
    };

    try {
      const registrations = await collectServiceWorkerRegistrations();
      for (const registration of registrations) {
        if (typeof registration.showNotification !== "function") continue;
        await registration.showNotification(notificationTitle, options);
        return true;
      }
    } catch {
      // Fall back to direct Notification constructor.
    }

    try {
      const notification = new Notification(notificationTitle, options);
      notification.onclick = (event) => {
        event.preventDefault();
        notification.close();
        openExportTarget(payload);
      };
      window.setTimeout(() => notification.close(), 28_000);
      return true;
    } catch {
      // Ignore constructor failure.
    }
    return false;
  }, [appName, collectServiceWorkerRegistrations, openExportTarget, resolvedLogoUrl]);

  const ensureNotificationPermission = useCallback(async (source: PermissionRequestSource = "export_start") => {
    if (!canUseNotificationApi()) {
      setPermission("unsupported");
      return "unsupported" as const;
    }

    const current = Notification.permission;
    setPermission(current);
    if (current === "granted") {
      setShowEnableHint(false);
      return current;
    }
    if (current === "denied") {
      const dismissed = safeLocalStorageGet(HINT_DISMISSED_STORAGE_KEY) === "true";
      setShowEnableHint(!dismissed);
      return current;
    }

    const canPrompt = source === "manual_enable" || source === "export_start" || requestPermissionOnMount;
    if (!canPrompt) return current;
    // Allow export-start prompts even if app-load already prompted once.
    // This keeps a user-gesture path available to grant desktop notifications.
    if (promptedRef.current && source === "app_load") return current;

    promptedRef.current = true;
    safeLocalStorageSet(PROMPTED_STORAGE_KEY, "true");

    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next === "denied") {
        setShowEnableHint(true);
      } else if (next === "granted") {
        setShowEnableHint(false);
      }
      return next;
    } catch {
      return current;
    }
  }, [requestPermissionOnMount]);

  const dismissEnableHint = useCallback(() => {
    setShowEnableHint(false);
    if (typeof window === "undefined") return;
    safeLocalStorageSet(HINT_DISMISSED_STORAGE_KEY, "true");
  }, []);

  const notifyExportComplete = useCallback(async (payload: ExportCompleteNotificationPayload) => {
    const baseKey = String(payload.jobId || payload.downloadUrl || payload.editorUrl || "").trim();
    const eventKey = payload.event ?? "ready";
    const key = baseKey ? `${eventKey}:${baseKey}` : "";
    if (!key || notifiedKeysRef.current.has(key)) return;
    notifiedKeysRef.current.add(key);

    if (canShowForegroundToast()) {
      renderToast(payload);
    } else {
      queuedToastRef.current.set(key, payload);
    }

    playSuccessTone();
    startTitleFlash();

    let resolvedPermission: NotificationPermissionState = permission;
    if (resolvedPermission === "default" && typeof document !== "undefined" && document.hidden) {
      resolvedPermission = await ensureNotificationPermission("export_start");
    }

    if (resolvedPermission === "granted") {
      await showSystemNotification(payload);
      return;
    }
    if (resolvedPermission === "default") {
      const dismissed = safeLocalStorageGet(HINT_DISMISSED_STORAGE_KEY) === "true";
      if (!dismissed) setShowEnableHint(true);
      return;
    }
    if (resolvedPermission === "denied") {
      const dismissed = safeLocalStorageGet(HINT_DISMISSED_STORAGE_KEY) === "true";
      if (!dismissed) setShowEnableHint(true);
    }
  }, [ensureNotificationPermission, permission, playSuccessTone, renderToast, showSystemNotification, startTitleFlash]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    promptedRef.current = safeLocalStorageGet(PROMPTED_STORAGE_KEY) === "true";
    const dismissedHint = safeLocalStorageGet(HINT_DISMISSED_STORAGE_KEY) === "true";

    if (!canUseNotificationApi()) {
      setPermission("unsupported");
      setShowEnableHint(false);
      return;
    }

    const current = Notification.permission;
    setPermission(current);
    if (current === "denied" && !dismissedHint) {
      setShowEnableHint(true);
    }
    if (requestPermissionOnMount && current === "default" && !promptedRef.current) {
      void ensureNotificationPermission("app_load");
    }
  }, [ensureNotificationPermission, requestPermissionOnMount]);

  useEffect(() => {
    const flushQueuedToasts = () => {
      if (!canShowForegroundToast()) return;
      if (queuedToastRef.current.size === 0) return;
      const queued = Array.from(queuedToastRef.current.values());
      queuedToastRef.current.clear();
      for (const payload of queued) {
        renderToast(payload);
      }
      clearTitleFlash();
    };

    flushQueuedToasts();
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const onVisibilityOrFocus = () => flushQueuedToasts();
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [clearTitleFlash, renderToast]);

  useEffect(() => {
    return () => {
      clearTitleFlash();
    };
  }, [clearTitleFlash]);

  return {
    notificationPermission: permission,
    showEnableNotificationHint: showEnableHint,
    ensureNotificationPermission,
    dismissEnableNotificationHint: dismissEnableHint,
    notifyExportComplete,
  };
};
