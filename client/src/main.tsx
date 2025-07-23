import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPWA } from "./lib/pwa";
initPWA().catch(console.error);

// Enhanced iOS PWA Service Worker Registration
async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      // Enhanced iOS detection including all iPad models
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
        (navigator.userAgent.includes("Mac") && "ontouchend" in document);

      // Check if running in standalone mode (iOS PWA)
      const isStandalone =
        (window.navigator as any).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches;

      console.log("🔧 Registering service worker...", {
        isIOS,
        isStandalone,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      });

      // iOS-specific service worker registration
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });

      console.log("✅ Service Worker registered:", registration);

      // iOS-specific handling
      if (isIOS) {
        if (isStandalone) {
          console.log("✅ iOS PWA running in standalone mode");
          console.log("🔔 Push notifications should be available");

          // Add iOS PWA class to body for CSS styling
          document.body.classList.add("ios-pwa-standalone");
        } else {
          console.log("📱 iOS Safari detected - PWA can be installed");
          console.log("💡 To install: Share button (□↗) → Add to Home Screen");
          console.log("⚠️ Push notifications require installation as PWA");

          // Add iOS Safari class to body
          document.body.classList.add("ios-safari-browser");
        }

        // Force update check for iOS
        registration.addEventListener("updatefound", () => {
          console.log("🔄 Service Worker update found");
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("🎯 New Service Worker ready for iOS");
                if (isStandalone) {
                  console.log("🔔 iOS PWA ready for push notifications");
                }
              }
            });
          }
        });
      }

      // Check for updates every 5 minutes in iOS
      if (isIOS) {
        setInterval(
          () => {
            registration.update();
          },
          5 * 60 * 1000,
        );
      }
    } catch (error) {
      console.error("❌ Service Worker registration failed:", error);
    }
  }
}

// Register service worker
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);

// PWA initialization is already handled by initPWA() call at the top
// No additional initialization needed here
