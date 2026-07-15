"use client";

import { useState } from "react";
import { getWalletsMetadata, updateWalletMetadata, getActiveWallet } from "../lib/storage";

interface SettingsProps {
  onClose: () => void;
  onExport?: () => void;
}

export default function Settings({ onClose, onExport }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<"general" | "network" | "security" | "about">("general");
  const [endpoint, setEndpoint] = useState("http://5.189.184.7:8545");
  const [renameMode, setRenameMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [feedback, setFeedback] = useState("");
  const activeWallet = getActiveWallet();

  const handleRenameWallet = () => {
    if (newName.trim() && activeWallet) {
      updateWalletMetadata(activeWallet.id, newName);
      setRenameMode(false);
      setFeedback("Wallet renamed successfully!");
      setTimeout(() => setFeedback(""), 2000);
    }
  };

  const wallets = getWalletsMetadata();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl border border-white/10 bg-[#05070b] shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/10 bg-[#05070b]/95 backdrop-blur">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 border-b border-white/10 bg-white/5">
          {[
            { id: "general", label: "General" },
            { id: "network", label: "Network" },
            { id: "security", label: "Security" },
            { id: "about", label: "About" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-[#00d4aa]/20 text-[#00d4aa]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Current Wallet</h3>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  {renameMode ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="New wallet name"
                        autoFocus
                        className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#00d4aa]/50"
                      />
                      <button
                        onClick={handleRenameWallet}
                        className="px-2 py-1 bg-[#00d4aa] text-black rounded text-xs font-bold hover:bg-[#00d4aa]/80"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{activeWallet?.name || "Wallet 1"}</span>
                      <button
                        onClick={() => {
                          setNewName(activeWallet?.name || "");
                          setRenameMode(true);
                        }}
                        className="text-xs text-[#00d4aa] hover:text-[#00d4aa]/80"
                      >
                        Rename
                      </button>
                    </div>
                  )}
                </div>
                {feedback && <p className="text-xs text-green-400 mt-2">{feedback}</p>}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Wallets ({wallets.length})</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {wallets.map((w) => (
                    <div key={w.id} className="flex items-center justify-between text-xs rounded border border-white/10 bg-black/40 p-2">
                      <span className={w.isActive ? "font-semibold text-[#00d4aa]" : "text-white/60"}>
                        {w.name}
                      </span>
                      {w.isActive && <span className="text-[#00d4aa]">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Network Tab */}
          {activeTab === "network" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">RPC Endpoint</h3>
                <select
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d4aa]/50"
                >
                  <option value="http://5.189.184.7:8545">Validator 1 - Faucet (HTTP)</option>
                  <option value="http://5.189.184.7:8546">Validator 2 (HTTP)</option>
                  <option value="http://5.189.184.7:8547">Validator 3 (HTTP)</option>
                  <option value="http://5.189.184.7:8548">Validator 4 (HTTP)</option>
                </select>
                <p className="text-xs text-white/40 mt-2">Current: {endpoint}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Network Info</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs py-2 border-b border-white/10">
                    <span className="text-white/60">Network</span>
                    <span className="text-white/80">QuanChain Testnet</span>
                  </div>
                  <div className="flex justify-between text-xs py-2 border-b border-white/10">
                    <span className="text-white/60">Chain ID</span>
                    <span className="text-white/80">Testnet</span>
                  </div>
                  <div className="flex justify-between text-xs py-2">
                    <span className="text-white/60">Token Decimals</span>
                    <span className="text-white/80">9</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Encryption</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-white/10">
                    <span className="text-white/60">Algorithm</span>
                    <span className="text-white/80">AES-256-GCM</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/10">
                    <span className="text-white/60">Key Derivation</span>
                    <span className="text-white/80">PBKDF2 (600k)</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-white/60">Parent Wallet</span>
                    <span className="text-white/80">64 KB</span>
                  </div>
                </div>
              </div>

              {onExport && (
                <button
                  onClick={onExport}
                  className="w-full rounded-lg border border-white/20 bg-white/10 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Export Wallet
                </button>
              )}

              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-xs text-red-400">
                  Never share your wallet backup. Anyone with it can access all your addresses.
                </p>
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab === "about" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">QuanVault</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-white/10">
                    <span className="text-white/60">Version</span>
                    <span className="text-white/80">1.0.0</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/10">
                    <span className="text-white/60">Network</span>
                    <span className="text-white/80">QuanChain Testnet</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-white/60">Status</span>
                    <span className="text-green-400">Live</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-white/60 leading-relaxed">
                  QuanVault is a secure, testnet wallet for the QuanChain ecosystem. Your private keys are encrypted locally and never transmitted.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
