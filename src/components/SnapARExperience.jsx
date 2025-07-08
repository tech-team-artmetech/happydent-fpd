import React, { useRef, useEffect, useState } from "react";
import { createMediaStreamSource, Transform2D } from "@snap/camera-kit";

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isTablet =
  /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768;
const isSohamDevice =
  window.innerWidth >= 350 && window.innerWidth <= 414 && !isTablet;

// Enhanced Canvas Management - NO CONTEXT ACCESS
const enhanceCanvas = (canvas) => {
  if (!canvas) return;

  try {
    // CRITICAL: Prevent canvas from being transferred to offscreen
    canvas.style.willChange = "auto"; // Remove will-change that triggers offscreen
    canvas.style.transform = "none"; // Remove transforms that trigger offscreen

    // Set stable styles
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.objectFit = "cover";
    canvas.style.zIndex = "1";

    // DO NOT get context - this was causing OffscreenCanvas errors
    // Just apply styling

    console.log(
      "🎨 Canvas enhanced with offscreen prevention (no context access)"
    );
  } catch (error) {
    console.warn("Canvas enhancement failed:", error);
  }
};

// Error Boundary to catch DOM manipulation errors
class ARErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Check if it's the specific DOM manipulation error we expect
    if (error.message && error.message.includes("removeChild")) {
      console.log(
        "🛡️ Caught expected DOM manipulation error, suppressing:",
        error.message
      );
      return { hasError: false }; // Don't show error UI for this
    }
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (!error.message || !error.message.includes("removeChild")) {
      console.error("❌ Unexpected AR error:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-white max-w-[768px] mx-auto bg-black">
          <div className="text-center p-6">
            <p className="text-red-300 text-sm mb-4">
              AR experience encountered an error
            </p>
            <button
              onClick={this.props.onError}
              className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
            >
              Skip to End (Test Mode)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SnapARExperience = ({ onComplete, userData, apiToken }) => {
  const containerRef = useRef(null);
  const canvasPlaceholderRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const sessionRef = useRef(null);
  const captureTimeoutRef = useRef(null);
  const arStartTimerRef = useRef(null);

  const [showCaptureButton, setShowCaptureButton] = useState(false);

  // 📡 SSE State Management
  const [sseConnected, setSseConnected] = useState(false);
  const [arSessionEnded, setArSessionEnded] = useState(false);
  const sseRef = useRef(null);
  const currentSessionId = useRef(null);
  const [sessionId, setSessionId] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);

  // 🔴 RED DEMON DETECTION: Ultra-efficient pixel scanning
  const [redDemonDetection, setRedDemonDetection] = useState({
    isScanning: false,
    redPixelsFound: 0,
    demonDetected: false,
    scanCount: 0,
  });

  const redDemonRef = useRef({
    intervalId: null,
    isRunning: false,
    consecutiveDetections: 0,
    requiredDetections: 3, // Need 3 consecutive detections to confirm
    startTime: null,
  });

  // Ultra-efficient red demon detection configuration
  const RED_DEMON_CONFIG = {
    scanInterval: 200, // Scan every 200ms
    topAreaPercent: 0.25, // Top 25% of canvas
    sampleRate: 0.02, // Sample only 2% of pixels in the area (ultra-efficient)
    redThresholds: {
      minRed: 180, // Minimum red value (0-255)
      maxGreen: 100, // Maximum green value (to ensure it's red, not orange/yellow)
      maxBlue: 100, // Maximum blue value (to ensure it's red, not purple)
      minIntensity: 200, // Minimum overall intensity to avoid dark reds
    },
    minRedPixels: 15, // Minimum red pixels needed to trigger detection
    maxScanTime: 30000, // Stop scanning after 30 seconds
  };

  // Stop red demon detection (defined early)
  const stopRedDemonDetection = () => {
    const detection = redDemonRef.current;

    if (!detection.isRunning) return;

    console.log("🔴 Stopping red demon detection");

    if (detection.intervalId) {
      clearInterval(detection.intervalId);
      detection.intervalId = null;
    }

    detection.isRunning = false;
    detection.consecutiveDetections = 0;

    setRedDemonDetection((prev) => ({
      ...prev,
      isScanning: false,
    }));
  };

  // Highly optimized red pixel detection
  const detectRedDemon = (canvas) => {
    if (!canvas) return false;

    try {
      // Create minimal temp canvas for top area only
      const tempCanvas = document.createElement("canvas");
      const ctx = tempCanvas.getContext("2d", {
        willReadFrequently: true,
        alpha: false,
        desynchronized: true, // Better performance
      });

      if (!ctx) return false;

      // Calculate top 25% area dimensions
      const topHeight = Math.floor(
        canvas.height * RED_DEMON_CONFIG.topAreaPercent
      );
      const scanWidth = Math.min(canvas.width, 400); // Cap width for performance
      const scanHeight = Math.min(topHeight, 100); // Cap height for performance

      // Set temp canvas to minimal size
      tempCanvas.width = scanWidth;
      tempCanvas.height = scanHeight;

      // Draw only the top portion of the AR canvas
      ctx.drawImage(
        canvas,
        0,
        0,
        canvas.width,
        topHeight, // Source: full width, top 25%
        0,
        0,
        scanWidth,
        scanHeight // Dest: scaled down for efficiency
      );

      // Get image data
      const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
      const data = imageData.data;

      // Ultra-efficient pixel sampling
      let redPixelCount = 0;
      const sampleStep = Math.floor(1 / RED_DEMON_CONFIG.sampleRate) * 4; // Skip pixels for efficiency
      const { minRed, maxGreen, maxBlue, minIntensity } =
        RED_DEMON_CONFIG.redThresholds;

      // Scan pixels with large steps for maximum efficiency
      for (let i = 0; i < data.length; i += sampleStep) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Check if pixel matches red demon criteria
        if (
          r >= minRed && // Strong red component
          g <= maxGreen && // Low green (not orange/yellow)
          b <= maxBlue && // Low blue (not purple/magenta)
          r + g + b >= minIntensity && // Bright enough (not dark red)
          r > (g + b) * 1.5 // Red is significantly stronger than other colors
        ) {
          redPixelCount++;

          // Early exit if we've found enough red pixels
          if (redPixelCount >= RED_DEMON_CONFIG.minRedPixels) {
            break;
          }
        }
      }

      const demonDetected = redPixelCount >= RED_DEMON_CONFIG.minRedPixels;

      // Update detection state
      setRedDemonDetection((prev) => ({
        ...prev,
        redPixelsFound: redPixelCount,
        demonDetected,
        scanCount: prev.scanCount + 1,
      }));

      console.log(
        `🔴 Red scan: ${redPixelCount} red pixels found, demon: ${demonDetected}`
      );

      return demonDetected;
    } catch (error) {
      console.warn("🔴 Red demon detection failed:", error);
      return false;
    }
  };

  // Main scanning function
  const scanForRedDemon = () => {
    const canvas =
      canvasRef.current ||
      canvasPlaceholderRef.current?.querySelector("canvas") ||
      window.snapARPreloadCache?.session?.output?.live;

    if (!canvas) {
      console.warn("🔴 No canvas available for red demon scanning");
      return;
    }

    const currentTime = Date.now();
    const detection = redDemonRef.current;

    // Stop scanning after max time
    if (currentTime - detection.startTime > RED_DEMON_CONFIG.maxScanTime) {
      console.log("🔴 Red demon scan timeout - stopping");
      stopRedDemonDetection();
      return;
    }

    // Perform efficient red detection
    const demonFound = detectRedDemon(canvas);

    if (demonFound) {
      detection.consecutiveDetections++;
      console.log(
        `🔴 Red demon detected! (${detection.consecutiveDetections}/${RED_DEMON_CONFIG.requiredDetections})`
      );

      // Require multiple consecutive detections for reliability
      if (
        detection.consecutiveDetections >= RED_DEMON_CONFIG.requiredDetections
      ) {
        console.log("🔴👹 RED DEMON CONFIRMED - showing PROCEED button!");
        stopRedDemonDetection();
        setShowCaptureButton(true);

        // Clear the timer since demon was detected
        if (arStartTimerRef.current) {
          clearTimeout(arStartTimerRef.current);
          arStartTimerRef.current = null;
        }
      }
    } else {
      // Reset consecutive count if no demon found
      detection.consecutiveDetections = 0;
    }
  };

  // Start red demon detection
  const startRedDemonDetection = () => {
    const detection = redDemonRef.current;

    if (detection.isRunning) {
      console.log("🔴 Red demon detection already running");
      return;
    }

    console.log("🔴 Starting RED DEMON detection...");

    detection.isRunning = true;
    detection.startTime = Date.now();
    detection.consecutiveDetections = 0;

    setRedDemonDetection({
      isScanning: true,
      redPixelsFound: 0,
      demonDetected: false,
      scanCount: 0,
    });

    // Start scanning at optimized interval
    detection.intervalId = setInterval(
      scanForRedDemon,
      RED_DEMON_CONFIG.scanInterval
    );
  };

  useEffect(() => {
    initializeARSession();
    return () => {
      cleanup();
    };
  }, []);

  // 📡 SSE Effect - Connect to AR events when sessionId state changes
  useEffect(() => {
    console.log(
      "📡 SSE useEffect triggered - sessionId:",
      sessionId,
      "sseConnected:",
      sseConnected
    );

    if (sessionId && !sseRef.current) {
      console.log("📡 Setting up SSE connection for session:", sessionId);
      setupSSEConnection(sessionId);
    }

    return () => {
      if (sseRef.current) {
        console.log("📡 Cleaning up SSE connection");
        sseRef.current.close();
        sseRef.current = null;
        setSseConnected(false);
      }
    };
  }, [sessionId]);

  // 🎯 Show PROCEED button logic - SSE end OR red demon detection OR timer
  useEffect(() => {
    console.log(
      "🎯 Button logic - arSessionEnded:",
      arSessionEnded,
      "redDemonDetected:",
      redDemonDetection.demonDetected,
      "isLoading:",
      isLoading,
      "showCaptureButton:",
      showCaptureButton
    );

    if (arSessionEnded) {
      console.log("🎯 AR Session ended via SSE - showing PROCEED button");
      setShowCaptureButton(true);
      // Stop red demon detection since SSE ended
      stopRedDemonDetection();
      // Clear timer since SSE ended the session
      if (arStartTimerRef.current) {
        clearTimeout(arStartTimerRef.current);
        arStartTimerRef.current = null;
      }
    }

    // 🔴 Check if red demon was detected
    if (redDemonDetection.demonDetected && !showCaptureButton) {
      console.log("🔴👹 Red demon detected - showing PROCEED button");
      setShowCaptureButton(true);
      // Clear timer since demon was detected
      if (arStartTimerRef.current) {
        clearTimeout(arStartTimerRef.current);
        arStartTimerRef.current = null;
      }
    }
  }, [
    arSessionEnded,
    redDemonDetection.demonDetected,
    isLoading,
    showCaptureButton,
  ]);

  // 📡 SETUP SSE CONNECTION FOR AR END DETECTION
  const setupSSEConnection = (sessionId) => {
    try {
      console.log("📡 Connecting to SSE endpoint for session:", sessionId);

      const eventSource = new EventSource(
        `https://artmetech.co.in/api/ar-events/${sessionId}`
      );
      sseRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("📡 SSE connection established");
        setSseConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📡 SSE message received:", data);

          switch (data.type) {
            case "connected":
              console.log("📡 SSE connected confirmation");
              setSseConnected(true);
              break;

            case "ar_ended":
              console.log("🎯 AR End detected via SSE!", data);
              if (
                data.sessionId === sessionId ||
                data.phone === userData?.phone
              ) {
                setArSessionEnded(true);
              }
              break;

            case "heartbeat":
              // Silent heartbeat
              break;

            default:
              console.log("📡 Unknown SSE message type:", data.type);
          }
        } catch (parseError) {
          console.warn("📡 Failed to parse SSE message:", event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error("📡 SSE connection error:", error);
        setSseConnected(false);

        if (eventSource.readyState === EventSource.CLOSED) {
          console.log("📡 SSE connection closed");
          sseRef.current = null;
        }
      };
    } catch (error) {
      console.error("📡 Failed to setup SSE connection:", error);
    }
  };

  // 🔍 CHECK AR SESSION STATUS FROM BACKEND
  const checkARSessionStatus = async (sessionId) => {
    try {
      const response = await fetch(
        `https://artmetech.co.in/api/snap/session-status/${sessionId}`
      );
      const data = await response.json();

      if (response.ok && data.success) {
        console.log("📊 Session status:", data.data.arState);
        return data.data.arState.ended;
      }
      return false;
    } catch (error) {
      console.error("❌ Failed to check session status:", error);
      return false;
    }
  };

  // 🚀 UNIFIED AR SESSION INITIALIZATION
  const initializeARSession = async () => {
    try {
      console.log("🚀 Initializing AR session...");
      setIsLoading(true);
      setError("");

      // 🔍 Try multiple sources for session ID
      let retrievedSessionId = null;

      // Method 1: From userData prop
      if (userData?.sessionId) {
        retrievedSessionId = userData.sessionId;
        console.log("📝 Got session ID from userData:", retrievedSessionId);
      }

      // Method 2: From localStorage with correct key
      if (!retrievedSessionId) {
        retrievedSessionId = localStorage.getItem("snapARSessionId");
        if (retrievedSessionId) {
          console.log(
            "📝 Got session ID from localStorage (snapARSessionId):",
            retrievedSessionId
          );
        }
      }

      // Method 3: Fallback to old key
      if (!retrievedSessionId) {
        retrievedSessionId = localStorage.getItem("currentSessionId");
        if (retrievedSessionId) {
          console.log(
            "📝 Got session ID from localStorage (currentSessionId):",
            retrievedSessionId
          );
        }
      }

      // Method 4: Try to fetch from phone if available
      if (!retrievedSessionId && userData?.phone) {
        console.log(
          "📱 No session ID found, checking for existing session by phone:",
          userData.phone
        );
        try {
          const checkResponse = await fetch(
            `https://artmetech.co.in/api/snap/check-session/${userData.phone}`
          );
          const checkData = await checkResponse.json();

          if (
            checkResponse.ok &&
            checkData.success &&
            checkData.data.hasExistingSession
          ) {
            retrievedSessionId = checkData.data.session.sessionId;
            console.log(
              "📝 Found existing session ID for phone:",
              retrievedSessionId
            );

            localStorage.setItem("snapARSessionId", retrievedSessionId);
            localStorage.setItem("currentSessionId", retrievedSessionId);
          }
        } catch (error) {
          console.warn("❌ Failed to check existing session:", error);
        }
      }

      // Method 5: Create new session if still no ID found
      if (!retrievedSessionId && userData?.phone) {
        console.log(
          "🆕 No session found, creating new session for phone:",
          userData.phone
        );
        try {
          const createResponse = await fetch(
            "https://artmetech.co.in/api/snap/create-session",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                phone: userData.phone,
                forceNew: false,
              }),
            }
          );

          const createData = await createResponse.json();

          if (createResponse.ok && createData.success) {
            retrievedSessionId = createData.data.sessionId;
            console.log("✅ Created new session ID:", retrievedSessionId);

            localStorage.setItem("snapARSessionId", retrievedSessionId);
            localStorage.setItem("currentSessionId", retrievedSessionId);

            // Associate phone with session
            if (userData.phone) {
              console.log("📱 Associating phone with new session");
              await fetch("https://artmetech.co.in/api/snap/associate-phone", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sessionId: retrievedSessionId,
                  phone: userData.phone,
                  userInfo: {
                    userId: userData.userId,
                    userName: userData.userName,
                    phone: userData.phone,
                  },
                }),
              });
            }
          }
        } catch (error) {
          console.error("❌ Failed to create new session:", error);
        }
      }

      // Set session ID if found
      if (retrievedSessionId) {
        console.log("✅ Final session ID:", retrievedSessionId);
        currentSessionId.current = retrievedSessionId;
        setSessionId(retrievedSessionId);

        // 🔍 Check initial AR session status
        const isEnded = await checkARSessionStatus(retrievedSessionId);
        setArSessionEnded(isEnded);
        console.log(`📊 Initial AR session status - Ended: ${isEnded}`);
      } else {
        console.warn("⚠️ No session ID could be obtained");
      }

      const cache = window.snapARPreloadCache;
      const isRetry = userData?.isRetry;
      const needsCompleteRestart = userData?.needsCompleteRestart;

      console.log("📊 Session check:", {
        isRetry,
        needsCompleteRestart,
        hasCache: !!cache,
        sessionReady: cache?.sessionReady,
        hasSession: !!cache?.session,
        hasCanvas: !!cache?.session?.output?.live,
      });

      // 🔥 COMPLETE RESTART: Recreate everything from scratch
      if (needsCompleteRestart || (isRetry && cache?.needsCompleteRestart)) {
        console.log(
          "🔥 Complete restart requested - recreating entire AR session"
        );
        await createCompletelyFreshARSession();
        return;
      }

      // 🆕 FRESH INITIALIZATION: Wait for preloaded session or create new
      if (cache?.sessionReady && cache.session?.output?.live) {
        console.log("✅ Using preloaded session");

        // Apply lens if not already applied
        if (cache && cache.lenses && userData?.groupSize) {
          const selectedLens = cache.lenses[userData.groupSize];
          if (selectedLens && !cache.appliedLens) {
            console.log(
              `🎯 Applying ${userData.groupSize} lens to preloaded session`
            );
            await cache.session.applyLens(selectedLens);
            cache.appliedLens = selectedLens;
          }
        }

        await setupCanvasAndStart(cache.session.output.live, cache.session);
      } else if (cache?.isPreloading) {
        console.log("⏳ Waiting for preload to complete...");
        await waitForSessionReady();

        if (cache.session?.output?.live) {
          // Apply lens after preload completes
          if (cache && cache.lenses && userData?.groupSize) {
            const selectedLens = cache.lenses[userData.groupSize];
            if (selectedLens && !cache.appliedLens) {
              console.log(
                `🎯 Applying ${userData.groupSize} lens after preload completion`
              );
              await cache.session.applyLens(selectedLens);
              cache.appliedLens = selectedLens;
            }
          }

          await setupCanvasAndStart(cache.session.output.live, cache.session);
        } else {
          throw new Error("Preload completed but no canvas available");
        }
      } else {
        console.log("🔧 No preloaded session, creating fresh one...");
        await createCompletelyFreshARSession();
      }
    } catch (err) {
      console.error("❌ AR initialization failed:", err);
      setError(`Failed to initialize AR: ${err.message}`);
      setIsLoading(false);
    }
  };

  // 🔥 CREATE COMPLETELY FRESH AR SESSION
  const createCompletelyFreshARSession = async () => {
    try {
      console.log("🔥 Creating completely fresh AR session...");

      // Clear any existing cache completely
      if (window.snapARPreloadCache) {
        const cache = window.snapARPreloadCache;

        // Stop everything properly
        if (cache.session) {
          try {
            await cache.session.pause();
            console.log("🛑 Previous session paused");
          } catch (e) {
            console.log("Session already stopped");
          }
        }

        if (cache.mediaStream) {
          cache.mediaStream.getTracks().forEach((track) => {
            track.stop();
            console.log("🛑 Media track stopped:", track.kind);
          });
        }

        // Add a small delay to ensure cleanup is complete
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 🆕 RECREATE ENTIRE CACHE AND SESSION
      window.snapARPreloadCache = {
        cameraKit: null,
        lenses: null,
        cameraManager: null,
        mediaStream: null,
        session: null,
        source: null,
        appliedLens: null,
        isPreloaded: false,
        isPreloading: false,
        preloadProgress: 0,
        error: null,
        sessionReady: false,
        needsCompleteRestart: false,
      };

      const cache = window.snapARPreloadCache;
      cache.isPreloading = true;

      console.log("🔥 Step 1: Initialize Camera Kit...");
      const { bootstrapCameraKit } = await import("@snap/camera-kit");
      cache.cameraKit = await bootstrapCameraKit({
        apiToken: apiToken,
      });

      console.log("🔥 Step 2: Get camera stream...");
      // Create camera manager with better error handling
      class CameraManager {
        constructor() {
          this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          this.isBackFacing = false;
          this.mediaStream = null;
        }

        async initializeCamera() {
          try {
            if (!this.isMobile) {
              document.body.classList.add("desktop");
            }

            console.log("📹 Requesting camera access...");
            this.mediaStream = await navigator.mediaDevices.getUserMedia(
              this.getConstraints()
            );

            // Verify the stream is active
            if (!this.mediaStream || !this.mediaStream.active) {
              throw new Error("Media stream is not active after creation");
            }

            console.log("✅ Camera stream active:", this.mediaStream.active);
            return this.mediaStream;
          } catch (error) {
            console.error("❌ Camera initialization failed:", error);
            throw new Error(`Camera access failed: ${error.message}`);
          }
        }

        getConstraints() {
          const settings = {
            camera: {
              constraints: {
                front: {
                  video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  },
                  audio: false,
                },
                back: {
                  video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  },
                  audio: false,
                },
                desktop: {
                  video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  },
                  audio: false,
                },
              },
            },
          };
          return this.isMobile
            ? this.isBackFacing
              ? settings.camera.constraints.back
              : settings.camera.constraints.front
            : settings.camera.constraints.desktop;
        }
      }

      cache.cameraManager = new CameraManager();
      cache.mediaStream = await cache.cameraManager.initializeCamera();

      console.log("🔥 Step 3: Load both lenses...");
      const actualLensGroupId = "b2aafdd8-cb11-4817-9df9-835b36d9d5a7";
      const lessLensId = "bc57c671-4255-423e-9eaf-71daba627ca8";
      const moreLensId = "c4b85218-50a5-4a71-b719-0a1381b4e73e";

      // Load both lenses
      const lessLens = await cache.cameraKit.lensRepository.loadLens(
        lessLensId,
        actualLensGroupId
      );
      const moreLens = await cache.cameraKit.lensRepository.loadLens(
        moreLensId,
        actualLensGroupId
      );

      cache.lenses = {
        less: lessLens,
        more: moreLens,
        loaded: true,
      };
      console.log("🔥 Step 4: Create session...");
      cache.session = await cache.cameraKit.createSession();

      console.log("🔥 Step 5: Create and configure source...");

      // Verify media stream is still active before creating source
      if (!cache.mediaStream || !cache.mediaStream.active) {
        throw new Error("Media stream became inactive before source creation");
      }

      cache.source = createMediaStreamSource(cache.mediaStream, {
        cameraType: "user",
        disableSourceAudio: true, // Disable audio to avoid issues
      });

      console.log("🔥 Step 6: Configure session...");
      await cache.session.setSource(cache.source);
      cache.source.setTransform(Transform2D.MirrorX);
      await cache.source.setRenderSize(window.innerWidth, window.innerHeight);
      await cache.session.setFPSLimit(60);

      console.log("🔥 Step 7: Apply selected lens based on user choice...");
      // Get the selected group size from localStorage or userData
      const selectedGroupSize =
        userData?.groupSize ||
        localStorage.getItem("selectedGroupSize") ||
        "less";
      const selectedLens = cache.lenses[selectedGroupSize];

      if (selectedLens) {
        console.log(`🎯 Applying ${selectedGroupSize} lens`);
        await cache.session.applyLens(selectedLens);
        cache.appliedLens = selectedLens;
      } else {
        console.warn("⚠️ Selected lens not found, using default");
        await cache.session.applyLens(cache.lenses.less);
        cache.appliedLens = cache.lenses.less;
      }

      cache.isPreloaded = true;
      cache.sessionReady = true;
      cache.isPreloading = false;

      console.log("🔥 Step 8: Setup canvas and start...");
      if (cache.session.output?.live) {
        await setupCanvasAndStart(cache.session.output.live, cache.session);
      } else {
        throw new Error("No canvas after fresh session creation");
      }
    } catch (error) {
      console.error("❌ Fresh AR session creation failed:", error);

      // Clean up on error
      if (window.snapARPreloadCache?.mediaStream) {
        window.snapARPreloadCache.mediaStream
          .getTracks()
          .forEach((track) => track.stop());
      }

      throw new Error(`Fresh session creation failed: ${error.message}`);
    }
  };

  const startCanvasMonitoring = (canvas) => {
    if (!canvas) return;

    // Monitor canvas visibility every 2 seconds - NO CONTEXT ACCESS
    const monitorInterval = setInterval(() => {
      if (!canvas.parentNode) {
        console.warn("🚨 Canvas detached from DOM!");
        clearInterval(monitorInterval);
        return;
      }

      // Check if canvas is visible (safe DOM check only)
      const rect = canvas.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;

      if (!isVisible) {
        console.warn("🚨 Canvas not visible, attempting recovery...");

        // Try to make canvas visible again
        canvas.style.display = "block";
        canvas.style.visibility = "visible";
        canvas.style.opacity = "1";

        // Force reflow
        canvas.offsetHeight;
      }
    }, 2000);

    // Store interval reference for cleanup
    canvas.dataset.monitorInterval = monitorInterval;
  };

  // 🎯 SETUP CANVAS AND START SESSION
  const setupCanvasAndStart = async (arCanvas, session) => {
    try {
      console.log("🎯 Setting up canvas with enhanced stability...");

      if (!arCanvas || arCanvas.tagName !== "CANVAS") {
        throw new Error(`Invalid canvas: ${arCanvas?.tagName || "null"}`);
      }

      // Store session reference
      sessionRef.current = session;

      // Enhanced canvas styling for visibility and stability
      arCanvas.id = "canvas";
      arCanvas.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        z-index: 1 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: none;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      `;

      // 🎨 ENHANCE CANVAS WITH STABILITY FEATURES
      enhanceCanvas(arCanvas);

      // Apply lens if needed
      const cache = window.snapARPreloadCache;
      if (cache && cache.lenses && userData?.groupSize) {
        const selectedLens = cache.lenses[userData.groupSize];
        if (selectedLens && !cache.appliedLens) {
          console.log(
            `🎯 Applying ${userData.groupSize} lens during canvas setup`
          );
          await session.applyLens(selectedLens);
          cache.appliedLens = selectedLens;
        }
      }

      // Use canvas placeholder - DON'T touch React's DOM structure
      const canvasPlaceholder = canvasPlaceholderRef.current;
      if (canvasPlaceholder) {
        try {
          // Just append the AR canvas to the placeholder div
          canvasPlaceholder.appendChild(arCanvas);
          canvasRef.current = arCanvas;

          // Force a reflow to ensure canvas is properly rendered
          arCanvas.offsetHeight; // Trigger reflow

          console.log(
            "✅ Canvas appended to placeholder, React DOM tree preserved"
          );
        } catch (domError) {
          console.warn("Canvas append to placeholder failed:", domError);
          throw new Error(
            `Failed to append canvas to placeholder: ${domError.message}`
          );
        }
      } else {
        throw new Error("Canvas placeholder ref is null, cannot append canvas");
      }

      // Start the session with error handling
      console.log("▶️ Starting AR session...");
      await session.play();

      // ANDROID FIX: Monitor canvas visibility
      startCanvasMonitoring(arCanvas);

      console.log("🎉 AR session started successfully!");
      setIsLoading(false);

      // 🔴 START RED DEMON DETECTION instead of timer
      console.log("🔴 AR loaded, starting red demon detection...");
      setTimeout(() => {
        startRedDemonDetection();
      }, 1000); // Wait 1 second for AR to stabilize

      // 🎯 FALLBACK TIMER (longer since we have demon detection)
      console.log("⏰ Starting fallback timer...");
      arStartTimerRef.current = setTimeout(() => {
        console.log("⏰ Fallback timer - showing PROCEED button");
        stopRedDemonDetection();
        setShowCaptureButton(true);
      }, 15000); // 15 seconds fallback
    } catch (err) {
      throw new Error(`Canvas setup failed: ${err.message}`);
    }
  };

  // Wait for preloaded session to be ready
  const waitForSessionReady = async () => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const cache = window.snapARPreloadCache;

        if (cache?.sessionReady || !cache?.isPreloading) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    });
  };

  const cleanup = () => {
    // Stop red demon detection
    stopRedDemonDetection();

    // Clean up all timer references
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }

    if (arStartTimerRef.current) {
      clearTimeout(arStartTimerRef.current);
      arStartTimerRef.current = null;
    }

    // Clean up canvas monitoring
    if (canvasRef.current && canvasRef.current.dataset.monitorInterval) {
      clearInterval(canvasRef.current.dataset.monitorInterval);
    }

    // Close SSE connection
    if (sseRef.current) {
      console.log("📡 Closing SSE connection during cleanup");
      sseRef.current.close();
      sseRef.current = null;
      setSseConnected(false);
    }

    console.log("🧹 Cleaned up AR component with red demon detection");
  };

  const skipToEnd = () => {
    cleanup();

    const appliedGroupSize =
      userData?.groupSize ||
      localStorage.getItem("selectedGroupSize") ||
      "less";
    const appliedLensId =
      appliedGroupSize === "less"
        ? "bc57c671-4255-423e-9eaf-71daba627ca8"
        : "c4b85218-50a5-4a71-b719-0a1381b4e73e";

    onComplete({
      ...userData,
      photo: "test-photo-url",
      timestamp: new Date().toISOString(),
      lensId: appliedLensId,
      groupSize: appliedGroupSize,
      testMode: true,
    });
  };

  const handleManualCapture = async () => {
    console.log("🎯 Manual capture button clicked - starting immediate upload");
    setShowCaptureButton(false);
    setIsUploading(true);

    try {
      // 📜 SCROLL TO TOP FIRST
      console.log("📜 Scrolling to top before capture...");

      // Method 1: Smooth scroll to top
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });

      // Method 2: Also scroll the container if it's scrollable
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: 0,
          left: 0,
          behavior: "smooth",
        });
      }

      // Method 3: Ensure any parent containers are also scrolled to top
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera

      // Wait for scroll to complete (smooth scroll takes time)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Immediately start capture and upload
      await captureAndUpload();
    } catch (error) {
      console.error("❌ Error during scroll or capture:", error);
      // Still try to capture even if scroll fails
      await captureAndUpload();
    }
  };

  // 🚀 Force SSE connection if sessionId exists but no connection
  useEffect(() => {
    // Fallback check every 3 seconds to ensure SSE connection
    const fallbackTimer = setInterval(() => {
      if (sessionId && !sseRef.current && !sseConnected) {
        console.log("🔄 Fallback: Attempting to reconnect SSE");
        setupSSEConnection(sessionId);
      }
    }, 3000);

    return () => clearInterval(fallbackTimer);
  }, [sessionId, sseConnected]);

  const captureAndUpload = async () => {
    console.log(
      "📸 🚀 PROCEED CLICKED - Starting immediate capture and upload process..."
    );
    setIsUploading(true);

    // 🔧 CRITICAL: Update counter FIRST before any processing
    const currentCounter = localStorage.getItem("photoCounter") || "0";
    const newCounter = currentCounter === "0" ? "1" : "0";

    console.log(`🔄 PROCEED: Counter UPDATE ${currentCounter} → ${newCounter}`);
    localStorage.setItem("photoCounter", newCounter);
    console.log(`✅ PROCEED: Counter immediately updated to: ${newCounter}`);

    // Try multiple ways to get the AR canvas
    let canvas = null;

    // Method 1: Use canvasRef
    if (canvasRef.current) {
      canvas = canvasRef.current;
    }

    // Method 2: Get from canvas placeholder
    if (!canvas && canvasPlaceholderRef.current) {
      canvas = canvasPlaceholderRef.current.querySelector("canvas");
    }

    // Method 3: Get from cache session
    if (!canvas && window.snapARPreloadCache?.session?.output?.live) {
      canvas = window.snapARPreloadCache.session.output.live;
    }

    // Method 4: Find any canvas with ID
    if (!canvas) {
      canvas =
        document.getElementById("canvas") || document.querySelector("#canvas");
    }

    if (!canvas || !userData?.phone || isCapturing) {
      console.log("❌ Cannot capture:", {
        hasCanvas: !!canvas,
        canvasType: canvas?.tagName,
        hasPhone: !!userData?.phone,
        isCapturing: isCapturing,
        containerRefType: containerRef.current?.tagName,
        containerHasCanvas: !!containerRef.current?.querySelector("canvas"),
      });
      return;
    }

    try {
      setIsCapturing(true);
      setAutoCapturing(true);
      console.log("📸 Starting enhanced polaroid capture process...");

      // 🎨 ENHANCE CANVAS ONE MORE TIME BEFORE CAPTURE
      enhanceCanvas(canvas);

      // Wait a moment for canvas to be stable
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get canvas dimensions
      const canvasWidth = canvas.width || canvas.clientWidth || 0;
      const canvasHeight = canvas.height || canvas.clientHeight || 0;

      if (canvasWidth === 0 || canvasHeight === 0) {
        throw new Error(
          `Canvas has invalid dimensions: ${canvasWidth}x${canvasHeight}`
        );
      }

      let polaroidArea;

      if (isTablet) {
        // Condition 1: Tablet devices
        polaroidArea = {
          x: 5,
          y: 0,
          width: 90,
          height: 90,
        };
        console.log("📱 Using TABLET polaroid area");
      } else if (isSohamDevice) {
        // Condition 2: Soham's specific device (only applies if NOT tablet)
        polaroidArea = {
          x: 0,
          y: 10,
          width: 100,
          height: 70,
        };
        console.log("📱 Using SOHAM DEVICE polaroid area");
      } else {
        // Condition 3: All other devices (default)
        polaroidArea = {
          x: 2,
          y: 10,
          width: 96,
          height: 72,
        };
        console.log("📱 Using DEFAULT polaroid area");
      }

      const captureArea = {
        x: Math.floor((canvasWidth * polaroidArea.x) / 100),
        y: Math.floor((canvasHeight * polaroidArea.y) / 100),
        width: Math.floor((canvasWidth * polaroidArea.width) / 100),
        height: Math.floor((canvasHeight * polaroidArea.height) / 100),
      };

      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");

      // 🚀 ENHANCE TEMPORARY CANVAS TOO
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = "high";

      const enlargedWidth = Math.floor(captureArea.width * 1.3);
      const enlargedHeight = Math.floor(captureArea.height * 1.3);

      tempCanvas.width = enlargedWidth;
      tempCanvas.height = enlargedHeight;

      // Draw the image
      tempCtx.drawImage(
        canvas,
        captureArea.x,
        captureArea.y,
        captureArea.width,
        captureArea.height,
        0,
        0,
        enlargedWidth,
        enlargedHeight
      );

      // 🏆 CAPTURE WITH HIGHER QUALITY
      const blob = await new Promise((resolve, reject) => {
        tempCanvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("Failed to create blob from canvas"));
            }
          },
          "image/png",
          1.0
        );
      });

      if (blob.size === 0) {
        throw new Error("Generated blob is empty");
      }

      console.log("✅ Enhanced blob created successfully, size:", blob.size);

      // 🔧 Use the counter that was already updated at the start
      console.log(
        `📸 PROCEED: Using updated counter for upload: ${newCounter}`
      );

      const formData = new FormData();
      formData.append(
        "photo",
        blob,
        `${userData.phone}_snapchat_polaroid_${newCounter}.png`
      );
      formData.append("phone", userData.phone);
      formData.append("source", "snapchat_polaroid");
      formData.append("counter", newCounter);

      const response = await fetch("https://artmetech.co.in/api/upload-photo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log("✅ Enhanced upload successful:", result.data.imageUrl);

        // 🔧 IMPORTANT: Counter was already updated before upload
        console.log(`✅ Photo saved with counter: ${newCounter}`);
        console.log(`📷 Server returned URL: ${result.data.imageUrl}`);

        // 🔧 CRITICAL: Update the stored URL to match the actual filename with counter
        // The server returns the base URL, but we need to store the URL with the correct counter
        const baseUrl = result.data.imageUrl.split("_").slice(0, -1).join("_"); // Remove old counter part
        const updatedImageUrl = `${baseUrl}_${newCounter}.png`;

        localStorage.setItem("userPhoto", updatedImageUrl);
        console.log(`💾 Stored counter-based image URL: ${updatedImageUrl}`);

        // Get the applied lens ID dynamically
        const appliedGroupSize =
          userData?.groupSize ||
          localStorage.getItem("selectedGroupSize") ||
          "less";
        const appliedLensId =
          appliedGroupSize === "less"
            ? "bc57c671-4255-423e-9eaf-71daba627ca8"
            : "c4b85218-50a5-4a71-b719-0a1381b4e73e";

        setTimeout(() => {
          setIsUploading(false);
          setShowEndScreen(true);
          onComplete({
            ...userData,
            photo: result.data.imageUrl,
            timestamp: new Date().toISOString(),
            lensId: appliedLensId,
            groupSize: appliedGroupSize,
            captureMode: "enhanced_polaroid",
            uploadSuccess: true,
            photoCounter: newCounter,
          });
        }, 2000);
      } else {
        // Handle upload failure - revert counter since upload failed
        console.log("❌ PROCEED: Upload failed, reverting counter");
        const revertedCounter = newCounter === "0" ? "1" : "0"; // Revert back
        localStorage.setItem("photoCounter", revertedCounter);
        console.log(`🔄 PROCEED: Counter reverted to: ${revertedCounter}`);

        const appliedGroupSize =
          userData?.groupSize ||
          localStorage.getItem("selectedGroupSize") ||
          "less";
        const appliedLensId =
          appliedGroupSize === "less"
            ? "bc57c671-4255-423e-9eaf-71daba627ca8"
            : "c4b85218-50a5-4a71-b719-0a1381b4e73e";

        setTimeout(() => {
          setIsUploading(false);
          setShowEndScreen(true);
          onComplete({
            ...userData,
            photo: "upload-failed",
            timestamp: new Date().toISOString(),
            lensId: appliedLensId,
            groupSize: appliedGroupSize,
            captureMode: "enhanced_polaroid",
            uploadSuccess: false,
            errorMessage: result.message,
          });
        }, 2400);
      }
    } catch (error) {
      // Handle capture/upload error - revert counter since upload failed
      console.log("❌ PROCEED: Capture/upload error, reverting counter");
      const revertedCounter = newCounter === "0" ? "1" : "0"; // Revert back
      localStorage.setItem("photoCounter", revertedCounter);
      console.log(
        `🔄 PROCEED: Counter reverted to: ${revertedCounter} due to error`
      );

      const appliedGroupSize =
        userData?.groupSize ||
        localStorage.getItem("selectedGroupSize") ||
        "less";
      const appliedLensId =
        appliedGroupSize === "less"
          ? "bc57c671-4255-423e-9eaf-71daba627ca8"
          : "c4b85218-50a5-4a71-b719-0a1381b4e73e";

      setTimeout(() => {
        setIsUploading(false);
        setShowEndScreen(true);
        onComplete({
          ...userData,
          photo: "capture-failed",
          timestamp: new Date().toISOString(),
          lensId: appliedLensId,
          groupSize: appliedGroupSize,
          captureMode: "enhanced_polaroid",
          uploadSuccess: false,
          errorMessage: error.message,
        });
      }, 1000);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-white max-w-[768px] mx-auto bg-black">
        <div className="text-center p-6">
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <button
            onClick={skipToEnd}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
          >
            Skip to End (Test Mode)
          </button>
        </div>
      </div>
    );
  }

  return (
    <ARErrorBoundary onError={skipToEnd}>
      <style jsx>{`
        #canvas {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        @media screen and (min-width: 768px) and (max-width: 1024px) {
          #canvas {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            aspect-ratio: 9 / 16 !important;
            background: linear-gradient(180deg, #0c1f59, #0b3396) !important;
          }

          .canvas-container {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
        }
      `}</style>

      <div className="min-h-screen flex flex-col bg-black text-white max-w-[991px] mx-auto">
        <div className="flex-1 relative canvas-container" ref={containerRef}>
          {/* Canvas placeholder - AR canvas gets appended here */}
          <div ref={canvasPlaceholderRef} className="absolute inset-0"></div>

          {/* Red Demon Detection Debug UI */}
          {process.env.NODE_ENV === "development" &&
            redDemonDetection.isScanning && (
              <div className="absolute top-4 left-4 bg-red-900/80 text-white text-xs p-3 rounded z-40 max-w-xs">
                <div className="font-bold mb-2">🔴 Red Demon Scanner</div>
                <div>
                  Scanning: {redDemonDetection.isScanning ? "Yes" : "No"}
                </div>
                <div>Red Pixels: {redDemonDetection.redPixelsFound}</div>
                <div>Scan Count: {redDemonDetection.scanCount}</div>
                <div>
                  Detected: {redDemonDetection.demonDetected ? "YES!" : "No"}
                </div>
                <div className="text-red-300 text-xs mt-1">
                  Scanning top 25% for red demon
                </div>
              </div>
            )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">🚀 Loading AR experience...</p>
              </div>
            </div>
          )}

          {(autoCapturing || isUploading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-white mx-auto mb-4 drop-shadow-lg"></div>
                <div className="animate-pulse text-white text-xl font-bold drop-shadow-lg">
                  Capturing your moment...
                </div>
              </div>
            </div>
          )}

          {showCaptureButton && !isCapturing && !isUploading && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30">
              <button
                style={{
                  background:
                    "radial-gradient(40% 40% at 80% 100%, rgb(255 255 255 / 31%) 0%, rgb(0 51 255 / 31%) 59%, rgb(0 13 255 / 31%) 100%)",
                  borderRadius: "4px",
                  border: "1px solid rgba(255, 255, 255, 0.52)",
                  borderStyle: "inside",
                  boxShadow: "2px 2px 4px 0px rgba(0, 0, 0, 0.39)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  opacity: "100%",
                }}
                onClick={handleManualCapture}
                className="font-bold py-4 px-8 transition-all duration-200 hover:scale-105"
              >
                PROCEED
              </button>
            </div>
          )}
        </div>
      </div>
    </ARErrorBoundary>
  );
};

export default SnapARExperience;
