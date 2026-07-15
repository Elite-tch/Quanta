"use client";

import { useState } from "react";
import { Wallet } from "../lib/wallet";
import { saveWallet } from "../lib/storage";

interface Props {
  onComplete: (wallet: Wallet) => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [view, setView] = useState<"welcome" | "create" | "import" | "created">("welcome");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState("");
  const [createdWallet, setCreatedWallet] = useState<Wallet | null>(null);

  const handleCreate = async () => {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const wallet = new Wallet();
      // Level 5 (Classical) is standard default for testnet wallets
      const newMnemonic = await wallet.create(password, 5);
      await saveWallet(wallet, password);
      
      setCreatedWallet(wallet);
      setGeneratedMnemonic(newMnemonic);
      setView("created");
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to create wallet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setError("");
    if (!mnemonic) {
      setError("Please enter your 24-word recovery phrase");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      const wallet = new Wallet();
      await wallet.recover(mnemonic.trim(), password, 5);
      await saveWallet(wallet, password);
      onComplete(wallet);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to import wallet");
    } finally {
      setIsLoading(false);
    }
  };

  if (view === "welcome") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-[#00d4aa] to-[#00a085] shadow-2xl shadow-[#00d4aa]/20">
          <span className="text-5xl font-bold text-[#05070b]">Q</span>
        </div>
        <h1 className="mb-4 text-center text-4xl font-extrabold tracking-tight sm:text-5xl">
          Welcome to QuanVault
        </h1>
        <p className="mb-12 max-w-lg text-center text-lg text-white/60">
          The simple, secure, and beautiful gateway to the QuanChain ecosystem. Create a testnet wallet in seconds.
        </p>

        <div className="flex w-full max-w-md flex-col gap-4">
          <button
            onClick={() => setView("create")}
            className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-6 py-4 font-bold text-[#05070b] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="relative z-10">Create New Wallet</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#00d4aa] to-[#00a085] opacity-0 transition-opacity group-hover:opacity-10"></div>
          </button>
          
          <button
            onClick={() => setView("import")}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-semibold transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            Import Existing Wallet
          </button>
        </div>
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="mx-auto w-full max-w-md rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-2xl">
        <button onClick={() => setView("welcome")} className="mb-6 text-sm text-white/50 hover:text-white">
          &larr; Back
        </button>
        <h2 className="mb-2 text-2xl font-bold">Create Wallet</h2>
        <p className="mb-8 text-sm text-white/60">Set a strong password to protect your wallet locally.</p>

        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-[#00d4aa]/50 focus:bg-black/60"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-[#00d4aa]/50 focus:bg-black/60"
              placeholder="Confirm password"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00a085] px-4 py-4 font-bold text-[#05070b] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? "Generating..." : "Generate Wallet"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "import") {
    return (
      <div className="mx-auto w-full max-w-md rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-2xl">
        <button onClick={() => setView("welcome")} className="mb-6 text-sm text-white/50 hover:text-white">
          &larr; Back
        </button>
        <h2 className="mb-2 text-2xl font-bold">Import Wallet</h2>
        <p className="mb-8 text-sm text-white/60">Enter your 24-word recovery phrase.</p>

        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Recovery Phrase</label>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              className="min-h-[100px] w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-[#00d4aa]/50 focus:bg-black/60"
              placeholder="word1 word2 word3..."
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-[#00d4aa]/50 focus:bg-black/60"
              placeholder="To secure it on this device"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleImport}
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-white px-4 py-4 font-bold text-[#05070b] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? "Importing..." : "Import Wallet"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "created") {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-[2.5rem] border border-[#00d4aa]/30 bg-[#00d4aa]/5 p-8 shadow-2xl shadow-[#00d4aa]/10 backdrop-blur-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#00d4aa]/20 text-3xl">
          🎉
        </div>
        <h2 className="mb-2 text-3xl font-bold">Wallet Created!</h2>
        <p className="mb-8 text-white/70">
          This is your 24-word recovery phrase. <strong>Write it down and keep it safe.</strong> It is the ONLY way to recover your funds.
        </p>
        
        <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {generatedMnemonic.split(" ").map((word, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm">
              <span className="text-white/30">{i + 1}.</span>
              <span className="font-mono font-medium">{word}</span>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-left text-sm text-orange-200">
          <strong>Warning:</strong> Do not share this phrase with anyone. QuanChain support will never ask for it.
        </div>

        <button
          onClick={() => {
            if (createdWallet) {
              onComplete(createdWallet);
            }
          }}
          className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00a085] px-4 py-4 font-bold text-[#05070b] transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          I have saved my phrase safely
        </button>
      </div>
    );
  }

  return null;
}
