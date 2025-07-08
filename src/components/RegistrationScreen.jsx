import React, { useState, useEffect } from "react";

const RegistrationScreen = ({ onComplete, onTerms, sessionData }) => {
  // 🔧 FIX: Initialize state with data from localStorage
  const [formData, setFormData] = useState(() => {
    const savedFormData = localStorage.getItem("registrationFormData");
    if (savedFormData) {
      try {
        return JSON.parse(savedFormData);
      } catch (e) {
        console.warn("Failed to parse saved form data");
      }
    }
    return {
      name: "",
      phone: "",
      groupSize: "less",
    };
  });

  const [otpData, setOtpData] = useState(() => {
    const savedOtpData = localStorage.getItem("registrationOtpData");
    if (savedOtpData) {
      try {
        return JSON.parse(savedOtpData);
      } catch (e) {
        console.warn("Failed to parse saved OTP data");
      }
    }
    return {
      otp: "",
      isOtpSent: false,
      isOtpVerified: false,
      timeLeft: 0,
      canResend: false,
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(() => {
    return localStorage.getItem("registrationPhoneTouched") === "true";
  });
  const [otpTouched, setOtpTouched] = useState(() => {
    return localStorage.getItem("registrationOtpTouched") === "true";
  });

  // NEW: State for edit mode
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // NEW: Session management state
  const [snapAR, setSnapAR] = useState({
    sessionId: null,
    phoneAssociated: false,
    arEnded: false,
    isMonitoring: false,
  });

  // ⭐ TESTING MODE - Set to true to bypass OTP
  const BYPASS_OTP = true; // Change to false for production

  // API endpoint - change this to your backend URL
  const API_BASE_URL = "";

  const [nameTouched, setNameTouched] = useState(() => {
    return localStorage.getItem("registrationNameTouched") === "true";
  });
  const [termsAccepted, setTermsAccepted] = useState(() => {
    return localStorage.getItem("registrationTermsAccepted") === "true";
  });

  // Set character limits
  const NAME_MIN_LENGTH = 2;
  const NAME_MAX_LENGTH = 36;

  // 🔧 FIX: Save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("registrationFormData", JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem("registrationOtpData", JSON.stringify(otpData));
  }, [otpData]);

  useEffect(() => {
    localStorage.setItem("registrationPhoneTouched", phoneTouched.toString());
  }, [phoneTouched]);

  useEffect(() => {
    localStorage.setItem("registrationOtpTouched", otpTouched.toString());
  }, [otpTouched]);

  useEffect(() => {
    localStorage.setItem("registrationNameTouched", nameTouched.toString());
  }, [nameTouched]);

  useEffect(() => {
    localStorage.setItem("registrationTermsAccepted", termsAccepted.toString());
  }, [termsAccepted]);

  // 🔧 FIX: Clear saved form data when registration is completed
  const clearSavedFormData = () => {
    localStorage.removeItem("registrationFormData");
    localStorage.removeItem("registrationOtpData");
    localStorage.removeItem("registrationPhoneTouched");
    localStorage.removeItem("registrationOtpTouched");
    localStorage.removeItem("registrationNameTouched");
    localStorage.removeItem("registrationTermsAccepted");
  };

  // NEW: Initialize session data from splash screen
  useEffect(() => {
    // Get session ID from props (passed from splash screen) or localStorage
    const sessionId =
      sessionData?.sessionId || localStorage.getItem("snapARSessionId");

    if (sessionId) {
      setSnapAR((prev) => ({ ...prev, sessionId }));
      console.log(`🆔 Using session ID: ${sessionId}`);
    } else {
      console.warn(
        "⚠️ No session ID found - this may cause issues with Snap AR integration"
      );
    }
  }, [sessionData]);

  // Timer for OTP expiry
  useEffect(() => {
    let timer;
    if (otpData.timeLeft > 0) {
      timer = setTimeout(() => {
        setOtpData((prev) => ({
          ...prev,
          timeLeft: prev.timeLeft - 1,
          canResend: prev.timeLeft - 1 <= 0,
        }));
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [otpData.timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Validate Indian phone number (exactly 10 digits)
  const validatePhone = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  const validateName = (name) => {
    const trimmedName = name.trim();
    const nameRegex = /^[a-zA-Z\s]+$/; // Only letters and spaces

    return (
      trimmedName.length >= NAME_MIN_LENGTH &&
      trimmedName.length <= NAME_MAX_LENGTH &&
      nameRegex.test(trimmedName)
    );
  };

  // Validate OTP (6 digits)
  const validateOTP = (otp) => {
    const otpRegex = /^\d{6}$/;
    return otpRegex.test(otp);
  };

  // Check if all fields are filled and valid
  const isFormValid = () => {
    const basicFields =
      validateName(formData.name) &&
      validatePhone(formData.phone) &&
      formData.groupSize !== "" &&
      termsAccepted; // 🚨 NEW: Must accept terms

    // If bypassing OTP, only check basic fields
    if (BYPASS_OTP) {
      return basicFields;
    }

    // Normal mode - require OTP verification
    return basicFields && otpData.isOtpVerified;
  };

  const handleTermsChange = () => {
    setTermsAccepted(!termsAccepted);
    setError(""); // Clear error when user interacts
  };

  const handleNameChange = (e) => {
    setError(""); // Clear error when user types
    let value = e.target.value;

    // Remove any non-letter/space characters in real-time
    value = value.replace(/[^a-zA-Z\s]/g, "");

    // Limit to max length
    if (value.length <= NAME_MAX_LENGTH) {
      setFormData((prev) => ({ ...prev, name: value }));
    }
  };

  const handlePhoneChange = (e) => {
    setError(""); // Clear error when user types
    const value = e.target.value.replace(/\D/g, ""); // Remove non-digits

    // Reset OTP state if phone number changes
    if (value !== formData.phone && !BYPASS_OTP) {
      setOtpData({
        otp: "",
        isOtpSent: false,
        isOtpVerified: false,
        timeLeft: 0,
        canResend: false,
      });
    }

    // Only allow first digit to be 6-9
    if (value.length === 0 || /^[6-9]/.test(value)) {
      if (value.length <= 10) {
        setFormData((prev) => ({ ...prev, phone: value }));
      }
    }
  };

  // NEW: Handle edit phone number
  const handleEditPhone = () => {
    setIsEditingPhone(true);
    setOtpData({
      otp: "",
      isOtpSent: false,
      isOtpVerified: false,
      timeLeft: 0,
      canResend: false,
    });
    setError("");
  };

  const handleOtpChange = (e) => {
    setError("");
    const value = e.target.value.replace(/\D/g, ""); // Remove non-digits
    if (value.length <= 6) {
      setOtpData((prev) => ({ ...prev, otp: value }));
    }
  };

  const handleGroupSizeSelect = (size) => {
    setError(""); // Clear error when user selects
    setFormData((prev) => ({ ...prev, groupSize: size }));
  };

  // Mock OTP verification for bypass mode
  const bypassOTPVerification = () => {
    setOtpData((prev) => ({
      ...prev,
      isOtpSent: true,
      isOtpVerified: true,
      timeLeft: 0,
    }));
    setIsEditingPhone(false); // Exit edit mode after verification
  };

  // Send OTP API call
  const sendOTP = async () => {
    // If bypassing, just mock the verification
    if (BYPASS_OTP) {
      setIsLoading(true);
      setTimeout(() => {
        bypassOTPVerification();
        setIsLoading(false);
      }, 500); // Small delay for UX
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(`https://artmetech.co.in/api/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: formData.phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }

      setOtpData((prev) => ({
        ...prev,
        isOtpSent: true,
        timeLeft: data.data.expiresIn * 60, // Convert minutes to seconds
        canResend: false,
      }));

      console.log("OTP sent successfully:", data);
    } catch (error) {
      console.error("Send OTP error:", error);
      setError(error.message || "Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP API call
  const verifyOTP = async () => {
    // If bypassing, verification is already done
    if (BYPASS_OTP) {
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(`https://artmetech.co.in/api/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formData.phone,
          otp: otpData.otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "OTP verification failed");
      }

      setOtpData((prev) => ({
        ...prev,
        isOtpVerified: true,
        timeLeft: 0,
      }));

      setIsEditingPhone(false); // Exit edit mode after successful verification

      console.log("OTP verified successfully:", data);
    } catch (error) {
      console.error("Verify OTP error:", error);

      if (error.message.includes("expired")) {
        setOtpData((prev) => ({
          ...prev,
          isOtpSent: false,
          otp: "",
          timeLeft: 0,
          canResend: true,
        }));
      }

      setError(error.message || "OTP verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Send/Resend OTP button click
  const handleSendOTP = async () => {
    if (!validatePhone(formData.phone)) {
      setError("Please enter a valid 10-digit phone number");
      setPhoneTouched(true);
      return;
    }

    await sendOTP();
  };

  // Handle Verify OTP button click
  const handleVerifyOTP = async () => {
    if (!validateOTP(otpData.otp)) {
      setError("Please enter a valid 6-digit OTP");
      setOtpTouched(true);
      return;
    }

    await verifyOTP();
  };

  // NEW: Associate phone number with session ID
  const associatePhoneWithSession = async (phone, userInfo = null) => {
    if (!snapAR.sessionId) {
      console.error("❌ No session ID available for phone association");
      return null;
    }

    try {
      console.log(
        `📱 Associating phone ${phone} with session ${snapAR.sessionId}`
      );

      const response = await fetch(
        `https://artmetech.co.in/api/snap/associate-phone`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: snapAR.sessionId,
            phone: phone,
            userInfo: userInfo,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to associate phone with session"
        );
      }

      setSnapAR((prev) => ({ ...prev, phoneAssociated: true }));
      console.log("✅ Phone associated with session successfully:", data);

      return data;
    } catch (error) {
      console.error("❌ Phone association error:", error);
      // Don't throw error - this shouldn't block registration
      return null;
    }
  };

  const registerUser = async (userData) => {
    try {
      const response = await fetch(`https://artmetech.co.in/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...userData,
          category: "internal", // Hardcoded for microsite
          otpVerified: BYPASS_OTP ? true : otpData.isOtpVerified,
          bypassMode: BYPASS_OTP, // Let backend know this is bypass mode
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      return data;
    } catch (error) {
      console.error("Registration API error:", error);
      throw error;
    }
  };

  const handleGetStarted = async () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth", // or 'instant' for immediate scroll
    });
    if (!isFormValid()) {
      if (!termsAccepted) {
        setError("Please accept the Terms & Conditions to continue");
        return;
      }
      if (!BYPASS_OTP && !otpData.isOtpVerified) {
        setError("Please verify your phone number first");
      } else {
        setError("Please fill all fields correctly");
      }
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // NEW: 1. APPLY THE SELECTED LENS BASED ON GROUP SIZE
      console.log(`🎯 Applying lens for group size: ${formData.groupSize}`);

      const cache = window.snapARPreloadCache;
      if (cache && cache.lenses && cache.session) {
        const selectedLens = cache.lenses[formData.groupSize]; // 'less' or 'more'

        if (selectedLens) {
          console.log(`🎯 Applying ${formData.groupSize} lens:`, selectedLens);
          await cache.session.applyLens(selectedLens);
          cache.appliedLens = selectedLens;
          console.log("✅ Lens applied successfully");
        } else {
          console.warn("⚠️ Selected lens not found in cache");
        }
      } else {
        console.warn("⚠️ AR cache or session not available");
      }

      // 2. ASSOCIATE PHONE WITH SESSION
      const userInfo = {
        name: formData.name.trim(),
        groupSize: formData.groupSize,
        timestamp: new Date().toISOString(),
      };

      console.log(
        `📱 Step 2: Associating phone ${formData.phone} with session ${snapAR.sessionId}`
      );
      await associatePhoneWithSession(formData.phone, userInfo);

      // 3. REGISTER USER
      const userData = {
        name: formData.name.trim(),
        phone: formData.phone,
        groupSize: formData.groupSize,
      };

      console.log("Registering user:", userData);

      // Call registration API
      const response = await registerUser(userData);

      console.log("Registration successful:", response);

      // 4. STORE USER DATA (including session ID and selected lens info)
      localStorage.setItem("userPhone", formData.phone);
      localStorage.setItem("userId", response.data.id.toString());
      localStorage.setItem("userName", formData.name.trim());
      localStorage.setItem("selectedGroupSize", formData.groupSize); // Store group size

      // 🔧 FIX: Clear saved form data after successful registration
      clearSavedFormData();

      // 5. COMPLETE REGISTRATION
      onComplete({
        ...formData,
        userId: response.data.id,
        isExisting: response.data.isExisting,
        apiResponse: response,
        bypassMode: BYPASS_OTP,
        // NEW: Session data with lens selection
        snapAR: {
          sessionId: snapAR.sessionId,
          phoneAssociated: snapAR.phoneAssociated,
        },
        // NEW: Selected lens info
        selectedLens: {
          groupSize: formData.groupSize,
          lensId:
            formData.groupSize === "less"
              ? "31000d06-6d26-4b39-8dd0-6e63aeb5901d"
              : "9187f2ac-af8f-4be0-95e9-cf19261c0082",
        },
      });
    } catch (error) {
      console.error("Registration error:", error);

      // Handle specific error messages
      if (error.message.includes("already registered")) {
        setError("This phone number is already registered");
      } else if (error.message.includes("Invalid phone")) {
        setError("Please enter a valid phone number");
      } else if (error.message.includes("verification required")) {
        setError("Please verify your phone number first");
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        setError("Network error. Please check your connection and try again");
      } else {
        setError(error.message || "Registration failed. Please try again");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTermsClick = () => {
    if (onTerms) {
      onTerms(); // Go to terms screen
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-white max-w-[991px] mx-auto">
      {/* HAPPYDENT Logo */}
      <img
        src="/assets/happydent-logo.png"
        alt="HAPPYDENT"
        className="w-64 h-32 object-contain mb-8"
      />

      {/* Subtitle */}
      <div className="text-center mb-8">
        <p className="text-lg italic">
          Get your <span className="font-bold">chamking</span> smile by
        </p>
        <p className="text-lg italic">filling in your details!</p>
      </div>

      {/* Testing Mode + Session Status Indicators */}
      <div className="w-full max-w-sm mb-4 space-y-2">
        {BYPASS_OTP && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded p-2 text-center">
            <p className="text-yellow-300 text-xs">
              🧪 Testing Mode - OTP Bypassed
            </p>
          </div>
        )}
      </div>

      {/* Form Container */}
      <div className="w-full max-w-sm space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-center">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Name Input */}
        <div>
          <input
            type="text"
            placeholder="Name"
            value={formData.name}
            onChange={handleNameChange}
            onBlur={() => setNameTouched(true)}
            disabled={isLoading}
            maxLength={NAME_MAX_LENGTH}
            className="w-full px-4 py-3 bg-transparent border border-white/50 rounded text-white placeholder-white/70 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Phone Input with OTP Button */}
        <div>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="tel"
                placeholder="Phone No."
                value={formData.phone}
                onChange={handlePhoneChange}
                onBlur={() => setPhoneTouched(true)}
                disabled={isLoading || (otpData.isOtpVerified && !isEditingPhone)}
                className="w-full px-4 py-3 bg-transparent border border-white/50 rounded text-white placeholder-white/70 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
                maxLength="10"
                pattern="^[6-9]\d{9}$"
              />

              {/* Edit button inside phone input when OTP is verified and not in edit mode */}
              {otpData.isOtpVerified && !isEditingPhone && (
                <button
                  onClick={handleEditPhone}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-300 hover:text-blue-200 text-sm font-medium transition-colors"
                  style={
                    {
                      backgroundColor: "transparent",
                      color: "white",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      textTransform: "uppercase",
                      opacity: "1",
                    }
                  }
                >
                  Edit
                </button>
              )}
            </div>

            {/* OTP Button - shown when not verified OR in edit mode */}
            {(!otpData.isOtpVerified || isEditingPhone) && (
              <button
                onClick={handleSendOTP}
                disabled={
                  !validatePhone(formData.phone) ||
                  isLoading ||
                  (otpData.isOtpSent && !otpData.canResend && !BYPASS_OTP)
                }
                className={`min-w-[120px] fixed-btn px-4 py-3 rounded font-medium text-sm transition-all ${validatePhone(formData.phone) &&
                  !isLoading &&
                  (!otpData.isOtpSent || otpData.canResend || BYPASS_OTP)
                  ? "text-white hover:opacity-80 border-white"
                  : "bg-gray-500/30 text-gray-400 border-white/40 cursor-not-allowed"
                  }`}
                style={{
                  backgroundColor:
                    validatePhone(formData.phone) &&
                      !isLoading &&
                      (!otpData.isOtpSent || otpData.canResend || BYPASS_OTP)
                      ? "#041763"
                      : undefined,
                }}
              >
                {BYPASS_OTP
                  ? "Verify"
                  : otpData.isOtpSent && !otpData.canResend
                    ? "Sent"
                    : otpData.isOtpSent
                      ? "Resend"
                      : "Send OTP"}
              </button>
            )}
          </div>

          <p
            className={`text-red-300 text-xs mt-1 transition-all duration-200 ${phoneTouched && !validatePhone(formData.phone)
              ? "visible"
              : "invisible"
              }`}
          >
            Enter valid 10 digit mobile number
          </p>
        </div>

        {/* OTP Input (shown only when OTP is sent and not bypassing and not verified) */}
        {otpData.isOtpSent && !otpData.isOtpVerified && !BYPASS_OTP && (
          <div
            style={{
              margin: "0px",
            }}
          >
            <div className="flex space-x-2">
              <input
                type="tel"
                placeholder="Enter 6-digit OTP"
                value={otpData.otp}
                onChange={handleOtpChange}
                onBlur={() => setOtpTouched(true)}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-transparent border border-white/50 rounded text-white placeholder-white/70 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
                maxLength="6"
                pattern="^\d{6}$"
              />

              <button
                onClick={handleVerifyOTP}
                disabled={!validateOTP(otpData.otp) || isLoading}
                className={`min-w-[120px] fixed-btn px-4 py-3 rounded font-medium text-sm transition-all ${validateOTP(otpData.otp) && !isLoading
                  ? "text-white hover:opacity-80 border-white"
                  : "bg-gray-500/30 text-gray-400 border-white/40 cursor-not-allowed"
                  }`}
                style={{
                  backgroundColor:
                    validateOTP(otpData.otp) && !isLoading
                      ? "#041763"
                      : undefined,
                }}
              >
                Verify
              </button>
            </div>

            {/* OTP Timer */}
            {otpData.timeLeft > 0 && (
              <p className="text-blue-300 text-xs mt-1">
                OTP expires in: {formatTime(otpData.timeLeft)}
              </p>
            )}

            {/* OTP Validation Error */}
            <p
              className={`text-red-300 text-xs mt-1 transition-all duration-200 ${otpTouched && !validateOTP(otpData.otp)
                ? "visible"
                : "invisible"
                }`}
            >
              Enter valid 6-digit OTP
            </p>
          </div>
        )}

        {/* Group Size Selection */}
        <div className="text-center">
          <h3 className="text-white text-lg mb-4 text-[20px] flex items-center gap-4">
            <div className="flex-1 h-px bg-white"></div>
            Select your
            <span className="font-bold drop-shadow-[0_0_15px_rgba(255,255,255,0.9)] text-white">
              GROUP SIZE
            </span>
            <div className="flex-1 h-px bg-white"></div>
          </h3>

          <div className="relative">
            {/* Background container */}
            <div className="relative flex border-2 border-white rounded-[4px] overflow-hidden bg-transparent mt-[24px]">
              {/* Sliding white background */}
              <div
                className={`absolute top-0 h-full w-1/2 bg-white transition-transform duration-300 ease-in-out ${formData.groupSize === "more"
                  ? "translate-x-full"
                  : "translate-x-0"
                  }`}
                style={{
                  margin: "0px",
                  width: "50%",
                  height: "100%",
                  borderRadius: "4px",
                }}
              />

              {/* Button container */}
              <div className="relative flex w-full radio-btn-container">
                <button
                  onClick={() => handleGroupSizeSelect("less")}
                  disabled={isLoading}
                  className={`outline-none hover:outline-none flex-1 py-[14px] px-6 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative z-10 font-semibold text-[14px] rounded-[4px] select-none focus:outline-none focus:ring-0 ${formData.groupSize === "less"
                    ? "bg-transparent text-blue-700" // Selected: transparent bg (white shows from behind), blue text
                    : "bg-transparent text-white" // Not selected: transparent bg, white text
                    }`}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    WebkitUserSelect: "none",
                    MozUserSelect: "none",
                    msUserSelect: "none",
                    userSelect: "none",
                    outline: "none",
                  }}
                >
                  Less than 3 people
                </button>
                <button
                  onClick={() => handleGroupSizeSelect("more")}
                  disabled={isLoading}
                  className={`outline-none hover:outline-none flex-1 py-[14px] px-6 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative z-10 font-semibold text-[14px] rounded-[4px] select-none focus:outline-none focus:ring-0 ${formData.groupSize === "more"
                    ? "bg-transparent text-blue-700" // Selected: transparent bg (white shows from behind), blue text
                    : "bg-transparent text-white" // Not selected: transparent bg, white text
                    }`}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    WebkitUserSelect: "none",
                    MozUserSelect: "none",
                    msUserSelect: "none",
                    userSelect: "none",
                    outline: "none",
                  }}
                >
                  More than 3 people
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 max-w-sm">
        <div
          className="flex items-start space-x-3 p-3 rounded cursor-pointer transition-all duration-200 "
          onClick={handleTermsChange}
        >
          {/* Custom Checkbox */}
          <div className="flex-shrink-0 mt-0.5">
            <div
              className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${termsAccepted
                ? "border-white bg-white"
                : "border-white/50 bg-transparent hover:border-white"
                }`}
            >
              {termsAccepted && (
                <svg
                  className="w-3 h-3 text-blue-700"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Terms Text */}
          {/* Terms Text - FIXED: All on one line to prevent extra spaces */}
          <div className="flex-1 text-sm text-white/80 leading-relaxed">
            <p>
              I confirm that I've read, understood, and agree to the{" "}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent checkbox toggle
                  handleTermsClick();
                }}
                className="text-white underline hover:text-white/80 transition-colors bg-transparent border-none cursor-pointer px-0"
              >
                Terms & Conditions
              </button>
            </p>
          </div>
        </div>

        {/* Terms validation error */}
        {!termsAccepted && error.includes("terms") && (
          <p className="text-red-300 text-xs mt-2 text-center">
            Please accept the Terms & Conditions to continue
          </p>
        )}
      </div>

      {/* Get Started Button */}
      <div className="w-full mb-[8px] max-w-sm">
        <button
          onClick={handleGetStarted}
          disabled={!isFormValid() || isLoading}
          className={`w-full py-4 px-6 rounded font-bold text-lg transition-all relative ${isFormValid() && !isLoading
            ? "cursor-pointer hover:opacity-90"
            : "cursor-not-allowed opacity-60"
            }`}
          style={{
            background:
              isFormValid() && !isLoading
                ? "radial-gradient(40% 40% at 80% 100%, rgb(255 255 255 / 31%) 0%, rgb(0 51 255 / 31%) 59%, rgb(0 13 255 / 31%) 100%)"
                : "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)", // Grey gradient when disabled
            borderRadius: "4px",
            // 🚨 FIXED: Use individual border properties instead of shorthand + borderStyle
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor:
              isFormValid() && !isLoading
                ? "rgba(255, 255, 255, 0.52)"
                : "rgba(156, 163, 175, 0.4)", // Grey border when disabled
            boxShadow:
              isFormValid() && !isLoading
                ? "2px 2px 4px 0px rgba(0, 0, 0, 0.39)"
                : "1px 1px 2px 0px rgba(0, 0, 0, 0.2)", // Lighter shadow when disabled
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              <span className="italic">REGISTERING...</span>
            </div>
          ) : (
            <span
              className={`italic ${isFormValid() && !isLoading ? "text-white" : "text-gray-300"
                }`}
            >
              GET STARTED
            </span>
          )}
        </button>
      </div>

      {/* Footer Text */}
    </div>
  );
};

export default RegistrationScreen;
