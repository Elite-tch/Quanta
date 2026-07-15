// Converted to ES Module

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  function anumber(n, title = "") {
    if (typeof n !== "number") {
      const prefix = title && `"${title}" `;
      throw new TypeError(`${prefix}expected number, got ${typeof n}`);
    }
    if (!Number.isSafeInteger(n) || n < 0) {
      const prefix = title && `"${title}" `;
      throw new RangeError(`${prefix}expected integer >= 0, got ${n}`);
    }
  }
  function abytes(value, length, title = "") {
    const bytes = isBytes(value);
    const len = value?.length;
    const needsLen = length !== void 0;
    if (!bytes || needsLen && len !== length) {
      const prefix = title && `"${title}" `;
      const ofLen = needsLen ? ` of length ${length}` : "";
      const got = bytes ? `length=${len}` : `type=${typeof value}`;
      const message = prefix + "expected Uint8Array" + ofLen + ", got " + got;
      if (!bytes)
        throw new TypeError(message);
      throw new RangeError(message);
    }
    return value;
  }
  function copyBytes(bytes) {
    return Uint8Array.from(abytes(bytes));
  }
  function ahash(h) {
    if (typeof h !== "function" || typeof h.create !== "function")
      throw new TypeError("Hash must wrapped by utils.createHasher");
    anumber(h.outputLen);
    anumber(h.blockLen);
    if (h.outputLen < 1)
      throw new Error('"outputLen" must be >= 1');
    if (h.blockLen < 1)
      throw new Error('"blockLen" must be >= 1');
  }
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("Hash instance has been destroyed");
    if (checkFinished && instance.finished)
      throw new Error("Hash#digest() has already been called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "digestInto() output");
    const min = instance.outputLen;
    if (out.length < min) {
      throw new RangeError('"digestInto() output" expected to be of length >=' + min);
    }
  }
  function u8(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
  function byteSwap(word) {
    return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  }
  var swap8IfBE = isLE ? (n) => n : (n) => byteSwap(n) >>> 0;
  function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = byteSwap(arr[i]);
    }
    return arr;
  }
  var swap32IfBE = isLE ? (u) => u : byteSwap32;
  var hasHexBuiltin = /* @__PURE__ */ (() => (
    // @ts-ignore
    typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
  ))();
  var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  function bytesToHex(bytes) {
    abytes(bytes);
    if (hasHexBuiltin)
      return bytes.toHex();
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += hexes[bytes[i]];
    }
    return hex;
  }
  var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
  function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
      return ch - asciis._0;
    if (ch >= asciis.A && ch <= asciis.F)
      return ch - (asciis.A - 10);
    if (ch >= asciis.a && ch <= asciis.f)
      return ch - (asciis.a - 10);
    return;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    if (hasHexBuiltin) {
      try {
        return Uint8Array.fromHex(hex);
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new RangeError(error.message);
        throw error;
      }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
      throw new RangeError("hex string expected, got unpadded hex of length " + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      const n1 = asciiToBase16(hex.charCodeAt(hi));
      const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
      if (n1 === void 0 || n2 === void 0) {
        const char = hex[hi] + hex[hi + 1];
        throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array[ai] = n1 * 16 + n2;
    }
    return array;
  }
  function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
      const a = arrays[i];
      abytes(a);
      sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
      const a = arrays[i];
      res.set(a, pad);
      pad += a.length;
    }
    return res;
  }
  function createHasher(hashCons, info = {}) {
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  function randomBytes(bytesLength = 32) {
    anumber(bytesLength, "bytesLength");
    const cr = typeof globalThis === "object" ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== "function")
      throw new Error("crypto.getRandomValues must be defined");
    if (bytesLength > 65536)
      throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
  }
  var oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@noble/curves/utils.js
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  function abool(value, title = "") {
    if (typeof value !== "boolean") {
      const prefix = title && `"${title}" `;
      throw new TypeError(prefix + "expected boolean, got type=" + typeof value);
    }
    return value;
  }

  // node_modules/@noble/hashes/_u64.js
  var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
  var _32n = /* @__PURE__ */ BigInt(32);
  function fromBig(n, le = false) {
    if (le)
      return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
    return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
  }
  function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
      const { h, l } = fromBig(lst[i], le);
      [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
  }
  var shrSH = (h, _l, s) => h >>> s;
  var shrSL = (h, l, s) => h << 32 - s | l >>> s;
  var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
  var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
  var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
  var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
  var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
  var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
  var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
  var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
  function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
  }
  var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
  var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
  var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
  var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
  var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
  var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

  // node_modules/@noble/hashes/sha3.js
  var _0n = BigInt(0);
  var _1n = BigInt(1);
  var _2n = BigInt(2);
  var _7n = BigInt(7);
  var _256n = BigInt(256);
  var _0x71n = BigInt(113);
  var SHA3_PI = [];
  var SHA3_ROTL = [];
  var _SHA3_IOTA = [];
  for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
    let t = _0n;
    for (let j = 0; j < 7; j++) {
      R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
      if (R & _2n)
        t ^= _1n << (_1n << BigInt(j)) - _1n;
    }
    _SHA3_IOTA.push(t);
  }
  var IOTAS = split(_SHA3_IOTA, true);
  var SHA3_IOTA_H = IOTAS[0];
  var SHA3_IOTA_L = IOTAS[1];
  var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
  var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
  function keccakP(s, rounds = 24) {
    anumber(rounds, "rounds");
    if (rounds < 1 || rounds > 24)
      throw new Error('"rounds" expected integer 1..24');
    const B = new Uint32Array(5 * 2);
    for (let round = 24 - rounds; round < 24; round++) {
      for (let x = 0; x < 10; x++)
        B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
      for (let x = 0; x < 10; x += 2) {
        const idx1 = (x + 8) % 10;
        const idx0 = (x + 2) % 10;
        const B0 = B[idx0];
        const B1 = B[idx0 + 1];
        const Th = rotlH(B0, B1, 1) ^ B[idx1];
        const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
        for (let y = 0; y < 50; y += 10) {
          s[x + y] ^= Th;
          s[x + y + 1] ^= Tl;
        }
      }
      let curH = s[2];
      let curL = s[3];
      for (let t = 0; t < 24; t++) {
        const shift = SHA3_ROTL[t];
        const Th = rotlH(curH, curL, shift);
        const Tl = rotlL(curH, curL, shift);
        const PI = SHA3_PI[t];
        curH = s[PI];
        curL = s[PI + 1];
        s[PI] = Th;
        s[PI + 1] = Tl;
      }
      for (let y = 0; y < 50; y += 10) {
        const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
        s[y] ^= ~s[y + 2] & s[y + 4];
        s[y + 1] ^= ~s[y + 3] & s[y + 5];
        s[y + 2] ^= ~s[y + 4] & s[y + 6];
        s[y + 3] ^= ~s[y + 5] & s[y + 7];
        s[y + 4] ^= ~s[y + 6] & s[y + 8];
        s[y + 5] ^= ~s[y + 7] & s[y + 9];
        s[y + 6] ^= ~s[y + 8] & b0;
        s[y + 7] ^= ~s[y + 9] & b1;
        s[y + 8] ^= ~b0 & b2;
        s[y + 9] ^= ~b1 & b3;
      }
      s[0] ^= SHA3_IOTA_H[round];
      s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
  }
  var Keccak = class _Keccak {
    state;
    pos = 0;
    posOut = 0;
    finished = false;
    state32;
    destroyed = false;
    blockLen;
    suffix;
    outputLen;
    canXOF;
    enableXOF = false;
    rounds;
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
      this.blockLen = blockLen;
      this.suffix = suffix;
      this.outputLen = outputLen;
      this.enableXOF = enableXOF;
      this.canXOF = enableXOF;
      this.rounds = rounds;
      anumber(outputLen, "outputLen");
      if (!(0 < blockLen && blockLen < 200))
        throw new Error("only keccak-f1600 function is supported");
      this.state = new Uint8Array(200);
      this.state32 = u32(this.state);
    }
    clone() {
      return this._cloneInto();
    }
    keccak() {
      swap32IfBE(this.state32);
      keccakP(this.state32, this.rounds);
      swap32IfBE(this.state32);
      this.posOut = 0;
      this.pos = 0;
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { blockLen, state } = this;
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        for (let i = 0; i < take; i++)
          state[this.pos++] ^= data[pos++];
        if (this.pos === blockLen)
          this.keccak();
      }
      return this;
    }
    finish() {
      if (this.finished)
        return;
      this.finished = true;
      const { state, suffix, pos, blockLen } = this;
      state[pos] ^= suffix;
      if ((suffix & 128) !== 0 && pos === blockLen - 1)
        this.keccak();
      state[blockLen - 1] ^= 128;
      this.keccak();
    }
    writeInto(out) {
      aexists(this, false);
      abytes(out);
      this.finish();
      const bufferOut = this.state;
      const { blockLen } = this;
      for (let pos = 0, len = out.length; pos < len; ) {
        if (this.posOut >= blockLen)
          this.keccak();
        const take = Math.min(blockLen - this.posOut, len - pos);
        out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
        this.posOut += take;
        pos += take;
      }
      return out;
    }
    xofInto(out) {
      if (!this.enableXOF)
        throw new Error("XOF is not possible for this instance");
      return this.writeInto(out);
    }
    xof(bytes) {
      anumber(bytes);
      return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
      aoutput(out, this);
      if (this.finished)
        throw new Error("digest() was already called");
      this.writeInto(out.subarray(0, this.outputLen));
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.outputLen);
      this.digestInto(out);
      return out;
    }
    destroy() {
      this.destroyed = true;
      clean(this.state);
    }
    _cloneInto(to) {
      const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
      to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
      to.blockLen = blockLen;
      to.state32.set(this.state32);
      to.pos = this.pos;
      to.posOut = this.posOut;
      to.finished = this.finished;
      to.rounds = rounds;
      to.suffix = suffix;
      to.outputLen = outputLen;
      to.enableXOF = enableXOF;
      to.canXOF = this.canXOF;
      to.destroyed = this.destroyed;
      return to;
    }
  };
  var genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info);
  var sha3_256 = /* @__PURE__ */ genKeccak(
    6,
    136,
    32,
    /* @__PURE__ */ oidNist(8)
  );
  var genShake = (suffix, blockLen, outputLen, info = {}) => createHasher((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true), info);
  var shake128 = /* @__PURE__ */ genShake(31, 168, 16, /* @__PURE__ */ oidNist(11));
  var shake256 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist(12));

  // node_modules/@noble/curves/abstract/fft.js
  function checkU32(n) {
    if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
      throw new Error("wrong u32 integer:" + n);
    return n;
  }
  function isPowerOfTwo(x) {
    checkU32(x);
    return (x & x - 1) === 0 && x !== 0;
  }
  function reverseBits(n, bits) {
    checkU32(n);
    if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
      throw new Error(`expected integer 0 <= bits <= 32, got ${bits}`);
    let reversed = 0;
    for (let i = 0; i < bits; i++, n >>>= 1)
      reversed = reversed << 1 | n & 1;
    return reversed >>> 0;
  }
  function log2(n) {
    checkU32(n);
    return 31 - Math.clz32(n);
  }
  function bitReversalInplace(values) {
    const n = values.length;
    if (!isPowerOfTwo(n))
      throw new Error("expected positive power-of-two length, got " + n);
    const bits = log2(n);
    for (let i = 0; i < n; i++) {
      const j = reverseBits(i, bits);
      if (i < j) {
        const tmp = values[i];
        values[i] = values[j];
        values[j] = tmp;
      }
    }
    return values;
  }
  var FFTCore = (F2, coreOpts) => {
    const { N: N2, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
    const bits = log2(N2);
    if (!isPowerOfTwo(N2))
      throw new Error("FFT: Polynomial size should be power of two");
    if (roots.length !== N2)
      throw new Error(`FFT: wrong roots length: expected ${N2}, got ${roots.length}`);
    const isDit = dit !== invertButterflies;
    isDit;
    return (values) => {
      if (values.length !== N2)
        throw new Error("FFT: wrong Polynomial length");
      if (dit && brp)
        bitReversalInplace(values);
      for (let i = 0, g = 1; i < bits - skipStages; i++) {
        const s = dit ? i + 1 + skipStages : bits - i;
        const m = 1 << s;
        const m2 = m >> 1;
        const stride = N2 >> s;
        for (let k = 0; k < N2; k += m) {
          for (let j = 0, grp = g++; j < m2; j++) {
            const rootPos = invertButterflies ? dit ? N2 - grp : grp : j * stride;
            const i0 = k + j;
            const i1 = k + j + m2;
            const omega = roots[rootPos];
            const b = values[i1];
            const a = values[i0];
            if (isDit) {
              const t = F2.mul(b, omega);
              values[i0] = F2.add(a, t);
              values[i1] = F2.sub(a, t);
            } else if (invertButterflies) {
              values[i0] = F2.add(b, a);
              values[i1] = F2.mul(F2.sub(b, a), omega);
            } else {
              values[i0] = F2.add(a, b);
              values[i1] = F2.mul(F2.sub(a, b), omega);
            }
          }
        }
      }
      if (!dit && brp)
        bitReversalInplace(values);
      return values;
    };
  };

  // node_modules/@noble/post-quantum/utils.js
  /*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
  var abytesDoc = abytes;
  var randomBytes2 = randomBytes;
  function equalBytes(a, b) {
    if (a.length !== b.length)
      return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
      diff |= a[i] ^ b[i];
    return diff === 0;
  }
  function copyBytes2(bytes) {
    return Uint8Array.from(abytes(bytes));
  }
  function validateOpts(opts) {
    if (Object.prototype.toString.call(opts) !== "[object Object]")
      throw new TypeError("expected valid options object");
  }
  function validateVerOpts(opts) {
    validateOpts(opts);
    if (opts.context !== void 0)
      abytes(opts.context, void 0, "opts.context");
  }
  function validateSigOpts(opts) {
    validateVerOpts(opts);
    if (opts.extraEntropy !== false && opts.extraEntropy !== void 0)
      abytes(opts.extraEntropy, void 0, "opts.extraEntropy");
  }
  function splitCoder(label, ...lengths) {
    const getLength = (c) => typeof c === "number" ? c : c.bytesLen;
    const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
    return {
      bytesLen,
      encode: (bufs) => {
        const res = new Uint8Array(bytesLen);
        for (let i = 0, pos = 0; i < lengths.length; i++) {
          const c = lengths[i];
          const l = getLength(c);
          const b = typeof c === "number" ? bufs[i] : c.encode(bufs[i]);
          abytes(b, l, label);
          res.set(b, pos);
          if (typeof c !== "number")
            b.fill(0);
          pos += l;
        }
        return res;
      },
      decode: (buf) => {
        abytes(buf, bytesLen, label);
        const res = [];
        for (const c of lengths) {
          const l = getLength(c);
          const b = buf.subarray(0, l);
          res.push(typeof c === "number" ? b : c.decode(b));
          buf = buf.subarray(l);
        }
        return res;
      }
    };
  }
  function vecCoder(c, vecLen) {
    const coder = c;
    const bytesLen = vecLen * coder.bytesLen;
    return {
      bytesLen,
      encode: (u) => {
        if (u.length !== vecLen)
          throw new RangeError(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
        const res = new Uint8Array(bytesLen);
        for (let i = 0, pos = 0; i < u.length; i++) {
          const b = coder.encode(u[i]);
          res.set(b, pos);
          b.fill(0);
          pos += b.length;
        }
        return res;
      },
      decode: (a) => {
        abytes(a, bytesLen);
        const r = [];
        for (let i = 0; i < a.length; i += coder.bytesLen)
          r.push(coder.decode(a.subarray(i, i + coder.bytesLen)));
        return r;
      }
    };
  }
  function cleanBytes(...list) {
    for (const t of list) {
      if (Array.isArray(t))
        for (const b of t)
          b.fill(0);
      else
        t.fill(0);
    }
  }
  function getMask(bits) {
    if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
      throw new RangeError(`expected bits in [0..32], got ${bits}`);
    return bits === 32 ? 4294967295 : ~(-1 << bits) >>> 0;
  }
  var EMPTY = /* @__PURE__ */ Uint8Array.of();
  function getMessage(msg, ctx = EMPTY) {
    abytes(msg);
    abytes(ctx);
    if (ctx.length > 255)
      throw new RangeError("context should be 255 bytes or less");
    return concatBytes(new Uint8Array([0, ctx.length]), ctx, msg);
  }
  var oidNistP = /* @__PURE__ */ Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2]);
  function checkHash(hash, requiredStrength = 0) {
    if (!hash.oid || !equalBytes(hash.oid.subarray(0, 10), oidNistP))
      throw new Error("hash.oid is invalid: expected NIST hash");
    const collisionResistance = hash.outputLen * 8 / 2;
    if (requiredStrength > collisionResistance) {
      throw new Error("Pre-hash security strength too low: " + collisionResistance + ", required: " + requiredStrength);
    }
  }
  function getMessagePrehash(hash, msg, ctx = EMPTY) {
    abytes(msg);
    abytes(ctx);
    if (ctx.length > 255)
      throw new RangeError("context should be 255 bytes or less");
    const hashed = hash(msg);
    return concatBytes(new Uint8Array([1, ctx.length]), ctx, hash.oid, hashed);
  }

  // node_modules/@noble/post-quantum/_crystals.js
  /*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
  var genCrystals = (opts) => {
    const { newPoly: newPoly2, N: N2, Q: Q2, F: F2, ROOT_OF_UNITY: ROOT_OF_UNITY2, brvBits, isKyber } = opts;
    const mod = (a, modulo = Q2) => {
      const result = a % modulo | 0;
      return (result >= 0 ? result | 0 : modulo + result | 0) | 0;
    };
    const smod = (a, modulo = Q2) => {
      const r = mod(a, modulo) | 0;
      return (r > modulo >> 1 ? r - modulo | 0 : r) | 0;
    };
    function getZettas() {
      const out = newPoly2(N2);
      for (let i = 0; i < N2; i++) {
        const b = reverseBits(i, brvBits);
        const p = BigInt(ROOT_OF_UNITY2) ** BigInt(b) % BigInt(Q2);
        out[i] = Number(p) | 0;
      }
      return out;
    }
    const nttZetas = getZettas();
    const field = {
      add: (a, b) => mod((a | 0) + (b | 0)) | 0,
      sub: (a, b) => mod((a | 0) - (b | 0)) | 0,
      mul: (a, b) => mod((a | 0) * (b | 0)) | 0,
      inv: (_a) => {
        throw new Error("not implemented");
      }
    };
    const nttOpts = {
      N: N2,
      roots: nttZetas,
      invertButterflies: true,
      skipStages: isKyber ? 1 : 0,
      brp: false
    };
    const dif = FFTCore(field, { dit: false, ...nttOpts });
    const dit = FFTCore(field, { dit: true, ...nttOpts });
    const NTT = {
      encode: (r) => {
        return dif(r);
      },
      decode: (r) => {
        dit(r);
        for (let i = 0; i < r.length; i++)
          r[i] = mod(F2 * r[i]);
        return r;
      }
    };
    const bitsCoder = (d, c) => {
      const mask = getMask(d);
      const bytesLen = d * (N2 / 8);
      return {
        bytesLen,
        encode: (poly_) => {
          const poly = poly_;
          const r = new Uint8Array(bytesLen);
          for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
            buf |= (c.encode(poly[i]) & mask) << bufLen;
            bufLen += d;
            for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
              r[pos++] = buf & getMask(bufLen);
          }
          return r;
        },
        decode: (bytes) => {
          const r = newPoly2(N2);
          for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
            buf |= bytes[i] << bufLen;
            bufLen += 8;
            for (; bufLen >= d; bufLen -= d, buf >>= d)
              r[pos++] = c.decode(buf & mask);
          }
          return r;
        }
      };
    };
    return {
      mod,
      smod,
      nttZetas,
      NTT: {
        encode: (r) => NTT.encode(r),
        decode: (r) => NTT.decode(r)
      },
      bitsCoder
    };
  };
  var createXofShake = (shake) => (seed, blockLen) => {
    if (!blockLen)
      blockLen = shake.blockLen;
    const _seed = new Uint8Array(seed.length + 2);
    _seed.set(seed);
    const seedLen = seed.length;
    const buf = new Uint8Array(blockLen);
    let h = shake.create({});
    let calls = 0;
    let xofs = 0;
    return {
      stats: () => ({ calls, xofs }),
      get: (x, y) => {
        _seed[seedLen + 0] = x;
        _seed[seedLen + 1] = y;
        h.destroy();
        h = shake.create({}).update(_seed);
        calls++;
        return () => {
          xofs++;
          return h.xofInto(buf);
        };
      },
      clean: () => {
        h.destroy();
        cleanBytes(buf, _seed);
      }
    };
  };
  var XOF128 = /* @__PURE__ */ createXofShake(shake128);
  var XOF256 = /* @__PURE__ */ createXofShake(shake256);

  // node_modules/@noble/post-quantum/ml-dsa.js
  /*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
  function validateInternalOpts(opts) {
    validateOpts(opts);
    if (opts.externalMu !== void 0)
      abool(opts.externalMu, "opts.externalMu");
  }
  var N = 256;
  var Q = 8380417;
  var ROOT_OF_UNITY = 1753;
  var F = 8347681;
  var D = 13;
  var GAMMA2_1 = Math.floor((Q - 1) / 88) | 0;
  var GAMMA2_2 = Math.floor((Q - 1) / 32) | 0;
  var PARAMS = /* @__PURE__ */ (() => Object.freeze({
    2: Object.freeze({
      K: 4,
      L: 4,
      D,
      GAMMA1: 2 ** 17,
      GAMMA2: GAMMA2_1,
      TAU: 39,
      ETA: 2,
      OMEGA: 80
    }),
    3: Object.freeze({
      K: 6,
      L: 5,
      D,
      GAMMA1: 2 ** 19,
      GAMMA2: GAMMA2_2,
      TAU: 49,
      ETA: 4,
      OMEGA: 55
    }),
    5: Object.freeze({
      K: 8,
      L: 7,
      D,
      GAMMA1: 2 ** 19,
      GAMMA2: GAMMA2_2,
      TAU: 60,
      ETA: 2,
      OMEGA: 75
    })
  }))();
  var newPoly = (n) => new Int32Array(n);
  var crystals = /* @__PURE__ */ genCrystals({
    N,
    Q,
    F,
    ROOT_OF_UNITY,
    newPoly,
    isKyber: false,
    brvBits: 8
  });
  var id = (n) => n;
  var polyCoder = (d, compress2 = id, verify = id) => crystals.bitsCoder(d, {
    encode: (i) => compress2(verify(i)),
    decode: (i) => verify(compress2(i))
  });
  var polyAdd = (a_, b_) => {
    const a = a_;
    const b = b_;
    for (let i = 0; i < a.length; i++)
      a[i] = crystals.mod(a[i] + b[i]);
    return a;
  };
  var polySub = (a_, b_) => {
    const a = a_;
    const b = b_;
    for (let i = 0; i < a.length; i++)
      a[i] = crystals.mod(a[i] - b[i]);
    return a;
  };
  var polyShiftl = (p_) => {
    const p = p_;
    for (let i = 0; i < N; i++)
      p[i] <<= D;
    return p;
  };
  var polyChknorm = (p_, B) => {
    const p = p_;
    for (let i = 0; i < N; i++)
      if (Math.abs(crystals.smod(p[i])) >= B)
        return true;
    return false;
  };
  var MultiplyNTTs = (a_, b_) => {
    const a = a_;
    const b = b_;
    const c = newPoly(N);
    for (let i = 0; i < a.length; i++)
      c[i] = crystals.mod(a[i] * b[i]);
    return c;
  };
  function RejNTTPoly(xof_) {
    const xof = xof_;
    const r = newPoly(N);
    for (let j = 0; j < N; ) {
      const b = xof();
      if (b.length % 3)
        throw new Error("RejNTTPoly: unaligned block");
      for (let i = 0; j < N && i <= b.length - 3; i += 3) {
        const t = (b[i + 0] | b[i + 1] << 8 | b[i + 2] << 16) & 8388607;
        if (t < Q)
          r[j++] = t;
      }
    }
    return r;
  }
  function getDilithium(opts_) {
    const opts = opts_;
    const { K, L, GAMMA1, GAMMA2, TAU, ETA, OMEGA } = opts;
    const { CRH_BYTES, TR_BYTES, C_TILDE_BYTES, XOF128: XOF1282, XOF256: XOF2562, securityLevel } = opts;
    if (![2, 4].includes(ETA))
      throw new Error("Wrong ETA");
    if (![1 << 17, 1 << 19].includes(GAMMA1))
      throw new Error("Wrong GAMMA1");
    if (![GAMMA2_1, GAMMA2_2].includes(GAMMA2))
      throw new Error("Wrong GAMMA2");
    const BETA = TAU * ETA;
    const decompose = (r) => {
      const rPlus = crystals.mod(r);
      const r0 = crystals.smod(rPlus, 2 * GAMMA2) | 0;
      if (rPlus - r0 === Q - 1)
        return { r1: 0 | 0, r0: r0 - 1 | 0 };
      const r1 = Math.floor((rPlus - r0) / (2 * GAMMA2)) | 0;
      return { r1, r0 };
    };
    const HighBits = (r) => decompose(r).r1;
    const LowBits = (r) => decompose(r).r0;
    const MakeHint = (z, r) => {
      const res0 = z <= GAMMA2 || z > Q - GAMMA2 || z === Q - GAMMA2 && r === 0 ? 0 : 1;
      return res0;
    };
    const UseHint = (h, r) => {
      const m = Math.floor((Q - 1) / (2 * GAMMA2));
      const { r1, r0 } = decompose(r);
      if (h === 1)
        return r0 > 0 ? crystals.mod(r1 + 1, m) | 0 : crystals.mod(r1 - 1, m) | 0;
      return r1 | 0;
    };
    const Power2Round = (r) => {
      const rPlus = crystals.mod(r);
      const r0 = crystals.smod(rPlus, 2 ** D) | 0;
      return { r1: Math.floor((rPlus - r0) / 2 ** D) | 0, r0 };
    };
    const hintCoder = {
      bytesLen: OMEGA + K,
      encode: (h_) => {
        const h = h_;
        if (h === false)
          throw new Error("hint.encode: hint is false");
        const res = new Uint8Array(OMEGA + K);
        for (let i = 0, k = 0; i < K; i++) {
          for (let j = 0; j < N; j++)
            if (h[i][j] !== 0)
              res[k++] = j;
          res[OMEGA + i] = k;
        }
        return res;
      },
      decode: (buf) => {
        const h = [];
        let k = 0;
        for (let i = 0; i < K; i++) {
          const hi = newPoly(N);
          if (buf[OMEGA + i] < k || buf[OMEGA + i] > OMEGA)
            return false;
          for (let j = k; j < buf[OMEGA + i]; j++) {
            if (j > k && buf[j] <= buf[j - 1])
              return false;
            hi[buf[j]] = 1;
          }
          k = buf[OMEGA + i];
          h.push(hi);
        }
        for (let j = k; j < OMEGA; j++)
          if (buf[j] !== 0)
            return false;
        return h;
      }
    };
    const ETACoder = polyCoder(ETA === 2 ? 3 : 4, (i) => ETA - i, (i) => {
      if (!(-ETA <= i && i <= ETA))
        throw new Error(`malformed key s1/s3 ${i} outside of ETA range [${-ETA}, ${ETA}]`);
      return i;
    });
    const T0Coder = polyCoder(13, (i) => (1 << D - 1) - i);
    const T1Coder = polyCoder(10);
    const ZCoder = polyCoder(GAMMA1 === 1 << 17 ? 18 : 20, (i) => crystals.smod(GAMMA1 - i));
    const W1Coder = polyCoder(GAMMA2 === GAMMA2_1 ? 6 : 4);
    const W1Vec = vecCoder(W1Coder, K);
    const publicCoder = splitCoder("publicKey", 32, vecCoder(T1Coder, K));
    const secretCoder = splitCoder("secretKey", 32, 32, TR_BYTES, vecCoder(ETACoder, L), vecCoder(ETACoder, K), vecCoder(T0Coder, K));
    const sigCoder = splitCoder("signature", C_TILDE_BYTES, vecCoder(ZCoder, L), hintCoder);
    const CoefFromHalfByte = ETA === 2 ? (n) => n < 15 ? 2 - n % 5 : false : (n) => n < 9 ? 4 - n : false;
    function RejBoundedPoly(xof_) {
      const xof = xof_;
      const r = newPoly(N);
      for (let j = 0; j < N; ) {
        const b = xof();
        for (let i = 0; j < N && i < b.length; i += 1) {
          const d1 = CoefFromHalfByte(b[i] & 15);
          const d2 = CoefFromHalfByte(b[i] >> 4 & 15);
          if (d1 !== false)
            r[j++] = d1;
          if (j < N && d2 !== false)
            r[j++] = d2;
        }
      }
      return r;
    }
    const SampleInBall = (seed) => {
      const pre = newPoly(N);
      const s = shake256.create({}).update(seed);
      const buf = new Uint8Array(shake256.blockLen);
      s.xofInto(buf);
      const masks = buf.slice(0, 8);
      for (let i = N - TAU, pos = 8, maskPos = 0, maskBit = 0; i < N; i++) {
        let b = i + 1;
        for (; b > i; ) {
          b = buf[pos++];
          if (pos < shake256.blockLen)
            continue;
          s.xofInto(buf);
          pos = 0;
        }
        pre[i] = pre[b];
        pre[b] = 1 - ((masks[maskPos] >> maskBit++ & 1) << 1);
        if (maskBit >= 8) {
          maskPos++;
          maskBit = 0;
        }
      }
      return pre;
    };
    const polyPowerRound = (p_) => {
      const p = p_;
      const res0 = newPoly(N);
      const res1 = newPoly(N);
      for (let i = 0; i < p.length; i++) {
        const { r0, r1 } = Power2Round(p[i]);
        res0[i] = r0;
        res1[i] = r1;
      }
      return { r0: res0, r1: res1 };
    };
    const polyUseHint = (u_, h_) => {
      const u = u_;
      const h = h_;
      for (let i = 0; i < N; i++)
        u[i] = UseHint(h[i], u[i]);
      return u;
    };
    const polyMakeHint = (a_, b_) => {
      const a = a_;
      const b = b_;
      const v = newPoly(N);
      let cnt = 0;
      for (let i = 0; i < N; i++) {
        const h = MakeHint(a[i], b[i]);
        v[i] = h;
        cnt += h;
      }
      return { v, cnt };
    };
    const signRandBytes = 32;
    const seedCoder = splitCoder("seed", 32, 64, 32);
    const internal = Object.freeze({
      info: Object.freeze({ type: "internal-ml-dsa" }),
      lengths: Object.freeze({
        secretKey: secretCoder.bytesLen,
        publicKey: publicCoder.bytesLen,
        seed: 32,
        signature: sigCoder.bytesLen,
        signRand: signRandBytes
      }),
      keygen: (seed) => {
        const seedDst = new Uint8Array(32 + 2);
        const randSeed = seed === void 0;
        if (randSeed)
          seed = randomBytes2(32);
        abytesDoc(seed, 32, "seed");
        seedDst.set(seed);
        if (randSeed)
          cleanBytes(seed);
        seedDst[32] = K;
        seedDst[33] = L;
        const [rho, rhoPrime, K_] = seedCoder.decode(shake256(seedDst, { dkLen: seedCoder.bytesLen }));
        const xofPrime = XOF2562(rhoPrime);
        const s1 = [];
        for (let i = 0; i < L; i++)
          s1.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
        const s2 = [];
        for (let i = L; i < L + K; i++)
          s2.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
        const s1Hat = s1.map((i) => crystals.NTT.encode(i.slice()));
        const t0 = [];
        const t1 = [];
        const xof = XOF1282(rho);
        const t = newPoly(N);
        for (let i = 0; i < K; i++) {
          cleanBytes(t);
          for (let j = 0; j < L; j++) {
            const aij = RejNTTPoly(xof.get(j, i));
            polyAdd(t, MultiplyNTTs(aij, s1Hat[j]));
          }
          crystals.NTT.decode(t);
          const { r0, r1 } = polyPowerRound(polyAdd(t, s2[i]));
          t0.push(r0);
          t1.push(r1);
        }
        const publicKey = publicCoder.encode([rho, t1]);
        const tr = shake256(publicKey, { dkLen: TR_BYTES });
        const secretKey = secretCoder.encode([rho, K_, tr, s1, s2, t0]);
        xof.clean();
        xofPrime.clean();
        cleanBytes(rho, rhoPrime, K_, s1, s2, s1Hat, t, t0, t1, tr, seedDst);
        return {
          publicKey,
          secretKey
        };
      },
      getPublicKey: (secretKey) => {
        const [rho, _K, _tr, s1, s2, _t0] = secretCoder.decode(secretKey);
        const xof = XOF1282(rho);
        const s1Hat = s1.map((p) => crystals.NTT.encode(p.slice()));
        const t1 = [];
        const tmp = newPoly(N);
        for (let i = 0; i < K; i++) {
          tmp.fill(0);
          for (let j = 0; j < L; j++) {
            const aij = RejNTTPoly(xof.get(j, i));
            polyAdd(tmp, MultiplyNTTs(aij, s1Hat[j]));
          }
          crystals.NTT.decode(tmp);
          polyAdd(tmp, s2[i]);
          const { r1 } = polyPowerRound(tmp);
          t1.push(r1);
        }
        xof.clean();
        cleanBytes(tmp, s1Hat, _t0, s1, s2);
        return publicCoder.encode([rho, t1]);
      },
      // NOTE: random is optional.
      sign: (msg, secretKey, opts2 = {}) => {
        validateSigOpts(opts2);
        validateInternalOpts(opts2);
        let { extraEntropy: random, externalMu = false } = opts2;
        const [rho, _K, tr, s1, s2, t0] = secretCoder.decode(secretKey);
        const A = [];
        const xof = XOF1282(rho);
        for (let i = 0; i < K; i++) {
          const pv = [];
          for (let j = 0; j < L; j++)
            pv.push(RejNTTPoly(xof.get(j, i)));
          A.push(pv);
        }
        xof.clean();
        for (let i = 0; i < L; i++)
          crystals.NTT.encode(s1[i]);
        for (let i = 0; i < K; i++) {
          crystals.NTT.encode(s2[i]);
          crystals.NTT.encode(t0[i]);
        }
        const mu = externalMu ? msg : (
          // 6: µ ← H(tr||M, 512)
          //    ▷ Compute message representative µ
          shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest()
        );
        const rnd = random === false ? new Uint8Array(32) : random === void 0 ? randomBytes2(signRandBytes) : random;
        abytesDoc(rnd, 32, "extraEntropy");
        const rhoprime = shake256.create({ dkLen: CRH_BYTES }).update(_K).update(rnd).update(mu).digest();
        abytesDoc(rhoprime, CRH_BYTES);
        const x256 = XOF2562(rhoprime, ZCoder.bytesLen);
        main_loop: for (let kappa = 0; ; ) {
          const y = [];
          for (let i = 0; i < L; i++, kappa++)
            y.push(ZCoder.decode(x256.get(kappa & 255, kappa >> 8)()));
          const z = y.map((i) => crystals.NTT.encode(i.slice()));
          const w = [];
          for (let i = 0; i < K; i++) {
            const wi = newPoly(N);
            for (let j = 0; j < L; j++)
              polyAdd(wi, MultiplyNTTs(A[i][j], z[j]));
            crystals.NTT.decode(wi);
            w.push(wi);
          }
          const w1 = w.map((j) => j.map(HighBits));
          const cTilde = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(w1)).digest();
          const cHat = crystals.NTT.encode(SampleInBall(cTilde));
          const cs1 = s1.map((i) => MultiplyNTTs(i, cHat));
          for (let i = 0; i < L; i++) {
            polyAdd(crystals.NTT.decode(cs1[i]), y[i]);
            if (polyChknorm(cs1[i], GAMMA1 - BETA))
              continue main_loop;
          }
          let cnt = 0;
          const h = [];
          for (let i = 0; i < K; i++) {
            const cs2 = crystals.NTT.decode(MultiplyNTTs(s2[i], cHat));
            const r0 = polySub(w[i], cs2).map(LowBits);
            if (polyChknorm(r0, GAMMA2 - BETA))
              continue main_loop;
            const ct0 = crystals.NTT.decode(MultiplyNTTs(t0[i], cHat));
            if (polyChknorm(ct0, GAMMA2))
              continue main_loop;
            polyAdd(r0, ct0);
            const hint = polyMakeHint(r0, w1[i]);
            h.push(hint.v);
            cnt += hint.cnt;
          }
          if (cnt > OMEGA)
            continue;
          x256.clean();
          const res = sigCoder.encode([cTilde, cs1, h]);
          cleanBytes(cTilde, cs1, h, cHat, w1, w, z, y, rhoprime, s1, s2, t0, ...A);
          if (!externalMu)
            cleanBytes(mu);
          return res;
        }
        throw new Error("Unreachable code path reached, report this error");
      },
      verify: (sig, msg, publicKey, opts2 = {}) => {
        validateInternalOpts(opts2);
        const { externalMu = false } = opts2;
        const [rho, t1] = publicCoder.decode(publicKey);
        const tr = shake256(publicKey, { dkLen: TR_BYTES });
        if (sig.length !== sigCoder.bytesLen)
          return false;
        const [cTilde, z, h] = sigCoder.decode(sig);
        if (h === false)
          return false;
        for (let i = 0; i < L; i++)
          if (polyChknorm(z[i], GAMMA1 - BETA))
            return false;
        const mu = externalMu ? msg : (
          // 7: µ ← H(tr||M, 512)
          shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest()
        );
        const c = crystals.NTT.encode(SampleInBall(cTilde));
        const zNtt = z.map((i) => i.slice());
        for (let i = 0; i < L; i++)
          crystals.NTT.encode(zNtt[i]);
        const wTick1 = [];
        const xof = XOF1282(rho);
        for (let i = 0; i < K; i++) {
          const ct12d = MultiplyNTTs(crystals.NTT.encode(polyShiftl(t1[i])), c);
          const Az = newPoly(N);
          for (let j = 0; j < L; j++) {
            const aij = RejNTTPoly(xof.get(j, i));
            polyAdd(Az, MultiplyNTTs(aij, zNtt[j]));
          }
          const wApprox = crystals.NTT.decode(polySub(Az, ct12d));
          wTick1.push(polyUseHint(wApprox, h[i]));
        }
        xof.clean();
        const c2 = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(wTick1)).digest();
        for (const t of h) {
          const sum = t.reduce((acc, i) => acc + i, 0);
          if (!(sum <= OMEGA))
            return false;
        }
        for (const t of z)
          if (polyChknorm(t, GAMMA1 - BETA))
            return false;
        return equalBytes(cTilde, c2);
      }
    });
    return Object.freeze({
      info: Object.freeze({ type: "ml-dsa" }),
      internal,
      securityLevel,
      keygen: internal.keygen,
      lengths: internal.lengths,
      getPublicKey: internal.getPublicKey,
      sign: (msg, secretKey, opts2 = {}) => {
        validateSigOpts(opts2);
        const M = getMessage(msg, opts2.context);
        const res = internal.sign(M, secretKey, opts2);
        cleanBytes(M);
        return res;
      },
      verify: (sig, msg, publicKey, opts2 = {}) => {
        validateVerOpts(opts2);
        return internal.verify(sig, getMessage(msg, opts2.context), publicKey);
      },
      prehash: (hash) => {
        checkHash(hash, securityLevel);
        return Object.freeze({
          info: Object.freeze({ type: "hashml-dsa" }),
          securityLevel,
          lengths: internal.lengths,
          keygen: internal.keygen,
          getPublicKey: internal.getPublicKey,
          sign: (msg, secretKey, opts2 = {}) => {
            validateSigOpts(opts2);
            const M = getMessagePrehash(hash, msg, opts2.context);
            const res = internal.sign(M, secretKey, opts2);
            cleanBytes(M);
            return res;
          },
          verify: (sig, msg, publicKey, opts2 = {}) => {
            validateVerOpts(opts2);
            return internal.verify(sig, getMessagePrehash(hash, msg, opts2.context), publicKey);
          }
        });
      }
    });
  }
  var ml_dsa87 = /* @__PURE__ */ (() => getDilithium({
    ...PARAMS[5],
    CRH_BYTES: 64,
    TR_BYTES: 64,
    C_TILDE_BYTES: 64,
    XOF128,
    XOF256,
    securityLevel: 256
  }))();

  // node_modules/@noble/hashes/hmac.js
  var _HMAC = class {
    oHash;
    iHash;
    blockLen;
    outputLen;
    canXOF = false;
    finished = false;
    destroyed = false;
    constructor(hash, key) {
      ahash(hash);
      abytes(key, void 0, "key");
      this.iHash = hash.create();
      if (typeof this.iHash.update !== "function")
        throw new Error("Expected instance of class which extends utils.Hash");
      this.blockLen = this.iHash.blockLen;
      this.outputLen = this.iHash.outputLen;
      const blockLen = this.blockLen;
      const pad = new Uint8Array(blockLen);
      pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
      for (let i = 0; i < pad.length; i++)
        pad[i] ^= 54;
      this.iHash.update(pad);
      this.oHash = hash.create();
      for (let i = 0; i < pad.length; i++)
        pad[i] ^= 54 ^ 92;
      this.oHash.update(pad);
      clean(pad);
    }
    update(buf) {
      aexists(this);
      this.iHash.update(buf);
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const buf = out.subarray(0, this.outputLen);
      this.iHash.digestInto(buf);
      this.oHash.update(buf);
      this.oHash.digestInto(buf);
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.oHash.outputLen);
      this.digestInto(out);
      return out;
    }
    _cloneInto(to) {
      to ||= Object.create(Object.getPrototypeOf(this), {});
      const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
      to = to;
      to.finished = finished;
      to.destroyed = destroyed;
      to.blockLen = blockLen;
      to.outputLen = outputLen;
      to.oHash = oHash._cloneInto(to.oHash);
      to.iHash = iHash._cloneInto(to.iHash);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
    destroy() {
      this.destroyed = true;
      this.oHash.destroy();
      this.iHash.destroy();
    }
  };
  var hmac = /* @__PURE__ */ (() => {
    const hmac_ = (hash, key, message) => new _HMAC(hash, key).update(message).digest();
    hmac_.create = (hash, key) => new _HMAC(hash, key);
    return hmac_;
  })();

  // node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class {
    blockLen;
    outputLen;
    canXOF = false;
    padOffset;
    isLE;
    // For partial updates less than block size
    buffer;
    view;
    finished = false;
    length = 0;
    pos = 0;
    destroyed = false;
    constructor(blockLen, outputLen, padOffset, isLE2) {
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE2;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { view, buffer, blockLen } = this;
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          continue;
        }
        buffer.set(data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
        }
      }
      this.length += data.length;
      this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE: isLE2 } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      clean(this.buffer.subarray(pos));
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        pos = 0;
      }
      for (let i = pos; i < blockLen; i++)
        buffer[i] = 0;
      view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE2);
      this.process(view, 0);
      const oview = createView(out);
      const len = this.outputLen;
      if (len % 4)
        throw new Error("_sha2: outputLen must be aligned to 32bit");
      const outLen = len / 4;
      const state = this.get();
      if (outLen > state.length)
        throw new Error("_sha2: outputLen bigger than state");
      for (let i = 0; i < outLen; i++)
        oview.setUint32(4 * i, state[i], isLE2);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneInto(to) {
      to ||= new this.constructor();
      to.set(...this.get());
      const { blockLen, buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (length % blockLen)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    4089235720,
    3144134277,
    2227873595,
    1013904242,
    4271175723,
    2773480762,
    1595750129,
    1359893119,
    2917565137,
    2600822924,
    725511199,
    528734635,
    4215389547,
    1541459225,
    327033209
  ]);

  // node_modules/@noble/hashes/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA2_32B = class extends HashMD {
    constructor(outputLen) {
      super(64, outputLen, 8, false);
    }
    get() {
      const { A, B, C, D: D2, E, F: F2, G, H } = this;
      return [A, B, C, D2, E, F2, G, H];
    }
    // prettier-ignore
    set(A, B, C, D2, E, F2, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D2 | 0;
      this.E = E | 0;
      this.F = F2 | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA256_W[i] = view.getUint32(offset, false);
      for (let i = 16; i < 64; i++) {
        const W15 = SHA256_W[i - 15];
        const W2 = SHA256_W[i - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
      }
      let { A, B, C, D: D2, E, F: F2, G, H } = this;
      for (let i = 0; i < 64; i++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F2, G) + SHA256_K[i] + SHA256_W[i] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B, C) | 0;
        H = G;
        G = F2;
        F2 = E;
        E = D2 + T1 | 0;
        D2 = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D2 = D2 + this.D | 0;
      E = E + this.E | 0;
      F2 = F2 + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D2, E, F2, G, H);
    }
    roundClean() {
      clean(SHA256_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var _SHA256 = class extends SHA2_32B {
    // We cannot use array here since array allows indexing by variable
    // which means optimizer/compiler cannot use registers.
    A = SHA256_IV[0] | 0;
    B = SHA256_IV[1] | 0;
    C = SHA256_IV[2] | 0;
    D = SHA256_IV[3] | 0;
    E = SHA256_IV[4] | 0;
    F = SHA256_IV[5] | 0;
    G = SHA256_IV[6] | 0;
    H = SHA256_IV[7] | 0;
    constructor() {
      super(32);
    }
  };
  var K512 = /* @__PURE__ */ (() => split([
    "0x428a2f98d728ae22",
    "0x7137449123ef65cd",
    "0xb5c0fbcfec4d3b2f",
    "0xe9b5dba58189dbbc",
    "0x3956c25bf348b538",
    "0x59f111f1b605d019",
    "0x923f82a4af194f9b",
    "0xab1c5ed5da6d8118",
    "0xd807aa98a3030242",
    "0x12835b0145706fbe",
    "0x243185be4ee4b28c",
    "0x550c7dc3d5ffb4e2",
    "0x72be5d74f27b896f",
    "0x80deb1fe3b1696b1",
    "0x9bdc06a725c71235",
    "0xc19bf174cf692694",
    "0xe49b69c19ef14ad2",
    "0xefbe4786384f25e3",
    "0x0fc19dc68b8cd5b5",
    "0x240ca1cc77ac9c65",
    "0x2de92c6f592b0275",
    "0x4a7484aa6ea6e483",
    "0x5cb0a9dcbd41fbd4",
    "0x76f988da831153b5",
    "0x983e5152ee66dfab",
    "0xa831c66d2db43210",
    "0xb00327c898fb213f",
    "0xbf597fc7beef0ee4",
    "0xc6e00bf33da88fc2",
    "0xd5a79147930aa725",
    "0x06ca6351e003826f",
    "0x142929670a0e6e70",
    "0x27b70a8546d22ffc",
    "0x2e1b21385c26c926",
    "0x4d2c6dfc5ac42aed",
    "0x53380d139d95b3df",
    "0x650a73548baf63de",
    "0x766a0abb3c77b2a8",
    "0x81c2c92e47edaee6",
    "0x92722c851482353b",
    "0xa2bfe8a14cf10364",
    "0xa81a664bbc423001",
    "0xc24b8b70d0f89791",
    "0xc76c51a30654be30",
    "0xd192e819d6ef5218",
    "0xd69906245565a910",
    "0xf40e35855771202a",
    "0x106aa07032bbd1b8",
    "0x19a4c116b8d2d0c8",
    "0x1e376c085141ab53",
    "0x2748774cdf8eeb99",
    "0x34b0bcb5e19b48a8",
    "0x391c0cb3c5c95a63",
    "0x4ed8aa4ae3418acb",
    "0x5b9cca4f7763e373",
    "0x682e6ff3d6b2b8a3",
    "0x748f82ee5defb2fc",
    "0x78a5636f43172f60",
    "0x84c87814a1f0ab72",
    "0x8cc702081a6439ec",
    "0x90befffa23631e28",
    "0xa4506cebde82bde9",
    "0xbef9a3f7b2c67915",
    "0xc67178f2e372532b",
    "0xca273eceea26619c",
    "0xd186b8c721c0c207",
    "0xeada7dd6cde0eb1e",
    "0xf57d4f7fee6ed178",
    "0x06f067aa72176fba",
    "0x0a637dc5a2c898a6",
    "0x113f9804bef90dae",
    "0x1b710b35131c471b",
    "0x28db77f523047d84",
    "0x32caab7b40c72493",
    "0x3c9ebe0a15c9bebc",
    "0x431d67c49c100d4c",
    "0x4cc5d4becb3e42b6",
    "0x597f299cfc657e2a",
    "0x5fcb6fab3ad6faec",
    "0x6c44198c4a475817"
  ].map((n) => BigInt(n))))();
  var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
  var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
  var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
  var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
  var SHA2_64B = class extends HashMD {
    constructor(outputLen) {
      super(128, outputLen, 16, false);
    }
    // prettier-ignore
    get() {
      const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
      return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
    }
    // prettier-ignore
    set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
      this.Ah = Ah | 0;
      this.Al = Al | 0;
      this.Bh = Bh | 0;
      this.Bl = Bl | 0;
      this.Ch = Ch | 0;
      this.Cl = Cl | 0;
      this.Dh = Dh | 0;
      this.Dl = Dl | 0;
      this.Eh = Eh | 0;
      this.El = El | 0;
      this.Fh = Fh | 0;
      this.Fl = Fl | 0;
      this.Gh = Gh | 0;
      this.Gl = Gl | 0;
      this.Hh = Hh | 0;
      this.Hl = Hl | 0;
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4) {
        SHA512_W_H[i] = view.getUint32(offset);
        SHA512_W_L[i] = view.getUint32(offset += 4);
      }
      for (let i = 16; i < 80; i++) {
        const W15h = SHA512_W_H[i - 15] | 0;
        const W15l = SHA512_W_L[i - 15] | 0;
        const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
        const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
        const W2h = SHA512_W_H[i - 2] | 0;
        const W2l = SHA512_W_L[i - 2] | 0;
        const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
        const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
        const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
        const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
        SHA512_W_H[i] = SUMh | 0;
        SHA512_W_L[i] = SUMl | 0;
      }
      let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
      for (let i = 0; i < 80; i++) {
        const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
        const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
        const CHIh = Eh & Fh ^ ~Eh & Gh;
        const CHIl = El & Fl ^ ~El & Gl;
        const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
        const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
        const T1l = T1ll | 0;
        const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
        const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
        const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
        const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
        Hh = Gh | 0;
        Hl = Gl | 0;
        Gh = Fh | 0;
        Gl = Fl | 0;
        Fh = Eh | 0;
        Fl = El | 0;
        ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
        Dh = Ch | 0;
        Dl = Cl | 0;
        Ch = Bh | 0;
        Cl = Bl | 0;
        Bh = Ah | 0;
        Bl = Al | 0;
        const All = add3L(T1l, sigma0l, MAJl);
        Ah = add3H(All, T1h, sigma0h, MAJh);
        Al = All | 0;
      }
      ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
      ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
      ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
      ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
      ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
      ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
      ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
      ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
      this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
    }
    roundClean() {
      clean(SHA512_W_H, SHA512_W_L);
    }
    destroy() {
      this.destroyed = true;
      clean(this.buffer);
      this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  };
  var _SHA512 = class extends SHA2_64B {
    Ah = SHA512_IV[0] | 0;
    Al = SHA512_IV[1] | 0;
    Bh = SHA512_IV[2] | 0;
    Bl = SHA512_IV[3] | 0;
    Ch = SHA512_IV[4] | 0;
    Cl = SHA512_IV[5] | 0;
    Dh = SHA512_IV[6] | 0;
    Dl = SHA512_IV[7] | 0;
    Eh = SHA512_IV[8] | 0;
    El = SHA512_IV[9] | 0;
    Fh = SHA512_IV[10] | 0;
    Fl = SHA512_IV[11] | 0;
    Gh = SHA512_IV[12] | 0;
    Gl = SHA512_IV[13] | 0;
    Hh = SHA512_IV[14] | 0;
    Hl = SHA512_IV[15] | 0;
    constructor() {
      super(64);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(
    () => new _SHA256(),
    /* @__PURE__ */ oidNist(1)
  );
  var sha512 = /* @__PURE__ */ createHasher(
    () => new _SHA512(),
    /* @__PURE__ */ oidNist(3)
  );

  // node_modules/@noble/post-quantum/slh-dsa.js
  /*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
  var PARAMS2 = /* @__PURE__ */ (() => Object.freeze({
    "128f": Object.freeze({ W: 16, N: 16, H: 66, D: 22, K: 33, A: 6, securityLevel: 128 }),
    "128s": Object.freeze({ W: 16, N: 16, H: 63, D: 7, K: 14, A: 12, securityLevel: 128 }),
    "192f": Object.freeze({ W: 16, N: 24, H: 66, D: 22, K: 33, A: 8, securityLevel: 192 }),
    "192s": Object.freeze({ W: 16, N: 24, H: 63, D: 7, K: 17, A: 14, securityLevel: 192 }),
    "256f": Object.freeze({ W: 16, N: 32, H: 68, D: 17, K: 35, A: 9, securityLevel: 256 }),
    "256s": Object.freeze({ W: 16, N: 32, H: 64, D: 8, K: 22, A: 14, securityLevel: 256 })
  }))();
  var AddressType = {
    WOTS: 0,
    WOTSPK: 1,
    HASHTREE: 2,
    FORSTREE: 3,
    FORSPK: 4,
    WOTSPRF: 5,
    FORSPRF: 6
  };
  function hexToNumber(hex) {
    if (typeof hex !== "string")
      throw new Error("hex string expected, got " + typeof hex);
    return BigInt(hex === "" ? "0" : "0x" + hex);
  }
  function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex(bytes));
  }
  function numberToBytesBE(n, len) {
    return hexToBytes(n.toString(16).padStart(len * 2, "0"));
  }
  var base2b = (outLen, b) => {
    const mask = getMask(b);
    return (bytes) => {
      const baseB = new Uint32Array(outLen);
      for (let out = 0, pos = 0, bits = 0, total = 0; out < outLen; out++) {
        while (bits < b) {
          total = total << 8 | bytes[pos++];
          bits += 8;
        }
        bits -= b;
        baseB[out] = total >>> bits & mask;
      }
      return baseB;
    };
  };
  function getMaskBig(bits) {
    return (1n << BigInt(bits)) - 1n;
  }
  function gen(opts, hashOpts_) {
    const hashOpts = hashOpts_;
    const { N: N2, W, H, D: D2, K, A, securityLevel } = opts;
    const getContext = hashOpts.getContext(opts);
    if (W !== 16)
      throw new Error("Unsupported Winternitz parameter");
    const WOTS_LOGW = 4;
    const WOTS_LEN1 = Math.floor(8 * N2 / WOTS_LOGW);
    const WOTS_LEN2 = N2 <= 8 ? 2 : N2 <= 136 ? 3 : 4;
    const TREE_HEIGHT = Math.floor(H / D2);
    const WOTS_LEN = WOTS_LEN1 + WOTS_LEN2;
    let ADDR_BYTES = 22;
    let OFFSET_LAYER = 0;
    let OFFSET_TREE = 1;
    let OFFSET_TYPE = 9;
    let OFFSET_KP_ADDR2 = 12;
    let OFFSET_KP_ADDR1 = 13;
    let OFFSET_CHAIN_ADDR = 17;
    let OFFSET_TREE_INDEX = 18;
    let OFFSET_HASH_ADDR = 21;
    if (!hashOpts.isCompressed) {
      ADDR_BYTES = 32;
      OFFSET_LAYER += 3;
      OFFSET_TREE += 7;
      OFFSET_TYPE += 10;
      OFFSET_KP_ADDR2 += 10;
      OFFSET_KP_ADDR1 += 10;
      OFFSET_CHAIN_ADDR += 10;
      OFFSET_TREE_INDEX += 10;
      OFFSET_HASH_ADDR += 10;
    }
    const setAddr = (opts2, addr = new Uint8Array(ADDR_BYTES)) => {
      const { type, height, tree, layer, index, chain, hash, keypair } = opts2;
      const { subtreeAddr, keypairAddr } = opts2;
      const v = createView(addr);
      if (height !== void 0)
        addr[OFFSET_CHAIN_ADDR] = height;
      if (layer !== void 0)
        addr[OFFSET_LAYER] = layer;
      if (type !== void 0)
        addr[OFFSET_TYPE] = type;
      if (chain !== void 0)
        addr[OFFSET_CHAIN_ADDR] = chain;
      if (hash !== void 0)
        addr[OFFSET_HASH_ADDR] = hash;
      if (index !== void 0)
        v.setUint32(OFFSET_TREE_INDEX, index, false);
      if (subtreeAddr)
        addr.set(subtreeAddr.subarray(0, OFFSET_TREE + 8));
      if (tree !== void 0)
        v.setBigUint64(OFFSET_TREE, tree, false);
      if (keypair !== void 0) {
        addr[OFFSET_KP_ADDR1] = keypair;
        if (TREE_HEIGHT > 8)
          addr[OFFSET_KP_ADDR2] = keypair >>> 8;
      }
      if (keypairAddr) {
        addr.set(keypairAddr.subarray(0, OFFSET_TREE + 8));
        addr[OFFSET_KP_ADDR1] = keypairAddr[OFFSET_KP_ADDR1];
        if (TREE_HEIGHT > 8)
          addr[OFFSET_KP_ADDR2] = keypairAddr[OFFSET_KP_ADDR2];
      }
      return addr;
    };
    const chainCoder = base2b(WOTS_LEN2, WOTS_LOGW);
    const chainLengths = (msg) => {
      const W1 = base2b(WOTS_LEN1, WOTS_LOGW)(msg);
      let csum = 0;
      for (let i = 0; i < W1.length; i++)
        csum += W - 1 - W1[i];
      csum <<= (8 - WOTS_LEN2 * WOTS_LOGW % 8) % 8;
      const W2 = chainCoder(numberToBytesBE(csum, Math.ceil(WOTS_LEN2 * WOTS_LOGW / 8)));
      const lengths = new Uint32Array(WOTS_LEN);
      lengths.set(W1);
      lengths.set(W2, W1.length);
      return lengths;
    };
    const messageToIndices = base2b(K, A);
    const TREE_BITS = TREE_HEIGHT * (D2 - 1);
    const LEAF_BITS = TREE_HEIGHT;
    const hashMsgCoder = splitCoder("hashedMessage", Math.ceil(A * K / 8), Math.ceil(TREE_BITS / 8), Math.ceil(TREE_HEIGHT / 8));
    const hashMessage = (R, pkSeed, msg, context) => {
      const rawContext = context;
      const digest = rawContext.Hmsg(R, pkSeed, msg, hashMsgCoder.bytesLen);
      const [md, tmpIdxTree, tmpIdxLeaf] = hashMsgCoder.decode(digest);
      const tree = bytesToNumberBE(tmpIdxTree) & getMaskBig(TREE_BITS);
      const leafIdx = Number(bytesToNumberBE(tmpIdxLeaf)) & getMask(LEAF_BITS);
      return { tree, leafIdx, md };
    };
    const treehash = (height, fn) => function treehash_i(context, leafIdx, idxOffset, treeAddr, info) {
      const rawContext = context;
      const leafFn = fn;
      const maxIdx = (1 << height) - 1;
      const stack = new Uint8Array(height * N2);
      const authPath = new Uint8Array(height * N2);
      for (let idx = 0; ; idx++) {
        const current = new Uint8Array(2 * N2);
        const cur0 = current.subarray(0, N2);
        const cur1 = current.subarray(N2);
        const addrOffset = idx + idxOffset;
        cur1.set(leafFn(leafIdx, addrOffset, rawContext, info));
        let h = 0;
        for (let i = idx, o = idxOffset, l = leafIdx; ; h++, i >>>= 1, l >>>= 1, o >>>= 1) {
          if (h === height)
            return { root: cur1, authPath };
          if ((i ^ l) === 1)
            authPath.subarray(h * N2).set(cur1);
          if ((i & 1) === 0 && idx < maxIdx)
            break;
          setAddr({ height: h + 1, index: (i >> 1) + (o >> 1) }, treeAddr);
          cur0.set(stack.subarray(h * N2).subarray(0, N2));
          cur1.set(rawContext.thashN(2, current, treeAddr));
        }
        stack.subarray(h * N2).set(cur1);
      }
      throw new Error("Unreachable code path reached, report this error");
    };
    const wotsTreehash = treehash(TREE_HEIGHT, (leafIdx, addrOffset, context, info) => {
      const rawContext = context;
      const wotsPk = new Uint8Array(WOTS_LEN * N2);
      const wotsKmask = addrOffset === leafIdx ? 0 : ~0 >>> 0;
      setAddr({ keypair: addrOffset }, info.leafAddr);
      setAddr({ keypair: addrOffset }, info.pkAddr);
      for (let i = 0; i < WOTS_LEN; i++) {
        const wotsK = info.wotsSteps[i] | wotsKmask;
        const pk = wotsPk.subarray(i * N2, (i + 1) * N2);
        setAddr({ chain: i, hash: 0, type: AddressType.WOTSPRF }, info.leafAddr);
        pk.set(rawContext.PRFaddr(info.leafAddr));
        setAddr({ type: AddressType.WOTS }, info.leafAddr);
        for (let k = 0; ; k++) {
          if (k === wotsK)
            info.wotsSig.subarray(i * N2).set(pk);
          if (k === W - 1)
            break;
          setAddr({ hash: k }, info.leafAddr);
          pk.set(rawContext.thash1(pk, info.leafAddr));
        }
      }
      return rawContext.thashN(WOTS_LEN, wotsPk, info.pkAddr);
    });
    const forsTreehash = treehash(A, (_, addrOffset, context, forsLeafAddr) => {
      const rawContext = context;
      setAddr({ type: AddressType.FORSPRF, index: addrOffset }, forsLeafAddr);
      const prf = rawContext.PRFaddr(forsLeafAddr);
      setAddr({ type: AddressType.FORSTREE }, forsLeafAddr);
      return rawContext.thash1(prf, forsLeafAddr);
    });
    const merkleSign = (context, wotsAddr, treeAddr, leafIdx, prevRoot = new Uint8Array(N2)) => {
      setAddr({ type: AddressType.HASHTREE }, treeAddr);
      const info = {
        wotsSig: new Uint8Array(wotsCoder.bytesLen),
        wotsSteps: chainLengths(prevRoot),
        leafAddr: setAddr({ subtreeAddr: wotsAddr }),
        pkAddr: setAddr({ type: AddressType.WOTSPK, subtreeAddr: wotsAddr })
      };
      const { root, authPath } = wotsTreehash(context, leafIdx, 0, treeAddr, info);
      return {
        root,
        sigWots: info.wotsSig.subarray(0, WOTS_LEN * N2),
        sigAuth: authPath
      };
    };
    const computeRoot = (leaf, leafIdx, idxOffset, authPath, treeHeight, context, addr) => {
      const rawContext = context;
      const buffer = new Uint8Array(2 * N2);
      const b0 = buffer.subarray(0, N2);
      const b1 = buffer.subarray(N2, 2 * N2);
      if ((leafIdx & 1) !== 0) {
        b1.set(leaf.subarray(0, N2));
        b0.set(authPath.subarray(0, N2));
      } else {
        b0.set(leaf.subarray(0, N2));
        b1.set(authPath.subarray(0, N2));
      }
      leafIdx >>>= 1;
      idxOffset >>>= 1;
      for (let i = 0; i < treeHeight - 1; i++, leafIdx >>= 1, idxOffset >>= 1) {
        setAddr({ height: i + 1, index: leafIdx + idxOffset }, addr);
        const a = authPath.subarray((i + 1) * N2, (i + 2) * N2);
        if ((leafIdx & 1) !== 0) {
          b1.set(rawContext.thashN(2, buffer, addr));
          b0.set(a);
        } else {
          buffer.set(rawContext.thashN(2, buffer, addr));
          b1.set(a);
        }
      }
      setAddr({ height: treeHeight, index: leafIdx + idxOffset }, addr);
      return rawContext.thashN(2, buffer, addr);
    };
    const seedCoder = splitCoder("seed", N2, N2, N2);
    const publicCoder = splitCoder("publicKey", N2, N2);
    const secretCoder = splitCoder("secretKey", N2, N2, publicCoder.bytesLen);
    const forsCoder = vecCoder(splitCoder("fors", N2, N2 * A), K);
    const wotsCoder = vecCoder(splitCoder("wots", WOTS_LEN * N2, TREE_HEIGHT * N2), D2);
    const sigCoder = splitCoder("signature", N2, forsCoder, wotsCoder);
    const internal = Object.freeze({
      info: Object.freeze({ type: "internal-slh-dsa" }),
      lengths: Object.freeze({
        publicKey: publicCoder.bytesLen,
        secretKey: secretCoder.bytesLen,
        signature: sigCoder.bytesLen,
        seed: seedCoder.bytesLen,
        signRand: N2
      }),
      keygen(seed) {
        if (seed !== void 0)
          abytesDoc(seed, seedCoder.bytesLen, "seed");
        seed = seed === void 0 ? randomBytes2(seedCoder.bytesLen) : copyBytes2(seed);
        const [secretSeed, secretPRF, publicSeed] = seedCoder.decode(seed);
        const context = getContext(publicSeed, secretSeed);
        const topTreeAddr = setAddr({ layer: D2 - 1 });
        const wotsAddr = setAddr({ layer: D2 - 1 });
        const { root } = merkleSign(context, wotsAddr, topTreeAddr, ~0 >>> 0);
        const publicKey = publicCoder.encode([publicSeed, root]);
        const secretKey = secretCoder.encode([secretSeed, secretPRF, publicKey]);
        context.clean();
        cleanBytes(secretSeed, secretPRF, root, wotsAddr, topTreeAddr);
        return {
          publicKey,
          secretKey
        };
      },
      getPublicKey: (secretKey) => {
        const [_skSeed, _skPRF, pk] = secretCoder.decode(secretKey);
        return Uint8Array.from(pk);
      },
      sign: (msg, sk, opts2 = {}) => {
        validateSigOpts(opts2);
        let { extraEntropy: random } = opts2;
        const [skSeed, skPRF, pk] = secretCoder.decode(sk);
        const [pkSeed, _] = publicCoder.decode(pk);
        if (random === false)
          random = copyBytes2(pkSeed);
        else if (random === void 0)
          random = randomBytes2(N2);
        else
          random = copyBytes2(random);
        abytesDoc(random, N2);
        const context = getContext(pkSeed, skSeed);
        const R = context.PRFmsg(skPRF, random, msg);
        let { tree, leafIdx, md } = hashMessage(R, pk, msg, context);
        const wotsAddr = setAddr({
          type: AddressType.WOTS,
          tree,
          keypair: leafIdx
        });
        const roots = [];
        const forsLeaf = setAddr({ keypairAddr: wotsAddr });
        const forsTreeAddr = setAddr({ keypairAddr: wotsAddr });
        const indices = messageToIndices(md);
        const fors = [];
        for (let i = 0; i < indices.length; i++) {
          const idxOffset = i << A;
          setAddr({
            type: AddressType.FORSPRF,
            height: 0,
            index: indices[i] + idxOffset
          }, forsTreeAddr);
          const prf = context.PRFaddr(forsTreeAddr);
          setAddr({ type: AddressType.FORSTREE }, forsTreeAddr);
          const { root: root2, authPath } = forsTreehash(context, indices[i], idxOffset, forsTreeAddr, forsLeaf);
          roots.push(root2);
          fors.push([prf, authPath]);
        }
        const forsPkAddr = setAddr({
          type: AddressType.FORSPK,
          keypairAddr: wotsAddr
        });
        const root = context.thashN(K, concatBytes(...roots), forsPkAddr);
        const treeAddr = setAddr({ type: AddressType.HASHTREE });
        const wots = [];
        for (let i = 0; i < D2; i++, tree >>= BigInt(TREE_HEIGHT)) {
          setAddr({ tree, layer: i }, treeAddr);
          setAddr({ subtreeAddr: treeAddr, keypair: leafIdx }, wotsAddr);
          const { sigWots, sigAuth, root: r } = merkleSign(context, wotsAddr, treeAddr, leafIdx, root);
          root.set(r);
          cleanBytes(r);
          wots.push([sigWots, sigAuth]);
          leafIdx = Number(tree & getMaskBig(TREE_HEIGHT));
        }
        context.clean();
        const SIG = sigCoder.encode([R, fors, wots]);
        cleanBytes(R, random, treeAddr, wotsAddr, forsLeaf, forsTreeAddr, indices, roots);
        return SIG;
      },
      verify: (sig, msg, publicKey) => {
        const [pkSeed, pubRoot] = publicCoder.decode(publicKey);
        const [random, forsVec, wotsVec] = sigCoder.decode(sig);
        const pk = publicKey;
        if (sig.length !== sigCoder.bytesLen)
          return false;
        const context = getContext(pkSeed);
        let { tree, leafIdx, md } = hashMessage(random, pk, msg, context);
        const wotsAddr = setAddr({
          type: AddressType.WOTS,
          tree,
          keypair: leafIdx
        });
        const roots = [];
        const forsTreeAddr = setAddr({
          type: AddressType.FORSTREE,
          keypairAddr: wotsAddr
        });
        const indices = messageToIndices(md);
        for (let i = 0; i < forsVec.length; i++) {
          const [prf, authPath] = forsVec[i];
          const idxOffset = i << A;
          setAddr({ height: 0, index: indices[i] + idxOffset }, forsTreeAddr);
          const leaf = context.thash1(prf, forsTreeAddr);
          roots.push(computeRoot(leaf, indices[i], idxOffset, authPath, A, context, forsTreeAddr));
        }
        const forsPkAddr = setAddr({
          type: AddressType.FORSPK,
          keypairAddr: wotsAddr
        });
        let root = context.thashN(K, concatBytes(...roots), forsPkAddr);
        const treeAddr = setAddr({ type: AddressType.HASHTREE });
        const wotsPkAddr = setAddr({ type: AddressType.WOTSPK });
        const wotsPk = new Uint8Array(WOTS_LEN * N2);
        for (let i = 0; i < wotsVec.length; i++, tree >>= BigInt(TREE_HEIGHT)) {
          const [wots, sigAuth] = wotsVec[i];
          setAddr({ tree, layer: i }, treeAddr);
          setAddr({ subtreeAddr: treeAddr, keypair: leafIdx }, wotsAddr);
          setAddr({ keypairAddr: wotsAddr }, wotsPkAddr);
          const lengths = chainLengths(root);
          for (let i2 = 0; i2 < WOTS_LEN; i2++) {
            setAddr({ chain: i2 }, wotsAddr);
            const steps = W - 1 - lengths[i2];
            const start = lengths[i2];
            const out = wotsPk.subarray(i2 * N2);
            out.set(wots.subarray(i2 * N2, (i2 + 1) * N2));
            for (let j = start; j < start + steps && j < W; j++) {
              setAddr({ hash: j }, wotsAddr);
              out.set(context.thash1(out, wotsAddr));
            }
          }
          const leaf = context.thashN(WOTS_LEN, wotsPk, wotsPkAddr);
          root = computeRoot(leaf, leafIdx, 0, sigAuth, TREE_HEIGHT, context, treeAddr);
          leafIdx = Number(tree & getMaskBig(TREE_HEIGHT));
        }
        return equalBytes(root, pubRoot);
      }
    });
    return Object.freeze({
      info: Object.freeze({ type: "slh-dsa" }),
      internal,
      securityLevel,
      lengths: internal.lengths,
      keygen: internal.keygen,
      getPublicKey: internal.getPublicKey,
      sign: (msg, secretKey, opts2 = {}) => {
        validateSigOpts(opts2);
        const M = getMessage(msg, opts2.context);
        const res = internal.sign(M, secretKey, opts2);
        cleanBytes(M);
        return res;
      },
      verify: (sig, msg, publicKey, opts2 = {}) => {
        validateVerOpts(opts2);
        return internal.verify(sig, getMessage(msg, opts2.context), publicKey);
      },
      prehash: (hash) => {
        checkHash(hash, securityLevel);
        const rawHash = hash;
        return Object.freeze({
          info: Object.freeze({ type: "hashslh-dsa" }),
          lengths: internal.lengths,
          keygen: internal.keygen,
          getPublicKey: internal.getPublicKey,
          sign: (msg, secretKey, opts2 = {}) => {
            validateSigOpts(opts2);
            const M = getMessagePrehash(rawHash, msg, opts2.context);
            const res = internal.sign(M, secretKey, opts2);
            cleanBytes(M);
            return res;
          },
          verify: (sig, msg, publicKey, opts2 = {}) => {
            validateVerOpts(opts2);
            return internal.verify(sig, getMessagePrehash(rawHash, msg, opts2.context), publicKey);
          }
        });
      }
    });
  }
  var genSha = (h0, h1) => (opts) => (pub_seed, sk_seed) => {
    const { N: N2 } = opts;
    const stats = { prf: 0, thash: 0, hmsg: 0, gen_message_random: 0, mgf1: 0 };
    const counterB = new Uint8Array(4);
    const counterV = createView(counterB);
    const h0ps = h0.create().update(pub_seed).update(new Uint8Array(h0.blockLen - N2));
    const h1ps = h1.create().update(pub_seed).update(new Uint8Array(h1.blockLen - N2));
    const h0tmp = h0ps.clone();
    const h1tmp = h1ps.clone();
    function mgf1(seed, length, hash) {
      stats.mgf1++;
      const out = new Uint8Array(Math.ceil(length / hash.outputLen) * hash.outputLen);
      if (length > 2 ** 32)
        throw new Error("mask too long");
      for (let counter = 0, o = out; o.length; counter++) {
        counterV.setUint32(0, counter, false);
        hash.create().update(seed).update(counterB).digestInto(o);
        o = o.subarray(hash.outputLen);
      }
      cleanBytes(out.subarray(length));
      return out.subarray(0, length);
    }
    const thash = (_, h, hTmp) => (blocks, input, addr) => {
      stats.thash++;
      const d = h._cloneInto(hTmp).update(addr).update(input.subarray(0, blocks * N2)).digest();
      return d.subarray(0, N2);
    };
    return {
      PRFaddr: (addr) => {
        if (!sk_seed)
          throw new Error("No sk seed");
        stats.prf++;
        const res = h0ps._cloneInto(h0tmp).update(addr).update(sk_seed).digest().subarray(0, N2);
        return res;
      },
      PRFmsg: (skPRF, random, msg) => {
        stats.gen_message_random++;
        return hmac.create(h1, skPRF).update(random).update(msg).digest().subarray(0, N2);
      },
      Hmsg: (R, pk, m, outLen) => {
        stats.hmsg++;
        const seed = concatBytes(R.subarray(0, N2), pk.subarray(0, N2), h1.create().update(R.subarray(0, N2)).update(pk).update(m).digest());
        return mgf1(seed, outLen, h1);
      },
      thash1: thash(h0, h0ps, h0tmp).bind(null, 1),
      thashN: thash(h1, h1ps, h1tmp),
      clean: () => {
        h0ps.destroy();
        h1ps.destroy();
        h0tmp.destroy();
        h1tmp.destroy();
      }
    };
  };
  var SHA512_SIMPLE = /* @__PURE__ */ (() => ({
    isCompressed: true,
    getContext: genSha(sha256, sha512)
  }))();
  var slh_dsa_sha2_256f = /* @__PURE__ */ (() => gen(PARAMS2["256f"], SHA512_SIMPLE))();

  // node_modules/@noble/hashes/hkdf.js
  function extract(hash, ikm, salt) {
    ahash(hash);
    if (salt === void 0)
      salt = new Uint8Array(hash.outputLen);
    return hmac(hash, salt, ikm);
  }
  var HKDF_COUNTER = /* @__PURE__ */ Uint8Array.of(0);
  var EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();
  function expand(hash, prk, info, length = 32) {
    ahash(hash);
    anumber(length, "length");
    abytes(prk, void 0, "prk");
    const olen = hash.outputLen;
    if (prk.length < olen)
      throw new Error('"prk" must be at least HashLen octets');
    if (length > 255 * olen)
      throw new Error("Length must be <= 255*HashLen");
    const blocks = Math.ceil(length / olen);
    if (info === void 0)
      info = EMPTY_BUFFER;
    else
      abytes(info, void 0, "info");
    const okm = new Uint8Array(blocks * olen);
    const HMAC = hmac.create(hash, prk);
    const HMACTmp = HMAC._cloneInto();
    const T = new Uint8Array(HMAC.outputLen);
    for (let counter = 0; counter < blocks; counter++) {
      HKDF_COUNTER[0] = counter + 1;
      HMACTmp.update(counter === 0 ? EMPTY_BUFFER : T).update(info).update(HKDF_COUNTER).digestInto(T);
      okm.set(T, olen * counter);
      HMAC._cloneInto(HMACTmp);
    }
    HMAC.destroy();
    HMACTmp.destroy();
    clean(T, HKDF_COUNTER);
    return okm.slice(0, length);
  }
  var hkdf = (hash, ikm, salt, info, length) => expand(hash, extract(hash, ikm, salt), info, length);

  // node_modules/@noble/hashes/_blake.js
  function G1s(a, b, c, d, x) {
    a = a + b + x | 0;
    d = rotr(d ^ a, 16);
    c = c + d | 0;
    b = rotr(b ^ c, 12);
    return { a, b, c, d };
  }
  function G2s(a, b, c, d, x) {
    a = a + b + x | 0;
    d = rotr(d ^ a, 8);
    c = c + d | 0;
    b = rotr(b ^ c, 7);
    return { a, b, c, d };
  }

  // node_modules/@noble/hashes/blake2.js
  var _BLAKE2 = class {
    buffer;
    buffer32;
    finished = false;
    destroyed = false;
    length = 0;
    pos = 0;
    blockLen;
    outputLen;
    canXOF = false;
    constructor(blockLen, outputLen) {
      anumber(blockLen);
      anumber(outputLen);
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.buffer = new Uint8Array(blockLen);
      this.buffer32 = u32(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { blockLen, buffer, buffer32 } = this;
      const len = data.length;
      const offset = data.byteOffset;
      const buf = data.buffer;
      for (let pos = 0; pos < len; ) {
        if (this.pos === blockLen) {
          swap32IfBE(buffer32);
          this.compress(buffer32, 0, false);
          swap32IfBE(buffer32);
          this.pos = 0;
        }
        const take = Math.min(blockLen - this.pos, len - pos);
        const dataOffset = offset + pos;
        if (take === blockLen && !(dataOffset % 4) && pos + take < len) {
          const data32 = new Uint32Array(buf, dataOffset, Math.floor((len - pos) / 4));
          swap32IfBE(data32);
          for (let pos32 = 0; pos + blockLen < len; pos32 += buffer32.length, pos += blockLen) {
            this.length += blockLen;
            this.compress(data32, pos32, false);
          }
          swap32IfBE(data32);
          continue;
        }
        buffer.set(data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        this.length += take;
        pos += take;
      }
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      const { pos, buffer32 } = this;
      this.finished = true;
      clean(this.buffer.subarray(pos));
      swap32IfBE(buffer32);
      this.compress(buffer32, 0, true);
      swap32IfBE(buffer32);
      if (out.byteOffset & 3)
        throw new RangeError('"digestInto() output" expected 4-byte aligned byteOffset, got ' + out.byteOffset);
      const state = this.get();
      const out32 = u32(out);
      const full = Math.floor(this.outputLen / 4);
      for (let i = 0; i < full; i++)
        out32[i] = swap8IfBE(state[i]);
      const tail = this.outputLen % 4;
      if (!tail)
        return;
      const off = full * 4;
      const word = state[full];
      for (let i = 0; i < tail; i++)
        out[off + i] = word >>> 8 * i;
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneInto(to) {
      const { buffer, length, finished, destroyed, outputLen, pos } = this;
      to ||= new this.constructor({ dkLen: outputLen });
      to.set(...this.get());
      to.buffer.set(buffer);
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      to.outputLen = outputLen;
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  function compress(s, offset, msg, rounds, v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15) {
    let j = 0;
    for (let i = 0; i < rounds; i++) {
      ({ a: v0, b: v4, c: v8, d: v12 } = G1s(v0, v4, v8, v12, msg[offset + s[j++]]));
      ({ a: v0, b: v4, c: v8, d: v12 } = G2s(v0, v4, v8, v12, msg[offset + s[j++]]));
      ({ a: v1, b: v5, c: v9, d: v13 } = G1s(v1, v5, v9, v13, msg[offset + s[j++]]));
      ({ a: v1, b: v5, c: v9, d: v13 } = G2s(v1, v5, v9, v13, msg[offset + s[j++]]));
      ({ a: v2, b: v6, c: v10, d: v14 } = G1s(v2, v6, v10, v14, msg[offset + s[j++]]));
      ({ a: v2, b: v6, c: v10, d: v14 } = G2s(v2, v6, v10, v14, msg[offset + s[j++]]));
      ({ a: v3, b: v7, c: v11, d: v15 } = G1s(v3, v7, v11, v15, msg[offset + s[j++]]));
      ({ a: v3, b: v7, c: v11, d: v15 } = G2s(v3, v7, v11, v15, msg[offset + s[j++]]));
      ({ a: v0, b: v5, c: v10, d: v15 } = G1s(v0, v5, v10, v15, msg[offset + s[j++]]));
      ({ a: v0, b: v5, c: v10, d: v15 } = G2s(v0, v5, v10, v15, msg[offset + s[j++]]));
      ({ a: v1, b: v6, c: v11, d: v12 } = G1s(v1, v6, v11, v12, msg[offset + s[j++]]));
      ({ a: v1, b: v6, c: v11, d: v12 } = G2s(v1, v6, v11, v12, msg[offset + s[j++]]));
      ({ a: v2, b: v7, c: v8, d: v13 } = G1s(v2, v7, v8, v13, msg[offset + s[j++]]));
      ({ a: v2, b: v7, c: v8, d: v13 } = G2s(v2, v7, v8, v13, msg[offset + s[j++]]));
      ({ a: v3, b: v4, c: v9, d: v14 } = G1s(v3, v4, v9, v14, msg[offset + s[j++]]));
      ({ a: v3, b: v4, c: v9, d: v14 } = G2s(v3, v4, v9, v14, msg[offset + s[j++]]));
    }
    return { v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15 };
  }

  // node_modules/@noble/hashes/blake3.js
  var B3_Flags = {
    CHUNK_START: 1,
    CHUNK_END: 2,
    PARENT: 4,
    ROOT: 8,
    KEYED_HASH: 16,
    DERIVE_KEY_CONTEXT: 32,
    DERIVE_KEY_MATERIAL: 64
  };
  var B3_IV = /* @__PURE__ */ SHA256_IV.slice();
  var B3_SIGMA = /* @__PURE__ */ (() => {
    const Id = Array.from({ length: 16 }, (_, i) => i);
    const permute = (arr) => [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8].map((i) => arr[i]);
    const res = [];
    for (let i = 0, v = Id; i < 7; i++, v = permute(v))
      res.push(...v);
    return Uint8Array.from(res);
  })();
  var _BLAKE3 = class __BLAKE3 extends _BLAKE2 {
    canXOF = true;
    chunkPos = 0;
    // Position of current block in chunk
    // How many chunks we already have; exact while this stays within
    // JS's safe-integer range.
    chunksDone = 0;
    flags = 0 | 0;
    IV;
    state;
    stack = [];
    // Output
    posOut = 0;
    bufferOut32 = new Uint32Array(16);
    bufferOut;
    // Index of output chunk; exact while this stays within JS's
    // safe-integer range.
    chunkOut = 0;
    enableXOF = true;
    constructor(opts = {}, flags = 0) {
      super(64, opts.dkLen === void 0 ? 32 : opts.dkLen);
      const { key, context } = opts;
      const hasContext = context !== void 0;
      if (key !== void 0) {
        if (hasContext)
          throw new Error('Only "key" or "context" can be specified at same time');
        abytes(key, 32, "key");
        const k = copyBytes(key);
        this.IV = u32(k);
        swap32IfBE(this.IV);
        this.flags = flags | B3_Flags.KEYED_HASH;
      } else if (hasContext) {
        abytes(context, void 0, "context");
        const ctx = context;
        const contextKey = new __BLAKE3({ dkLen: 32 }, B3_Flags.DERIVE_KEY_CONTEXT).update(ctx).digest();
        this.IV = u32(contextKey);
        swap32IfBE(this.IV);
        this.flags = flags | B3_Flags.DERIVE_KEY_MATERIAL;
      } else {
        this.IV = B3_IV.slice();
        this.flags = flags;
      }
      this.state = this.IV.slice();
      this.bufferOut = u8(this.bufferOut32);
    }
    // _BLAKE2's scalar-state hooks are unused here: BLAKE3 keeps its tree/XOF state in arrays and
    // copies it directly in _cloneInto().
    get() {
      return [];
    }
    set() {
    }
    // Truncated chunk/parent compression: seed v8..v15 as IV[0..3], t0, t1,
    // block length, and flags, then keep only the first 8 output words.
    b2Compress(counter, flags, buf, bufPos = 0) {
      const { state: s, pos } = this;
      const { h, l } = fromBig(BigInt(counter), true);
      const { v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15 } = compress(B3_SIGMA, bufPos, buf, 7, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], B3_IV[0], B3_IV[1], B3_IV[2], B3_IV[3], h, l, pos, flags);
      s[0] = v0 ^ v8;
      s[1] = v1 ^ v9;
      s[2] = v2 ^ v10;
      s[3] = v3 ^ v11;
      s[4] = v4 ^ v12;
      s[5] = v5 ^ v13;
      s[6] = v6 ^ v14;
      s[7] = v7 ^ v15;
    }
    compress(buf, bufPos = 0, isLast = false) {
      let flags = this.flags;
      if (!this.chunkPos)
        flags |= B3_Flags.CHUNK_START;
      if (this.chunkPos === 15 || isLast)
        flags |= B3_Flags.CHUNK_END;
      if (!isLast)
        this.pos = this.blockLen;
      this.b2Compress(this.chunksDone, flags, buf, bufPos);
      this.chunkPos += 1;
      if (this.chunkPos === 16 || isLast) {
        let chunk = this.state;
        this.state = this.IV.slice();
        for (let last, chunks = this.chunksDone + 1; isLast || !(chunks & 1); chunks >>= 1) {
          if (!(last = this.stack.pop()))
            break;
          this.buffer32.set(last, 0);
          this.buffer32.set(chunk, 8);
          this.pos = this.blockLen;
          this.b2Compress(0, this.flags | B3_Flags.PARENT, this.buffer32, 0);
          chunk = this.state;
          this.state = this.IV.slice();
        }
        this.chunksDone++;
        this.chunkPos = 0;
        this.stack.push(chunk);
      }
      this.pos = 0;
    }
    _cloneInto(to) {
      to = super._cloneInto(to);
      const { IV, flags, state, chunkPos, posOut, chunkOut, stack, chunksDone } = this;
      to.state.set(state.slice());
      to.stack = stack.map((i) => Uint32Array.from(i));
      to.IV.set(IV);
      to.flags = flags;
      to.chunkPos = chunkPos;
      to.chunksDone = chunksDone;
      to.posOut = posOut;
      to.chunkOut = chunkOut;
      to.enableXOF = this.enableXOF;
      to.bufferOut32.set(this.bufferOut32);
      return to;
    }
    destroy() {
      this.destroyed = true;
      clean(this.state, this.buffer32, this.IV, this.bufferOut32);
      clean(...this.stack);
    }
    // Root/XOF compression: rerun the same ROOT inputs with incrementing output
    // counter `t` and materialize all 16 output words.
    // Same as b2Compress, but doesn't modify state and returns 16 u32 array (instead of 8)
    b2CompressOut() {
      const { state: s, pos, flags, buffer32, bufferOut32: out32 } = this;
      const { h, l } = fromBig(BigInt(this.chunkOut++));
      swap32IfBE(buffer32);
      const { v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15 } = compress(B3_SIGMA, 0, buffer32, 7, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], B3_IV[0], B3_IV[1], B3_IV[2], B3_IV[3], l, h, pos, flags);
      out32[0] = v0 ^ v8;
      out32[1] = v1 ^ v9;
      out32[2] = v2 ^ v10;
      out32[3] = v3 ^ v11;
      out32[4] = v4 ^ v12;
      out32[5] = v5 ^ v13;
      out32[6] = v6 ^ v14;
      out32[7] = v7 ^ v15;
      out32[8] = s[0] ^ v8;
      out32[9] = s[1] ^ v9;
      out32[10] = s[2] ^ v10;
      out32[11] = s[3] ^ v11;
      out32[12] = s[4] ^ v12;
      out32[13] = s[5] ^ v13;
      out32[14] = s[6] ^ v14;
      out32[15] = s[7] ^ v15;
      swap32IfBE(buffer32);
      swap32IfBE(out32);
      this.posOut = 0;
    }
    finish() {
      if (this.finished)
        return;
      this.finished = true;
      clean(this.buffer.subarray(this.pos));
      let flags = this.flags | B3_Flags.ROOT;
      if (this.stack.length) {
        flags |= B3_Flags.PARENT;
        swap32IfBE(this.buffer32);
        this.compress(this.buffer32, 0, true);
        swap32IfBE(this.buffer32);
        this.chunksDone = 0;
        this.pos = this.blockLen;
      } else {
        flags |= (!this.chunkPos ? B3_Flags.CHUNK_START : 0) | B3_Flags.CHUNK_END;
      }
      this.flags = flags;
      this.b2CompressOut();
    }
    writeInto(out) {
      aexists(this, false);
      abytes(out);
      this.finish();
      const { blockLen, bufferOut } = this;
      for (let pos = 0, len = out.length; pos < len; ) {
        if (this.posOut >= blockLen)
          this.b2CompressOut();
        const take = Math.min(blockLen - this.posOut, len - pos);
        out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
        this.posOut += take;
        pos += take;
      }
      return out;
    }
    xofInto(out) {
      if (!this.enableXOF)
        throw new Error("XOF is not possible after digest call");
      return this.writeInto(out);
    }
    xof(bytes) {
      anumber(bytes);
      return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
      aoutput(out, this);
      if (this.finished)
        throw new Error("digest() was already called");
      this.enableXOF = false;
      this.writeInto(out.subarray(0, this.outputLen));
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.outputLen);
      this.digestInto(out);
      return out;
    }
  };
  var blake3 = /* @__PURE__ */ createHasher((opts = {}) => new _BLAKE3(opts));

  // bundle-entry.mjs
  var qcPQ = {
    ml_dsa87,
    slh_dsa_sha2_256f,
    sha3_256,
    blake3,
    // for level-20 parent addresses (128-byte XOF output)
    hkdf,
    sha256,
    bytesToHex,
    hexToBytes,
    concatBytes
  };

export { qcPQ };

