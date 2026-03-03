export const registerExportNotificationServiceWorker = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register("/export-notification-sw.js", {
      scope: "/",
    });
    return registration;
  } catch (error) {
    // Service worker support is optional for v1 export notifications.
    return null;
  }
};

