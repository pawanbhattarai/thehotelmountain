import { Button } from "@/components/ui/button";
import { ReactNode, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
  onMobileMenuToggle?: () => void;
}

export default function Header({
  title,
  subtitle,
  action,
  onMobileMenuToggle,
}: HeaderProps) {
  const isMobile = useIsMobile();
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: isMobile ? "short" : "long",
    year: "numeric",
    month: isMobile ? "short" : "long",
    day: "numeric",
    timeZone: "Asia/Kathmandu",
  });

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
              {title}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 truncate">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 ml-2">
            {!isMobile && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                  Today: {currentDate}
                </p>
              </div>
            )}

            {isMobile && (
              <div className="text-right text-xs">
                <p className="font-medium text-gray-900">{currentDate}</p>
              </div>
            )}

            <div className="flex-shrink-0">{action}</div>
          </div>
        </div>
      </header>
    </>
  );
}
