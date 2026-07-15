"use client";

import { useState, useEffect } from "react";
import { getWalletsMetadata, updateWalletMetadata, WalletMetadata } from "../lib/storage";

interface WalletManagerProps {
  currentWallet: WalletMetadata | null;
  onSelectWallet: (walletId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export default function WalletManager({
  currentWallet,
  onSelectWallet,
  onCreateNew,
  onClose
}: WalletManagerProps) {
  const [wallets, setWallets] = useState<WalletMetadata[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const walletList = getWalletsMetadata();
    setWallets(walletList);
  }, []);

  const handleRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveRename = (id: string) => {
    if (editName.trim()) {
      updateWalletMetadata(id, editName);
      const updatedWallets = wallets.map(w =>
        w.id === id ? { ...w, name: editName } : w
      );
      setWallets(updatedWallets);
    }
    setEditingId(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl border border-white/10 bg-[#05070b] shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/10 bg-[#05070b]/95 backdrop-blur">
          <h2 className="text-xl font-bold">Manage Wallets</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Wallets List */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white/60 mb-3">Your Wallets</h3>
            {wallets.length === 0 ? (
              <div className="text-center py-6 text-white/40 text-sm">
                No wallets found
              </div>
            ) : (
              wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className={`rounded-lg border transition-all ${
                    currentWallet?.id === wallet.id
                      ? "border-[#00d4aa] bg-[#00d4aa]/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  } p-4 cursor-pointer group`}
                  onClick={() => {
                    if (currentWallet?.id !== wallet.id) {
                      onSelectWallet(wallet.id);
                    }
                  }}
                >
                  {editingId === wallet.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#00d4aa]/50"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveRename(wallet.id);
                        }}
                        className="px-2 py-1 bg-[#00d4aa] text-black rounded text-xs font-bold hover:bg-[#00d4aa]/80"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{wallet.name}</span>
                          {currentWallet?.id === wallet.id && (
                            <span className="text-xs bg-[#00d4aa]/20 text-[#00d4aa] px-2 py-0.5 rounded">Active</span>
                          )}
                        </div>
                        <p className="text-xs text-white/40">Created {formatDate(wallet.createdAt)}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(wallet.id, wallet.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs text-[#00d4aa] hover:bg-[#00d4aa]/10 rounded"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10 my-4"></div>

          {/* Create New Wallet */}
          <button
            onClick={onCreateNew}
            className="w-full rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 py-3 text-sm font-semibold text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors"
          >
            + Create New Wallet
          </button>

          {/* Stats */}
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="text-xs text-white/60 space-y-1">
              <div className="flex justify-between">
                <span>Total Wallets</span>
                <span className="text-white/80 font-medium">{wallets.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active</span>
                <span className="text-[#00d4aa] font-medium">1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
