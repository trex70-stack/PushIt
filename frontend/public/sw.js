self.addEventListener("install", () => {
  // Sofort aktivieren ohne auf Tab-Reload zu warten
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Alle offenen Tabs sofort übernehmen
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "PushIt", body: event.data.text() };
  }

  const options = {
    body: data.body,
    icon: "/favicon.svg",
    image: data.image,
    data: data.data ?? {},
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
