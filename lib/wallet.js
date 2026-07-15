/**
 * QuanChain Wallet - Core Wallet Implementation
 * Handles key generation, storage, and transaction signing
 */

import { generateMnemonic, mnemonicToSeed, validateMnemonic } from './bip39.js';
import { deriveLevel5Identity, ADDRESS_HASH_BYTES, bytesToHex } from './qc-crypto.js';
import { signTransaction } from './crypto.js';

/**
 * Base58 alphabet (Bitcoin)
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) {
    const r = Number(n % 58n);
    n /= 58n;
    out = BASE58_ALPHABET[r] + out;
  }
  while (zeros-- > 0) out = '1' + out;
  return out;
}

/**
 * Derive a level-5 keypair and chain-compatible address from 64 bytes of seed material.
 * Address = QC5_<base58(SHA3-256(pubkey)[..24])>
 */
async function deriveAccount(seed, index) {
  // HKDF-like: take 64 bytes from seed offset by index
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', seed, { name: 'HKDF' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: encoder.encode(`QC-level5-account-${index}`) },
    keyMaterial,
    512, // 64 bytes
  );
  const keyBytes = new Uint8Array(derived);
  const identity = await deriveLevel5Identity(keyBytes);
  const addrBytes = identity.addressBytes; // already 24 bytes of SHA3-256
  const address = `QC5_${base58Encode(addrBytes)}`;
  return { identity, address, keyBytes };
}

// Security levels
const SECURITY_LEVELS = {
  CLASSICAL: { min: 1, max: 5, name: 'Classical (ECDSA)' },
  HYBRID: { min: 6, max: 11, name: 'Hybrid (ECDSA + Dilithium)' },
  POST_QUANTUM: { min: 12, max: 15, name: 'Post-Quantum (Dilithium)' }
};

/**
 * QuanChain Wallet class
 */
export class Wallet {
  constructor() {
    this.mnemonic = null;
    this.seed = null;
    this.accounts = [];
    this.activeAccountIndex = 0;
    this.securityLevel = 5;
    this.sessionPassword = null;
  }

  /**
   * Create a new wallet with a fresh mnemonic
   * @param {string} password - Encryption password
   * @param {number} securityLevel - Quantum security level (1-15)
   * @returns {Promise<string>} - The mnemonic phrase
   */
  async create(password, securityLevel = 5) {
    this.securityLevel = securityLevel;
    this.mnemonic = generateMnemonic(256); // 24 words
    this.seed = await mnemonicToSeed(this.mnemonic, password);
    this.sessionPassword = password;

    // Create first account
    await this.createAccount('Account 1');

    return this.mnemonic;
  }

  /**
   * Recover wallet from mnemonic
   * @param {string} mnemonic - BIP-39 mnemonic phrase
   * @param {string} password - Encryption password
   * @param {number} securityLevel - Quantum security level (1-15)
   */
  async recover(mnemonic, password, securityLevel = 5) {
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    this.securityLevel = securityLevel;
    this.mnemonic = mnemonic;
    this.seed = await mnemonicToSeed(mnemonic, password);
    this.sessionPassword = password;

    // Create first account
    await this.createAccount('Account 1');
  }

  /**
   * Import wallet from encrypted data
   * @param {object} encryptedData - Encrypted wallet data
   * @param {string} password - Decryption password
   */
  async import(encryptedData, password) {
    try {
      const decrypted = await this.decrypt(encryptedData, password);

      this.mnemonic = decrypted.mnemonic;
      this.seed = await mnemonicToSeed(this.mnemonic, password);
      this.accounts = decrypted.accounts;
      this.activeAccountIndex = decrypted.activeAccountIndex || 0;
      this.securityLevel =
        typeof decrypted.securityLevel === 'number' ? decrypted.securityLevel : 5;
      this.sessionPassword = password;

      // Regenerate keys and addresses for accounts (fixes corrupted stored addresses)
      for (let i = 0; i < this.accounts.length; i++) {
        const { identity, address, keyBytes } = await deriveAccount(this.seed, i);
        this.accounts[i].address = address;
        this.accounts[i].publicKey = bytesToHex(identity.publicKey);
        this.accounts[i].keyBytes = Array.from(keyBytes);
      }
    } catch (error) {
      throw new Error('Invalid password or corrupted wallet data');
    }
  }

  /**
   * Export wallet as encrypted data
   * @param {string} password - Encryption password
   * @returns {Promise<object>} - Encrypted wallet data
   */
  async export(password) {
    const data = {
      mnemonic: this.mnemonic,
      accounts: this.accounts.map(acc => ({
        name: acc.name,
        address: acc.address,
        index: acc.index
        // Private keys are NOT exported, they're derived from mnemonic
      })),
      activeAccountIndex: this.activeAccountIndex,
      securityLevel: this.securityLevel,
      version: 1
    };

    return await this.encrypt(data, password);
  }

  /**
   * Create a new account
   * @param {string} name - Account name
   * @returns {object} - New account info
   */
  async createAccount(name) {
    const index = this.accounts.length;
    const { identity, address, keyBytes } = await deriveAccount(this.seed, index);

    const account = {
      name: name || `Account ${index + 1}`,
      address,
      index,
      publicKey: bytesToHex(identity.publicKey),
      // Store the 64-byte key material so we can re-derive signing identity
      keyBytes: Array.from(keyBytes),
    };

    this.accounts.push(account);
    return {
      name: account.name,
      address: account.address,
      index: account.index
    };
  }

  /**
   * Get all accounts (without private keys)
   * @returns {Array} - List of accounts
   */
  getAccounts() {
    return this.accounts.map(acc => ({
      name: acc.name,
      address: acc.address,
      index: acc.index
    }));
  }

  /**
   * Get active account index
   * @returns {number}
   */
  getActiveAccountIndex() {
    return this.activeAccountIndex;
  }

  /**
   * Set active account
   * @param {number} index - Account index
   */
  setActiveAccount(index) {
    if (index < 0 || index >= this.accounts.length) {
      throw new Error('Invalid account index');
    }
    this.activeAccountIndex = index;
  }

  /**
   * Get current address
   * @returns {string}
   */
  getAddress() {
    const account = this.accounts[this.activeAccountIndex];
    const address = account?.address;
    return typeof address === 'string' ? address : null;
  }

  /**
   * Get security level
   * @returns {number}
   */
  getSecurityLevel() {
    return typeof this.securityLevel === 'number' ? this.securityLevel : 5;
  }

  /**
   * Get session password (for re-encryption)
   * @returns {string}
   */
  getSessionPassword() {
    return this.sessionPassword;
  }

  /**
   * Verify password
   * @param {string} password - Password to verify
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password) {
    return password === this.sessionPassword;
  }

  /**
   * Get mnemonic (requires password verification)
   * @param {string} password - Password
   * @returns {Promise<string>}
   */
  async getMnemonic(password) {
    if (!await this.verifyPassword(password)) {
      throw new Error('Invalid password');
    }
    return this.mnemonic;
  }

  /**
   * Sign a transaction
   * @param {object} tx - Unsigned transaction
   * @param {string} password - Password for signing
   * @returns {Promise<object>} - Signed transaction
   */
  async signTransaction(tx, password) {
    if (!await this.verifyPassword(password)) {
      throw new Error('Invalid password');
    }

    const account = this.accounts[this.activeAccountIndex];
    if (!account) {
      throw new Error('No active account');
    }

    return signTransaction(tx, account.privateKey, this.securityLevel);
  }

  /**
   * Encrypt data with password using AES-GCM
   * @param {object} data - Data to encrypt
   * @param {string} password - Encryption password
   * @returns {Promise<object>} - Encrypted data
   */
  async encrypt(data, password) {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(JSON.stringify(data));

    // Derive key from password
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Encrypt
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBytes
    );

    return {
      salt: Array.from(salt),
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
      version: 1
    };
  }

  /**
   * Decrypt data with password
   * @param {object} encryptedData - Encrypted data
   * @param {string} password - Decryption password
   * @returns {Promise<object>} - Decrypted data
   */
  async decrypt(encryptedData, password) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const salt = new Uint8Array(encryptedData.salt);
    const iv = new Uint8Array(encryptedData.iv);
    const data = new Uint8Array(encryptedData.data);

    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return JSON.parse(decoder.decode(decrypted));
  }
}

export { SECURITY_LEVELS };
