/**
 * QuanChain Wallet — Merkle derivation tree (B4.4)
 *
 * Pure-JS port of `quanchain-crypto::tadeqs::derivation_tree`. Used by the
 * wallet to:
 *   1. Build the Merkle tree at parent registration time, hash to commitment.
 *   2. Generate proofs for new children at SpendAndRotate time (one proof
 *      per rotation).
 *
 * Cross-tested against the Rust chain via `merkle_interop.rs` — same input
 * (level, index, key_material) bytes must produce byte-identical leaf hashes
 * and identical Merkle roots on both sides.
 *
 * ## Algorithm
 *
 * leaf = SHA3-256(level_u8 || index_u64_le || SHA3-256(key_material))
 * pair = SHA3-256(left || right)
 * tree: pair-up adjacent nodes; odd nodes hash with self; layers built bottom-up
 * proof: [sibling_at_layer_0, sibling_at_layer_1, ...] for path leaf → root
 *
 * Loaded via `importScripts('../lib/qc-merkle.js')` in the service worker.
 * Depends on `qcPQ.sha3_256` (must be loaded first).
 */

(() => {
  'use strict';

  if (!globalThis.qcPQ || !globalThis.qcPQ.sha3_256) {
    throw new Error(
      'qc-merkle.js requires qc-pq.js to be loaded first (sha3_256 missing)',
    );
  }
  const { sha3_256, bytesToHex, concatBytes } = globalThis.qcPQ;

  // ──────────────────────────────────────────────────────────────────────
  //                              LEAVES
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Encode a u64 as 8 little-endian bytes — matches Rust's `index.to_le_bytes()`.
   * Uses BigInt to handle the full u64 range without precision loss.
   * @param {number|bigint} n
   * @returns {Uint8Array} 8 bytes
   */
  function u64LE(n) {
    const v = typeof n === 'bigint' ? n : BigInt(n);
    if (v < 0n || v > 0xFFFFFFFFFFFFFFFFn) {
      throw new RangeError(`u64 out of range: ${v}`);
    }
    const out = new Uint8Array(8);
    let x = v;
    for (let i = 0; i < 8; i++) {
      out[i] = Number(x & 0xFFn);
      x >>= 8n;
    }
    return out;
  }

  /**
   * Compute a Merkle leaf hash for a (level, index, key_material) triple.
   *
   * `leaf = SHA3-256(level || index_le || SHA3-256(key_material))`
   *
   * Matches `quanchain-crypto::tadeqs::derivation_tree::compute_leaf`
   * byte-for-byte (verified by `merkle_interop.rs`).
   *
   * @param {number} level — 1..20
   * @param {number|bigint} index — leaf position within its level's range
   * @param {Uint8Array} keyMaterial — arbitrary bytes; in the wallet flow
   *   this will be the child's public key hash (or full keyBytes for compat
   *   with the chain's existing tree-building code)
   * @returns {Uint8Array} 32 bytes
   */
  function computeLeaf(level, index, keyMaterial) {
    if (typeof level !== 'number' || level < 0 || level > 255) {
      throw new RangeError(`level must be u8: ${level}`);
    }
    if (!(keyMaterial instanceof Uint8Array)) {
      throw new TypeError('keyMaterial must be Uint8Array');
    }

    // Stage 1: hash the key material to a fixed 32-byte digest
    const kmHash = sha3_256(keyMaterial);

    // Stage 2: hash (level || index_le || kmHash)
    const buf = concatBytes(
      new Uint8Array([level]),
      u64LE(index),
      kmHash,
    );
    return sha3_256(buf);
  }

  /**
   * Hash two 32-byte child nodes into a single parent node.
   * @param {Uint8Array} left  32 bytes
   * @param {Uint8Array} right 32 bytes
   * @returns {Uint8Array} 32 bytes
   */
  function hashPair(left, right) {
    if (left.length !== 32 || right.length !== 32) {
      throw new RangeError('hashPair: each side must be 32 bytes');
    }
    return sha3_256(concatBytes(left, right));
  }

  // ──────────────────────────────────────────────────────────────────────
  //                              LAYERS
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Build the Merkle tree from a list of leaves.
   *
   * Convention (matches chain):
   *   - Empty input → `[[zero_32]]` (one synthetic zero root)
   *   - Otherwise: each layer pairs adjacent nodes, odd-out hashes with self
   *   - Returns ALL layers; `layers[0]` is the leaves, `layers[last]` is `[root]`
   *
   * Wallet must pad leaves to a power of two BEFORE calling (with all-zero
   * 32-byte leaves) — same as the chain's `build_derivation_tree` does.
   *
   * @param {Uint8Array[]} leaves — array of 32-byte leaf hashes
   * @returns {Uint8Array[][]} layers, bottom-up
   */
  function buildMerkleLayers(leaves) {
    if (!leaves || leaves.length === 0) {
      return [[new Uint8Array(32)]];
    }
    for (const l of leaves) {
      if (!(l instanceof Uint8Array) || l.length !== 32) {
        throw new TypeError('every leaf must be a 32-byte Uint8Array');
      }
    }

    const layers = [leaves.slice()];
    while (true) {
      const current = layers[layers.length - 1];
      if (current.length === 1) break;

      const next = [];
      for (let i = 0; i < current.length; i += 2) {
        if (i + 1 < current.length) {
          next.push(hashPair(current[i], current[i + 1]));
        } else {
          // Odd element — hash with self (matches chain)
          next.push(hashPair(current[i], current[i]));
        }
      }
      layers.push(next);
    }
    return layers;
  }

  /**
   * Generate a Merkle proof for a specific leaf.
   *
   * Returns `{leaf_hash, path, leaf_index}` — same shape as
   * `quanchain_core::MerkleDerivationProof` (the on-chain payload type).
   *
   * @param {Uint8Array[][]} layers — output of `buildMerkleLayers`
   * @param {number|bigint} leafIndex
   * @returns {{leaf_hash: Uint8Array, path: Uint8Array[], leaf_index: bigint}}
   */
  function generateProof(layers, leafIndex) {
    if (!layers || layers.length === 0 || layers[0].length === 0) {
      throw new Error('empty tree');
    }
    const idxBig = typeof leafIndex === 'bigint' ? leafIndex : BigInt(leafIndex);
    const idx = Number(idxBig);
    if (idx < 0 || idx >= layers[0].length) {
      throw new RangeError(
        `leaf index ${idx} out of bounds (tree has ${layers[0].length} leaves)`,
      );
    }

    const leafHash = layers[0][idx];
    const path = [];
    let current = idx;
    for (let l = 0; l < layers.length - 1; l++) {
      const layer = layers[l];
      let siblingIdx;
      if (current % 2 === 0) {
        siblingIdx = current + 1 < layer.length ? current + 1 : current; // self if odd-out
      } else {
        siblingIdx = current - 1;
      }
      path.push(layer[siblingIdx]);
      current = Math.floor(current / 2);
    }

    return { leaf_hash: leafHash, path, leaf_index: idxBig };
  }

  /**
   * Verify a proof against a 32-byte root. (Mainly here for parity with the
   * chain's `verify_proof`; the wallet doesn't usually call this — proofs
   * are verified server-side. Useful for self-tests.)
   *
   * @param {{leaf_hash: Uint8Array, path: Uint8Array[], leaf_index: bigint|number}} proof
   * @param {Uint8Array} root 32 bytes
   * @returns {boolean}
   */
  function verifyProof(proof, root) {
    let current = proof.leaf_hash;
    let idx = typeof proof.leaf_index === 'bigint'
      ? Number(proof.leaf_index)
      : proof.leaf_index;
    for (const sibling of proof.path) {
      if (idx % 2 === 0) {
        current = hashPair(current, sibling);
      } else {
        current = hashPair(sibling, current);
      }
      idx = Math.floor(idx / 2);
    }
    return bytesToHex(current) === bytesToHex(root);
  }

  // ──────────────────────────────────────────────────────────────────────
  //                              EXPORTS
  // ──────────────────────────────────────────────────────────────────────

  globalThis.qcMerkle = {
    computeLeaf,
    hashPair,
    buildMerkleLayers,
    generateProof,
    verifyProof,
    u64LE, // exported for testing
  };
})();
