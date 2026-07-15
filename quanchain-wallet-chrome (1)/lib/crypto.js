/**
 * QuanChain Wallet - Cryptographic Functions
 * Key derivation, address generation, and transaction signing
 *
 * Security Level Architecture:
 * - Levels 1-5:   Classical ECDSA (secp256k1) - for everyday transactions
 * - Levels 6-11:  Hybrid (ECDSA + Dilithium) - for medium-value holdings
 * - Levels 12-15: Pure Post-Quantum (Dilithium only) - for high-value/cold storage
 * - Levels 16-20: Reserved for future NIST standards
 */

import * as secp256k1 from './secp256k1.js';
import * as dilithium from './dilithium.js';

// BIP-44 derivation path for QuanChain
// m/44'/9999'/0'/0/index (9999 = QuanChain coin type)
const COIN_TYPE = 9999;

/**
 * Security level categories
 */
export const SECURITY_CATEGORIES = {
  CLASSICAL: { min: 1, max: 5, name: 'Classical', algorithm: 'ECDSA' },
  HYBRID: { min: 6, max: 11, name: 'Hybrid', algorithm: 'ECDSA + Dilithium' },
  POST_QUANTUM: { min: 12, max: 15, name: 'Post-Quantum', algorithm: 'Dilithium' },
  RESERVED: { min: 16, max: 20, name: 'Reserved', algorithm: 'Future NIST' }
};

/**
 * Get security category for a level
 */
export function getSecurityCategory(level) {
  if (level >= 1 && level <= 5) return SECURITY_CATEGORIES.CLASSICAL;
  if (level >= 6 && level <= 11) return SECURITY_CATEGORIES.HYBRID;
  if (level >= 12 && level <= 15) return SECURITY_CATEGORIES.POST_QUANTUM;
  if (level >= 16 && level <= 20) return SECURITY_CATEGORIES.RESERVED;
  throw new Error(`Invalid security level: ${level}`);
}

/**
 * Derive key pair(s) from seed based on security level
 * @param {Uint8Array} seed - Master seed from mnemonic/entropy
 * @param {number} index - Account index
 * @param {number} securityLevel - Security level (1-15)
 * @returns {Promise<object>} - Key pair(s) based on security level
 */
export async function deriveKey(seed, index, securityLevel) {
  const category = getSecurityCategory(securityLevel);

  if (category === SECURITY_CATEGORIES.RESERVED) {
    throw new Error(`Security level ${securityLevel} is reserved for future use`);
  }

  // Always derive ECDSA key for levels 1-11
  let ecdsaKeys = null;
  if (securityLevel <= 11) {
    const path = `m/44'/${COIN_TYPE}'/0'/0/${index}`;
    const derivedKey = await deriveChildKey(seed, path);
    const privateKey = derivedKey.slice(0, 32);
    const publicKey = secp256k1.getPublicKey(privateKey);

    ecdsaKeys = {
      privateKey: bytesToHex(privateKey),
      publicKey: bytesToHex(publicKey)
    };
  }

  // Derive Dilithium keys for levels 6-15
  let dilithiumKeys = null;
  if (securityLevel >= 6) {
    const dilithiumLevel = dilithium.getDilithiumLevel(securityLevel);

    // Derive Dilithium seed from master seed + security level
    const dilithiumSeed = await deriveDilithiumSeed(seed, securityLevel, index);

    // Generate Dilithium key pair
    const { publicKey, privateKey, level } = dilithium.generateKeyPair(dilithiumLevel);

    dilithiumKeys = {
      privateKey: bytesToHex(privateKey),
      publicKey: bytesToHex(publicKey),
      dilithiumLevel: level
    };
  }

  // Return appropriate key structure based on level
  if (securityLevel <= 5) {
    // Classical: ECDSA only
    return {
      type: 'classical',
      ecdsa: ecdsaKeys,
      publicKey: ecdsaKeys.publicKey, // Primary public key for address
      privateKey: ecdsaKeys.privateKey
    };
  } else if (securityLevel <= 11) {
    // Hybrid: Both ECDSA and Dilithium
    return {
      type: 'hybrid',
      ecdsa: ecdsaKeys,
      dilithium: dilithiumKeys,
      // For hybrid, we hash both public keys together for the address
      publicKey: ecdsaKeys.publicKey + dilithiumKeys.publicKey,
      privateKey: JSON.stringify({ ecdsa: ecdsaKeys.privateKey, dilithium: dilithiumKeys.privateKey })
    };
  } else {
    // Post-Quantum: Dilithium only
    return {
      type: 'post-quantum',
      dilithium: dilithiumKeys,
      publicKey: dilithiumKeys.publicKey,
      privateKey: dilithiumKeys.privateKey
    };
  }
}

/**
 * Derive Dilithium seed from master seed
 */
async function deriveDilithiumSeed(masterSeed, securityLevel, index) {
  // Use HKDF-like expansion for Dilithium seed
  const encoder = new TextEncoder();
  const info = encoder.encode(`QuanChain-Dilithium-L${securityLevel}-${index}`);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    masterSeed,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32), // Zero salt
      info: info
    },
    keyMaterial,
    256 // 32 bytes
  );

  return new Uint8Array(derived);
}

/**
 * Derive child key from seed using simplified BIP-32
 * @param {Uint8Array} seed - Master seed
 * @param {string} path - Derivation path
 * @returns {Uint8Array} - Derived key
 */
async function deriveChildKey(seed, path) {
  const encoder = new TextEncoder();

  // Start with master key derivation
  const masterKey = await hmacSha512(
    encoder.encode('Bitcoin seed'),
    seed
  );

  let key = masterKey.slice(0, 32);
  let chainCode = masterKey.slice(32);

  // Parse path and derive
  const segments = path.split('/').slice(1); // Remove 'm'

  for (const segment of segments) {
    const hardened = segment.endsWith("'");
    const index = parseInt(segment.replace("'", ''), 10);
    const childIndex = hardened ? index + 0x80000000 : index;

    const data = new Uint8Array(37);
    if (hardened) {
      data[0] = 0;
      data.set(key, 1);
    } else {
      const pubKey = secp256k1.getPublicKey(key, true);
      data.set(pubKey, 0);
    }

    // Set index as big-endian 32-bit
    data[33] = (childIndex >>> 24) & 0xff;
    data[34] = (childIndex >>> 16) & 0xff;
    data[35] = (childIndex >>> 8) & 0xff;
    data[36] = childIndex & 0xff;

    const derived = await hmacSha512(chainCode, data);
    key = derived.slice(0, 32);
    chainCode = derived.slice(32);
  }

  return key;
}

/**
 * HMAC-SHA512 using Web Crypto API
 */
async function hmacSha512(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * Create a QuanChain address from public key(s)
 * Format: QC{level}_{payload}_{checksum}
 * - payload: base58-encoded 32-byte hash of public key(s)
 * - checksum: first 4 chars of base58(sha256(level || payload))
 *
 * @param {string} publicKeyHex - Public key in hex (combined for hybrid)
 * @param {number} securityLevel - Security level (1-15)
 * @returns {Promise<string>} - QuanChain address
 */
export async function createAddress(publicKeyHex, securityLevel) {
  const publicKey = hexToBytes(publicKeyHex);

  // Hash public key to 32 bytes (SHA-256)
  const hash = await hashPublicKey(publicKey);

  // Encode payload as base58
  const payload = base58Encode(hash);

  // Compute checksum: sha256(level || payload), then base58, take first 4 chars
  const checksumData = `${securityLevel}${payload}`;
  const encoder = new TextEncoder();
  const checksumHash = await crypto.subtle.digest('SHA-256', encoder.encode(checksumData));
  const checksumBase58 = base58Encode(new Uint8Array(checksumHash));
  const checksum = checksumBase58.slice(0, 4);

  // Format: QC{level}_{payload}_{checksum}
  return `QC${securityLevel}_${payload}_${checksum}`;
}

/**
 * Hash public key for address generation (32 bytes)
 */
async function hashPublicKey(publicKey) {
  // SHA256 of public key (32 bytes)
  const sha256Hash = await crypto.subtle.digest('SHA-256', publicKey);
  return new Uint8Array(sha256Hash);
}

/**
 * Sign a transaction based on security level
 * @param {object} tx - Unsigned transaction
 * @param {object} keys - Key object from deriveKey()
 * @param {number} securityLevel - Security level
 * @returns {Promise<object>} - Signed transaction
 */
export async function signTransaction(tx, keys, securityLevel) {
  const category = getSecurityCategory(securityLevel);

  // Serialize transaction for signing
  const txBytes = serializeTransaction(tx);
  const txHash = await crypto.subtle.digest('SHA-256', txBytes);
  const txHashBytes = new Uint8Array(txHash);

  let signatures = {};

  if (category === SECURITY_CATEGORIES.CLASSICAL) {
    // Classical: ECDSA only
    const privateKey = hexToBytes(keys.ecdsa.privateKey);
    const ecdsaSig = secp256k1.sign(txHashBytes, privateKey);

    signatures = {
      ecdsa: bytesToHex(ecdsaSig)
    };
  } else if (category === SECURITY_CATEGORIES.HYBRID) {
    // Hybrid: Both ECDSA and Dilithium signatures required
    const ecdsaPrivKey = hexToBytes(keys.ecdsa.privateKey);
    const ecdsaSig = secp256k1.sign(txHashBytes, ecdsaPrivKey);

    const dilithiumPrivKey = hexToBytes(keys.dilithium.privateKey);
    const dilithiumLevel = keys.dilithium.dilithiumLevel;
    const dilithiumSig = dilithium.sign(txHashBytes, dilithiumPrivKey, dilithiumLevel);

    signatures = {
      ecdsa: bytesToHex(ecdsaSig),
      dilithium: bytesToHex(dilithiumSig),
      dilithiumLevel: dilithiumLevel
    };
  } else if (category === SECURITY_CATEGORIES.POST_QUANTUM) {
    // Post-Quantum: Dilithium only
    const dilithiumPrivKey = hexToBytes(keys.dilithium.privateKey);
    const dilithiumLevel = keys.dilithium.dilithiumLevel;
    const dilithiumSig = dilithium.sign(txHashBytes, dilithiumPrivKey, dilithiumLevel);

    signatures = {
      dilithium: bytesToHex(dilithiumSig),
      dilithiumLevel: dilithiumLevel
    };
  }

  return {
    ...tx,
    signatures: signatures,
    hash: bytesToHex(txHashBytes),
    signatureType: category.name.toLowerCase().replace('-', '_')
  };
}

/**
 * Legacy sign function for backward compatibility (levels 1-5 only)
 */
export async function signTransactionLegacy(tx, privateKeyHex, securityLevel) {
  if (securityLevel > 5) {
    throw new Error('Use signTransaction() with full key object for levels 6+');
  }

  const privateKey = hexToBytes(privateKeyHex);
  const txBytes = serializeTransaction(tx);
  const txHash = await crypto.subtle.digest('SHA-256', txBytes);
  const signature = secp256k1.sign(new Uint8Array(txHash), privateKey);

  return {
    ...tx,
    signature: bytesToHex(signature),
    hash: bytesToHex(new Uint8Array(txHash))
  };
}

/**
 * Verify a transaction signature
 * @param {object} signedTx - Signed transaction
 * @param {object} publicKeys - Public key(s)
 * @param {number} securityLevel - Security level
 * @returns {Promise<boolean>} - True if valid
 */
export async function verifyTransaction(signedTx, publicKeys, securityLevel) {
  const category = getSecurityCategory(securityLevel);

  const txBytes = serializeTransaction(signedTx);
  const txHash = await crypto.subtle.digest('SHA-256', txBytes);
  const txHashBytes = new Uint8Array(txHash);

  if (category === SECURITY_CATEGORIES.CLASSICAL) {
    const pubKey = hexToBytes(publicKeys.ecdsa || publicKeys);
    const sig = hexToBytes(signedTx.signatures?.ecdsa || signedTx.signature);
    return secp256k1.verify(sig, txHashBytes, pubKey);
  } else if (category === SECURITY_CATEGORIES.HYBRID) {
    // Both signatures must be valid
    const ecdsaPubKey = hexToBytes(publicKeys.ecdsa);
    const ecdsaSig = hexToBytes(signedTx.signatures.ecdsa);
    const ecdsaValid = secp256k1.verify(ecdsaSig, txHashBytes, ecdsaPubKey);

    if (!ecdsaValid) return false;

    const dilithiumPubKey = hexToBytes(publicKeys.dilithium);
    const dilithiumSig = hexToBytes(signedTx.signatures.dilithium);
    const dilithiumLevel = signedTx.signatures.dilithiumLevel;
    const dilithiumValid = dilithium.verify(txHashBytes, dilithiumSig, dilithiumPubKey, dilithiumLevel);

    return dilithiumValid;
  } else if (category === SECURITY_CATEGORIES.POST_QUANTUM) {
    const dilithiumPubKey = hexToBytes(publicKeys.dilithium || publicKeys);
    const dilithiumSig = hexToBytes(signedTx.signatures.dilithium);
    const dilithiumLevel = signedTx.signatures.dilithiumLevel;
    return dilithium.verify(txHashBytes, dilithiumSig, dilithiumPubKey, dilithiumLevel);
  }

  return false;
}

/**
 * Serialize transaction for signing
 */
function serializeTransaction(tx) {
  const encoder = new TextEncoder();

  // Create deterministic serialization
  const parts = [
    tx.from,
    tx.to,
    tx.value.toString(),
    tx.nonce.toString(),
    tx.security_level.toString(),
    tx.gas_limit.toString(),
    tx.gas_price.toString(),
    tx.channel.toString(),
    tx.data || ''
  ];

  return encoder.encode(parts.join(':'));
}

/**
 * Get key sizes for a security level
 * @param {number} securityLevel - Security level (1-15)
 * @returns {object} - Key size information
 */
export function getKeySizes(securityLevel) {
  const category = getSecurityCategory(securityLevel);

  if (category === SECURITY_CATEGORIES.CLASSICAL) {
    return {
      publicKey: 33,  // Compressed secp256k1
      privateKey: 32,
      signature: 64,
      description: 'ECDSA secp256k1'
    };
  } else if (category === SECURITY_CATEGORIES.HYBRID) {
    const dLevel = dilithium.getDilithiumLevel(securityLevel);
    const dParams = dilithium.DILITHIUM_PARAMS[dLevel];
    return {
      publicKey: 33 + dParams.publicKeySize,
      privateKey: 32 + dParams.privateKeySize,
      signature: 64 + dParams.signatureSize,
      ecdsaPublicKey: 33,
      ecdsaSignature: 64,
      dilithiumPublicKey: dParams.publicKeySize,
      dilithiumSignature: dParams.signatureSize,
      description: `ECDSA + ${dParams.name}`
    };
  } else if (category === SECURITY_CATEGORIES.POST_QUANTUM) {
    const dLevel = dilithium.getDilithiumLevel(securityLevel);
    const dParams = dilithium.DILITHIUM_PARAMS[dLevel];
    return {
      publicKey: dParams.publicKeySize,
      privateKey: dParams.privateKeySize,
      signature: dParams.signatureSize,
      description: dParams.name
    };
  }

  return null;
}

/**
 * Get human-readable security info for a level
 */
export function getSecurityInfo(level) {
  const category = getSecurityCategory(level);
  const sizes = getKeySizes(level);

  const info = {
    level,
    category: category.name,
    algorithm: category.algorithm,
    ...sizes
  };

  // Add quantum resistance info
  if (level <= 5) {
    info.quantumResistant = false;
    info.recommendation = 'Suitable for everyday transactions under $1,000';
  } else if (level <= 11) {
    info.quantumResistant = true;
    info.hybridMode = true;
    info.recommendation = 'Recommended for holdings $1,000 - $100,000';
  } else {
    info.quantumResistant = true;
    info.hybridMode = false;
    info.recommendation = 'Maximum security for holdings over $100,000';
  }

  return info;
}

// ============ Utility Functions ============

/**
 * Base58 alphabet (Bitcoin style, no 0, O, I, l)
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode bytes to base58
 */
export function base58Encode(bytes) {
  if (bytes.length === 0) return '';

  // Count leading zeros
  let zeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeros++;
  }

  // Convert to big integer
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  // Convert to base58
  let result = '';
  while (num > 0) {
    result = BASE58_ALPHABET[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }

  // Add leading '1's for zeros
  return '1'.repeat(zeros) + result;
}

/**
 * Decode base58 to bytes
 */
export function base58Decode(str) {
  if (str.length === 0) return new Uint8Array(0);

  // Count leading '1's
  let zeros = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    zeros++;
  }

  // Convert from base58
  let num = BigInt(0);
  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base58 character');
    num = num * BigInt(58) + BigInt(index);
  }

  // Convert to bytes
  const bytes = [];
  while (num > 0) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }

  // Add leading zeros
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes]);
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
