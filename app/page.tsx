"use client";

import { useEffect, useState } from "react";
import { hasWallet } from "./lib/storage";
import { Wallet } from "./lib/wallet"; 
import Onboarding from "./components/Onboarding";
import Dashboard from "./components/Dashboard";
import Unlock from "./components/Unlock";


type AppState = "loading" | "onboarding" | "locked" | "dashboard";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    // Check if wallet exists on mount
    setTimeout(() => {
      if (hasWallet()) {
        setAppState("locked");
      } else {
        setAppState("onboarding");
      }
    }, 0);
  }, []);

  const handleWalletCreated = (newWallet: Wallet) => {
    setWallet(newWallet);
    setAppState("dashboard");
  };

  const handleUnlocked = (unlockedWallet: Wallet) => {
    setWallet(unlockedWallet);
    setAppState("dashboard");
  };

  const handleLock = () => {
    setWallet(null);
    setAppState("locked");
  };

  const handleReset = () => {
    setWallet(null);
    setAppState("onboarding");
  };

  if (appState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070b]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#00d4aa] border-t-transparent"></div>
      </main>
    );
  }

  // Dashboard layout manages its own full-screen sidebar structure
  if (appState === "dashboard" && wallet) {
    return <Dashboard wallet={wallet} onLock={handleLock} />;
  }

  // Onboarding and Unlock states use a centered, compact layout
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1b2735_0%,#0a0d14_38%,#05070b_100%)] text-[#f5f2ed] selection:bg-[#00d4aa]/30 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <header className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#00a085] shadow-lg shadow-[#00d4aa]/20">
            <span className="text-xl font-bold text-[#05070b]">Q</span>
          </div>
          <span className="text-xl font-bold tracking-tight">QuanVault</span>
        </header>

        {appState === "onboarding" && <Onboarding onComplete={handleWalletCreated} />}
        {appState === "locked" && <Unlock onUnlock={handleUnlocked} onReset={handleReset} />}
      </div>
    </main>
  );
}
