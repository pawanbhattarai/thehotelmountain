import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Download, Smartphone } from "lucide-react";
import { showInstallPrompt, getPlatformInfo } from "@/lib/pwa";

export default function PWAInstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<any>(null);

  useEffect(() => {
    const info = getPlatformInfo();
    setPlatformInfo(info);

    // Show install prompt if PWA is installable and not already installed
    if (info.isInstallable && !info.isStandalone) {
      // Delay showing to avoid interrupting user experience
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const result = await showInstallPrompt();
      if (result) {
        setIsVisible(false);
      }
    } catch (error) {
      console.error("Installation failed:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Don't show again for this session
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  // Don't show if already dismissed or not installable
  if (
    !isVisible ||
    !platformInfo?.isInstallable ||
    platformInfo?.isStandalone
  ) {
    return null;
  }

  // Check if user already dismissed this session
  if (sessionStorage.getItem("pwa-prompt-dismissed")) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Install Hotel PMS App
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Add to your home screen for quick access and push notifications
                {platformInfo?.isIOS && " (required for iOS notifications)"}
              </p>

              <div className="flex items-center space-x-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
                >
                  {isInstalling ? (
                    <div className="flex items-center space-x-1">
                      <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent" />
                      <span>Installing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <Download className="h-3 w-3" />
                      <span>Install</span>
                    </div>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900 text-xs px-2 py-1"
                >
                  Not now
                </Button>
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
