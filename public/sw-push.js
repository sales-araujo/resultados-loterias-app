// Custom Service Worker for Push Notifications
// This runs alongside the next-pwa generated SW

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Loterias Caixa",
      body: event.data.text(),
      icon: "/icons/icon-192x192.png",
    };
  }

  const options = {
    body: payload.body || "Novo resultado disponível!",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    tag: payload.tag || "lottery-result",
    renotify: true,
    data: {
      url: payload.url || "/",
      gameId: payload.gameId || null,
      concurso: payload.concurso || null,
    },
    actions: [
      {
        action: "view",
        title: "Ver Resultado",
      },
      {
        action: "dismiss",
        title: "Dispensar",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      payload.title || "Loterias Caixa",
      options
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(urlToOpen);
            return;
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});
