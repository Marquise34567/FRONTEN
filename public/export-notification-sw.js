self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const targetUrl = data.downloadUrl || data.editorUrl || "/editor";

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

