// components/LandscapeBlocker.jsx
import React, { useState, useEffect } from "react";
import { RotateCcw, Smartphone } from "lucide-react";

const LandscapeBlocker = ({ children }) => {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Check if device is mobile/tablet (max-width: 1024px) and in landscape
      const isMobileTablet = window.innerWidth <= 1024;
      const isLandscapeMode = window.innerWidth > window.innerHeight;

      setIsLandscape(isMobileTablet && isLandscapeMode);
    };

    // Check on mount
    checkOrientation();

    // Listen to orientation and resize changes
    window.addEventListener("orientationchange", () => {
      // Small delay to ensure dimensions are updated after orientation change
      setTimeout(checkOrientation, 100);
    });

    window.addEventListener("resize", checkOrientation);

    return () => {
      window.removeEventListener("orientationchange", checkOrientation);
      window.removeEventListener("resize", checkOrientation);
    };
  }, []);

  if (isLandscape) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white p-8 max-w-sm">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <Smartphone className="w-16 h-16 text-white" />
              <RotateCcw
                className="w-8 h-8 text-blue-400 absolute -top-2 -right-2 animate-spin"
                style={{ animationDuration: "2s" }}
              />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4">Portrait Mode Only</h2>
          <p className="text-gray-300 mb-6 leading-relaxed">
            This app is designed for portrait orientation. Please rotate your
            device to continue.
          </p>

          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
            <div
              className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default LandscapeBlocker;
