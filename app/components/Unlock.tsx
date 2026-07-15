"use client";

import { useState } from "react";
import { loadWallet, clearWallet } from "../lib/storage";
import { Wallet } from "../lib/wallet";

interface Props {
  onUnlock: (wallet: Wallet) => void;
  onReset: () => void;
}

export default function Unlock({ onUnlock, onReset }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async () => {
    setError("");
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setIsLoading(true);
    try {
      const wallet = await loadWallet(password);
      onUnlock(wallet);
    } catch {
      setError("Invalid password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetClick = () => {
    if (confirm("Are you sure? This will delete your wallet from this device. If you haven't saved your recovery phrase, you will lose your funds permanently.")) {
      clearWallet();
      onReset();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d4aa]/20 to-[#00a085]/10 border border-[#00d4aa]/30 shadow-lg shadow-[#00d4aa]/10">
        <span className="text-4xl font-bold text-[#00d4aa]">🔒</span>
      </div>
      
      <h1 className="mb-2 text-center text-3xl font-extrabold tracking-tight">
        Welcome Back
      </h1>
      <p className="mb-10 text-center text-white/60">
        Enter your password to unlock QuanVault.
      </p>

      <div className="w-full max-w-sm">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-center text-lg text-white outline-none transition-colors focus:border-[#00d4aa]/50 focus:bg-black/60"
          placeholder="Password"
          autoFocus
        />
        
        {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={isLoading || !password}
          className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00a085] px-4 py-4 font-bold text-[#05070b] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? "Unlocking..." : "Unlock Wallet"}
        </button>

        <button
          onClick={handleResetClick}
          className="mt-8 w-full text-center text-sm font-medium text-white/40 hover:text-red-400 transition-colors"
        >
          Reset Wallet (Delete Data)
        </button>
      </div>
    </div>
  );
}
