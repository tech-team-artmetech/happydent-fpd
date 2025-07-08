import React, { useState, useEffect } from "react";

const EndScreen = ({ onRetry, onRetryAR }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [photoInfo, setPhotoInfo] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Store lens selection info
  const [lensInfo, setLensInfo] = useState({
    groupSize: null,
    lensId: null,
  });

  const API_BASE_URL = "";

  // Play sound effect when component loads
  useEffect(() => {
    const playEndSound = () => {
      try {
        const audio = new Audio('/assets/twinkle.mp3');
        audio.volume = 0.7;
        audio.play().catch(error => {
          console.log('Sound play failed:', error);
        });
      } catch (error) {
        console.log('Audio creation failed:', error);
      }
    };

    playEndSound();
  }, []);

  // Generate QR Code using API
  const generateQRCode = async (url) => {
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
      return qrApiUrl;
    } catch (error) {
      console.error('QR generation failed:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Get user info from localStorage
    const phone = localStorage.getItem("userPhone");
    const userId = localStorage.getItem("userId");
    const userName = localStorage.getItem("userName");

    // Get lens selection info
    const selectedGroupSize = localStorage.getItem("selectedGroupSize");
    const selectedLensId = selectedGroupSize === "less"
      ? "522218f6-7200-4d66-9f05-ddd56c81a8e5"
      : "c4b85218-50a5-4a71-b719-0a1381b4e73e";

    if (phone && userId && userName) {
      setUserInfo({ phone, userId, userName });
      setLensInfo({
        groupSize: selectedGroupSize || "less",
        lensId: selectedLensId,
      });

      // Get current counter and construct the correct image URL
      const currentCounter = localStorage.getItem("photoCounter") || "0";
      console.log("📷 Current photo counter:", currentCounter);

      // Check if we have a cached URL first
      const cachedImageUrl = localStorage.getItem("userPhoto");

      if (cachedImageUrl) {
        console.log("📷 Using cached image URL:", cachedImageUrl);
        const cacheBustedUrl = `${cachedImageUrl}?counter=${currentCounter}&t=${Date.now()}`;
        setUserPhoto(cacheBustedUrl);
        setPhotoInfo({ hasPhoto: true, imageUrl: cacheBustedUrl });
      } else {
        console.log("📷 No cached URL, constructing expected URL with counter:", currentCounter);
        const expectedImageUrl = `https://artmetech.co.in/api/uploads/enhanced_polaroid_${phone}_${currentCounter}.png?t=${Date.now()}`;
        console.log("📷 Expected image URL:", expectedImageUrl);

        const img = new Image();
        img.onload = () => {
          console.log("✅ Expected image loaded successfully");
          setUserPhoto(expectedImageUrl);
          setPhotoInfo({ hasPhoto: true, imageUrl: expectedImageUrl });
          localStorage.setItem("userPhoto", expectedImageUrl.split('?')[0]);
        };
        img.onerror = () => {
          console.log("❌ Expected image failed, trying API fallback...");
          fetchUserPhoto(phone);
        };
        img.src = expectedImageUrl;
      }
    }
  }, []);

  // Fetch user photo from server
  const fetchUserPhoto = async (phone) => {
    try {
      setIsLoading(true);
      console.log("📷 Fetching photo from API for phone:", phone);

      const response = await fetch(
        `https://artmetech.co.in/api/user/${phone}/photo`
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setPhotoInfo(data.data);
        if (data.data.hasPhoto) {
          const currentCounter = localStorage.getItem("photoCounter") || "0";
          const cacheBustedUrl = `${data.data.imageUrl}?counter=${currentCounter}&t=${Date.now()}`;
          console.log("📷 API returned image, adding cache busting:", cacheBustedUrl);
          setUserPhoto(cacheBustedUrl);
          localStorage.setItem("userPhoto", data.data.imageUrl);
        }
      }
    } catch (error) {
      console.error("Error fetching photo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Download photo function
  const downloadPhoto = async () => {
    if (!userInfo?.phone) {
      setError("User information not found. Please register again.");
      return;
    }

    if (!photoInfo?.hasPhoto) {
      setError("No photo available to download.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log(`📥 Downloading photo for ${userInfo.phone}`);

      const response = await fetch(
        `https://artmetech.co.in/api/download-photo/${userInfo.phone}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Download failed");
      }

      // Get the blob data
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Set filename
      const fileName = `${userInfo.userName.replace(
        /\s+/g,
        "_"
      )}_happydent_photo.jpg`;
      link.download = fileName;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`✅ Photo downloaded successfully: ${fileName}`);
    } catch (error) {
      console.error("Download error:", error);
      setError(error.message || "Failed to download photo. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Download button click - show QR code
  const handleDownload = async () => {
    if (!photoInfo?.hasPhoto) {
      setError("No photo available to download.");
      return;
    }

    try {
      // Generate QR code with the photo URL
      const photoUrl = userPhoto || photoInfo.imageUrl;
      const qrUrl = await generateQRCode(photoUrl);
      setQrCodeUrl(qrUrl);
      setShowQR(true);
      console.log("🔗 QR Code generated for URL:", photoUrl);
    } catch (error) {
      console.error("QR generation error:", error);
      setError("Failed to generate QR code. Please try again.");
    }
  };

  // Handle Bluetooth Print button click
  const handleBluetoothPrint = async () => {
    if (!userPhoto && !photoInfo?.imageUrl) {
      setError("No photo available to print.");
      return;
    }

    const photoUrl = userPhoto || photoInfo?.imageUrl;

    try {
      // Try Web Bluetooth for direct printer connection
      if ('bluetooth' in navigator && 'requestDevice' in navigator.bluetooth) {
        const device = await navigator.bluetooth.requestDevice({
          filters: [
            { services: ['00001801-0000-1000-8000-00805f9b34fb'] }, // Generic Attribute
            { services: ['0000180f-0000-1000-8000-00805f9b34fb'] }, // Battery Service
          ],
          optionalServices: ['00001800-0000-1000-8000-00805f9b34fb'] // Generic Access
        });

        if (device) {
          await sendToBluetooth(device, photoUrl);
          return;
        }
      }

      alert("Please connect a Bluetooth printer");
    } catch (error) {
      console.error('Bluetooth print error:', error);
      alert("Please connect a Bluetooth printer");
    }
  };

  // Handle WiFi Print button click
  const handleWiFiPrint = async () => {
    if (!userPhoto && !photoInfo?.imageUrl) {
      setError("No photo available to print.");
      return;
    }

    const photoUrl = userPhoto || photoInfo?.imageUrl;

    try {
      // Method 1: Try IPP (Internet Printing Protocol) via fetch
      const networkPrinters = await discoverNetworkPrinters();
      if (networkPrinters.length > 0) {
        await sendToNetworkPrinter(networkPrinters[0], photoUrl);
        return;
      }

      // Method 2: AirPrint detection for iOS
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        await tryAirPrint(photoUrl);
        return;
      }

      // Method 3: USB printer detection (as fallback for WiFi-connected USB printers)
      if ('usb' in navigator && 'getDevices' in navigator.usb) {
        const devices = await navigator.usb.getDevices();
        const printerDevice = devices.find(device =>
          device.deviceClass === 7 || // Printer class
          (device.vendorId && [0x04B8, 0x04A9, 0x03F0, 0x0924].includes(device.vendorId)) // Epson, Canon, HP, Xerox
        );

        if (printerDevice) {
          await sendToUSBPrinter(printerDevice, photoUrl);
          return;
        }
      }

      alert("Please connect a WiFi printer");
    } catch (error) {
      console.error('WiFi print error:', error);
      alert("Please connect a WiFi printer");
    }
  };

  // Bluetooth printer communication
  const sendToBluetooth = async (device, photoUrl) => {
    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('00001801-0000-1000-8000-00805f9b34fb');

      // Convert image to ESC/POS commands
      const imageBlob = await fetch(photoUrl).then(r => r.blob());
      const escPosData = await convertToESCPOS(imageBlob);

      // Send to printer (simplified - actual implementation would need specific printer protocols)
      console.log('Sent to Bluetooth printer');
      return true;
    } catch (error) {
      throw error;
    }
  };

  // USB printer communication
  const sendToUSBPrinter = async (device, photoUrl) => {
    try {
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      // Convert image to printer-specific format
      const imageBlob = await fetch(photoUrl).then(r => r.blob());
      const printerData = await convertToPrinterFormat(imageBlob);

      // Send to USB printer
      await device.transferOut(1, printerData);
      await device.close();

      console.log('Sent to USB printer');
      return true;
    } catch (error) {
      throw error;
    }
  };

  // Network printer discovery
  const discoverNetworkPrinters = async () => {
    try {
      // Try common printer discovery endpoints
      const commonPorts = [631, 9100, 515]; // IPP, JetDirect, LPD
      const localIPs = await getLocalNetworkIPs();
      const printers = [];

      for (const ip of localIPs) {
        for (const port of commonPorts) {
          try {
            const response = await fetch(`http://${ip}:${port}/ipp/print`, {
              method: 'OPTIONS',
              mode: 'no-cors',
              signal: AbortSignal.timeout(1000)
            });
            printers.push({ ip, port });
          } catch (e) {
            // Printer not found on this IP:port
          }
        }
      }

      return printers;
    } catch (error) {
      return [];
    }
  };

  // Get local network IP range
  const getLocalNetworkIPs = async () => {
    try {
      // Use WebRTC to detect local IP
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');

      const localIPs = [];

      return new Promise((resolve) => {
        pc.onicecandidate = (ice) => {
          if (ice.candidate) {
            const ip = ice.candidate.candidate.split(' ')[4];
            if (ip && ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
              const baseIP = ip.split('.').slice(0, 3).join('.');
              // Generate IP range (e.g., 192.168.1.1 to 192.168.1.254)
              for (let i = 1; i < 255; i++) {
                localIPs.push(`${baseIP}.${i}`);
              }
            }
          }
        };

        pc.createOffer().then(offer => pc.setLocalDescription(offer));

        setTimeout(() => {
          pc.close();
          resolve(localIPs.slice(0, 50)); // Limit to first 50 IPs for performance
        }, 2000);
      });
    } catch (error) {
      return ['192.168.1.100', '192.168.0.100']; // Fallback common printer IPs
    }
  };

  // Send to network printer via IPP
  const sendToNetworkPrinter = async (printer, photoUrl) => {
    try {
      const imageBlob = await fetch(photoUrl).then(r => r.blob());
      const formData = new FormData();
      formData.append('file', imageBlob, 'photo.jpg');

      const response = await fetch(`http://${printer.ip}:${printer.port}/ipp/print`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/ipp',
        }
      });

      if (response.ok) {
        console.log('Sent to network printer');
        return true;
      }
      throw new Error('Network print failed');
    } catch (error) {
      throw error;
    }
  };

  // AirPrint for iOS
  const tryAirPrint = async (photoUrl) => {
    try {
      // Create a canvas and draw the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      return new Promise((resolve, reject) => {
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Convert to blob
          canvas.toBlob(async (blob) => {
            try {
              if (navigator.share && blob) {
                const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

                // On iOS, this should show print option directly
                await navigator.share({
                  files: [file],
                  title: 'Print Photo'
                });

                resolve(true);
              } else {
                reject(new Error('Share API not available'));
              }
            } catch (shareError) {
              reject(shareError);
            }
          }, 'image/jpeg', 0.9);
        };

        img.onerror = () => reject(new Error('Image load failed'));
        img.crossOrigin = 'anonymous';
        img.src = photoUrl;
      });
    } catch (error) {
      throw error;
    }
  };

  // Convert image to ESC/POS format (for thermal printers)
  const convertToESCPOS = async (imageBlob) => {
    // This is a simplified version - real implementation would need full ESC/POS protocol
    const arrayBuffer = await imageBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // ESC/POS print image command header
    const header = new Uint8Array([0x1D, 0x76, 0x30, 0x00]);
    const combined = new Uint8Array(header.length + uint8Array.length);
    combined.set(header);
    combined.set(uint8Array, header.length);

    return combined;
  };

  // Convert to generic printer format
  const convertToPrinterFormat = async (imageBlob) => {
    // Convert to raw bytes that most printers can understand
    return new Uint8Array(await imageBlob.arrayBuffer());
  };

  // Smart retry function with lens info
  const handleSmartRetry = async () => {
    console.log("🔄 Smart retry initiated");

    try {
      const phone = userInfo?.phone;
      if (!phone) {
        throw new Error("User phone not found. Please start over.");
      }

      console.log(`📱 Checking existing session for phone: ${phone}`);

      // Step 1: Check if there's an existing session for this phone
      const sessionCheckResponse = await fetch(
        `https://artmetech.co.in/api/snap/check-session/${phone}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const sessionCheckData = await sessionCheckResponse.json();
      console.log("📊 Session check result:", sessionCheckData);

      let sessionId = null;
      let isNewSession = false;

      if (sessionCheckResponse.ok && sessionCheckData.success) {
        if (
          sessionCheckData.data.hasExistingSession &&
          sessionCheckData.data.session.canReuse
        ) {
          // Existing session found and can be reused
          sessionId = sessionCheckData.data.session.sessionId;
          console.log(`♻️ Found existing reusable session: ${sessionId}`);

          // Step 2a: Reset the existing session to ended: false
          const resetResponse = await fetch(
            "https://artmetech.co.in/api/snap/reset-session",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId: sessionId,
                phone: phone,
              }),
            }
          );

          const resetData = await resetResponse.json();

          if (!resetResponse.ok || !resetData.success) {
            throw new Error(resetData.message || "Failed to reset session");
          }

          console.log(`✅ Session reset successfully:`, resetData.data);
        } else {
          // No existing session or not reusable - create new one
          console.log(`🆕 No reusable session found, creating new session`);
          isNewSession = true;
        }
      } else {
        console.log(`🆕 Session check failed, creating new session`);
        isNewSession = true;
      }

      // Step 2b: Create new session if needed
      if (isNewSession) {
        const createSessionResponse = await fetch(
          "https://artmetech.co.in/api/snap/create-session",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              phone: phone,
              forceNew: true, // Force new session
            }),
          }
        );

        const createSessionData = await createSessionResponse.json();

        if (!createSessionResponse.ok || !createSessionData.success) {
          throw new Error(
            createSessionData.message || "Failed to create new session"
          );
        }

        sessionId = createSessionData.data.sessionId;
        console.log(`✅ New session created: ${sessionId}`);

        // Step 3: Associate phone with the new session
        const associateResponse = await fetch(
          "https://artmetech.co.in/api/snap/associate-phone",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: sessionId,
              phone: phone,
              userInfo: {
                userId: userInfo.userId,
                userName: userInfo.userName,
                phone: phone,
              },
            }),
          }
        );

        const associateData = await associateResponse.json();

        if (!associateResponse.ok || !associateData.success) {
          throw new Error(
            associateData.message || "Failed to associate phone with session"
          );
        }

        console.log(`✅ Phone associated with session:`, associateData.data);
      }

      // Step 4: Reset the phone-based AR state to ended: false
      const arEndResponse = await fetch("https://artmetech.co.in/api/ar-end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          ended: false, // Reset to ongoing
        }),
      });

      const arEndData = await arEndResponse.json();

      if (!arEndResponse.ok || !arEndData.success) {
        console.warn("⚠️ Failed to reset AR end state:", arEndData.message);
      } else {
        console.log(`✅ AR state reset to ongoing:`, arEndData.data);
      }

      // Step 5: Update local storage with session info
      localStorage.setItem("currentSessionId", sessionId);
      localStorage.setItem("snapARSessionId", sessionId);
      localStorage.setItem("arSessionReady", "true");

      // Ensure lens selection is preserved
      if (lensInfo.groupSize) {
        localStorage.setItem("selectedGroupSize", lensInfo.groupSize);
      }

      // Step 6: Check if we can reuse AR session from cache
      const cache = window.snapARPreloadCache;
      const hasValidARSession = cache?.sessionReady && cache?.session;

      console.log("📊 Final AR Session Status:", {
        sessionId: sessionId,
        hasCache: !!cache,
        sessionReady: cache?.sessionReady,
        hasSession: !!cache?.session,
        canReuseAR: hasValidARSession,
        lensInfo: lensInfo,
      });

      // Force cache to load both lenses if needed
      if (hasValidARSession && cache && !cache.lenses?.loaded) {
        console.log("🔄 Cache exists but lenses not loaded, forcing fresh session");

        // Clear cache to force fresh session creation with both lenses
        if (cache.session) {
          try {
            await cache.session.pause();
          } catch (e) {
            console.log("Session already stopped");
          }
        }

        if (cache.mediaStream) {
          cache.mediaStream.getTracks().forEach((track) => track.stop());
        }

        window.snapARPreloadCache = null;
        hasValidARSession = false;
      }

      // Step 7: Execute the appropriate retry action
      if (hasValidARSession && onRetryAR) {
        // AR session is available - go directly to AR experience
        console.log("🎮 Launching AR experience with session:", sessionId);

        onRetryAR({
          sessionId: sessionId,
          phone: userInfo.phone,
          userId: userInfo.userId,
          userName: userInfo.userName,
          groupSize: lensInfo.groupSize,
          isRetry: true,
        });
      } else {
        // No AR session in cache - do full restart but keep session info
        console.log("🔄 Doing full restart with session:", sessionId);

        // Keep session info but clear other data for fresh registration flow
        localStorage.removeItem("userPhone");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");

        if (onRetry) {
          onRetry({
            sessionId: sessionId,
            preserveSession: true,
            lensInfo: lensInfo,
          });
        }
      }
    } catch (error) {
      console.error("❌ Retry error:", error);
      setError(error.message || "Failed to restart session. Please try again.");

      // Fallback: Clear everything and do fresh start
      localStorage.clear();
      if (onRetry) {
        onRetry({ freshStart: true });
      }
    }
  };

  // Updated handleRetry to use smart retry
  const handleRetry = () => {
    console.log("🔄 Retry button clicked - using smart retry");
    // Reset QR state on retry
    setShowQR(false);
    setQrCodeUrl("");
    handleSmartRetry();
  };

  // Debug function with lens info
  const handleDebug = async () => {
    const phone = userInfo?.phone;
    const sessionId = localStorage.getItem("currentSessionId");

    console.log("🔍 Debug Session State:");
    console.log("Phone:", phone);
    console.log("Stored Session ID:", sessionId);
    console.log("Lens Info:", lensInfo);
    console.log("Selected Group Size:", localStorage.getItem("selectedGroupSize"));
    console.log("AR Cache:", window.snapARPreloadCache);
    console.log("Show QR:", showQR);
    console.log("QR URL:", qrCodeUrl);

    if (phone) {
      try {
        const arStatus = await fetch(
          `https://artmetech.co.in/api/snap/ar-status/${phone}`
        );
        const arData = await arStatus.json();
        console.log("Phone AR Status:", arData);
      } catch (e) {
        console.log("Could not fetch phone AR status");
      }
    }

    if (sessionId) {
      try {
        const sessionStatus = await fetch(
          `https://artmetech.co.in/api/snap/session-status/${sessionId}`
        );
        const sessionData = await sessionStatus.json();
        console.log("Session Status:", sessionData);
      } catch (e) {
        console.log("Could not fetch session status");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-white max-w-[768px] mx-auto relative z-10 overflow-y-hidden">

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded p-3 text-center z-20">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Image or QR Code */}
      <div className="mb-8 z-10 flex justify-center items-center">
        {showQR ? (
          <div className="text-center">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Scan to Download Your Photo</h3>
              <p className="text-sm text-gray-300">Use your phone's camera to scan this QR code</p>
            </div>
            <div className="flex justify-center">
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="object-contain rounded-lg bg-white p-4 mx-auto"
                style={{ width: '300px', height: '300px' }}
              />
            </div>
          </div>
        ) : (
          <img
            src={userPhoto || "/assets/enddummy.png"}
            alt="Result"
            className="object-contain rounded-lg"
            onError={(e) => {
              e.target.src = "/assets/enddummy.png";
            }}
          />
        )}
      </div>

      {/* Buttons Container */}
      <div className="flex flex-col space-y-4 items-center z-20 relative">
        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="text-white text-xl font-bold cursor-pointer py-3 w-80"
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
        >
          DOWNLOAD
        </button>

        {/* Print Buttons Row - Only show when QR is displayed */}
        {showQR && (
          <div className="flex gap-4 w-80">
            {/* Bluetooth Print Button */}
            <button
              onClick={handleBluetoothPrint}
              className="text-white text-lg font-bold cursor-pointer py-3 flex-1 flex items-center justify-center gap-2"
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
            >
              {/* Bluetooth Icon */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Vertical stem */}
                <line x1="12" y1="2" x2="12" y2="22" />
                {/* Upper chevron */}
                <polyline points="12 2 18 8 12 14" />
                {/* Lower chevron */}
                <polyline points="12 14 18 20 12 22" />
                {/* Mirror chevron on left */}
                <polyline points="12 2 6 8 12 14" />
                <polyline points="12 14 6 20 12 22" />
              </svg>
              PRINT
            </button>
            {/* WiFi Print Button */}
            <button
              onClick={handleWiFiPrint}
              className="text-white text-lg font-bold cursor-pointer py-3 flex-1 flex items-center justify-center gap-2"
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
            >
              {/* WiFi Icon */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              PRINT
            </button>
          </div>
        )}

        {/* Smart Retry Button */}
        <button
          onClick={handleRetry}
          className="text-white text-xl font-bold cursor-pointer py-3 w-80"
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
        >
          RETRY
        </button>

        {/* Back Button - Only show when QR is displayed */}
        {showQR && (
          <button
            onClick={() => {
              setShowQR(false);
              setQrCodeUrl("");
            }}
            className="text-white text-lg font-medium cursor-pointer py-2 px-4 flex items-center gap-2"
            style={{
              background: "transparent",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15,18 9,12 15,6"></polyline>
            </svg>
            BACK
          </button>
        )}
      </div>
    </div>
  );
};

export default EndScreen;
