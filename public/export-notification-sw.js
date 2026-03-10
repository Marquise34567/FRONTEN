self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = { body: event.data?.text?.() || "" };
  }

  const title = payload?.title || "Daily Creator Nudge";
  const body = payload?.body || "Open the editor for your next quick improvement.";
  const url = payload?.url || "/editor";
  const tag = payload?.tag || "autoeditor-daily-engagement";
  const icon = payload?.icon || "/favicon-32x32.png";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag,
      renotify: true,
      data: {
        url,
        editorUrl: url,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const targetUrl = data.downloadUrl || data.editorUrl || data.url || "/editor";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const current = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (current.origin === target.origin && "focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(target.href);
            return;
          }
        } catch (error) {
          // continue to fallback
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
