import React, { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
const EndScreen = ({ onRetry, onRetryAR }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [photoInfo, setPhotoInfo] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [redirectTimer, setRedirectTimer] = useState(30);
  const [showRedirectTimer, setShowRedirectTimer] = useState(false);

  // NEW: Add state for background-removed photo
  const [backgroundRemovedPhoto, setBackgroundRemovedPhoto] = useState(null);

  // Store lens selection info
  const [lensInfo, setLensInfo] = useState({
    groupSize: null,
    lensId: null,
  });

  const polaroidDivRef = useRef(null);

  const API_BASE_URL = "";

  // Play sound effect when component loads
  useEffect(() => {
    const playEndSound = () => {
      try {
        const audio = new Audio("/assets/twinkle.mp3");
        audio.volume = 0.7;
        audio.play().catch((error) => {
          console.log("Sound play failed:", error);
        });
      } catch (error) {
        console.log("Audio creation failed:", error);
      }
    };

    playEndSound();
  }, []);

  useEffect(() => {
    // UNCOMMENT THE LINE BELOW TO ENABLE THE REDIRECT TIMER
    if (showQR) {
      setShowRedirectTimer(true);
      setRedirectTimer(30); // Reset timer when QR is shown
    } else {
      setShowRedirectTimer(false);
    }

    if (!showRedirectTimer || !showQR) return;

    const timer = setInterval(() => {
      setRedirectTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Direct redirect to splash screen
          console.log("Redirecting directly to splash screen...");

          // Clear all localStorage data
          localStorage.clear();

          // Direct reload to start fresh from splash
          window.location.reload();

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showRedirectTimer, showQR]);

  // Generate QR Code using API
  const generateQRCode = async (url) => {
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
        url
      )}`;
      return qrApiUrl;
    } catch (error) {
      console.error("QR generation failed:", error);
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
    const selectedLensId =
      selectedGroupSize === "less"
        ? "a4c89dd6-7e7a-4ec2-8390-9df9545b5994"
        : "32f1cc6e-cb6f-4f2f-be03-08f51b8feddf";

    if (phone && userId && userName) {
      setUserInfo({ phone, userId, userName });
      setLensInfo({
        groupSize: selectedGroupSize || "less",
        lensId: selectedLensId,
      });

      // Get current counter and construct the correct image URL
      const currentCounter = localStorage.getItem("photoCounter") || "0";
      console.log("📷 Current photo counter:", currentCounter);

      // NEW: Get background-removed photo URL
      const backgroundRemovedUrl = localStorage.getItem("userPhotoBgRemoved");
      if (backgroundRemovedUrl) {
        setBackgroundRemovedPhoto(backgroundRemovedUrl);
        console.log("🎨 Background-removed photo found:", backgroundRemovedUrl);
      }

      // Check if we have a cached URL first
      const cachedImageUrl = localStorage.getItem("userPhoto");

      if (cachedImageUrl) {
        console.log("📷 Using cached image URL:", cachedImageUrl);
        const cacheBustedUrl = `${cachedImageUrl}?counter=${currentCounter}&t=${Date.now()}`;
        setUserPhoto(cacheBustedUrl);
        setPhotoInfo({ hasPhoto: true, imageUrl: cacheBustedUrl });
      } else {
        console.log(
          "📷 No cached URL, constructing expected URL with counter:",
          currentCounter
        );
        const expectedImageUrl = `https://artmetech.co.in/api/uploads/enhanced_polaroid_${phone}_${currentCounter}.png?t=${Date.now()}`;
        console.log("📷 Expected image URL:", expectedImageUrl);

        const img = new Image();
        img.onload = () => {
          console.log("✅ Expected image loaded successfully");
          setUserPhoto(expectedImageUrl);
          setPhotoInfo({ hasPhoto: true, imageUrl: expectedImageUrl });
          localStorage.setItem("userPhoto", expectedImageUrl.split("?")[0]);
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
          const cacheBustedUrl = `${
            data.data.imageUrl
          }?counter=${currentCounter}&t=${Date.now()}`;
          console.log(
            "📷 API returned image, adding cache busting:",
            cacheBustedUrl
          );
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
  // const handleDownload = async () => {
  //   if (!photoInfo?.hasPhoto) {
  //     setError("No photo available to download.");
  //     return;
  //   }

  //   try {
  //     // Generate QR code with the photo URL
  //     const photoUrl = userPhoto || photoInfo.imageUrl;
  //     const qrUrl = await generateQRCode(photoUrl);
  //     setQrCodeUrl(qrUrl);
  //     setShowQR(true);
  //     console.log("🔗 QR Code generated for URL:", photoUrl);
  //   } catch (error) {
  //     console.error("QR generation error:", error);
  //     setError("Failed to generate QR code. Please try again.");
  //   }
  // };

  const handleDownload = async () => {
    if (!photoInfo?.hasPhoto) {
      setError("No photo available to download.");
      return;
    }

    setIsLoading(true);
    setError("");

    // Wait 3 seconds for images to load
    console.log("⏳ Waiting 3 seconds for all images to load...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const currentCounter = localStorage.getItem("photoCounter") || "0";
      const phone = userInfo?.phone;

      if (!phone) {
        throw new Error("User phone not found");
      }

      console.log("🎨 Creating polaroid manually on canvas (200 IQ method)...");

      // Create canvas manually with exact dimensions
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 400;
      canvas.height = 550;

      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 550);

      console.log("✅ Canvas created: 400x550");

      // Helper function to load images
      const loadImage = (src) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            console.log(`✅ Loaded image: ${src}`);
            resolve(img);
          };
          img.onerror = (error) => {
            console.warn(`⚠️ Failed to load: ${src}`, error);
            resolve(null); // Don't reject, just return null
          };
          img.src = src;
        });
      };

      // Load all images in parallel
      console.log("📥 Loading all images...");
      const [frameImg, redManImg, whattaImg, userImg] = await Promise.all([
        loadImage("/assets/enddummy.png"),
        loadImage("/assets/red-man.png"),
        loadImage("/assets/chamking-whatta.png"),
        loadImage(backgroundRemovedPhoto || userPhoto || ""),
      ]);

      console.log("✅ All images loaded, drawing on canvas...");

      // Draw frame background (z-index 10)
      if (frameImg) {
        ctx.drawImage(frameImg, 0, 0, 400, 550);
        console.log("✅ Frame drawn");
      }

      // Draw user photo (z-index 20) - positioned exactly like in CSS
      if (userImg) {
        // CSS: top: "133px", left: "38px", width: "339px", height: "290px", scale: "1.23"
        // The scale transforms around center, so we need to account for that
        const originalX = 38;
        const originalY = 149;
        const originalW = 339;
        const originalH = 290;
        const scale = 1.32;

        // Calculate final scaled dimensions
        const scaledW = originalW * scale; // 339 * 1.23 = 417px
        const scaledH = originalH * scale; // 290 * 1.23 = 357px

        // Scale transforms from center, so adjust position
        const finalX = originalX - (scaledW - originalW) / 2; // Approximately 38 - 39 = -1
        const finalY = originalY - (scaledH - originalH) / 2; // Approximately 133 - 33.5 = 99.5

        ctx.drawImage(userImg, finalX, finalY, scaledW, scaledH);
        console.log("✅ User photo drawn with exact CSS scale positioning");
      }

      // Draw red man (z-index 30) - positioned exactly like in CSS - OVERLAPPING user photo
      if (redManImg) {
        // CSS: top: "93px", left: "107px", width: "60px", height: "60px", scale: "5.5"
        const originalX = 107;
        const originalY = 92;
        const originalWidth = 60;
        const originalHeight = 60;

        // Independent scaling
        const scaleX = 3.8;
        const scaleY = 5.4; // ← adjust this as needed to stretch vertically

        const scaledWidth = originalWidth * scaleX;
        const scaledHeight = originalHeight * scaleY;

        // Adjust position to scale from center
        const finalX = originalX - (scaledWidth - originalWidth) / 2;
        const finalY = originalY - (scaledHeight - originalHeight) / 2;

        // Draw with independent width and height
        ctx.drawImage(redManImg, finalX, finalY, scaledWidth, scaledHeight);

        console.log("✅ Red man drawn with independent scaleX/scaleY", {
          x: finalX,
          y: finalY,
          width: scaledWidth,
          height: scaledHeight,
        });
      }

      // Draw whatta text (z-index 30) - positioned exactly like in CSS
      if (whattaImg) {
        // CSS: top: "44px", right: "100px", width: "60px", height: "60px", scale: "4.5"
        const originalY = 44;
        const rightMargin = 100;
        const originalWidth = 60;
        const originalHeight = 60;
        const scaleX = 4.3; // keep X scale as-is
        const scaleY = 2.5; // stretch more in Y direction

        const scaledWidth = originalWidth * scaleX;
        const scaledHeight = originalHeight * scaleY;

        // Calculate X from right
        const originalX = 400 - rightMargin - originalWidth;

        // Since scaling is from center, adjust position
        const finalX = originalX - (scaledWidth - originalWidth) / 2;
        const finalY = originalY - (scaledHeight - originalHeight) / 2;

        // Draw image with independent scaling
        ctx.drawImage(whattaImg, finalX, finalY, scaledWidth, scaledHeight);

        console.log("✅ Whatta text drawn with X:Y stretch", {
          x: finalX,
          y: finalY,
          width: scaledWidth,
          height: scaledHeight,
        });
      }

      console.log("🎨 Polaroid manually created on canvas!");

      // Convert to blob
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("Failed to create blob"));
          },
          "image/png",
          1.0
        );
      });

      console.log("✅ Canvas converted to blob, size:", blob.size);

      // Upload to S3
      console.log("🚀 Uploading manually created polaroid to S3...");
      const formData = new FormData();
      formData.append(
        "photo",
        blob,
        `${phone}_polaroid_manual_${currentCounter}.png`
      );
      formData.append("phone", phone);
      formData.append("source", "manual_polaroid_creation");
      formData.append("counter", currentCounter);

      console.log("📤 FormData created:", {
        filename: `${phone}_polaroid_manual_${currentCounter}.png`,
        phone: phone,
        source: "manual_polaroid_creation",
        counter: currentCounter,
        blobSize: blob.size,
      });

      const response = await fetch("https://artmetech.co.in/api/upload-photo", {
        method: "POST",
        body: formData,
      });

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Upload failed:", response.status, errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("📊 Upload response:", result);

      if (result.success) {
        console.log(
          "✅ Manual polaroid uploaded successfully:",
          result.data.imageUrl
        );

        // Store new URL
        localStorage.setItem("userPhoto", result.data.imageUrl);
        console.log("💾 Stored new URL:", result.data.imageUrl);

        // Generate QR
        const qrUrl = await generateQRCode(result.data.imageUrl);
        setQrCodeUrl(qrUrl);
        setShowQR(true);
        console.log("✅ QR generated and shown");
      } else {
        throw new Error(result.message || "Upload failed");
      }
    } catch (error) {
      console.error("❌ Error:", error);
      setError("Failed to create polaroid. Please try again.");
    } finally {
      setIsLoading(false);
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
      if ("bluetooth" in navigator && "requestDevice" in navigator.bluetooth) {
        const device = await navigator.bluetooth.requestDevice({
          filters: [
            { services: ["00001801-0000-1000-8000-00805f9b34fb"] }, // Generic Attribute
            { services: ["0000180f-0000-1000-8000-00805f9b34fb"] }, // Battery Service
          ],
          optionalServices: ["00001800-0000-1000-8000-00805f9b34fb"], // Generic Access
        });

        if (device) {
          await sendToBluetooth(device, photoUrl);
          return;
        }
      }

      alert("Please connect a Bluetooth printer");
    } catch (error) {
      console.error("Bluetooth print error:", error);
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
      if ("usb" in navigator && "getDevices" in navigator.usb) {
        const devices = await navigator.usb.getDevices();
        const printerDevice = devices.find(
          (device) =>
            device.deviceClass === 7 || // Printer class
            (device.vendorId &&
              [0x04b8, 0x04a9, 0x03f0, 0x0924].includes(device.vendorId)) // Epson, Canon, HP, Xerox
        );

        if (printerDevice) {
          await sendToUSBPrinter(printerDevice, photoUrl);
          return;
        }
      }

      alert("Please connect a WiFi printer");
    } catch (error) {
      console.error("WiFi print error:", error);
      alert("Please connect a WiFi printer");
    }
  };
  // const [capturedPhoto, setCapturedPhoto] = useState(null);
  // const photoDataUrl = canvas.toDataURL("image/jpeg", 0.9);
  // setCapturedPhoto(photoDataUrl);
  // const downloadPhoto = () => {
  //   if (!capturedPhoto) return;

  //   const link = document.createElement("a");
  //   link.download = `capture_${Date.now()}.jpg`;
  //   link.href = capturedPhoto;
  //   link.click();
  // };
  // Bluetooth printer communication
  const sendToBluetooth = async (device, photoUrl) => {
    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(
        "00001801-0000-1000-8000-00805f9b34fb"
      );

      // Convert image to ESC/POS commands
      const imageBlob = await fetch(photoUrl).then((r) => r.blob());
      const escPosData = await convertToESCPOS(imageBlob);

      // Send to printer (simplified - actual implementation would need specific printer protocols)
      console.log("Sent to Bluetooth printer");
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
      const imageBlob = await fetch(photoUrl).then((r) => r.blob());
      const printerData = await convertToPrinterFormat(imageBlob);

      // Send to USB printer
      await device.transferOut(1, printerData);
      await device.close();

      console.log("Sent to USB printer");
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
              method: "OPTIONS",
              mode: "no-cors",
              signal: AbortSignal.timeout(1000),
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
      pc.createDataChannel("");

      const localIPs = [];

      return new Promise((resolve) => {
        pc.onicecandidate = (ice) => {
          if (ice.candidate) {
            const ip = ice.candidate.candidate.split(" ")[4];
            if (
              (ip && ip.startsWith("192.168.")) ||
              ip.startsWith("10.") ||
              ip.startsWith("172.")
            ) {
              const baseIP = ip.split(".").slice(0, 3).join(".");
              // Generate IP range (e.g., 192.168.1.1 to 192.168.1.254)
              for (let i = 1; i < 255; i++) {
                localIPs.push(`${baseIP}.${i}`);
              }
            }
          }
        };

        pc.createOffer().then((offer) => pc.setLocalDescription(offer));

        setTimeout(() => {
          pc.close();
          resolve(localIPs.slice(0, 50)); // Limit to first 50 IPs for performance
        }, 2000);
      });
    } catch (error) {
      return ["192.168.1.100", "192.168.0.100"]; // Fallback common printer IPs
    }
  };

  // Handle Normal Print button click
  const handleNormalPrint = async () => {
    // Get the S3 image URL from localStorage
    const s3ImageUrl = localStorage.getItem("userPhoto");

    if (!s3ImageUrl && !userPhoto && !photoInfo?.imageUrl) {
      setError("No photo available to print.");
      return;
    }

    // Priority: localStorage S3 URL > userPhoto > photoInfo.imageUrl
    const photoUrl = s3ImageUrl || userPhoto || photoInfo?.imageUrl;

    console.log("🖨️ Printing S3 image from localStorage:", photoUrl);

    try {
      // Create a new window/tab for printing
      const printWindow = window.open("", "_blank");

      // Create the filename with user's name
      const fileName = `whatta-chamking-smile-${
        userInfo?.userName?.replace(/\s+/g, "_") || "user"
      }`;

      // Write HTML content with the S3 image
      printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${fileName}</title>
        <style>
          @page {
            size: 4in 6in;
            margin: 0;
            orientation: portrait;
          }
          
          body {
            margin: 0;
            padding: 0;
            width: 4in;
            height: 6in;
            display: flex;
            justify-content: center;
            align-items: center;
            background: white;
            overflow: hidden;
          }
          
          img {
            max-width: 4in;
            max-height: 6in;
            object-fit: contain;
            display: block;
          }
          
          @media print {
            @page {
              size: 4in 6in !important;
              margin: 0 !important;
              orientation: portrait !important;
            }
            
            html, body { 
              width: 4in !important;
              height: 6in !important;
              margin: 0 !important; 
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              overflow: hidden !important;
              page-break-after: avoid !important;
            }
            
            img { 
              max-width: 4in !important; 
              max-height: 6in !important;
              width: auto !important;
              height: auto !important;
              object-fit: contain !important;
              page-break-inside: avoid !important;
              page-break-before: avoid !important;
              page-break-after: avoid !important;
              display: block !important;
              /* Enhanced print quality */
              filter: contrast(1.15) brightness(1.02) saturate(1.1) !important;
              image-rendering: -webkit-optimize-contrast !important;
              image-rendering: crisp-edges !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            /* Force single page */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              page-break-inside: avoid !important;
              orphans: 1 !important;
              widows: 1 !important;
            }
            
            /* Hide everything that might cause page breaks */
            body > *:not(img) {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <img src="${photoUrl}" alt="S3 Photo to print" onload="window.print(); window.close();" />
      </body>
    </html>
  `);

      printWindow.document.close();
    } catch (error) {
      console.error("Normal print error:", error);
      setError("Failed to open print dialog. Please try again.");
    }
  };

  // Send to network printer via IPP
  const sendToNetworkPrinter = async (printer, photoUrl) => {
    try {
      const imageBlob = await fetch(photoUrl).then((r) => r.blob());
      const formData = new FormData();
      formData.append("file", imageBlob, fileName);

      const response = await fetch(
        `http://${printer.ip}:${printer.port}/ipp/print`,
        {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "application/ipp",
          },
        }
      );

      if (response.ok) {
        console.log("Sent to network printer");
        return true;
      }
      throw new Error("Network print failed");
    } catch (error) {
      throw error;
    }
  };

  // AirPrint for iOS
  const tryAirPrint = async (photoUrl) => {
    try {
      // Create a canvas and draw the image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      return new Promise((resolve, reject) => {
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Convert to blob
          canvas.toBlob(
            async (blob) => {
              try {
                if (navigator.share && blob) {
                  const file = new File([blob], fileName, {
                    type: "image/jpeg",
                  });

                  // On iOS, this should show print option directly
                  await navigator.share({
                    files: [file],
                    title: "Print Photo",
                  });

                  resolve(true);
                } else {
                  reject(new Error("Share API not available"));
                }
              } catch (shareError) {
                reject(shareError);
              }
            },
            "image/jpeg",
            0.9
          );
        };

        img.onerror = () => reject(new Error("Image load failed"));
        img.crossOrigin = "anonymous";
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
    const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00]);
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
        console.log(
          "🔄 Cache exists but lenses not loaded, forcing fresh session"
        );

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
    console.log(
      "Selected Group Size:",
      localStorage.getItem("selectedGroupSize")
    );
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
              <h3 className="text-lg font-semibold mb-2">
                Scan to Download Your Photo
              </h3>
              <p className="text-sm text-gray-300">
                Use your phone's camera to scan this QR code
              </p>
            </div>
            <div className="flex justify-center">
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="object-contain rounded-lg bg-white p-4 mx-auto"
                style={{ width: "300px", height: "300px" }}
              />
            </div>
          </div>
        ) : (
          /* NEW: Polaroid Composite Display */
          <div
            ref={polaroidDivRef}
            className="relative"
            style={{ width: "400px", height: "550px" }}
          >
            {/* Polaroid Frame Background */}
            <img
              src="/assets/enddummy.png"
              alt="Polaroid Frame"
              className="absolute inset-0 w-full h-full object-cover z-10"
              style={{ width: "400px", height: "550px" }}
            />

            <img
              src="/assets/red-man.png"
              alt="Chamking"
              className="absolute z-30"
              style={{
                top: "93px",
                width: "60px",
                height: "60px",
                objectFit: "contain",
                scale: "5.5",
                left: "107px",
              }}
            />

            <img
              src="/assets/chamking-whatta.png"
              alt="Chamking"
              className="absolute z-30"
              style={{
                top: "44px",
                right: "100px",
                width: "60px",
                height: "60px",
                objectFit: "contain",
                scale: "4.5",
              }}
            />

            {/* Background-Removed Photo (positioned in the blue area) */}
            {backgroundRemovedPhoto && (
              <img
                src={backgroundRemovedPhoto}
                alt="Your AR Photo"
                className="absolute z-20"
                style={{
                  // top: "143px",
                  // left: "38px",
                  left: "60px",
                  width: "339px",
                  height: "290px",
                  // objectFit: "cover",
                  objectFit: "contain",
                  borderRadius: "4px",
                  scale: "1.3",
                  bottom: "110px",
                }}
                onError={(e) => {
                  console.log(
                    "Background-removed photo failed to load, hiding"
                  );
                  setBackgroundRemovedPhoto(null);
                }}
              />
            )}

            {/* Fallback: Original photo if background removal failed */}
            {!backgroundRemovedPhoto && userPhoto && (
              <img
                src={userPhoto}
                alt="Your AR Photo"
                className="absolute z-20"
                style={{
                  top: "143px",
                  left: "38px",
                  width: "339px",
                  height: "290px",
                  objectFit: "cover",
                  borderRadius: "4px",
                  scale: "1.3",
                }}
                onError={(e) => {
                  console.log("Original photo failed to load");
                  e.target.style.display = "none";
                }}
              />
            )}

            {/* Double Fallback: Show just the frame if no photos */}
            {!backgroundRemovedPhoto && !userPhoto && (
              <div
                className="absolute z-20 flex items-center justify-center text-gray-400 text-sm"
                style={{
                  top: "143px",
                  left: "38px",
                  width: "339px",
                  height: "290px",
                  objectFit: "cover",
                  borderRadius: "4px",
                  scale: "1.3",
                }}
              >
                Photo not available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Buttons Container */}
      <div className="flex flex-col space-y-4 items-center z-20 relative">
        {/* Download Button */}
        {!showQR && (
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
            {photoInfo?.hasPhoto ? "PROCEED TO PRINT" : "DOWNLOAD"}
          </button>
        )}

        {showQR && (
          <button
            onClick={handleNormalPrint}
            className="text-white font-gotham text-sm font-bold cursor-pointer py-3 flex-1 flex items-center justify-center gap-1 text-xl font-bold cursor-pointer py-3 w-80"
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
            {/* Print Icon */}
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
              <polyline points="6,9 6,2 18,2 18,9"></polyline>
              <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"></path>
              <polyline points="6,14 18,14 18,22 6,22 6,14"></polyline>
            </svg>
            PRINT
          </button>
        )}

        {/* Print Buttons Row - Only show when QR is displayed */}
        {showQR && (
          <div className="flex gap-4 w-80">
            {/* Bluetooth Print Button */}
            <button
              onClick={downloadPhoto}
              className="text-white font-gotham text-xl font-bold cursor-pointer py-3 w-80"
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
              Download Photo
            </button>

            {/* WiFi Print Button */}
          </div>
        )}

        {/* Smart Retry Button */}
        <button
          onClick={handleRetry}
          className="text-white font-gotham text-xl font-bold cursor-pointer py-3 w-80"
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
            className="text-white text-lg font-gotham font-medium cursor-pointer py-2 px-4 flex items-center gap-2"
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
        {showQR && showRedirectTimer && redirectTimer > 0 && (
          <div className="  z-30">
            <div className="text-white px-4 py-2 rounded-lg border border-white/20 backdrop-blur-sm">
              <p className="text-sm font-medium">
                Redirecting in {redirectTimer}...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EndScreen;
