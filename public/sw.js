console.log("🔧 Service Worker loaded");

// Cache name and resources for PWA
const CACHE_NAME = "hotel-pwa-v1";
const STATIC_CACHE_URLS = ["/", "/manifest.json", "/favic-trans-icon.png"];

// Install event - cache essential resources
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("📦 Caching essential resources");
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log("✅ Service Worker installed");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("❌ Service Worker install failed:", error);
      }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🔧 Service Worker activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("🗑️ Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log("✅ Service Worker activated");
        return self.clients.claim();
      }),
  );
});

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
  // Only cache GET requests for the same origin
  if (
    event.request.method === "GET" &&
    event.request.url.startsWith(self.location.origin)
  ) {
    event.respondWith(
      caches
        .match(event.request)
        .then((response) => {
          // Return cached version or fetch from network
          return response || fetch(event.request);
        })
        .catch(() => {
          // If both cache and network fail, return offline page for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        }),
    );
  }
});

// Push event handler - Essential for iOS PWA notifications
self.addEventListener("push", (event) => {
  console.log("📨 Push event received:", event);

  let notificationData;

  try {
    if (event.data) {
      notificationData = event.data.json();
      console.log("📨 Push notification data:", notificationData);
    } else {
      console.warn("⚠️ Push event has no data");
      notificationData = {
        title: "Hotel Management",
        body: "You have a new notification",
        icon: "/favic-trans-icon.png",
        badge: "/favic-trans-icon.png",
        tag: "default-notification",
      };
    }
  } catch (error) {
    console.error("❌ Error parsing push data:", error);
    notificationData = {
      title: "Hotel Management",
      body: "You have a new notification",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "default-notification",
    };
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon || "/favicon.ico",
    badge: notificationData.badge || "/favicon.ico",
    tag: notificationData.tag || "hotel-notification",
    data: notificationData.data || {},
    requireInteraction: true,
    actions: notificationData.actions || [
      {
        action: "view",
        title: "View Details",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    silent: false,
    renotify: false,
  };

  // Show notification - Required immediately for iOS
  event.waitUntil(
    self.registration
      .showNotification(notificationData.title, notificationOptions)
      .then(() => {
        console.log("✅ Push notification displayed successfully");

        // Update app badge if supported (iOS 16.4+)
        if ("setAppBadge" in navigator) {
          navigator
            .setAppBadge(1)
            .catch((err) => console.log("Badge API not available:", err));
        }
      })
      .catch((error) => {
        console.error("❌ Error displaying notification:", error);
      }),
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("🖱️ Notification clicked:", event.notification.data);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === "dismiss") {
    console.log("📝 Notification dismissed");
    return;
  }

  // Handle notification click
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            console.log("🎯 Focusing existing window");
            return client.focus();
          }
        }

        // Open new window if app is not open
        if (clients.openWindow) {
          console.log("🪟 Opening new window");
          return clients.openWindow("/");
        }
      })
      .catch((error) => {
        console.error("❌ Error handling notification click:", error);
      }),
  );
});

// Notification close event
self.addEventListener("notificationclose", (event) => {
  console.log("❌ Notification closed:", event.notification.data);

  // Clear app badge when notification is closed
  if ("clearAppBadge" in navigator) {
    navigator
      .clearAppBadge()
      .catch((err) => console.log("Badge clear not available:", err));
  }
});

// Background sync for offline actions (PWA feature)
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync triggered:", event.tag);

  if (event.tag === "background-sync") {
    event.waitUntil(
      // Handle background sync tasks here
      Promise.resolve().then(() => {
        console.log("✅ Background sync completed");
      }),
    );
  }
});

// Message handler for communication with main app
self.addEventListener("message", (event) => {
  console.log("💬 Message received in SW:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_BADGE") {
    if ("clearAppBadge" in navigator) {
      navigator
        .clearAppBadge()
        .catch((err) => console.log("Badge clear not available:", err));
    }
  }

  if (event.data && event.data.type === "SET_BADGE") {
    const count = event.data.count || 1;
    if ("setAppBadge" in navigator) {
      navigator
        .setAppBadge(count)
        .catch((err) => console.log("Badge API not available:", err));
    }
  }
});

console.log(
  "✅ Service Worker setup complete - PWA ready for iOS notifications",
);
