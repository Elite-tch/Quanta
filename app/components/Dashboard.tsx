"use client";

import { useEffect, useState, useCallback } from "react";
import { Wallet } from "../lib/wallet";
import { RpcClient } from "../lib/rpc";
import QRCode from "react-qr-code";
import TransactionHistory from "./TransactionHistory";
import Settings from "./Settings";
import ImportWallet from "./ImportWallet";
import { saveTransaction, Transaction } from "../lib/storage";

interface Props {
  wallet: Wallet;
  onLock: () => void;
}

const ENDPOINT = "http://5.189.184.7:8545";

export default function Dashboard({ wallet, onLock }: Props) {
  const [view, setView] = useState<"home" | "send" | "receive" | "history">("home");
  const [balance, setBalance] = useState("0");
  const [networkVersion, setNetworkVersion] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Send State
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendPassword, setSendPassword] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Faucet State
  const [isDripping, setIsDripping] = useState(false);
  const [faucetFeedback, setFaucetFeedback] = useState("");

  const address = (() => {
    try {
      const a = wallet.getAddress();
      return typeof a === "string" ? a : "";
    } catch {
      return "";
    }
  })();

  const securityLevel = (() => {
    try {
      const s = wallet.getSecurityLevel();
      return typeof s === "number" ? s : 5;
    } catch {
      return 5;
    }
  })();

  const fetchBalance = useCallback(async () => {
    setIsRefreshing(true);
    setNetworkStatus("connecting");
    setNetworkError(null);
    
    try {
      const rpc = new RpcClient(ENDPOINT);
      
      // Add timeout to RPC calls
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Network timeout")), 5000)
      );
      
      const net = await Promise.race([
        rpc.call("net_version"),
        timeoutPromise
      ]);
      setNetworkVersion(String(net));
      setNetworkStatus("connected");
      
      const balData = await Promise.race([
        rpc.call("chain_getBalance", [address]),
        timeoutPromise
      ]);
      const rawBalance =
        balData && typeof balData === "object" && "balance" in balData
          ? balData.balance
          : balData;
      setBalance(
        typeof rawBalance === "string" || typeof rawBalance === "number"
          ? String(rawBalance)
          : "0"
      );
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || "Failed to connect to network";
      console.error("[v0] Network error:", errorMsg);
      setNetworkStatus("error");
      setNetworkError(errorMsg);
    } finally {
      setIsRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    // eslint-disable-next-line
    fetchBalance();
  }, [fetchBalance]);

  const handleFaucet = async () => {
    setIsDripping(true);
    setFaucetFeedback("");
    try {
      const rpc = new RpcClient(ENDPOINT);
      await rpc.call("faucet_drip", [address]);
      setFaucetFeedback("Success! Tokens should arrive shortly.");
      setTimeout(fetchBalance, 5000); // Poll after 5s
    } catch (err: unknown) {
      setFaucetFeedback((err as Error).message || "Faucet failed");
    } finally {
      setIsDripping(false);
    }
  };

  const handleSend = async () => {
    setSendFeedback(null);
    if (!sendTo || !sendAmount || !sendPassword) {
      setSendFeedback({ type: "error", msg: "All fields are required" });
      return;
    }
    
    setIsSending(true);
    try {
      const value = (parseFloat(sendAmount) * 1000000000).toString(); // 9 decimals
      
      const tx = {
        from: address,
        to: sendTo,
        value,
        nonce: Date.now(),
        security_level: securityLevel,
        gas_limit: 21000,
        gas_price: "1000",
        channel: 1,
        data: ""
      };
      
      const signedTx = await wallet.signTransaction(tx, sendPassword);
      const rpc = new RpcClient(ENDPOINT);
      const res = await rpc.call("tx_submitTransaction", [signedTx]);

      // Save transaction to history
      const transaction: Transaction = {
        id: res.tx_hash || `tx_${Date.now()}`,
        type: "send",
        from: address,
        to: sendTo,
        amount: sendAmount,
        timestamp: Date.now(),
        status: "confirmed",
        hash: res.tx_hash,
        level: securityLevel
      };
      saveTransaction(transaction);

      setSendFeedback({ type: "success", msg: `Transaction submitted! Hash: ${res.tx_hash || 'unknown'}` });
      setSendTo("");
      setSendAmount("");
      setSendPassword("");
      setTimeout(fetchBalance, 3000);
    } catch (err: unknown) {
      setSendFeedback({ type: "error", msg: (err as Error).message || "Send failed" });
    } finally {
      setIsSending(false);
    }
  };

  const displayBalance = (balanceStr: string) => {
    const normalized =
      typeof balanceStr === "string" || typeof balanceStr === "number"
        ? String(balanceStr)
        : "0";
    const bal = parseFloat(normalized);
    if (isNaN(bal)) return "0.00";
    return (bal / 1000000000).toFixed(4); // Divide by 10^9
  };

  return (
    <div className="flex min-h-screen bg-[#05070b] text-white">
      {/* Sidebar Layout */}
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-white/10 bg-black/30 backdrop-blur-md">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#00a085] shadow-lg shadow-[#00d4aa]/20">
            <span className="text-lg font-bold text-[#05070b]">Q</span>
          </div>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            QuanVault
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          <button
            onClick={() => setView("home")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              view === "home"
                ? "bg-[#00d4aa]/10 text-[#00d4aa]"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Overview
          </button>
          
          <button
            onClick={() => setView("send")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              view === "send"
                ? "bg-[#00d4aa]/10 text-[#00d4aa]"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send Tokens
          </button>

          <button
            onClick={() => setView("receive")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              view === "receive"
                ? "bg-[#00d4aa]/10 text-[#00d4aa]"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Receive
          </button>

          <button
            onClick={() => setView("history")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              view === "history"
                ? "bg-[#00d4aa]/10 text-[#00d4aa]"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 space-y-4">
          {/* Network Status */}
          <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/40">Network</span>
              <div className="flex items-center gap-2 font-medium">
                <span className={`h-2 w-2 rounded-full ${
                  networkStatus === "connected" ? "bg-[#00d4aa] shadow-lg shadow-[#00d4aa]/50" : 
                  networkStatus === "error" ? "bg-red-500 shadow-lg shadow-red-500/50" :
                  "bg-yellow-500 animate-pulse"
                }`}></span>
                {networkStatus === "connecting" ? "Connecting..." : 
                 networkStatus === "connected" ? `Connected (${networkVersion})` : 
                 "Connection failed"}
              </div>
            </div>
            {networkError && (
              <div className="text-red-400/80 text-xs leading-tight break-words">
                Error: {networkError}
              </div>
            )}
            {networkStatus === "error" && (
              <button
                onClick={fetchBalance}
                className="text-[#00d4aa] hover:text-[#00d4aa]/80 font-medium text-xs mt-1"
              >
                Retry connection
              </button>
            )}
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-xs">
            <span className="text-white/40">Security</span>
            <span className="font-semibold text-[#00d4aa] bg-[#00d4aa]/10 px-2 py-0.5 rounded-md">
              Level {securityLevel}
            </span>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>

          {/* Lock Button */}
          <button
            onClick={onLock}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Lock
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="ml-64 flex-1 overflow-y-auto px-8 py-10">
        {/* Dynamic Inner Views */}
        {view === "home" && (
          <div className="max-w-4xl space-y-8">
            {/* Balance Widget */}
            <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-[#111926] to-[#0a0f18] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-[#00d4aa]/5 blur-3xl"></div>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-white/50">Total Portfolio Balance</span>
                <button
                  onClick={fetchBalance}
                  disabled={isRefreshing}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white transition-colors disabled:opacity-50"
                >
                  <svg className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <div className="flex items-baseline gap-3">
                <h2 className="text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  {displayBalance(balance)}
                </h2>
                <span className="text-2xl font-bold text-[#00d4aa] tracking-wide">QCH</span>
              </div>
            </div>

            {/* Grid for Active Address & Faucet */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Address Card */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Active Address</h3>
                  <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                    <span className="block font-mono text-sm font-medium text-white/80 break-all select-all">{address}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    alert("Address copied!");
                  }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20 transition-all active:scale-[0.98]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 012 2h2a2 2 0 012-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy Address
                </button>
              </div>

              {/* Faucet Card */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="rounded-lg bg-[#00d4aa]/10 p-1.5 text-[#00d4aa]">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold">Testnet Drip Faucet</h3>
                  </div>
                  <p className="text-xs leading-5 text-white/50">
                    Need QCH for sandbox actions? Drip 100 testnet QCH tokens straight into this address (limit: once per day).
                  </p>
                </div>
                
                <div className="mt-6">
                  {faucetFeedback && (
                    <p className="mb-3 text-xs font-semibold text-[#00d4aa]">{faucetFeedback}</p>
                  )}
                  <button
                    onClick={handleFaucet}
                    disabled={isDripping}
                    className="w-full rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-bold transition-all hover:bg-white/20 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isDripping ? "Dripping..." : "Get Free QCH"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "send" && (
          <div className="max-w-xl mx-auto">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <h2 className="text-2xl font-bold mb-6">Send Tokens</h2>

              <div className="flex flex-col gap-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">To Address</label>
                  <input
                    type="text"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-[#00d4aa]/50 focus:bg-black/60"
                    placeholder="QC5_..."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Amount (QCH)</label>
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-[#00d4aa]/50 focus:bg-black/60"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Wallet Password</label>
                  <input
                    type="password"
                    value={sendPassword}
                    onChange={(e) => setSendPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition-colors focus:border-[#00d4aa]/50 focus:bg-black/60"
                    placeholder="Authorize transaction signing"
                  />
                </div>

                {sendFeedback && (
                  <div className={`mt-2 rounded-lg p-3 text-sm ${sendFeedback.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                    {sendFeedback.msg}
                  </div>
                )}

                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00a085] px-4 py-4 font-bold text-[#05070b] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isSending ? "Signing & Sending..." : "Submit Transaction"}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "receive" && (
          <div className="max-w-md mx-auto">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8 flex flex-col items-center">
              <h2 className="text-2xl font-bold mb-6 self-start">Receive Tokens</h2>
              
              <div className="mb-8 rounded-2xl bg-white p-4">
                <QRCode value={address} size={200} />
              </div>
              
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Deposit Address</p>
              <p className="break-all text-center font-mono text-sm font-medium tracking-tight text-white/90 px-4">
                {address}
              </p>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(address);
                  alert("Address copied!");
                }}
                className="mt-6 w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
              >
                Copy Address
              </button>
            </div>
          </div>
        )}

        {view === "history" && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-3xl font-bold">Transaction History</h2>
              <p className="text-white/60 text-sm mt-2">All your recent activity on QuanChain</p>
            </div>
            <TransactionHistory />
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onExport={() => alert("Export wallet feature coming soon!")}
        />
      )}

      {/* Import Wallet Modal */}
      {showImport && (
        <ImportWallet
          onClose={() => setShowImport(false)}
          onImport={async (walletData, password) => {
            // Implementation would go here
            console.log("Import wallet", walletData, password);
          }}
        />
      )}
    </div>
  );
}
