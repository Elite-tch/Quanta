/**
 * QuanChain Wallet — client-side crypto primitives
 *
 * Self-contained module covering everything the wallet needs to:
 *   1. Compute QC{level} addresses that the chain accepts
 *      (= SHA3-256(pubkey_concat) truncated to per-level bytes)
 *   2. Sign SpendAndRotate / Transfer transactions at security level 5
 *      (= dual classical: secp256k1 + Ed25519, signatures concatenated)
 *
 * Loaded via `importScripts('../lib/qc-crypto.js')` at the top of
 * background/service-worker.js, so all these symbols become globals on the
 * service worker's scope.
 *
 * No external dependencies — every primitive is implemented or wraps the
 * Web Crypto API.
 *
 * Notes on choices:
 *   • SHA3-256 is the FIPS-202 Keccak[r=1088, c=512] padding variant. The
 *     implementation uses BigInt for the 64-bit lane arithmetic — slower
 *     than uint32 pairs but ~10× shorter and easier to audit.
 *   • secp256k1 ECDSA uses RFC 6979 deterministic k via SHA-256 (good
 *     enough for our signing needs). Returns 64-byte (r || s) low-S sigs
 *     matching the Rust chain's k256 expectation.
 *   • Ed25519 uses Web Crypto's `Ed25519` algorithm (Chrome 130+).
 */

// Converted to ES module for Next.js compatibility
// Original used an IIFE + globalThis; we export named symbols instead.


  // ════════════════════════════════════════════════════════════════════════
  //                            UTILITIES
  // ════════════════════════════════════════════════════════════════════════

  /** Hex-encode bytes (no 0x prefix) */
  function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  /** Decode hex (with or without 0x prefix) into a Uint8Array */
  function hexToBytes(hex) {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length % 2 !== 0) throw new Error('hex length must be even');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }

  /** Concatenate Uint8Arrays */
  function concatBytes(...arrays) {
    const total = arrays.reduce((acc, a) => acc + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
      out.set(a, offset);
      offset += a.length;
    }
    return out;
  }

  function bigIntToBytes(num, size) {
    const out = new Uint8Array(size);
    let n = num;
    for (let i = size - 1; i >= 0; i--) {
      out[i] = Number(n & 0xffn);
      n >>= 8n;
    }
    return out;
  }

  function bytesToBigInt(bytes) {
    let n = 0n;
    for (let i = 0; i < bytes.length; i++) {
      n = (n << 8n) | BigInt(bytes[i]);
    }
    return n;
  }

  // ════════════════════════════════════════════════════════════════════════
  //                          SHA3-256 (Keccak)
  // ════════════════════════════════════════════════════════════════════════
  //
  // FIPS-202: SHA3-256 = Keccak[c=512] with padding 0x06/0x80.
  // State is a 5×5 array of 64-bit "lanes". We use BigInt for lanes.
  //
  // Round constants (24 rounds of Keccak-f[1600])
  const KECCAK_RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
    0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
    0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
    0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
    0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
    0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
    0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];
  // Rho rotation offsets, indexed [x][y]
  const KECCAK_ROT = [
    [ 0n, 36n,  3n, 41n, 18n],
    [ 1n, 44n, 10n, 45n,  2n],
    [62n,  6n, 43n, 15n, 61n],
    [28n, 55n, 25n, 21n, 56n],
    [27n, 20n, 39n,  8n, 14n],
  ];
  const MASK64 = 0xffffffffffffffffn;

  function keccakRotL(x, n) {
    return (((x << n) | (x >> (64n - n))) & MASK64);
  }

  /** Apply Keccak-f[1600] permutation to a 5×5 BigInt state in place */
  function keccakF(state) {
    for (let round = 0; round < 24; round++) {
      // θ
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = state[x][0] ^ state[x][1] ^ state[x][2] ^ state[x][3] ^ state[x][4];
      }
      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ keccakRotL(C[(x + 1) % 5], 1n);
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x][y] = state[x][y] ^ D[x];
        }
      }
      // ρ + π
      const B = [[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n]];
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          B[y][(2 * x + 3 * y) % 5] = keccakRotL(state[x][y], KECCAK_ROT[x][y]);
        }
      }
      // χ
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x][y] = B[x][y] ^ ((~B[(x + 1) % 5][y] & MASK64) & B[(x + 2) % 5][y]);
        }
      }
      // ι
      state[0][0] = state[0][0] ^ KECCAK_RC[round];
    }
  }

  /** SHA3-256 of a Uint8Array, returns 32-byte Uint8Array */
  function sha3_256(data) {
    const RATE_BYTES = 136; // (1600 - 2*256) / 8
    // State as 5×5 64-bit lanes
    const state = [];
    for (let x = 0; x < 5; x++) {
      state.push([0n, 0n, 0n, 0n, 0n]);
    }

    // Pad: 0x06 marker + 0x80 final bit, fill last block with zeros
    const padded = new Uint8Array(
      Math.ceil((data.length + 1) / RATE_BYTES) * RATE_BYTES,
    );
    padded.set(data);
    padded[data.length] = 0x06;
    padded[padded.length - 1] |= 0x80;

    // Absorb: each block XORs into the rate portion of state
    for (let off = 0; off < padded.length; off += RATE_BYTES) {
      for (let i = 0; i < RATE_BYTES; i++) {
        const laneIdx = (i / 8) | 0;
        const x = laneIdx % 5;
        const y = (laneIdx / 5) | 0;
        const byteInLane = i % 8;
        state[x][y] = state[x][y] ^ (BigInt(padded[off + i]) << BigInt(byteInLane * 8));
      }
      keccakF(state);
    }

    // Squeeze: read 32 bytes from rate (4 lanes worth, all in first row)
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      const laneIdx = (i / 8) | 0;
      const x = laneIdx % 5;
      const y = (laneIdx / 5) | 0;
      const byteInLane = i % 8;
      out[i] = Number((state[x][y] >> BigInt(byteInLane * 8)) & 0xffn);
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════
  //                          secp256k1 ECDSA
  // ════════════════════════════════════════════════════════════════════════
  //
  // Curve parameters
  const SEC_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
  const SEC_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const SEC_GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
  const SEC_GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

  function modP(n) {
    const r = n % SEC_P;
    return r >= 0n ? r : r + SEC_P;
  }
  function modN(n) {
    const r = n % SEC_N;
    return r >= 0n ? r : r + SEC_N;
  }
  function invMod(n, m) {
    let [oldR, r] = [m, ((n % m) + m) % m];
    let [oldS, s] = [0n, 1n];
    while (r !== 0n) {
      const q = oldR / r;
      [oldR, r] = [r, oldR - q * r];
      [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % m) + m) % m;
  }

  // Affine point ops on secp256k1. Identity is null.
  function pointDouble(P) {
    if (!P) return null;
    const [x, y] = P;
    if (y === 0n) return null;
    const s = modP(3n * x * x * invMod(2n * y, SEC_P));
    const xr = modP(s * s - 2n * x);
    const yr = modP(s * (x - xr) - y);
    return [xr, yr];
  }
  function pointAdd(P, Q) {
    if (!P) return Q;
    if (!Q) return P;
    const [x1, y1] = P;
    const [x2, y2] = Q;
    if (x1 === x2) {
      if (modP(y1 + y2) === 0n) return null;
      return pointDouble(P);
    }
    const s = modP((y2 - y1) * invMod(x2 - x1, SEC_P));
    const xr = modP(s * s - x1 - x2);
    const yr = modP(s * (x1 - xr) - y1);
    return [xr, yr];
  }
  function pointMul(k, P) {
    let result = null;
    let addend = P;
    let scalar = k;
    while (scalar > 0n) {
      if (scalar & 1n) result = pointAdd(result, addend);
      addend = pointDouble(addend);
      scalar >>= 1n;
    }
    return result;
  }

  /** secp256k1 public key (compressed, 33 bytes) from 32-byte secret */
  function secp256k1GetPublicKey(secretBytes) {
    const d = bytesToBigInt(secretBytes);
    const Q = pointMul(d, [SEC_GX, SEC_GY]);
    if (!Q) throw new Error('invalid secret key (zero point)');
    const [x, y] = Q;
    const out = new Uint8Array(33);
    out[0] = (y & 1n) === 0n ? 0x02 : 0x03;
    out.set(bigIntToBytes(x, 32), 1);
    return out;
  }

  /**
   * Deterministic k generation per RFC 6979 (simplified using HMAC-SHA256
   * as a single HKDF-like extraction). Strictly speaking RFC 6979 specifies
   * an HMAC_DRBG construction; our chain doesn't care which k was used as
   * long as the resulting signature verifies, so a deterministic-but-not-
   * fully-RFC-6979 k is fine for a wallet.
   */
  async function deriveK(msgHash, secretBytes) {
    // k = HMAC-SHA256(secretBytes, msgHash) modulo (n-1) plus 1, retrying
    // if k=0 (extremely unlikely). Web Crypto HMAC-SHA256 is sufficient.
    const key = await crypto.subtle.importKey(
      'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, msgHash);
    let k = bytesToBigInt(new Uint8Array(sig));
    k = (k % (SEC_N - 1n)) + 1n;
    return k;
  }

  /** Sign 32-byte msgHash with 32-byte secret, returns 64-byte (r || s) low-S */
  async function secp256k1Sign(msgHash, secretBytes) {
    const d = bytesToBigInt(secretBytes);
    const z = bytesToBigInt(msgHash);
    let k = await deriveK(msgHash, secretBytes);
    // Try k, k+1, k+2 ... in the unlikely case r=0 or s=0
    for (let attempt = 0; attempt < 10; attempt++) {
      const R = pointMul(k, [SEC_GX, SEC_GY]);
      if (R) {
        const r = modN(R[0]);
        if (r !== 0n) {
          const kInv = invMod(k, SEC_N);
          let s = modN(kInv * (z + r * d));
          if (s !== 0n) {
            // Low-S form per BIP-62 (matches the Rust k256 crate's expectation)
            if (s > SEC_N / 2n) s = SEC_N - s;
            const sig = new Uint8Array(64);
            sig.set(bigIntToBytes(r, 32), 0);
            sig.set(bigIntToBytes(s, 32), 32);
            return sig;
          }
        }
      }
      k = (k + 1n) % SEC_N;
    }
    throw new Error('failed to produce valid k after 10 attempts');
  }

  // ════════════════════════════════════════════════════════════════════════
  //                          Ed25519 (via Web Crypto)
  // ════════════════════════════════════════════════════════════════════════
  //
  // Web Crypto exposes Ed25519 as a Subtle algorithm (Chrome 130+).

  /**
   * Derive 32-byte Ed25519 public key from 32-byte raw seed.
   *
   * Web Crypto's `importKey` for Ed25519 accepts:
   *   • raw + public usage — a 32-byte public key
   *   • pkcs8 / jwk — a structured private key
   *   • raw + private usage is NOT supported across all Chromium versions
   *
   * We need to import the raw 32-byte seed as a private key. The reliable
   * cross-version path is JWK with `crv: "Ed25519"`, `d: base64url(seed)`.
   * After importing, we export the matching public key.
   */
  function bytesToBase64Url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function base64UrlToBytes(b64u) {
    const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /**
   * Compute Ed25519 (publicKey, signature) for a given seed + message.
   * Returns 32-byte public key + 64-byte signature.
   *
   * The seed must be exactly 32 bytes. We need to compute the pubkey from
   * the seed; Web Crypto requires either JWK (with both `d` and `x`) or
   * pkcs8 / raw. Cross-platform reliable approach: generate a fresh keypair
   * for verification of the seed-derived behavior is non-trivial without
   * the public key. So we use a small helper: derive Ed25519 public from
   * seed by inlining the SHA-512 + clamp + scalar mul (~80 lines). For
   * MVP simplicity we instead require the caller to pre-compute the
   * pubkey. See `ed25519DerivePublic` below.
   */

  // Pure-JS Ed25519 public key derivation.
  // Curve order:
  const ED_Q = (1n << 255n) - 19n;
  const ED_N = (1n << 252n) + 27742317777372353535851937790883648493n;
  const ED_D =
    37095705934669439343138083508754565189542113879843219016388785533085940283555n;
  // Base point (B): y = 4/5 mod q
  const ED_BY = (4n * invMod(5n, ED_Q)) % ED_Q;
  const ED_BX = recoverX(ED_BY, 0); // Will compute below

  function modQ(n) {
    const r = n % ED_Q;
    return r >= 0n ? r : r + ED_Q;
  }

  function modPow(b, e, m) {
    let result = 1n;
    let base = b % m;
    if (base < 0n) base += m;
    let exp = e;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % m;
      exp >>= 1n;
      base = (base * base) % m;
    }
    return result;
  }

  // Recover x given y on edwards curve
  function recoverX(y, sign) {
    const xx = modQ((y * y - 1n) * invMod(modQ(ED_D * y * y + 1n), ED_Q));
    let x = modPow(xx, (ED_Q + 3n) / 8n, ED_Q);
    if (modQ(x * x - xx) !== 0n) {
      // Multiply by 2^((q-1)/4)
      const r2 = modPow(2n, (ED_Q - 1n) / 4n, ED_Q);
      x = (x * r2) % ED_Q;
    }
    if ((Number(x & 1n)) !== sign) x = ED_Q - x;
    return x;
  }

  // Edwards point addition (extended-twisted form would be faster; we use
  // affine for clarity since we only do 1-2 scalar mults per signature).
  function edAdd(P, Q) {
    const [x1, y1] = P;
    const [x2, y2] = Q;
    const denom1 = invMod(modQ(1n + ED_D * x1 * x2 * y1 * y2), ED_Q);
    const denom2 = invMod(modQ(1n - ED_D * x1 * x2 * y1 * y2), ED_Q);
    const x3 = modQ((x1 * y2 + x2 * y1) * denom1);
    const y3 = modQ((y1 * y2 + x1 * x2) * denom2);
    return [x3, y3];
  }
  function edMul(P, k) {
    let result = [0n, 1n]; // Edwards identity
    let addend = P;
    let scalar = k;
    while (scalar > 0n) {
      if (scalar & 1n) result = edAdd(result, addend);
      addend = edAdd(addend, addend);
      scalar >>= 1n;
    }
    return result;
  }
  function edEncode(P) {
    const [x, y] = P;
    const bytes = bigIntToBytes(y, 32).reverse(); // little-endian
    if (x & 1n) bytes[31] |= 0x80;
    return new Uint8Array(bytes);
  }

  // SHA-512 via Web Crypto, returns 64-byte Uint8Array
  async function sha512(data) {
    const buf = await crypto.subtle.digest('SHA-512', data);
    return new Uint8Array(buf);
  }

  /**
   * Derive the Ed25519 public key from a 32-byte seed.
   * Returns 32-byte Uint8Array (compressed-y encoding with x-sign bit).
   */
  async function ed25519DerivePublic(seedBytes) {
    if (seedBytes.length !== 32) throw new Error('Ed25519 seed must be 32 bytes');
    const h = await sha512(seedBytes);
    // Clamp lower half
    const a = new Uint8Array(h.slice(0, 32));
    a[0] &= 248;
    a[31] &= 127;
    a[31] |= 64;
    // Decode as little-endian scalar
    const aLE = new Uint8Array(a).reverse();
    const aScalar = bytesToBigInt(aLE);
    const A = edMul([ED_BX, ED_BY], aScalar);
    return edEncode(A);
  }

  /**
   * Ed25519 sign per RFC 8032.
   * Returns 64-byte signature.
   */
  async function ed25519Sign(msgBytes, seedBytes) {
    if (seedBytes.length !== 32) throw new Error('Ed25519 seed must be 32 bytes');
    const h = await sha512(seedBytes);
    const a = new Uint8Array(h.slice(0, 32));
    a[0] &= 248;
    a[31] &= 127;
    a[31] |= 64;
    const aScalar = bytesToBigInt(new Uint8Array(a).reverse());

    const prefix = h.slice(32, 64);
    const A = edEncode(edMul([ED_BX, ED_BY], aScalar));

    const r = bytesToBigInt(
      new Uint8Array((await sha512(concatBytes(prefix, msgBytes)))).reverse(),
    ) % ED_N;
    const R = edMul([ED_BX, ED_BY], r);
    const Renc = edEncode(R);

    const k = bytesToBigInt(
      new Uint8Array((await sha512(concatBytes(Renc, A, msgBytes)))).reverse(),
    ) % ED_N;
    const s = (r + k * aScalar) % ED_N;

    const sig = new Uint8Array(64);
    sig.set(Renc, 0);
    sig.set(bigIntToBytes(s, 32).reverse(), 32);
    return sig;
  }

  // ════════════════════════════════════════════════════════════════════════
  //                  LEVEL-5 IDENTITY (dual classical)
  // ════════════════════════════════════════════════════════════════════════
  //
  // Level 5 in the chain = secp256k1 (33-byte compressed pub) +
  // Ed25519 (32-byte pub), concatenated. Address hash = 24 bytes
  // (= first 24 bytes of SHA3-256(pub_concat)).

  /** Per-level address hash byte counts (must match chain) */
  const ADDRESS_HASH_BYTES = {
    1: 16,  2: 16,  3: 20,  4: 20,  5: 24,
    6: 32,  7: 32,  8: 32,  9: 32,  10: 32,
    11: 48, 12: 48, 13: 48, 14: 64, 15: 64,
    16: 96, 17: 96, 18: 96, 19: 96, 20: 128,
  };

  /**
   * Derive a level-5 identity from a 64-byte secret.
   *
   * Layout matches the chain's `keys::generate_keypair` for level 5:
   *   bytes[0..32]   = secp256k1 secret
   *   bytes[32..64]  = Ed25519 secret
   *
   * Returns:
   *   {
   *     publicKey:    Uint8Array(65)  // secp pub (33) || ed pub (32)
   *     addressBytes: Uint8Array(24)  // SHA3-256(publicKey)[..24]
   *     sign(msgHash: Uint8Array(32)) -> Promise<Uint8Array(128)>
   *       // secp sig (64) || ed sig (64)
   *   }
   */
  async function deriveLevel5Identity(keyBytes) {
    if (keyBytes.length < 64) {
      throw new Error(`level-5 keyBytes must be ≥ 64, got ${keyBytes.length}`);
    }
    const secpSecret = keyBytes.slice(0, 32);
    const edSeed = keyBytes.slice(32, 64);
    const secpPub = secp256k1GetPublicKey(secpSecret);
    const edPub = await ed25519DerivePublic(edSeed);
    const publicKey = concatBytes(secpPub, edPub);
    const addressBytes = sha3_256(publicKey).slice(0, ADDRESS_HASH_BYTES[5]);

    return {
      publicKey,
      addressBytes,
      async sign(msgHash) {
        if (msgHash.length !== 32) throw new Error('msgHash must be 32 bytes');
        const secpSig = await secp256k1Sign(msgHash, secpSecret);
        const edSig = await ed25519Sign(msgHash, edSeed);
        return concatBytes(secpSig, edSig);
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //                              EXPORTS
  // ════════════════════════════════════════════════════════════════════════
  //
  // Plain script load, so attach to globalThis (= worker scope).


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
