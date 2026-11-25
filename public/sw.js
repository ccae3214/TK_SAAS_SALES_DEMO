// One-time cleanup for the former demo/notes PWA worker.
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => name.startsWith("workbox-") || [
      "start-url", "apis", "others", "cross-origin", "static-js-assets", "static-style-assets",
      "static-image-assets", "static-data-assets", "static-audio-assets", "static-video-assets",
      "next-image", "next-data", "google-fonts-webfonts", "google-fonts-stylesheets"
    ].includes(name)).map((name) => caches.delete(name)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    await Promise.all(clients.map((client) => {
      const path = new URL(client.url).pathname;
      if (["/demo", "/notes", "/checkout", "/admin"].some((route) => path === route || path.startsWith(`${route}/`))) {
        return client.navigate("/");
      }
      return undefined;
    }));
  })());
});
