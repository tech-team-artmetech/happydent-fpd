import React, { useState, useEffect } from "react";
import {
  bootstrapCameraKit,
  createMediaStreamSource,
  Transform2D,
} from "@snap/camera-kit";
import chamkingSmile from "../../src/assets/chamking-smile-logo.png";

// Camera Manager class
class CameraManager {
  constructor() {
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.isBackFacing = false;
    this.mediaStream = null;
  }

  async initializeCamera() {
    if (!this.isMobile) {
      document.body.classList.add("desktop");
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia(
      this.getConstraints()
    );
    return this.mediaStream;
  }

  getConstraints() {
    const settings = {
      camera: {
        constraints: {
          front: {
            video: { facingMode: "user" },
            audio: true,
          },
          back: {
            video: { facingMode: "environment" },
            audio: true,
          },
          desktop: {
            video: { facingMode: "user" },
            audio: true,
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

const SplashScreen = ({ onComplete }) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState({});

  // NEW: Animation states for smooth transitions
  const [showLoadingContent, setShowLoadingContent] = useState(true);
  const [showFinalContent, setShowFinalContent] = useState(false);

  // Session management state
  const [sessionState, setSessionState] = useState({
    sessionId: null,
    isCreating: false,
    created: false,
    error: null,
  });

  // 🚀 HARD REFRESH ON SPLASH SCREEN LOAD
  useEffect(() => {
    // Clear any existing AR cache completely
    if (window.snapARPreloadCache) {
      try {
        // Stop any existing session
        if (window.snapARPreloadCache.session) {
          window.snapARPreloadCache.session.pause();
        }
        // Clear the entire cache
        window.snapARPreloadCache = null;
        delete window.snapARPreloadCache;
      } catch (e) {
        // console.log("Cache cleanup:", e.message);
      }
    }

    // Clear any other global state and localStorage
    sessionStorage.clear();

    // Clear any existing session data
    localStorage.removeItem("snapARSessionId");
    localStorage.removeItem("userPhone");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");

    // Initialize fresh cache
    window.snapARPreloadCache = {
      // Core components
      cameraKit: null,
      lenses: null,
      cameraManager: null,
      mediaStream: null,

      // 🚀 SESSION WITHOUT CANVAS - This is the key!
      session: null,
      source: null,
      appliedLens: null,

      // State tracking
      isPreloaded: false,
      isPreloading: false,
      preloadProgress: 0,
      error: null,
      sessionReady: false,

      // NEW: Session tracking
      sessionId: null,
    };
  }, []); // Only run on mount

  // Preload all images
  const [currentFrame, setCurrentFrame] = useState(0);
  const totalFrames = 31;

  useEffect(() => {
    const images = {};
    let loadedCount = 0;

    for (let i = 0; i < totalFrames; i++) {
      const img = new Image();
      const fileName = `Comp 1_${i.toString().padStart(5, "0")}.png`;
      const src = `/assets/smile/${fileName}`;

      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalFrames) {
          setImagesLoaded(true);
        }
      };

      img.src = src;
      images[i] = src;
    }

    setPreloadedImages(images);
  }, []);

  useEffect(() => {
    if (!imagesLoaded) return;

    let frame = 0;
    const totalFrames = 31;
    const frameDuration = 25; // ms per frame → ~12.5 FPS (adjust to 100 for slower)

    let lastFrameTime = performance.now();

    const animate = (timestamp) => {
      if (frame >= totalFrames) {
        setLoadingProgress(100);
        setShowLoadingContent(false);

        setTimeout(() => {
          setShowButton(true);
          setShowFinalContent(true);
        }, 300);

        return;
      }

      if (timestamp - lastFrameTime >= frameDuration) {
        setCurrentFrame(frame);
        setLoadingProgress((frame / (totalFrames - 1)) * 100);
        frame++;
        lastFrameTime = timestamp;
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [imagesLoaded]);

  // NEW: Create unique session ID
  const createSnapARSession = async () => {
    if (sessionState.isCreating || sessionState.created) {
      return sessionState.sessionId;
    }

    try {
      setSessionState((prev) => ({ ...prev, isCreating: true, error: null }));

      const response = await fetch(
        `https://artmetech.co.in/api/snap/create-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create session");
      }

      const sessionId = data.data.sessionId;

      // Store session ID in localStorage
      localStorage.setItem("snapARSessionId", sessionId);

      // Update cache
      if (window.snapARPreloadCache) {
        window.snapARPreloadCache.sessionId = sessionId;
      }

      setSessionState({
        sessionId: sessionId,
        isCreating: false,
        created: true,
        error: null,
      });

      return sessionId;
    } catch (error) {
      console.error("❌ Failed to create Snap AR session:", error);
      setSessionState((prev) => ({
        ...prev,
        isCreating: false,
        error: error.message,
      }));
      return null;
    }
  };

  // 🔥 COMPLETE AR SESSION PRELOAD - Creates session WITHOUT canvas dependency
  const preloadCompleteARSession = async (sessionId) => {
    const cache = window.snapARPreloadCache;

    if (cache.sessionReady) {
      return;
    }

    if (cache.isPreloading) {
      return;
    }

    try {
      cache.isPreloading = true;
      cache.error = null;
      cache.sessionId = sessionId;

      // 🔥 STEP 1: Initialize Camera Kit
      if (!cache.cameraKit) {
        const actualApiToken =
          "eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzUwMjUxNDQ5LCJzdWIiOiJmZDFmZDkyMi01NWI1LTQ3ZTQtOTlmOS1kMjQ1YzIyNzZjZWZ-UFJPRFVDVElPTn4wYTBiZDg4OC0zYzJkLTQ2NTQtOWJhZS04NWNkZjIwZGZkM2MifQ.DXp0F3LA8ZqxuB0UH4TCaQT2iMbCsc9xrT8xbuoYOJg";

        cache.cameraKit = await bootstrapCameraKit({
          apiToken: actualApiToken,
        });
      }

      // 🔥 STEP 2: Get camera permissions and create stream
      if (!cache.mediaStream) {
        cache.cameraManager = new CameraManager();
        cache.mediaStream = await cache.cameraManager.initializeCamera();
      }

      // 🔥 STEP 3: Load lens assets (ALL API calls happen here)
      if (!cache.lenses) {
        const actualLensGroupId = "b2aafdd8-cb11-4817-9df9-835b36d9d5a7";
        const lessLensId = "c9b9a62d-0a61-4e26-9db1-67133ff07b99"; // Less than 3 people
        const moreLensId = "3d4c5e55-255e-4e92-8c93-24530158d072"; // More than 3 people

        // Load both lenses
        console.log("🔥 Loading both lenses...");
        const lessLens = await cache.cameraKit.lensRepository.loadLens(
          lessLensId,
          actualLensGroupId
        );
        const moreLens = await cache.cameraKit.lensRepository.loadLens(
          moreLensId,
          actualLensGroupId
        );

        // Store both lenses with identifiers
        cache.lenses = {
          less: lessLens,
          more: moreLens,
          loaded: true,
        };

        console.log("✅ Both lenses loaded successfully");
      }

      // 🚀 STEP 4: Create session WITHOUT canvas - Let Camera Kit create its own canvas
      if (!cache.session) {
        // Create session without providing a canvas - Camera Kit will create its own
        cache.session = await cache.cameraKit.createSession();

        // Create and configure the source
        cache.source = createMediaStreamSource(cache.mediaStream, {
          cameraType: "user",
          disableSourceAudio: false,
        });

        // Set up the session completely
        await cache.session.setSource(cache.source);
        cache.source.setTransform(Transform2D.MirrorX);
        await cache.source.setRenderSize(window.innerWidth, window.innerHeight);
        await cache.session.setFPSLimit(60);

        // DON'T APPLY ANY LENS YET - Wait for user selection
        console.log(
          "🎯 Session ready - waiting for lens selection based on group size"
        );
      }

      // 🎯 MARK AS COMPLETELY READY
      cache.isPreloaded = true;
      cache.sessionReady = true;
      cache.preloadProgress = 100;
      cache.isPreloading = false;
    } catch (error) {
      console.error("❌ Complete AR session preload failed:", error);
      cache.error = error.message;
      cache.isPreloading = false;
      cache.sessionReady = false;
    }
  };

  const getCurrentImageIndex = () => {
    // When progress is 100%, always show the last frame (index 30)
    if (loadingProgress >= 100) {
      return 30;
    }
    return Math.min(Math.floor((loadingProgress / 100) * 30), 30);
  };

  const handleTapToBegin = async () => {
    try {
      // 🆔 STEP 1: Create unique session ID first
      const sessionId = await createSnapARSession();

      if (!sessionId) {
        console.error("❌ Failed to create session, cannot proceed");
        return;
      }

      // 🚀 STEP 2: Start COMPLETE AR session preload in background with session ID
      preloadCompleteARSession(sessionId);

      // 🏃‍♂️ STEP 3: Immediately proceed to registration
      if (onComplete) {
        onComplete({
          sessionId: sessionId,
          sessionCreated: true,
        });
      }
    } catch (error) {
      console.error("❌ Error in handleTapToBegin:", error);
      setSessionState((prev) => ({
        ...prev,
        error: error.message,
      }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-white max-w-[768px] mx-auto">
      {/* HAPPYDENT Logo */}
      <img
        src="/assets/happydent-logo.png"
        alt="HAPPYDENT"
        className="w-64 h-32 object-contain mb-8"
      />

      <img className="chamking-smile-logo" src={chamkingSmile} alt="" />

      {/* Loading text below logo - ALWAYS in DOM, just visibility controlled */}
      {/* <div
        className={`font-gotham font-light font-[18px] italic mb-2 transition-opacity duration-300 ${showLoadingContent && imagesLoaded ? "opacity-100" : "opacity-0"
          }`}
        style={{
          visibility: showLoadingContent && imagesLoaded ? "visible" : "hidden",
        }}
      >
        Loading...
      </div> */}

      {/* Session Status Indicator */}
      {/* {sessionState.created && (
        <div className="w-full max-w-sm mb-4">
          <div className="bg-green-500/20 border border-green-500/50 rounded p-2 text-center">
            <p className="text-green-300 text-xs">
              🆔 Session Created: {sessionState.sessionId?.substring(0, 20)}...
            </p>
          </div>
        </div>
      )} */}

      {/* Error Message */}
      {sessionState.error && (
        <div className="w-full max-w-sm mb-4">
          <div className="bg-red-500/20 border border-red-500/50 rounded p-2 text-center">
            <p className="text-red-300 text-xs">❌ {sessionState.error}</p>
          </div>
        </div>
      )}

      {/* PNG Sequence - Always visible, never fades */}
      <div className="mb-8 flex flex-col items-center">
        {/* PNG Image - ALWAYS in DOM */}
        <div className="mb-4">
          <img
            src={preloadedImages[getCurrentImageIndex()]}
            alt="Loading animation"
            className="w-42 h-42 object-contain"
            style={{
              visibility: imagesLoaded ? "visible" : "hidden",
              opacity: imagesLoaded ? 1 : 0,
            }}
          />
        </div>

        {/* Initial loading message - ALWAYS in DOM */}
        {/* <p
          className={`text-center text-xl font-bold transition-opacity duration-300 ${showLoadingContent && imagesLoaded ? "opacity-100" : "opacity-0"
            }`}
          style={{
            visibility:
              showLoadingContent && imagesLoaded ? "visible" : "hidden",
          }}
        >
          {Math.round(loadingProgress)}%
        </p> */}
        <p
          className={`text-center text-xl font-bold transition-all duration-300 ${showLoadingContent && imagesLoaded ? "opacity-100" : "opacity-0"
            }`}
        // style={{
        //   transform:
        //     showLoadingContent && imagesLoaded ? "scale(1)" : "scale(0)",
        //   transformOrigin: "center",
        // }}
        >
          {Math.round(loadingProgress)}%
        </p>
      </div>

      {/* Button - ALWAYS in DOM, just visibility controlled */}
      <div className="flex flex-col items-center space-y-4">
        <button
          onClick={handleTapToBegin}
          disabled={sessionState.isCreating}
          className={`text-white text-[18px] ctaBtn font-gotham font-medium italic transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${showFinalContent ? "opacity-100" : "opacity-0"
            }`}
          style={{
            visibility: showFinalContent ? "visible" : "hidden",
            background:
              "radial-gradient(40% 40% at 80% 100%, rgb(255 255 255 / 31%) 0%, rgb(0 51 255 / 31%) 59%, rgb(0 13 255 / 31%) 100%)",
            borderRadius: "4px",
            border: "1px solid rgba(255, 255, 255, 0.52)",
            borderStyle: "inside",
            boxShadow: "2px 2px 4px 0px rgba(0, 0, 0, 0.39)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {sessionState.isCreating ? (
            <span>LOADING...</span>
          ) : (
            <span>TAP TO BEGIN!</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default SplashScreen;
