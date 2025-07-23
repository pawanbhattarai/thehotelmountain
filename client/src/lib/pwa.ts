// PWA utilities for iOS support and badge management

interface PWAInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Navigator {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
  standalone?: boolean;
}

interface Window {
  navigator: Navigator;
}

class PWAManager {
  private installPrompt: PWAInstallPromptEvent | null = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  async init() {
    await this.registerServiceWorker();
    this.setupInstallPrompt();
    this.setupBadgeSupport();
    this.detectStandaloneMode();
  }

  private async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        this.serviceWorkerRegistration = registration;

        console.log("🔧 Service Worker registered successfully");

        // Handle service worker updates
        registration.addEventListener("updatefound", () => {
          console.log("🔄 Service Worker update found");
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          console.log("💬 Message from SW:", event.data);
        });

        return registration;
      } catch (error) {
        console.error("❌ Service Worker registration failed:", error);
        throw error;
      }
    } else {
      throw new Error("Service Worker not supported");
    }
  }

  private setupInstallPrompt() {
    // Listen for PWA install prompt
    window.addEventListener("beforeinstallprompt", (e) => {
      console.log("📱 PWA install prompt available");
      e.preventDefault();
      this.installPrompt = e as PWAInstallPromptEvent;
    });

    // Handle PWA installation
    window.addEventListener("appinstalled", () => {
      console.log("✅ PWA installed successfully");
      this.installPrompt = null;
    });
  }

  private setupBadgeSupport() {
    // Badge API is available in iOS 16.4+ PWAs
    if ("setAppBadge" in navigator) {
      console.log("✅ Badge API supported");
    } else {
      console.log("ℹ️ Badge API not supported on this device");
    }
  }

  // Critical: Check if running in standalone mode
  isStandalone(): boolean {
    // iOS Safari - Primary detection method
    if (window.navigator.standalone === true) {
      return true;
    }

    // Android Chrome and other browsers
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }

    // iOS Safari additional check
    if (window.matchMedia("(display-mode: fullscreen)").matches) {
      return true;
    }

    // Fallback: Check for source parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("source") === "pwa") {
      return true;
    }

    // Additional iOS checks
    const isIOSDevice = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    const isStandaloneCapable = window.navigator.standalone !== undefined;

    if (isIOSDevice && isStandaloneCapable) {
      // Check if window height suggests fullscreen mode
      const windowHeight = window.innerHeight;
      const screenHeight = window.screen.height;
      const ratio = windowHeight / screenHeight;

      // iOS Safari in standalone mode typically uses full screen height
      if (ratio > 0.9) {
        return true;
      }
    }

    return false;
  }

  // Force standalone mode detection on page load
  detectStandaloneMode() {
    const standalone = this.isStandalone();
    console.log("🔍 PWA Standalone mode:", standalone);

    // Set a flag for CSS targeting
    if (standalone) {
      document.documentElement.setAttribute("data-pwa-standalone", "true");
      console.log("✅ Running in PWA standalone mode");
    } else {
      document.documentElement.setAttribute("data-pwa-standalone", "false");
      console.log("ℹ️ Running in browser mode");
    }

    return standalone;
  }

  async showInstallPrompt(): Promise<boolean> {
    if (!this.installPrompt) {
      console.log("📱 Install prompt not available");
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const result = await this.installPrompt.userChoice;

      if (result.outcome === "accepted") {
        console.log("✅ User accepted PWA install");
        this.installPrompt = null;
        return true;
      } else {
        console.log("❌ User dismissed PWA install");
        return false;
      }
    } catch (error) {
      console.error("❌ Install prompt failed:", error);
      return false;
    }
  }

  isInstallable(): boolean {
    return this.installPrompt !== null;
  }

  async setBadge(count?: number): Promise<void> {
    try {
      if ("setAppBadge" in navigator) {
        await navigator.setAppBadge!(count);
        console.log(`📍 Badge set to: ${count || "dot"}`);
      } else {
        // Fallback: Send message to service worker
        if (this.serviceWorkerRegistration?.active) {
          this.serviceWorkerRegistration.active.postMessage({
            type: "SET_BADGE",
            count: count || 1,
          });
        }
      }
    } catch (error) {
      console.error("❌ Failed to set badge:", error);
    }
  }

  async clearBadge(): Promise<void> {
    try {
      if ("clearAppBadge" in navigator) {
        await navigator.clearAppBadge!();
        console.log("🔄 Badge cleared");
      } else {
        // Fallback: Send message to service worker
        if (this.serviceWorkerRegistration?.active) {
          this.serviceWorkerRegistration.active.postMessage({
            type: "CLEAR_BADGE",
          });
        }
      }
    } catch (error) {
      console.error("❌ Failed to clear badge:", error);
    }
  }

  async updateServiceWorker(): Promise<void> {
    if (this.serviceWorkerRegistration) {
      try {
        await this.serviceWorkerRegistration.update();
        console.log("🔄 Service Worker updated");
      } catch (error) {
        console.error("❌ Service Worker update failed:", error);
      }
    }
  }

  // iOS-specific PWA checks
  isIOSPWA(): boolean {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = this.isStandalone();
    return isIOS && isStandalone;
  }

  // Get platform-specific info
  getPlatformInfo() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isStandalone = this.isStandalone();
    const isInstallable = this.isInstallable();

    return {
      isIOS,
      isAndroid,
      isStandalone,
      isInstallable,
      isPWA: isStandalone,
      supportsNotifications: "Notification" in window,
      supportsBadges: "setAppBadge" in navigator,
      serviceWorkerSupported: "serviceWorker" in navigator,
    };
  }
}

export const pwaManager = new PWAManager();

// Export utilities
// Add PWA installability check
async function checkPWAInstallability() {
  console.log("🔍 Checking PWA installability...");

  // Check required PWA criteria
  const checks = {
    serviceWorker: "serviceWorker" in navigator,
    manifest: false,
    icon: false,
    https: location.protocol === "https:" || location.hostname === "localhost",
    standalone: false,
  };

  try {
    // Check manifest
    const manifestResponse = await fetch("/manifest.json");
    checks.manifest = manifestResponse.ok;

    // Check icon
    const iconResponse = await fetch("/favicon-icon.png");
    checks.icon = iconResponse.ok;

    // Check if standalone mode is supported
    checks.standalone = window.matchMedia("(display-mode: standalone)").matches;

    console.log("📋 PWA Check Results:", checks);

    const installable =
      checks.serviceWorker && checks.manifest && checks.icon && checks.https;

    if (installable) {
      console.log("✅ PWA meets installability criteria");
    } else {
      console.warn(
        "⚠️ PWA installability issues found:",
        Object.entries(checks)
          .filter(([_, value]) => !value)
          .map(([key]) => key),
      );
    }

    return installable;
  } catch (error) {
    console.error("❌ PWA check failed:", error);
    return false;
  }
}

export const initPWA = async () => {
  await pwaManager.init();
  await checkPWAInstallability();
};
export const showInstallPrompt = () => pwaManager.showInstallPrompt();
export const setBadge = (count?: number) => pwaManager.setBadge(count);
export const clearBadge = () => pwaManager.clearBadge();
export const isStandalone = () => pwaManager.isStandalone();
export const isIOSPWA = () => pwaManager.isIOSPWA();
export const getPlatformInfo = () => pwaManager.getPlatformInfo();
