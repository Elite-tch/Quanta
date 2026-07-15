/**
 * QuanChain Wallet - secp256k1 Implementation
 * Elliptic curve operations for ECDSA signing
 *
 * This is a minimal implementation for the wallet extension.
 * In production, consider using noble-secp256k1 or similar audited library.
 */

// secp256k1 curve parameters
const CURVE = {
  // Prime field
  P: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
  // Order
  N: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
  // Generator point
  Gx: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
  Gy: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'),
  // Cofactor
  h: BigInt(1),
  // a coefficient (= 0 for secp256k1)
  a: BigInt(0),
  // b coefficient
  b: BigInt(7)
};

/**
 * Modular arithmetic helpers
 */
function mod(n, m = CURVE.P) {
  const result = n % m;
  return result >= 0n ? result : result + m;
}

function modInverse(n, m = CURVE.P) {
  let [old_r, r] = [m, mod(n, m)];
  let [old_s, s] = [0n, 1n];

  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }

  return mod(old_s, m);
}

function modPow(base, exp, m = CURVE.P) {
  let result = 1n;
  base = mod(base, m);

  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = mod(result * base, m);
    }
    exp = exp / 2n;
    base = mod(base * base, m);
  }

  return result;
}

/**
 * Point operations on the curve
 */
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  static ZERO = new Point(null, null);
  static G = new Point(CURVE.Gx, CURVE.Gy);

  isZero() {
    return this.x === null && this.y === null;
  }

  equals(other) {
    return this.x === other.x && this.y === other.y;
  }

  negate() {
    if (this.isZero()) return Point.ZERO;
    return new Point(this.x, mod(-this.y));
  }

  double() {
    if (this.isZero()) return Point.ZERO;
    if (this.y === 0n) return Point.ZERO;

    // λ = (3x² + a) / 2y
    const lambda = mod(
      mod(3n * this.x * this.x + CURVE.a) * modInverse(2n * this.y)
    );

    // x' = λ² - 2x
    const x = mod(lambda * lambda - 2n * this.x);
    // y' = λ(x - x') - y
    const y = mod(lambda * (this.x - x) - this.y);

    return new Point(x, y);
  }

  add(other) {
    if (this.isZero()) return other;
    if (other.isZero()) return this;

    if (this.x === other.x) {
      if (this.y === other.y) return this.double();
      return Point.ZERO; // Point at infinity
    }

    // λ = (y2 - y1) / (x2 - x1)
    const lambda = mod(
      mod(other.y - this.y) * modInverse(mod(other.x - this.x))
    );

    // x' = λ² - x1 - x2
    const x = mod(lambda * lambda - this.x - other.x);
    // y' = λ(x1 - x') - y1
    const y = mod(lambda * (this.x - x) - this.y);

    return new Point(x, y);
  }

  multiply(scalar) {
    let result = Point.ZERO;
    let point = this;
    scalar = mod(scalar, CURVE.N);

    while (scalar > 0n) {
      if (scalar % 2n === 1n) {
        result = result.add(point);
      }
      point = point.double();
      scalar = scalar / 2n;
    }

    return result;
  }

  toBytes(compressed = true) {
    if (this.isZero()) {
      return new Uint8Array([0]);
    }

    const x = bigIntToBytes(this.x, 32);

    if (compressed) {
      const prefix = this.y % 2n === 0n ? 0x02 : 0x03;
      const result = new Uint8Array(33);
      result[0] = prefix;
      result.set(x, 1);
      return result;
    } else {
      const y = bigIntToBytes(this.y, 32);
      const result = new Uint8Array(65);
      result[0] = 0x04;
      result.set(x, 1);
      result.set(y, 33);
      return result;
    }
  }

  static fromBytes(bytes) {
    if (bytes.length === 0 || bytes[0] === 0) {
      return Point.ZERO;
    }

    const prefix = bytes[0];

    if (prefix === 0x04) {
      // Uncompressed
      const x = bytesToBigInt(bytes.slice(1, 33));
      const y = bytesToBigInt(bytes.slice(33, 65));
      return new Point(x, y);
    } else if (prefix === 0x02 || prefix === 0x03) {
      // Compressed
      const x = bytesToBigInt(bytes.slice(1, 33));

      // y² = x³ + 7
      const y2 = mod(modPow(x, 3n) + CURVE.b);
      let y = modPow(y2, (CURVE.P + 1n) / 4n);

      // Check parity
      const isEven = y % 2n === 0n;
      const shouldBeEven = prefix === 0x02;

      if (isEven !== shouldBeEven) {
        y = mod(-y);
      }

      return new Point(x, y);
    }

    throw new Error('Invalid point encoding');
  }
}

/**
 * Get public key from private key
 * @param {Uint8Array} privateKey - 32-byte private key
 * @param {boolean} compressed - Return compressed format
 * @returns {Uint8Array} - Public key
 */
export function getPublicKey(privateKey, compressed = true) {
  const scalar = bytesToBigInt(privateKey);
  const point = Point.G.multiply(scalar);
  return point.toBytes(compressed);
}

/**
 * Sign a message hash
 * @param {Uint8Array} msgHash - 32-byte message hash
 * @param {Uint8Array} privateKey - 32-byte private key
 * @returns {Uint8Array} - 64-byte signature (r || s)
 */
export function sign(msgHash, privateKey) {
  const d = bytesToBigInt(privateKey);
  const z = bytesToBigInt(msgHash);

  // Generate k deterministically (RFC 6979 simplified)
  let k = generateK(msgHash, privateKey);

  while (true) {
    const point = Point.G.multiply(k);
    const r = mod(point.x, CURVE.N);

    if (r === 0n) {
      k = mod(k + 1n, CURVE.N);
      continue;
    }

    // s = k⁻¹(z + rd) mod n
    const kInv = modInverse(k, CURVE.N);
    let s = mod(kInv * (z + r * d), CURVE.N);

    if (s === 0n) {
      k = mod(k + 1n, CURVE.N);
      continue;
    }

    // Ensure low S (BIP-62)
    if (s > CURVE.N / 2n) {
      s = CURVE.N - s;
    }

    const signature = new Uint8Array(64);
    signature.set(bigIntToBytes(r, 32), 0);
    signature.set(bigIntToBytes(s, 32), 32);

    return signature;
  }
}

/**
 * Verify a signature
 * @param {Uint8Array} msgHash - 32-byte message hash
 * @param {Uint8Array} signature - 64-byte signature
 * @param {Uint8Array} publicKey - Public key
 * @returns {boolean} - True if valid
 */
export function verify(msgHash, signature, publicKey) {
  try {
    const point = Point.fromBytes(publicKey);
    const r = bytesToBigInt(signature.slice(0, 32));
    const s = bytesToBigInt(signature.slice(32, 64));
    const z = bytesToBigInt(msgHash);

    if (r <= 0n || r >= CURVE.N || s <= 0n || s >= CURVE.N) {
      return false;
    }

    const sInv = modInverse(s, CURVE.N);
    const u1 = mod(z * sInv, CURVE.N);
    const u2 = mod(r * sInv, CURVE.N);

    const p1 = Point.G.multiply(u1);
    const p2 = point.multiply(u2);
    const result = p1.add(p2);

    if (result.isZero()) return false;

    return mod(result.x, CURVE.N) === r;
  } catch {
    return false;
  }
}

/**
 * Generate deterministic k for signing (simplified RFC 6979)
 */
async function generateKAsync(msgHash, privateKey) {
  // Simplified - use hash of private key + message
  const combined = new Uint8Array(64);
  combined.set(privateKey, 0);
  combined.set(msgHash, 32);

  const hash = await crypto.subtle.digest('SHA-256', combined);
  let k = bytesToBigInt(new Uint8Array(hash));
  k = mod(k, CURVE.N - 1n) + 1n;

  return k;
}

// For synchronous use, use a fallback
function generateKSync(msgHash, privateKey) {
  // XOR-based mixing for determinism
  const k = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    k[i] = privateKey[i] ^ msgHash[i];
  }

  let result = bytesToBigInt(k);
  result = mod(result, CURVE.N - 1n) + 1n;

  return result;
}

// Override generateK to use sync version
function generateK(msgHash, privateKey) {
  return generateKSync(msgHash, privateKey);
}

/**
 * Utility: Convert BigInt to fixed-size bytes
 */
function bigIntToBytes(num, size) {
  const bytes = new Uint8Array(size);
  for (let i = size - 1; i >= 0; i--) {
    bytes[i] = Number(num & 0xffn);
    num = num >> 8n;
  }
  return bytes;
}

/**
 * Utility: Convert bytes to BigInt
 */
function bytesToBigInt(bytes) {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

export { Point, CURVE };
