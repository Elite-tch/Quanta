"use client";

import { useEffect, useState } from "react";
import { getTransactions, Transaction } from "../lib/storage";

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const txs = getTransactions();
    setTransactions(txs);
    setLoading(false);
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '—';
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  };

  const getTypeIcon = (type: string, status: string) => {
    if (type === 'send') {
      return status === 'failed' ? '✗' : '↑';
    } else if (type === 'receive') {
      return status === 'failed' ? '✗' : '↓';
    } else if (type === 'migrate') {
      return '→';
    }
    return '•';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-white/60';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'send':
        return 'Sent';
      case 'receive':
        return 'Received';
      case 'migrate':
        return 'Migrated';
      default:
        return 'Transaction';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-white/5 rounded-lg animate-pulse"></div>
        <div className="h-12 bg-white/5 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="text-6xl mb-3">📭</div>
        <p className="text-white/60 text-sm">No transactions yet</p>
        <p className="text-white/40 text-xs mt-1">Send or receive QCH to see activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-4 flex-1">
            {/* Icon */}
            <div
              className={`flex items-center justify-center h-10 w-10 rounded-full ${
                tx.type === 'send' ? 'bg-red-500/10' : tx.type === 'receive' ? 'bg-green-500/10' : 'bg-blue-500/10'
              }`}
            >
              <span
                className={`text-lg font-bold ${
                  tx.type === 'send' ? 'text-red-400' : tx.type === 'receive' ? 'text-green-400' : 'text-blue-400'
                }`}
              >
                {getTypeIcon(tx.type, tx.status)}
              </span>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">
                  {getTypeLabel(tx.type)}
                  {tx.level && tx.level !== 5 && (
                    <span className="text-white/60 text-xs ml-1">Level {tx.level}</span>
                  )}
                </span>
                <span className={`text-xs font-medium ${getStatusColor(tx.status)}`}>
                  {tx.status === 'confirmed' ? '✓' : tx.status === 'pending' ? '⧗' : '✗'}{' '}
                  {tx.status}
                </span>
              </div>
              <div className="text-xs text-white/40 truncate">
                {tx.type === 'send' ? 'to ' : 'from '}
                {formatAddress(tx.type === 'send' ? tx.to : tx.from)}
              </div>
            </div>
          </div>

          {/* Amount & Time */}
          <div className="text-right">
            <div className={`font-bold text-sm ${tx.type === 'send' ? 'text-red-400' : 'text-green-400'}`}>
              {tx.type === 'send' ? '-' : '+'}
              {parseFloat(tx.amount).toFixed(4)} QCH
            </div>
            <div className="text-xs text-white/40">{formatDate(tx.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
