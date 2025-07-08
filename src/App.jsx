import React, { useState } from "react";
import SplashScreen from "./components/SplashScreen";
import RegistrationScreen from "./components/RegistrationScreen";
import SnapARExperience from "./components/SnapARExperience";
import EndScreen from "./components/EndScreen";
import Terms from "./components/terms";
import LandscapeBlocker from "./components/LandscapeBlocker"; // 🆕 Add this import

function App() {
  const [currentScreen, setCurrentScreen] = useState("splash");
  const [userData, setUserData] = useState(null);

  // 🚨 NEW: Add loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Your Snap AR credentials - REPLACE WITH YOUR ACTUAL VALUES
  const SNAP_API_TOKEN =
    "eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzUwMjUxNDQ5LCJzdWIiOiJmZDFmZDkyMi01NWI1LTQ3ZTQtOTlmOS1kMjQ1YzIyNzZjZWZ-UFJPRFVDVElPTn4wYTBiZDg4OC0zYzJkLTQ2NTQtOWJhZS04NWNkZjIwZGZkM2MifQ.DXp0F3LA8ZqxuB0UH4TCaQT2iMbCsc9xrT8xbuoYOJg";

  // 🚨 NEW: Error clearing function
  const clearError = () => setError("");

  // 🚨 ENHANCED: Navigation functions with error clearing
  const goToRegister = (sessionData) => {
    clearError();
    setCurrentScreen("register");
    if (sessionData) {
      setUserData(sessionData);
    }
  };

  const goToSnapAR = (data) => {
    clearError();
    setUserData(data);
    setCurrentScreen("snapar");
  };

  const goToEnd = (data) => {
    clearError();
    setUserData(data);
    setCurrentScreen("end");
  };

  // 🧹 COMPREHENSIVE CLEANUP FUNCTION
  const performDeepCleanup = async () => {
    try {
      console.log("🧹 Starting deep AR cleanup...");

      // Step 1: Cleanup AR cache completely
      if (window.snapARPreloadCache) {
        const cache = window.snapARPreloadCache;

        // Stop session properly with error handling
        if (cache.session) {
          try {
            await cache.session.pause();
            // Try to destroy if method exists
            if (typeof cache.session.destroy === "function") {
              await cache.session.destroy();
            }
            console.log("✅ Session stopped and destroyed");
          } catch (e) {
            console.log("Session cleanup:", e.message);
          }
        }

        // Stop all media tracks
        if (cache.mediaStream && cache.mediaStream.active) {
          cache.mediaStream.getTracks().forEach((track) => {
            if (track.readyState === "live") {
              track.stop();
              console.log(`✅ Stopped active ${track.kind} track`);
            }
          });
        }

        // Clear source with error handling
        if (cache.source) {
          try {
            if (typeof cache.source.destroy === "function") {
              cache.source.destroy();
            }
            cache.source = null;
            console.log("✅ Source cleared");
          } catch (e) {
            console.log("Source cleanup:", e.message);
          }
        }

        // Clear lenses
        if (cache.lenses) {
          cache.lenses = null;
          console.log("✅ Lenses cleared");
        }

        // Clear camera kit
        if (cache.cameraKit) {
          try {
            if (typeof cache.cameraKit.destroy === "function") {
              cache.cameraKit.destroy();
            }
            cache.cameraKit = null;
            console.log("✅ Camera Kit cleared");
          } catch (e) {
            console.log("Camera Kit cleanup:", e.message);
          }
        }

        // Finally, destroy the entire cache
        window.snapARPreloadCache = null;
        delete window.snapARPreloadCache;
        console.log("✅ AR cache completely destroyed");
      }

      // Step 2: Clear any remaining WebGL contexts
      const canvases = document.querySelectorAll("canvas");
      canvases.forEach((canvas) => {
        const gl = canvas.getContext("webgl") || canvas.getContext("webgl2");
        if (gl) {
          const loseContext = gl.getExtension("WEBGL_lose_context");
          if (loseContext) {
            loseContext.loseContext();
            console.log("✅ WebGL context cleared");
          }
        }

        // Remove canvas from DOM if it exists
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      });

      // Step 3: Force garbage collection (if available)
      if (window.gc) {
        window.gc();
        console.log("✅ Garbage collection triggered");
      }

      console.log("🎉 Deep cleanup completed successfully");
    } catch (error) {
      console.error("❌ Cleanup error:", error);
    }
  };

  // 🔄 ENHANCED Full Retry function with comprehensive cleanup
  const handleRetry = (retryData) => {
    console.log("🔄 Full Retry clicked - enhanced cleanup");
    setIsLoading(true);
    clearError();

    // Execute cleanup with proper timing
    setTimeout(async () => {
      try {
        await performDeepCleanup();

        // Clear localStorage based on retry type
        if (retryData?.freshStart) {
          localStorage.clear();
          console.log("✅ Complete localStorage cleared");
        } else if (retryData?.preserveSession) {
          localStorage.removeItem("userPhone");
          localStorage.removeItem("userId");
          localStorage.removeItem("userName");
          console.log("✅ User data cleared, session preserved");
        } else {
          localStorage.removeItem("userPhone");
          localStorage.removeItem("userId");
          localStorage.removeItem("userName");
          console.log("✅ User data cleared");
        }

        // Add additional delay before navigation
        setTimeout(() => {
          setIsLoading(false);

          if (retryData?.freshStart || !retryData) {
            setCurrentScreen("splash");
            setUserData(null);
          } else if (retryData?.preserveSession) {
            setCurrentScreen("register");
            setUserData(retryData);
          }
        }, 500); // 500ms delay before navigation
      } catch (error) {
        console.error("❌ Retry error:", error);
        setError("Failed to restart. Please refresh the page.");
        setIsLoading(false);
      }
    }, 1000); // 1 second delay before cleanup
  };

  // 🚀 ENHANCED Smart AR Retry with rate limiting and comprehensive cleanup
  const handleRetryAR = (retryUserData) => {
    console.log("🚀 Smart AR Retry - enhanced cleanup");

    // 🚨 RATE LIMITING: Prevent rapid retries
    const lastRetry = localStorage.getItem("lastRetryTime");
    const currentTime = Date.now();

    if (lastRetry && currentTime - parseInt(lastRetry) < 3000) {
      console.warn("⚠️ Rate limited: Please wait before retrying");
      setError("Please wait a moment before retrying...");

      // Clear error after 3 seconds
      setTimeout(() => setError(""), 3000);
      return;
    }

    localStorage.setItem("lastRetryTime", currentTime.toString());
    setIsLoading(true);
    clearError();

    // 🚨 NEW: Get the lens selection from the retry data or localStorage
    const selectedGroupSize =
      retryUserData?.groupSize ||
      localStorage.getItem("selectedGroupSize") ||
      "less";

    console.log(`🎯 Retrying with group size: ${selectedGroupSize}`);

    // 🧹 COMPREHENSIVE AR SESSION CLEANUP
    const cleanupARSession = async () => {
      if (window.snapARPreloadCache) {
        const cache = window.snapARPreloadCache;

        try {
          console.log("🧹 Starting comprehensive AR session cleanup...");

          // Stop session with proper error handling
          if (cache.session) {
            try {
              await cache.session.pause();
              // Add delay before destroying
              setTimeout(() => {
                try {
                  if (typeof cache.session.destroy === "function") {
                    cache.session.destroy();
                  }
                  console.log("✅ Session destroyed after pause");
                } catch (e) {
                  console.log("Session destroy:", e.message);
                }
              }, 100);
            } catch (e) {
              console.log("Session pause error:", e);
            }
          }

          // Stop media tracks with delay and proper checking
          if (cache.mediaStream && cache.mediaStream.active) {
            cache.mediaStream.getTracks().forEach((track) => {
              if (track.readyState === "live") {
                track.stop();
                console.log(`✅ Stopped active ${track.kind} track`);
              }
            });
          }

          // Clear WebGL contexts
          const canvases = document.querySelectorAll("canvas");
          canvases.forEach((canvas) => {
            const gl =
              canvas.getContext("webgl") || canvas.getContext("webgl2");
            if (gl) {
              const loseContext = gl.getExtension("WEBGL_lose_context");
              if (loseContext) {
                loseContext.loseContext();
              }
            }
          });

          // Reset cache properties for complete restart
          cache.sessionReady = false;
          cache.isPreloaded = false;
          cache.isPreloading = false;
          cache.mediaStream = null;
          cache.source = null;
          cache.lenses = null;
          cache.appliedLens = null;
          cache.needsCompleteRestart = true;

          console.log("✅ AR session cleanup completed");
        } catch (e) {
          console.error("❌ AR cleanup error:", e);
        }
      }
    };

    // Execute cleanup with delays
    setTimeout(async () => {
      try {
        await cleanupARSession();

        // Ensure lens selection is preserved
        localStorage.setItem("selectedGroupSize", selectedGroupSize);

        // Additional delay before starting new session
        setTimeout(() => {
          setIsLoading(false);

          // Set user data with restart flag
          setUserData({
            name: retryUserData.userName,
            phone: retryUserData.phone,
            userId: retryUserData.userId,
            sessionId: retryUserData.sessionId,
            groupSize: selectedGroupSize,
            isRetry: true,
            needsCompleteRestart: true,
          });

          setCurrentScreen("snapar");
        }, 1000); // 1 second delay before starting new AR session
      } catch (error) {
        console.error("❌ AR retry error:", error);
        setError("Failed to restart AR. Please try again.");
        setIsLoading(false);
      }
    }, 500); // 500ms delay before cleanup
  };

  const goToTerms = () => {
    clearError();
    setCurrentScreen("terms");
  };

  const goBackToRegister = () => {
    clearError();
    setCurrentScreen("register");
  };

  // 🆕 RENDER ALL CONTENT INSIDE LANDSCAPE BLOCKER
  const renderCurrentScreen = () => {
    // 🚨 LOADING STATE UI
    if (isLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-white max-w-[768px] mx-auto bg-black">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white/60 text-sm mt-2">Please wait a moment</p>
          </div>
        </div>
      );
    }

    // 🚨 ERROR STATE UI
    if (error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-white max-w-[768px] mx-auto bg-black">
          <div className="text-center">
            <p className="text-red-300 text-lg mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setError("");
                  setCurrentScreen("splash");
                  setUserData(null);
                }}
                className="block w-full px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={() => {
                  setError("");
                  // Try to continue from current state
                }}
                className="block w-full px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 🚨 NORMAL SCREEN RENDERING
    if (currentScreen === "splash") {
      return <SplashScreen onComplete={goToRegister} />;
    }

    if (currentScreen === "register") {
      return (
        <RegistrationScreen
          onComplete={goToSnapAR}
          onTerms={goToTerms}
          sessionData={userData}
        />
      );
    }

    if (currentScreen === "snapar") {
      return (
        <SnapARExperience
          onComplete={goToEnd}
          userData={userData}
          apiToken={SNAP_API_TOKEN}
        />
      );
    }

    if (currentScreen === "end") {
      return (
        <EndScreen
          onRetry={handleRetry}
          onRetryAR={handleRetryAR}
          userData={userData}
        />
      );
    }

    if (currentScreen === "terms") {
      return <Terms onBack={goBackToRegister} />;
    }

    return <SplashScreen onComplete={goToRegister} />;
  };

  // 🆕 WRAP EVERYTHING IN LANDSCAPE BLOCKER
  return <LandscapeBlocker>{renderCurrentScreen()}</LandscapeBlocker>;
}

export default App;
