import React from "react";

const Terms = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      {/* Header with Close Button */}
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between bg-transparent">
          <button
            onClick={onBack}
            className="text-white text-4xl font-light hover:text-gray-300 transition-colors bg-transparent px-0"
          >
            ←
          </button>
          <img
            src="/assets/happydent-logo.png"
            alt="HAPPYDENT"
            className="w-48 h-24 object-contain mx-auto"
          />

          {/* Spacer for alignment */}
          <div className="w-10"></div>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Brand Header */}
        <div className="text-center mb-12">
          <h1 className="text-xl font-semibold text-center flex-1">
            Terms & Conditions
          </h1>
          {/* <p className="text-white/70 text-sm">Chamking Smile AR Experience</p> */}
        </div>

        {/* Terms Content */}
        <div className="prose prose-invert max-w-none">
          {/* <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 mb-8">
            <p className="text-white/90 leading-relaxed mb-6">
              Welcome to the Happydent Chamking Smile AR Experience. By using this application,
              you agree to comply with and be bound by the following terms and conditions.
            </p>
          </div> */}

          {/* Terms Sections */}
          <div className="space-y-6">
            <section className=" border-blue-400 pl-6 py-4">
              <h3 className="text-lg font-semibold mb-3 text-white">
                1. Acceptance of Terms
              </h3>
              <p className="text-white leading-relaxed">
                By accessing and using this AR experience, you acknowledge that
                you have read, understood, and agree to be bound by these terms.
              </p>
            </section>

            <section className=" border-blue-400 pl-6 py-4">
              <h3 className="text-lg font-semibold mb-3 text-white">
                2. Data Collection & Privacy
              </h3>
              <p className="text-white leading-relaxed">
                We collect your name and phone number solely for this
                experience. Your information will not be shared with third
                parties without explicit consent. Photos captured are stored
                temporarily and can be deleted upon request.
              </p>
            </section>

            <section className=" border-blue-400 pl-6 py-4">
              <h3 className="text-lg font-semibold mb-3 text-white">
                3. Camera & AR Technology
              </h3>
              <p className="text-white leading-relaxed">
                This application uses your device's camera for AR functionality.
                Camera access is required for the experience to work. No video
                recording occurs without your explicit action.
              </p>
            </section>

            <section className=" border-blue-400 pl-6 py-4">
              <h3 className="text-lg font-semibold mb-3 text-white">
                4. Age Requirements
              </h3>
              <p className="text-white leading-relaxed">
                This service is intended for users aged 13 and above. Users
                under 18 must have parental or guardian consent before use.
              </p>
            </section>

            <section className=" border-blue-400 pl-6 py-4">
              <h3 className="text-lg font-semibold mb-3 text-white">
                5. Limitation of Liability
              </h3>
              <p className="text-white leading-relaxed">
                Happydent provides this AR experience "as is" without
                warranties. We are not liable for any damages arising from use
                of this application.
              </p>
            </section>

            <section className=" border-blue-400 pl-6 py-4">
              <h3 className="text-lg font-semibold mb-3 text-white">
                6. Technical Requirements
              </h3>
              <p className="text-white leading-relaxed">
                This experience requires a compatible device with camera access
                and modern browser support. Performance may vary based on device
                capabilities.
              </p>
            </section>

            <section className=" border-blue-400 pl-6 py-4">
              <h3 className="text-lg font-semibold mb-3 text-white">
                7. Contact Information
              </h3>
              <p className="text-white leading-relaxed">
                For questions regarding these terms or to request data deletion,
                please contact us through official Happydent support channels.
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-white/10 text-center">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <p className="text-white text-sm mb-2">
                By continuing to use this application, you acknowledge that you
                have read and agree to these terms and conditions.
              </p>
              <p className="text-white text-xs">
                © 2024 Happydent. All rights reserved. | Powered by Snap AR
                Technology
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Spacing */}
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default Terms;
