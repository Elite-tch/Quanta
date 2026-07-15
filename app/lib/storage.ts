import { Wallet } from '../../lib/wallet.js';

const STORAGE_KEY = 'quanvault_encrypted_data';
const TRANSACTIONS_KEY = 'quanvault_transactions';
const WALLETS_KEY = 'quanvault_wallets_metadata';

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'migrate';
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  hash?: string;
  level: number;
}

export async function saveWallet(wallet: Wallet, password: string): Promise<void> {
  const encryptedData = await wallet.export(password);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedData));
}

export async function loadWallet(password: string): Promise<Wallet> {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) throw new Error('No wallet found');
  
  const encryptedData = JSON.parse(data);
  const wallet = new Wallet();
  await wallet.import(encryptedData, password);
  return wallet;
}

export function hasWallet(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(STORAGE_KEY);
}

export function clearWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Transaction History Management
export function saveTransaction(tx: Transaction): void {
  if (typeof window === 'undefined') return;
  
  const transactions = getTransactions();
  transactions.unshift(tx); // Add to front
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions.slice(0, 100))); // Keep last 100
}

export function getTransactions(): Transaction[] {
  if (typeof window === 'undefined') return [];
  
  const data = localStorage.getItem(TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function clearTransactions(): void {
  localStorage.removeItem(TRANSACTIONS_KEY);
}

// Wallet Metadata Management
export interface WalletMetadata {
  id: string;
  name: string;
  createdAt: number;
  isActive: boolean;
}

export function getWalletsMetadata(): WalletMetadata[] {
  if (typeof window === 'undefined') return [];
  
  const data = localStorage.getItem(WALLETS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveWalletsMetadata(wallets: WalletMetadata[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
}

export function addWalletMetadata(name: string): WalletMetadata {
  const wallets = getWalletsMetadata();
  const newWallet: WalletMetadata = {
    id: Date.now().toString(),
    name: name || `Wallet ${wallets.length + 1}`,
    createdAt: Date.now(),
    isActive: wallets.length === 0
  };
  
  wallets.forEach(w => w.isActive = false);
  newWallet.isActive = true;
  wallets.push(newWallet);
  saveWalletsMetadata(wallets);
  
  return newWallet;
}

export function updateWalletMetadata(id: string, name: string): void {
  const wallets = getWalletsMetadata();
  const wallet = wallets.find(w => w.id === id);
  if (wallet) {
    wallet.name = name;
    saveWalletsMetadata(wallets);
  }
}

export function getActiveWallet(): WalletMetadata | null {
  const wallets = getWalletsMetadata();
  return wallets.find(w => w.isActive) || null;
}
