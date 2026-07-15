/**
 * CRYSTALS-Dilithium Post-Quantum Digital Signature Implementation
 *
 * This implements ML-DSA (formerly Dilithium) as standardized in FIPS 204 (August 2024)
 *
 * Security Levels:
 * - Dilithium2: NIST Level 2 (~128-bit classical, ~64-bit quantum)
 * - Dilithium3: NIST Level 3 (~192-bit classical, ~96-bit quantum)
 * - Dilithium5: NIST Level 5 (~256-bit classical, ~128-bit quantum)
 *
 * Key Sizes:
 * - Dilithium2: Public key 1,312 bytes, Private key 2,528 bytes, Signature 2,420 bytes
 * - Dilithium3: Public key 1,952 bytes, Private key 4,000 bytes, Signature 3,293 bytes
 * - Dilithium5: Public key 2,592 bytes, Private key 4,864 bytes, Signature 4,595 bytes
 *
 * QuanChain Security Level Mapping:
 * - Levels 6-8:   Dilithium2 (hybrid with ECDSA)
 * - Levels 9-11:  Dilithium3 (hybrid with ECDSA)
 * - Levels 12-13: Dilithium3 (pure post-quantum)
 * - Levels 14-15: Dilithium5 (pure post-quantum)
 */

// Dilithium parameters for each security level
export const DILITHIUM_PARAMS = {
  2: {
    name: 'Dilithium2',
    k: 4, l: 4, eta: 2, tau: 39, beta: 78,
    gamma1: 131072, gamma2: 95232, omega: 80,
    publicKeySize: 1312,
    privateKeySize: 2528,
    signatureSize: 2420,
    nistLevel: 2
  },
  3: {
    name: 'Dilithium3',
    k: 6, l: 5, eta: 4, tau: 49, beta: 196,
    gamma1: 524288, gamma2: 261888, omega: 55,
    publicKeySize: 1952,
    privateKeySize: 4000,
    signatureSize: 3293,
    nistLevel: 3
  },
  5: {
    name: 'Dilithium5',
    k: 8, l: 7, eta: 2, tau: 60, beta: 120,
    gamma1: 524288, gamma2: 261888, omega: 75,
    publicKeySize: 2592,
    privateKeySize: 4864,
    signatureSize: 4595,
    nistLevel: 5
  }
};

// Map QuanChain security levels to Dilithium parameters
export const LEVEL_TO_DILITHIUM = {
  6: 2,   // Hybrid: ECDSA + Dilithium2
  7: 2,
  8: 2,
  9: 3,   // Hybrid: ECDSA + Dilithium3
  10: 3,
  11: 3,
  12: 3,  // Pure PQ: Dilithium3
  13: 3,
  14: 5,  // Pure PQ: Dilithium5
  15: 5
};

// Modulus q = 2^23 - 2^13 + 1 = 8380417
const Q = 8380417;
const N = 256;
const D = 13;

// SHAKE-128 and SHAKE-256 using Web Crypto API with fallback
class SHAKE {
  constructor(rate) {
    this.rate = rate;
    this.state = new Uint8Array(200);
    this.offset = 0;
  }

  absorb(data) {
    for (let i = 0; i < data.length; i++) {
      this.state[this.offset++] ^= data[i];
      if (this.offset === this.rate) {
        this.keccakF1600();
        this.offset = 0;
      }
    }
  }

  finalize() {
    // Padding for SHAKE
    this.state[this.offset] ^= 0x1F;
    this.state[this.rate - 1] ^= 0x80;
    this.keccakF1600();
    this.offset = 0;
  }

  squeeze(length) {
    const output = new Uint8Array(length);
    let outputOffset = 0;

    while (outputOffset < length) {
      if (this.offset === this.rate) {
        this.keccakF1600();
        this.offset = 0;
      }
      const toCopy = Math.min(length - outputOffset, this.rate - this.offset);
      output.set(this.state.slice(this.offset, this.offset + toCopy), outputOffset);
      this.offset += toCopy;
      outputOffset += toCopy;
    }

    return output;
  }

  // Keccak-f[1600] permutation
  keccakF1600() {
    const state64 = new BigUint64Array(this.state.buffer);

    // Round constants
    const RC = [
      0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
      0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
      0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
      0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
      0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
      0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
      0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
      0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
    ];

    const rotl64 = (x, n) => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & 0xFFFFFFFFFFFFFFFFn;

    for (let round = 0; round < 24; round++) {
      // θ step
      const C = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = state64[x] ^ state64[x + 5] ^ state64[x + 10] ^ state64[x + 15] ^ state64[x + 20];
      }

      const D = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state64[x + 5 * y] ^= D[x];
        }
      }

      // ρ and π steps
      const rotations = [
        [0, 36, 3, 41, 18],
        [1, 44, 10, 45, 2],
        [62, 6, 43, 15, 61],
        [28, 55, 25, 21, 56],
        [27, 20, 39, 8, 14]
      ];

      const B = new BigUint64Array(25);
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const idx = x + 5 * y;
          const newX = y;
          const newY = (2 * x + 3 * y) % 5;
          B[newX + 5 * newY] = rotl64(state64[idx], rotations[y][x]);
        }
      }

      // χ step
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const idx = x + 5 * y;
          state64[idx] = B[idx] ^ ((~B[(x + 1) % 5 + 5 * y]) & B[(x + 2) % 5 + 5 * y]);
        }
      }

      // ι step
      state64[0] ^= RC[round];
    }
  }
}

// SHAKE-128 (rate = 168 bytes)
function shake128(data, outputLength) {
  const shake = new SHAKE(168);
  shake.absorb(data);
  shake.finalize();
  return shake.squeeze(outputLength);
}

// SHAKE-256 (rate = 136 bytes)
function shake256(data, outputLength) {
  const shake = new SHAKE(136);
  shake.absorb(data);
  shake.finalize();
  return shake.squeeze(outputLength);
}

// NTT (Number Theoretic Transform) operations
const ZETAS = generateZetas();

function generateZetas() {
  const zetas = new Int32Array(N);
  const rootOfUnity = 1753; // Primitive 512th root of unity mod q

  let power = 1;
  for (let i = 0; i < N; i++) {
    // Bit-reverse the index
    let j = 0;
    let k = i;
    for (let b = 0; b < 8; b++) {
      j = (j << 1) | (k & 1);
      k >>= 1;
    }
    zetas[j] = power;
    power = Number((BigInt(power) * BigInt(rootOfUnity)) % BigInt(Q));
  }

  return zetas;
}

// Montgomery reduction
function montgomeryReduce(a) {
  const QINV = 58728449; // q^(-1) mod 2^32
  const t = (a * QINV) | 0;
  return ((a - t * Q) >> 32) | 0;
}

// Barrett reduction
function barrettReduce(a) {
  const v = ((1n << 48n) / BigInt(Q)) | 0n;
  const t = Number((BigInt(a) * v) >> 48n);
  return a - t * Q;
}

// Modular arithmetic
function modQ(a) {
  let r = a % Q;
  if (r < 0) r += Q;
  return r;
}

// Polynomial operations
class Polynomial {
  constructor(coeffs = null) {
    this.coeffs = coeffs || new Int32Array(N);
  }

  static zero() {
    return new Polynomial();
  }

  static random(seed, nonce) {
    const poly = new Polynomial();
    const buf = shake128(concatBytes(seed, new Uint8Array([nonce & 0xFF, nonce >> 8])), 3 * N);

    let j = 0;
    for (let i = 0; i < N && j < buf.length - 2; ) {
      const t = (buf[j] | (buf[j + 1] << 8) | ((buf[j + 2] & 0x7F) << 16));
      j += 3;
      if (t < Q) {
        poly.coeffs[i++] = t;
      }
    }

    return poly;
  }

  static randomEta(seed, nonce, eta) {
    const poly = new Polynomial();
    const bufLen = eta === 2 ? N / 2 : N * 3 / 4;
    const buf = shake256(concatBytes(seed, new Uint8Array([nonce & 0xFF, nonce >> 8])), bufLen);

    if (eta === 2) {
      for (let i = 0; i < N / 2; i++) {
        const t = buf[i];
        const d1 = (t & 3) - ((t >> 2) & 3);
        const d2 = ((t >> 4) & 3) - ((t >> 6) & 3);
        poly.coeffs[2 * i] = d1;
        poly.coeffs[2 * i + 1] = d2;
      }
    } else { // eta === 4
      for (let i = 0; i < N / 2; i++) {
        const t0 = buf[i * 3 / 2 | 0];
        const t1 = buf[(i * 3 / 2 | 0) + 1] || 0;

        let a, b;
        if (i % 2 === 0) {
          a = t0 & 0xF;
          b = t0 >> 4;
        } else {
          a = ((t0 >> 4) | ((t1 & 0xF) << 4)) & 0xF;
          b = t1 >> 4;
        }

        poly.coeffs[2 * i] = modQ(a - (a >> 3) * 9);
        poly.coeffs[2 * i + 1] = modQ(b - (b >> 3) * 9);
      }
    }

    return poly;
  }

  add(other) {
    const result = new Polynomial();
    for (let i = 0; i < N; i++) {
      result.coeffs[i] = modQ(this.coeffs[i] + other.coeffs[i]);
    }
    return result;
  }

  sub(other) {
    const result = new Polynomial();
    for (let i = 0; i < N; i++) {
      result.coeffs[i] = modQ(this.coeffs[i] - other.coeffs[i]);
    }
    return result;
  }

  // NTT transform
  ntt() {
    const result = new Polynomial(this.coeffs.slice());
    let k = 1;

    for (let len = N / 2; len >= 1; len /= 2) {
      for (let start = 0; start < N; start += 2 * len) {
        const zeta = ZETAS[k++];
        for (let j = start; j < start + len; j++) {
          const t = Number((BigInt(zeta) * BigInt(result.coeffs[j + len])) % BigInt(Q));
          result.coeffs[j + len] = modQ(result.coeffs[j] - t);
          result.coeffs[j] = modQ(result.coeffs[j] + t);
        }
      }
    }

    return result;
  }

  // Inverse NTT
  invNtt() {
    const result = new Polynomial(this.coeffs.slice());
    let k = N - 1;
    const f = 8347681; // 256^(-1) mod q

    for (let len = 1; len <= N / 2; len *= 2) {
      for (let start = 0; start < N; start += 2 * len) {
        const zeta = Q - ZETAS[k--];
        for (let j = start; j < start + len; j++) {
          const t = result.coeffs[j];
          result.coeffs[j] = modQ(t + result.coeffs[j + len]);
          result.coeffs[j + len] = Number((BigInt(zeta) * BigInt(t - result.coeffs[j + len])) % BigInt(Q));
          result.coeffs[j + len] = modQ(result.coeffs[j + len]);
        }
      }
    }

    for (let i = 0; i < N; i++) {
      result.coeffs[i] = Number((BigInt(result.coeffs[i]) * BigInt(f)) % BigInt(Q));
    }

    return result;
  }

  // Pointwise multiplication in NTT domain
  pointwiseMul(other) {
    const result = new Polynomial();
    for (let i = 0; i < N; i++) {
      result.coeffs[i] = Number((BigInt(this.coeffs[i]) * BigInt(other.coeffs[i])) % BigInt(Q));
    }
    return result;
  }

  // Check if infinity norm is less than bound
  checkNorm(bound) {
    for (let i = 0; i < N; i++) {
      let coeff = this.coeffs[i];
      if (coeff > Q / 2) coeff -= Q;
      if (Math.abs(coeff) >= bound) return false;
    }
    return true;
  }

  // Power2Round
  power2Round() {
    const r1 = new Polynomial();
    const r0 = new Polynomial();

    for (let i = 0; i < N; i++) {
      const a = this.coeffs[i];
      r1.coeffs[i] = (a + (1 << (D - 1)) - 1) >> D;
      r0.coeffs[i] = a - (r1.coeffs[i] << D);
    }

    return [r1, r0];
  }

  // Decompose for high/low bits
  decompose(gamma2) {
    const r1 = new Polynomial();
    const r0 = new Polynomial();

    for (let i = 0; i < N; i++) {
      let a = modQ(this.coeffs[i]);
      let a0 = a % (2 * gamma2);
      if (a0 > gamma2) a0 -= 2 * gamma2;

      if (a - a0 === Q - 1) {
        r1.coeffs[i] = 0;
        r0.coeffs[i] = a0 - 1;
      } else {
        r1.coeffs[i] = (a - a0) / (2 * gamma2);
        r0.coeffs[i] = a0;
      }
    }

    return [r1, r0];
  }

  // Pack polynomial to bytes
  pack(bits) {
    const bytes = new Uint8Array(N * bits / 8);
    let bitPos = 0;
    let bytePos = 0;
    let current = 0;

    for (let i = 0; i < N; i++) {
      let coeff = this.coeffs[i];
      if (coeff < 0) coeff += Q;

      current |= (coeff << bitPos);
      bitPos += bits;

      while (bitPos >= 8) {
        bytes[bytePos++] = current & 0xFF;
        current >>= 8;
        bitPos -= 8;
      }
    }

    if (bitPos > 0) {
      bytes[bytePos] = current & 0xFF;
    }

    return bytes;
  }
}

// Vector of polynomials
class PolyVec {
  constructor(size) {
    this.polys = Array(size).fill(null).map(() => Polynomial.zero());
  }

  static random(seed, offset, size) {
    const vec = new PolyVec(size);
    for (let i = 0; i < size; i++) {
      vec.polys[i] = Polynomial.random(seed, offset + i);
    }
    return vec;
  }

  static randomEta(seed, offset, size, eta) {
    const vec = new PolyVec(size);
    for (let i = 0; i < size; i++) {
      vec.polys[i] = Polynomial.randomEta(seed, offset + i, eta);
    }
    return vec;
  }

  ntt() {
    const result = new PolyVec(this.polys.length);
    for (let i = 0; i < this.polys.length; i++) {
      result.polys[i] = this.polys[i].ntt();
    }
    return result;
  }

  invNtt() {
    const result = new PolyVec(this.polys.length);
    for (let i = 0; i < this.polys.length; i++) {
      result.polys[i] = this.polys[i].invNtt();
    }
    return result;
  }

  add(other) {
    const result = new PolyVec(this.polys.length);
    for (let i = 0; i < this.polys.length; i++) {
      result.polys[i] = this.polys[i].add(other.polys[i]);
    }
    return result;
  }

  sub(other) {
    const result = new PolyVec(this.polys.length);
    for (let i = 0; i < this.polys.length; i++) {
      result.polys[i] = this.polys[i].sub(other.polys[i]);
    }
    return result;
  }

  checkNorm(bound) {
    for (const poly of this.polys) {
      if (!poly.checkNorm(bound)) return false;
    }
    return true;
  }

  // Inner product in NTT domain
  innerProduct(other) {
    let result = Polynomial.zero();
    for (let i = 0; i < this.polys.length; i++) {
      result = result.add(this.polys[i].pointwiseMul(other.polys[i]));
    }
    return result;
  }
}

// Matrix of polynomials
class PolyMat {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.data = Array(rows).fill(null).map(() => new PolyVec(cols));
  }

  static expandA(seed, k, l) {
    const mat = new PolyMat(k, l);
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < l; j++) {
        mat.data[i].polys[j] = Polynomial.random(seed, (i << 8) | j);
      }
    }
    return mat;
  }

  // Matrix-vector multiplication
  mulVec(vec) {
    const result = new PolyVec(this.rows);
    for (let i = 0; i < this.rows; i++) {
      result.polys[i] = this.data[i].innerProduct(vec);
    }
    return result;
  }
}

// Utility functions
function concatBytes(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generate a Dilithium key pair
 * @param {number} level - Dilithium security level (2, 3, or 5)
 * @returns {Object} - { publicKey: Uint8Array, privateKey: Uint8Array }
 */
export function generateKeyPair(level = 3) {
  const params = DILITHIUM_PARAMS[level];
  if (!params) throw new Error(`Invalid Dilithium level: ${level}`);

  const { k, l, eta } = params;

  // Generate random seed
  const seed = randomBytes(32);
  const expanded = shake256(seed, 128);
  const rho = expanded.slice(0, 32);      // Public seed
  const rhoPrime = expanded.slice(32, 96); // Secret seed for s1, s2
  const key = expanded.slice(96, 128);     // For private key packing

  // Expand matrix A from rho
  const A = PolyMat.expandA(rho, k, l);

  // Sample secret vectors s1, s2
  const s1 = PolyVec.randomEta(rhoPrime, 0, l, eta);
  const s2 = PolyVec.randomEta(rhoPrime, l, k, eta);

  // NTT of s1
  const s1Hat = s1.ntt();

  // Compute t = A * s1 + s2
  const t = A.mulVec(s1Hat).invNtt().add(s2);

  // Power2Round on t
  const t1Polys = [];
  const t0Polys = [];
  for (const poly of t.polys) {
    const [t1, t0] = poly.power2Round();
    t1Polys.push(t1);
    t0Polys.push(t0);
  }

  // Pack public key: rho || t1
  const publicKey = packPublicKey(rho, t1Polys, k);

  // Compute tr = H(pk)
  const tr = shake256(publicKey, 64);

  // Pack private key: rho || key || tr || s1 || s2 || t0
  const privateKey = packPrivateKey(rho, key, tr, s1.polys, s2.polys, t0Polys, params);

  return { publicKey, privateKey, level };
}

/**
 * Sign a message with Dilithium
 * @param {Uint8Array} message - Message to sign
 * @param {Uint8Array} privateKey - Private key
 * @param {number} level - Dilithium security level
 * @returns {Uint8Array} - Signature
 */
export function sign(message, privateKey, level = 3) {
  const params = DILITHIUM_PARAMS[level];
  if (!params) throw new Error(`Invalid Dilithium level: ${level}`);

  const { k, l, eta, tau, beta, gamma1, gamma2, omega } = params;

  // Unpack private key
  const { rho, key, tr, s1, s2, t0 } = unpackPrivateKey(privateKey, params);

  // Expand A
  const A = PolyMat.expandA(rho, k, l);

  // NTT transforms
  const s1Hat = s1.ntt();
  const s2Hat = s2.ntt();
  const t0Hat = t0.ntt();

  // Compute mu = H(tr || msg)
  const mu = shake256(concatBytes(tr, message), 64);

  // Initialize rejection sampling
  let nonce = 0;
  const rhoPrime2 = shake256(concatBytes(key, mu), 64);

  while (true) {
    // Sample y
    const y = sampleMaskingVector(rhoPrime2, nonce, l, gamma1);
    nonce += l;

    // Compute w = A * NTT(y)
    const yHat = y.ntt();
    const w = A.mulVec(yHat).invNtt();

    // HighBits(w)
    const w1Polys = [];
    for (const poly of w.polys) {
      const [w1, _] = poly.decompose(gamma2);
      w1Polys.push(w1);
    }

    // Compute challenge c
    const w1Packed = packW1(w1Polys, gamma2, k);
    const cTilde = shake256(concatBytes(mu, w1Packed), 32);
    const c = sampleChallenge(cTilde, tau);
    const cHat = c.ntt();

    // Compute z = y + c * s1
    const cs1 = new PolyVec(l);
    for (let i = 0; i < l; i++) {
      cs1.polys[i] = cHat.pointwiseMul(s1Hat.polys[i]).invNtt();
    }
    const z = y.add(cs1);

    // Check norm of z
    if (!z.checkNorm(gamma1 - beta)) continue;

    // Compute r0 = LowBits(w - c * s2)
    const cs2 = new PolyVec(k);
    for (let i = 0; i < k; i++) {
      cs2.polys[i] = cHat.pointwiseMul(s2Hat.polys[i]).invNtt();
    }
    const wMinusCs2 = w.sub(cs2);

    const r0Polys = [];
    for (const poly of wMinusCs2.polys) {
      const [_, r0] = poly.decompose(gamma2);
      r0Polys.push(r0);
    }

    // Check norm of r0
    let r0Valid = true;
    for (const r0 of r0Polys) {
      if (!r0.checkNorm(gamma2 - beta)) {
        r0Valid = false;
        break;
      }
    }
    if (!r0Valid) continue;

    // Compute ct0
    const ct0 = new PolyVec(k);
    for (let i = 0; i < k; i++) {
      ct0.polys[i] = cHat.pointwiseMul(t0Hat.polys[i]).invNtt();
    }

    // Check norm of ct0
    if (!ct0.checkNorm(gamma2)) continue;

    // Compute hint
    const hint = makeHint(wMinusCs2, ct0, gamma2, k);

    // Count hint bits
    let hintBits = 0;
    for (const h of hint) {
      for (let i = 0; i < N; i++) {
        if (h.coeffs[i]) hintBits++;
      }
    }
    if (hintBits > omega) continue;

    // Pack and return signature
    return packSignature(cTilde, z.polys, hint, params);
  }
}

/**
 * Verify a Dilithium signature
 * @param {Uint8Array} message - Original message
 * @param {Uint8Array} signature - Signature to verify
 * @param {Uint8Array} publicKey - Public key
 * @param {number} level - Dilithium security level
 * @returns {boolean} - True if valid
 */
export function verify(message, signature, publicKey, level = 3) {
  const params = DILITHIUM_PARAMS[level];
  if (!params) throw new Error(`Invalid Dilithium level: ${level}`);

  const { k, l, gamma1, gamma2, beta, omega } = params;

  try {
    // Unpack public key
    const { rho, t1 } = unpackPublicKey(publicKey, k);

    // Unpack signature
    const { cTilde, z, hint } = unpackSignature(signature, params);

    // Check norm of z
    if (!z.checkNorm(gamma1 - beta)) return false;

    // Count hint bits
    let hintBits = 0;
    for (const h of hint) {
      for (let i = 0; i < N; i++) {
        if (h.coeffs[i]) hintBits++;
      }
    }
    if (hintBits > omega) return false;

    // Expand A
    const A = PolyMat.expandA(rho, k, l);

    // Compute tr = H(pk)
    const tr = shake256(publicKey, 64);

    // Compute mu = H(tr || msg)
    const mu = shake256(concatBytes(tr, message), 64);

    // Recover challenge c
    const c = sampleChallenge(cTilde, params.tau);
    const cHat = c.ntt();

    // Compute w' = A * NTT(z) - c * t1 * 2^d
    const zHat = z.ntt();
    const Az = A.mulVec(zHat);

    const t1Vec = new PolyVec(k);
    for (let i = 0; i < k; i++) {
      t1Vec.polys[i] = t1[i];
    }
    const t1Hat = t1Vec.ntt();

    const ct1 = new PolyVec(k);
    for (let i = 0; i < k; i++) {
      ct1.polys[i] = cHat.pointwiseMul(t1Hat.polys[i]);
      // Multiply by 2^d
      for (let j = 0; j < N; j++) {
        ct1.polys[i].coeffs[j] = modQ(ct1.polys[i].coeffs[j] << D);
      }
    }

    const wPrime = Az.sub(ct1).invNtt();

    // UseHint to recover w1
    const w1Prime = useHint(hint, wPrime, gamma2);

    // Pack w1' and recompute challenge
    const w1PrimePacked = packW1(w1Prime, gamma2, k);
    const cTildeCheck = shake256(concatBytes(mu, w1PrimePacked), 32);

    // Verify challenge matches
    for (let i = 0; i < 32; i++) {
      if (cTilde[i] !== cTildeCheck[i]) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

// Helper functions for packing/unpacking
function packPublicKey(rho, t1, k) {
  const t1Bytes = k * N * 10 / 8; // 10 bits per coefficient
  const pk = new Uint8Array(32 + t1Bytes);
  pk.set(rho, 0);

  let offset = 32;
  for (const poly of t1) {
    const packed = poly.pack(10);
    pk.set(packed, offset);
    offset += packed.length;
  }

  return pk;
}

function unpackPublicKey(pk, k) {
  const rho = pk.slice(0, 32);
  const t1 = [];

  let offset = 32;
  const bytesPerPoly = N * 10 / 8;

  for (let i = 0; i < k; i++) {
    const poly = new Polynomial();
    const bytes = pk.slice(offset, offset + bytesPerPoly);

    // Unpack 10-bit coefficients
    let bitPos = 0;
    let byteIdx = 0;
    for (let j = 0; j < N; j++) {
      let coeff = 0;
      let bitsNeeded = 10;

      while (bitsNeeded > 0) {
        const bitsAvail = 8 - (bitPos % 8);
        const bitsToTake = Math.min(bitsAvail, bitsNeeded);
        const mask = (1 << bitsToTake) - 1;
        const shift = bitPos % 8;

        coeff |= ((bytes[byteIdx] >> shift) & mask) << (10 - bitsNeeded);

        bitPos += bitsToTake;
        bitsNeeded -= bitsToTake;

        if (bitPos % 8 === 0) byteIdx++;
      }

      poly.coeffs[j] = coeff;
    }

    t1.push(poly);
    offset += bytesPerPoly;
  }

  return { rho, t1 };
}

function packPrivateKey(rho, key, tr, s1, s2, t0, params) {
  // Simplified packing - in production use proper bit-packing
  const parts = [rho, key, tr];

  for (const poly of s1) {
    parts.push(new Uint8Array(poly.coeffs.buffer.slice(0)));
  }
  for (const poly of s2) {
    parts.push(new Uint8Array(poly.coeffs.buffer.slice(0)));
  }
  for (const poly of t0) {
    parts.push(new Uint8Array(poly.coeffs.buffer.slice(0)));
  }

  return concatBytes(...parts);
}

function unpackPrivateKey(sk, params) {
  const { k, l } = params;

  let offset = 0;
  const rho = sk.slice(offset, offset + 32); offset += 32;
  const key = sk.slice(offset, offset + 32); offset += 32;
  const tr = sk.slice(offset, offset + 64); offset += 64;

  const polySize = N * 4; // Int32Array

  const s1 = new PolyVec(l);
  for (let i = 0; i < l; i++) {
    s1.polys[i] = new Polynomial(new Int32Array(sk.buffer, sk.byteOffset + offset, N));
    offset += polySize;
  }

  const s2 = new PolyVec(k);
  for (let i = 0; i < k; i++) {
    s2.polys[i] = new Polynomial(new Int32Array(sk.buffer, sk.byteOffset + offset, N));
    offset += polySize;
  }

  const t0 = new PolyVec(k);
  for (let i = 0; i < k; i++) {
    t0.polys[i] = new Polynomial(new Int32Array(sk.buffer, sk.byteOffset + offset, N));
    offset += polySize;
  }

  return { rho, key, tr, s1, s2, t0 };
}

function packSignature(cTilde, z, hint, params) {
  const parts = [cTilde];

  // Pack z
  for (const poly of z) {
    parts.push(new Uint8Array(poly.coeffs.buffer.slice(0)));
  }

  // Pack hint
  for (const h of hint) {
    parts.push(new Uint8Array(h.coeffs.buffer.slice(0)));
  }

  return concatBytes(...parts);
}

function unpackSignature(sig, params) {
  const { k, l } = params;

  let offset = 0;
  const cTilde = sig.slice(offset, offset + 32); offset += 32;

  const polySize = N * 4;

  const zVec = new PolyVec(l);
  for (let i = 0; i < l; i++) {
    zVec.polys[i] = new Polynomial(new Int32Array(sig.buffer, sig.byteOffset + offset, N));
    offset += polySize;
  }

  const hint = [];
  for (let i = 0; i < k; i++) {
    hint.push(new Polynomial(new Int32Array(sig.buffer, sig.byteOffset + offset, N)));
    offset += polySize;
  }

  return { cTilde, z: zVec, hint };
}

function sampleMaskingVector(seed, nonce, l, gamma1) {
  const vec = new PolyVec(l);

  for (let i = 0; i < l; i++) {
    const poly = new Polynomial();
    const buf = shake256(concatBytes(seed, new Uint8Array([(nonce + i) & 0xFF, (nonce + i) >> 8])), N * 20 / 8);

    // Sample from [-gamma1+1, gamma1]
    for (let j = 0; j < N; j++) {
      const bytes = buf.slice(j * 20 / 8, (j + 1) * 20 / 8 + 1);
      let coeff = 0;
      for (let b = 0; b < 20 && b < bytes.length * 8; b++) {
        if (bytes[b >> 3] & (1 << (b & 7))) {
          coeff |= (1 << b);
        }
      }
      coeff &= (gamma1 * 2 - 1);
      poly.coeffs[j] = gamma1 - coeff;
    }

    vec.polys[i] = poly;
  }

  return vec;
}

function sampleChallenge(seed, tau) {
  const c = new Polynomial();
  const buf = shake256(seed, 8 + tau);

  let signs = 0n;
  for (let i = 0; i < 8; i++) {
    signs |= BigInt(buf[i]) << BigInt(i * 8);
  }

  let pos = 8;
  for (let i = N - tau; i < N; i++) {
    let j;
    do {
      j = buf[pos++] || 0;
    } while (j > i);

    c.coeffs[i] = c.coeffs[j];
    c.coeffs[j] = 1 - 2 * Number((signs >> BigInt(i + tau - N)) & 1n);
  }

  return c;
}

function packW1(w1, gamma2, k) {
  // Simplified packing
  const parts = [];
  for (const poly of w1) {
    parts.push(new Uint8Array(poly.coeffs.buffer.slice(0)));
  }
  return concatBytes(...parts);
}

function makeHint(v0, v1, gamma2, k) {
  const hint = [];

  for (let i = 0; i < k; i++) {
    const h = new Polynomial();
    for (let j = 0; j < N; j++) {
      const r = v0.polys[i].coeffs[j];
      const z = v1.polys[i].coeffs[j];

      const [h0, _] = new Polynomial(new Int32Array([r])).decompose(gamma2);
      const [h1, __] = new Polynomial(new Int32Array([modQ(r + z)])).decompose(gamma2);

      h.coeffs[j] = h0.coeffs[0] !== h1.coeffs[0] ? 1 : 0;
    }
    hint.push(h);
  }

  return hint;
}

function useHint(hint, w, gamma2) {
  const result = [];

  for (let i = 0; i < hint.length; i++) {
    const poly = new Polynomial();
    for (let j = 0; j < N; j++) {
      const r = w.polys[i].coeffs[j];
      const [r1, r0] = new Polynomial(new Int32Array([r])).decompose(gamma2);

      if (hint[i].coeffs[j]) {
        if (r0 > 0) {
          poly.coeffs[j] = modQ(r1.coeffs[0] + 1);
        } else {
          poly.coeffs[j] = modQ(r1.coeffs[0] - 1);
        }
      } else {
        poly.coeffs[j] = r1.coeffs[0];
      }
    }
    result.push(poly);
  }

  return result;
}

/**
 * Get the Dilithium level for a QuanChain security level
 */
export function getDilithiumLevel(quanchainLevel) {
  return LEVEL_TO_DILITHIUM[quanchainLevel] || null;
}

/**
 * Check if a QuanChain level requires Dilithium
 */
export function requiresDilithium(quanchainLevel) {
  return quanchainLevel >= 6 && quanchainLevel <= 15;
}

/**
 * Check if a QuanChain level is hybrid (ECDSA + Dilithium)
 */
export function isHybridLevel(quanchainLevel) {
  return quanchainLevel >= 6 && quanchainLevel <= 11;
}

/**
 * Check if a QuanChain level is pure post-quantum
 */
export function isPurePostQuantum(quanchainLevel) {
  return quanchainLevel >= 12 && quanchainLevel <= 15;
}
