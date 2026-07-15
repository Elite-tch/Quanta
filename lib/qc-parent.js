/**
 * QuanChain Wallet — Parent identity (level 20) (B4.5)
 *
 * Builds the parent's level-20 composite (ML-DSA-87 + SLH-DSA-SHA2-256f)
 * identity from the wallet's parent entropy, derives the on-chain parent
 * address (BLAKE3-XOF-128 of pubkey concat), and provides composite signing.
 *
 * Mirrors `quanchain-crypto::tadeqs::composite_signature::generate_composite_keypair_from_seed`
 * byte-for-byte:
 *   - First 32KB of parent entropy = ML-DSA seed material
 *   - Second 32KB = SLH-DSA seed material
 *   - HKDF-SHA256 with the same context strings the chain uses
 *
 * Cross-tested against the chain via `wallet_pq_interop.rs` (proof: same
 * seed → same pubkey on both sides).
 *
 * Loaded via `importScripts('../lib/qc-parent.js')`. Depends on qcPQ.
 * Attaches to `globalThis.qcParent`.
 */

(() => {
  'use strict';

  if (!globalThis.qcPQ) {
    throw new Error('qc-parent.js requires qc-pq.js to be loaded first');
  }
  const {
    ml_dsa87,
    slh_dsa_sha2_256f,
    blake3,
    hkdf,
    sha256,
    bytesToHex,
    concatBytes,
  } = globalThis.qcPQ;

  /**
   * Per-level address hash byte counts. Must match `quanchain-core::SecurityLevel::address_hash_bytes`.
   * For level 20 → 128 bytes (BLAKE3-XOF).
   */
  const LEVEL_20_ADDRESS_BYTES = 128;

  /**
   * HKDF context strings — must EXACTLY match the chain's
   * `composite_signature::generate_*_from_seed` `info` parameters,
   * else wallet pubkey ≠ chain pubkey from the same entropy.
   */
  const HKDF_INFO_MLDSA = new TextEncoder().encode('TADEQS-mldsa87-keygen-v1');
  const HKDF_INFO_SLHDSA = new TextEncoder().encode('TADEQS-slhdsa-sha2-256f-keygen-v1');

  /**
   * Convert a Uint8Array to base58btc (Bitcoin alphabet) for QC{level}_ encoding.
   * Self-contained — `address_to_qc_string` mirrors the chain's `Address::encode`.
   */
  const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function base58Encode(bytes) {
    if (bytes.length === 0) return '';
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

    // Convert byte array to BigInt
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
   * Compute the level-20 parent address from a composite public key.
   *
   * Mirrors `quanchain-core::Address::from_public_key(level=20, pk)`:
   *   - hash = BLAKE3-XOF-128(public_key)
   *   - encoding = "QC20_" + base58btc(hash)
   *
   * @param {Uint8Array} publicKeyConcat — ML-DSA pk (2592) || SLH-DSA pk (64) = 2656 bytes
   * @returns {{addressString: string, addressBytes: Uint8Array}}
   */
  function parentAddressFromPubKey(publicKeyConcat) {
    if (publicKeyConcat.length !== 2592 + 64) {
      throw new RangeError(
        `parent_public_key must be 2656 bytes, got ${publicKeyConcat.length}`,
      );
    }
    // BLAKE3 with dkLen for variable-length output
    const addressBytes = blake3(publicKeyConcat, { dkLen: LEVEL_20_ADDRESS_BYTES });
    return {
      addressBytes,
      addressString: `QC20_${base58Encode(addressBytes)}`,
    };
  }

  /**
   * Derive the parent's level-20 composite identity from parent entropy.
   *
   * @param {Uint8Array} parentEntropy — 64KB master entropy
   * @returns {{
   *   dilithium5: { publicKey: Uint8Array, secretKey: Uint8Array },
   *   sphincsplus256f: { publicKey: Uint8Array, secretKey: Uint8Array },
   *   parent_public_key: Uint8Array, // 2656-byte concat
   *   parent_address: string,        // QC20_...
   *   parent_address_bytes: Uint8Array, // 128 bytes
   * }}
   */
  function deriveParentIdentity(parentEntropy) {
    if (!(parentEntropy instanceof Uint8Array) || parentEntropy.length < 64) {
      throw new RangeError(
        `parentEntropy must be a Uint8Array of at least 64 bytes, got ${parentEntropy?.length}`,
      );
    }

    // Following the chain split: first half → ML-DSA, second half → SLH-DSA.
    // In practice we HKDF-derive from the WHOLE entropy on each side, so the
    // exact split point doesn't matter as long as both ends agree on the
    // input. Currently the chain uses `entropy[..32768]` and `entropy[32768..]`
    // separately, so we mirror that.
    const half = parentEntropy.length >>> 1;
    const dilithiumSeed = parentEntropy.subarray(0, half);
    const sphincsSeed = parentEntropy.subarray(half);

    // ML-DSA-87: HKDF-SHA256 → 32-byte xi → keygen
    const xi = hkdf(sha256, dilithiumSeed, new Uint8Array(), HKDF_INFO_MLDSA, 32);
    const dilKp = ml_dsa87.keygen(xi);

    // SLH-DSA-SHA2-256f: HKDF-SHA256 → 96 bytes → keygen
    const slhSeed = hkdf(sha256, sphincsSeed, new Uint8Array(), HKDF_INFO_SLHDSA, 96);
    const slhKp = slh_dsa_sha2_256f.keygen(slhSeed);

    const pkConcat = concatBytes(dilKp.publicKey, slhKp.publicKey);
    const addr = parentAddressFromPubKey(pkConcat);

    return {
      dilithium5: dilKp,
      sphincsplus256f: slhKp,
      parent_public_key: pkConcat,
      parent_address: addr.addressString,
      parent_address_bytes: addr.addressBytes,
    };
  }

  /**
   * Sign a payload with the parent's composite keypair.
   *
   * Both signatures cover the same payload bytes, byte-for-byte. The result
   * is the value the chain's `verify_composite` expects.
   *
   * @param {Uint8Array} payload — bytes to sign (typically `WalletRegistrationData::signing_payload()` from the chain's prepare RPC)
   * @param {{secretKey: Uint8Array}} dilithium5
   * @param {{secretKey: Uint8Array}} sphincsplus256f
   * @returns {Promise<{dilithium5_sig: Uint8Array, sphincsplus256f_sig: Uint8Array}>}
   */
  async function signComposite(payload, dilithium5, sphincsplus256f) {
    if (!(payload instanceof Uint8Array)) {
      throw new TypeError('payload must be Uint8Array');
    }
    // ML-DSA: ~20-50ms
    const dilSig = ml_dsa87.sign(payload, dilithium5.secretKey);
    // SLH-DSA: ~1-3 seconds in pure JS. Yield to event loop first so the
    // service worker doesn't appear hung during composite-sign.
    await new Promise((r) => setTimeout(r, 0));
    const slhSig = slh_dsa_sha2_256f.sign(payload, sphincsplus256f.secretKey);
    return {
      dilithium5_sig: dilSig,
      sphincsplus256f_sig: slhSig,
    };
  }

  globalThis.qcParent = {
    deriveParentIdentity,
    parentAddressFromPubKey,
    signComposite,
    base58Encode,
    LEVEL_20_ADDRESS_BYTES,
  };
})();
