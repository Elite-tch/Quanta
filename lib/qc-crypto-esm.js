/**
 * ES Module adapter for qc-crypto.js
 *
 * qc-crypto.js uses an IIFE that attaches to globalThis.qcCrypto.
 * We execute it here and re-export its functions as named ES exports
 * so Next.js components can import them cleanly.
 */

// Execute the IIFE by evaluating the file content.
// Since Next.js bundles these as modules, we need to run it once
// and capture the globalThis.qcCrypto it attaches.
import './qc-crypto-raw.js';

const {
  bytesToHex,
  hexToBytes,
  concatBytes,
  sha3_256,
  sha512,
  secp256k1GetPublicKey,
  secp256k1Sign,
  ed25519DerivePublic,
  ed25519Sign,
  deriveLevel5Identity,
  ADDRESS_HASH_BYTES,
} = globalThis.qcCrypto;

export {
  bytesToHex,
  hexToBytes,
  concatBytes,
  sha3_256,
  sha512,
  secp256k1GetPublicKey,
  secp256k1Sign,
  ed25519DerivePublic,
  ed25519Sign,
  deriveLevel5Identity,
  ADDRESS_HASH_BYTES,
};
