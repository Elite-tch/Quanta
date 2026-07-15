"use client";

import { useState } from "react";

interface ImportWalletProps {
  onClose: () => void;
  onImport: (walletData: string, password: string) => Promise<void>;
}

export default function ImportWallet({ onClose, onImport }: ImportWalletProps) {
  const [step, setStep] = useState<"method" | "paste" | "password">("method");
  const [walletData, setWalletData] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMethodSelect = (method: string) => {
    if (method === "paste") {
      setStep("paste");
    }
  };

  const handlePasteNext = () => {
    setError("");
    if (!walletData.trim()) {
      setError("Please paste wallet data");
      return;
    }
    if (walletData.trim().length < 100) {
      setError("Wallet data seems too short. Please check.");
      return;
    }
    setStep("password");
  };

  const handleImport = async () => {
    setError("");
    if (!password) {
      setError("Please enter a password");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await onImport(walletData, password);
    } catch (err) {
      setError((err as Error).message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl border border-white/10 bg-[#05070b] shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {step !== "method" && (
              <button
                onClick={() => setStep(step === "password" ? "paste" : "method")}
                className="hover:text-[#00d4aa] transition-colors"
              >
                ←
              </button>
            )}
            Import Wallet
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {step === "method" && (
            <div className="space-y-4">
              <p className="text-sm text-white/60">Choose your import method:</p>

              <button
                onClick={() => handleMethodSelect("paste")}
                className="w-full flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all group"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">📋</div>
                <div className="text-left">
                  <p className="font-semibold text-sm">Paste Wallet Data</p>
                  <p className="text-xs text-white/40 mt-1">Paste your 64KB parent wallet hex data</p>
                </div>
              </button>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60 leading-relaxed">
                  <strong>Important:</strong> Never share your wallet backup with anyone. Anyone with this data can access all your addresses.
                </p>
              </div>
            </div>
          )}

          {step === "paste" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-2 uppercase text-white/50">
                  Wallet Backup Data
                </label>
                <textarea
                  value={walletData}
                  onChange={(e) => setWalletData(e.target.value)}
                  placeholder="Paste your 64KB wallet hex data here..."
                  className="w-full h-32 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#00d4aa]/50 resize-none font-mono"
                />
                <p className="text-xs text-white/40 mt-2">
                  Expected: 131,072 hex characters (64 KB)
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handlePasteNext}
                className="w-full rounded-lg bg-gradient-to-r from-[#00d4aa] to-[#00a085] px-4 py-2.5 text-sm font-bold text-black hover:shadow-lg hover:shadow-[#00d4aa]/30 transition-all"
              >
                Continue
              </button>
            </div>
          )}

          {step === "password" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-2 uppercase text-white/50">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 8 chars)"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#00d4aa]/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 uppercase text-white/50">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#00d4aa]/50"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-[#00d4aa] to-[#00a085] px-4 py-2.5 text-sm font-bold text-black hover:shadow-lg hover:shadow-[#00d4aa]/30 transition-all disabled:opacity-50"
              >
                {loading ? "Importing..." : "Import Wallet"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
