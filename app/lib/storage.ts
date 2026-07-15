import { Wallet } from '../../lib/wallet.js';

const STORAGE_KEY = 'quanvault_encrypted_data';

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
