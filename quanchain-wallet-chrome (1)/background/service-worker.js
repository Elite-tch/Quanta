/**
 * QuanChain Wallet - Background Service Worker
 * Implements TADEQS (Transcendent Adapting Dynamic Efficients Quantum Secure Encryption)
 *
 * Key Features:
 * - 64KB Parent Wallet (master entropy)
 * - Child key derivation for all 20 security levels
 * - HKDF-SHA256 key expansion
 * - Migration support between security levels
 */

// Load self-contained crypto helpers (SHA3-256, secp256k1, Ed25519, level-5
// dual signing, chain-compatible address derivation). Attaches to
// `globalThis.qcCrypto`. Must be called BEFORE any other top-level code that
// references the crypto module.
importScripts('../lib/qc-crypto.js');

// Load post-quantum primitives (ML-DSA-87 + SLH-DSA-SHA2-256f from
// `@noble/post-quantum`, plus SHA3-256, HKDF-SHA256, byte utils).
// Attaches to `globalThis.qcPQ`. Used for parent identity (level 20):
//   1. Deterministic keygen from parent entropy (matches the chain's
//      `composite_signature::generate_composite_keypair_from_seed`
//      byte-for-byte — proven by the wallet_pq_interop test in
//      `crates/quanchain-crypto/tests`).
//   2. Composite signing of WalletRegistration / Recovery payloads.
// SLH-DSA signing is ~1s in pure JS; tolerable since it runs once per
// parent registration, never per transaction.
importScripts('../lib/qc-pq.js');

// Load the Merkle derivation tree (B4.4). Provides:
//   - `qcMerkle.computeLeaf(level, index, key_material)` — leaf hash
//   - `qcMerkle.buildMerkleLayers(leaves)` — bottom-up tree
//   - `qcMerkle.generateProof(layers, leaf_index)` — proof object the
//     chain's verifier expects
// Cross-tested against `quanchain-crypto::tadeqs::derivation_tree`
// (5/5 tests pass in `wallet_merkle_interop.rs`). Depends on qcPQ.
importScripts('../lib/qc-merkle.js');

// Load parent identity helpers (B4.5). Provides:
//   - `qcParent.deriveParentIdentity(parentEntropy)` → composite keypair
//     + level-20 BLAKE3-XOF-128 address (matches chain byte-for-byte;
//     proven by 3/3 wallet_parent_interop.rs tests)
//   - `qcParent.signComposite(payload, dilithium5, sphincsplus256f)`
//     → both halves of the composite signature, used for WalletRegistration
//     and RecoveryTransaction payloads.
importScripts('../lib/qc-parent.js');

// ============ Configuration ============
// QuanChain testnet — single Contabo VPS hosting all 4 validators on
// successive RPC ports, fronted by Caddy with a Let's Encrypt cert.
//
// Primary endpoint is HTTPS via Caddy's round-robin load-balancer across
// localhost:8545-8548 with passive health checks (a failing validator is
// taken out of rotation for 30s). One URL, four upstreams, real TLS.
//
// The legacy plain-HTTP endpoints are kept as fallbacks for now — if
// Caddy is down or DNS/TLS misbehaves on a particular client, the wallet
// can still talk to a validator directly. They will be removed once the
// HTTPS endpoint is stable for 30+ days and `rpc.quanchain.ai` is set up
// at the registrar.
const RPC_ENDPOINTS = [
  'https://5-189-184-7.sslip.io',  // Caddy LB (HTTPS, recommended)
  'http://5.189.184.7:8545',       // validator-1 direct (legacy fallback)
  'http://5.189.184.7:8546',       // validator-2 direct (legacy fallback)
  'http://5.189.184.7:8547',       // validator-3 direct (legacy fallback)
  'http://5.189.184.7:8548'        // validator-4 direct (legacy fallback)
];

let currentEndpoint = RPC_ENDPOINTS[0];

// TADEQS Constants
const PARENT_WALLET_SIZE = 65536; // 64 KB
const PBKDF2_ITERATIONS = 600000;
const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes

// Security Level Definitions (all 20 levels)
const SECURITY_LEVELS = {
  // Classical (Levels 1-5)
  1: { name: 'ECDSA-128', algorithm: 'ECDSA', quantumBits: 50, sigSize: 64, keySize: 32 },
  2: { name: 'ECDSA-192', algorithm: 'ECDSA', quantumBits: 75, sigSize: 96, keySize: 32 },
  3: { name: 'ECDSA-256', algorithm: 'Ed25519', quantumBits: 100, sigSize: 128, keySize: 32 },
  4: { name: 'ECDSA+RSA-2048', algorithm: 'ECDSA+RSA', quantumBits: 112, sigSize: 320, keySize: 64 },
  5: { name: 'ECDSA+RSA-4096', algorithm: 'ECDSA+RSA', quantumBits: 128, sigSize: 576, keySize: 64 },

  // Hybrid Post-Quantum (Levels 6-11)
  6: { name: 'Dilithium2+ECDSA', algorithm: 'Dilithium2+ECDSA', quantumBits: 150, sigSize: 2420, keySize: 96 },
  7: { name: 'Dilithium2+P256', algorithm: 'Dilithium2+ECDSA', quantumBits: 150, sigSize: 2484, keySize: 96 },
  8: { name: 'Dilithium3+P384', algorithm: 'Dilithium3+ECDSA', quantumBits: 175, sigSize: 3421, keySize: 128 },
  9: { name: 'Dilithium3+Ed25519', algorithm: 'Dilithium3+EdDSA', quantumBits: 175, sigSize: 3357, keySize: 128 },
  10: { name: 'Falcon-512+RSA', algorithm: 'Falcon512+RSA', quantumBits: 180, sigSize: 1202, keySize: 128 },
  11: { name: 'Falcon-512+P384', algorithm: 'Falcon512+ECDSA', quantumBits: 180, sigSize: 786, keySize: 128 },

  // Pure Post-Quantum (Levels 12-15)
  12: { name: 'SPHINCS+-128f', algorithm: 'SPHINCS+', quantumBits: 200, sigSize: 17088, keySize: 64 },
  13: { name: 'SPHINCS+-192f', algorithm: 'SPHINCS+', quantumBits: 225, sigSize: 35664, keySize: 96 },
  14: { name: 'SPHINCS+-256f', algorithm: 'SPHINCS+', quantumBits: 256, sigSize: 49856, keySize: 128 },
  15: { name: 'Dilithium5+Falcon-1024', algorithm: 'DualPQ', quantumBits: 300, sigSize: 5577, keySize: 256 },

  // Reserved for Future NIST Standards (Levels 16-20)
  16: { name: 'Reserved-NIST-L16', algorithm: 'Reserved', quantumBits: 350, sigSize: 32768, keySize: 512 },
  17: { name: 'Reserved-NIST-L17', algorithm: 'Reserved', quantumBits: 400, sigSize: 40960, keySize: 1024 },
  18: { name: 'Reserved-NIST-L18', algorithm: 'Reserved', quantumBits: 450, sigSize: 49152, keySize: 2048 },
  19: { name: 'Reserved-NIST-L19', algorithm: 'Reserved', quantumBits: 480, sigSize: 57344, keySize: 4096 },
  20: { name: 'Maximum-Security', algorithm: 'MaxSec', quantumBits: 512, sigSize: 65536, keySize: 8192 }
};

// Value ranges for automatic level recommendations (in USD)
const VALUE_THRESHOLDS = {
  1: 10,           // < $10
  3: 1000,         // < $1,000
  5: 10000,        // < $10,000
  7: 100000,       // < $100,000
  10: 500000,      // < $500,000
  12: 1000000,     // < $1M
  14: 10000000,    // < $10M
  15: 100000000,   // < $100M
  20: Infinity     // Unlimited
};

// Migration thresholds (safety factors)
const MIGRATION_AUTOMATIC_FACTOR = 1.5;
const MIGRATION_SUGGESTED_FACTOR = 3.0;

// LQCp/h (Logical Qubit Cost per Hour) - Economic quantum threat metric
// Current estimates based on hardware trajectory
const LQCPH_CURRENT = 5000000; // $5M per logical qubit-hour (2024 estimate)
const LQCPH_YEAR_DECLINE = 0.5; // 50% decline per year (Moore's law for quantum)

// Per-level address hash byte count (must match `SecurityLevel::address_hash_bytes`
// in the Rust chain). The chain decodes addresses by base58-decoding the payload
// and asserting `decoded.len() == address_hash_bytes(level)`. If the wallet
// produces a different length the chain rejects the address as malformed.
const ADDRESS_HASH_BYTES = {
  1: 16,  2: 16,  3: 20,  4: 20,  5: 24,
  6: 32,  7: 32,  8: 32,  9: 32,  10: 32,
  11: 48, 12: 48, 13: 48, 14: 64, 15: 64,
  16: 96, 17: 96, 18: 96, 19: 96, 20: 128,
};

// Multi-wallet state (in-memory)
// Supports multiple parent wallets like MetaMask
let walletState = {
  // All parent wallets keyed by wallet ID
  wallets: {},              // { walletId: { parentEntropy, childWallets, name, createdAt } }
  activeWalletId: null,     // Currently selected wallet ID
  activeLevel: 5,           // Currently active security level within the active wallet
  isUnlocked: false,
  sessionPassword: null
};

// Get the active wallet's data
function getActiveWallet() {
  if (!walletState.activeWalletId || !walletState.wallets[walletState.activeWalletId]) {
    return null;
  }
  return walletState.wallets[walletState.activeWalletId];
}

// Get child wallets for the active wallet
function getActiveChildWallets() {
  const wallet = getActiveWallet();
  return wallet ? wallet.childWallets : {};
}

// Generate a unique wallet ID
function generateWalletId() {
  return 'wallet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

let lockTimeout = null;

// ============ Message Handler ============
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ error: error.message }));
  return true;
});

async function handleMessage(request) {
  resetAutoLock();

  switch (request.type) {
    case 'GET_WALLET_STATUS':
      return await getWalletStatus();

    case 'CREATE_WALLET':
      return await createWallet(request.password);

    case 'IMPORT_WALLET':
      return await importWallet(request.entropy, request.password);

    case 'UNLOCK_WALLET':
      return await unlockWallet(request.password);

    case 'LOCK_WALLET':
      return lockWallet();

    case 'GET_ACCOUNTS':
      return getAccounts();

    case 'GET_CHILD_WALLET':
      return getChildWallet(request.level, request.index);

    case 'SET_ACTIVE_LEVEL':
      return setActiveLevel(request.level);

    case 'GET_ALL_LEVELS':
      return getAllLevels();

    case 'GET_BALANCE':
      return await getBalance(request.address);

    case 'GET_NETWORK_INFO':
      return await getNetworkInfo();

    case 'SWITCH_ENDPOINT':
      return switchEndpoint(request.endpoint);

    case 'EXPORT_PARENT_WALLET':
      return exportParentWallet(request.password);

    case 'SEND_TRANSACTION':
      return await sendTransaction(request.tx, request.password);

    case 'GET_MIGRATION_RECOMMENDATION':
      return getMigrationRecommendation(request.balance, request.currentLevel);

    case 'MIGRATE_FUNDS':
      return await migrateFunds(request.fromLevel, request.toLevel, request.amount, request.password);

    case 'GET_SECURITY_LEVEL_INFO':
      return getSecurityLevelInfo(request.level);

    case 'GET_TRANSACTIONS':
      return await getTransactions(request.address, request.limit, request.offset);

    // Track A: parent identity + registration
    case 'GET_PARENT_STATUS':
      return getParentStatus();

    case 'REGISTER_PARENT':
      return await registerParent(request.password);

    case 'FAUCET_DRIP':
      return await faucetDripToActive(request.target);

    // Multi-wallet management
    case 'GET_ALL_WALLETS':
      return getAllWallets();

    case 'CREATE_NEW_WALLET':
    case 'CREATE_ADDITIONAL_WALLET':
      return await createAdditionalWallet(request.name, request.password);

    case 'SWITCH_WALLET':
      return await switchWallet(request.walletId);

    case 'RENAME_WALLET':
      return await renameWallet(request.walletId, request.name);

    case 'DELETE_WALLET':
      return await deleteWallet(request.walletId, request.password);

    case 'IMPORT_ADDITIONAL_WALLET':
      return await importAdditionalWallet(request.entropy, request.name, request.password);

    default:
      throw new Error('Unknown message type: ' + request.type);
  }
}

// ============ Auto-Lock ============
function resetAutoLock() {
  if (lockTimeout) {
    clearTimeout(lockTimeout);
  }
  if (walletState.isUnlocked) {
    lockTimeout = setTimeout(() => {
      lockWallet();
      chrome.runtime.sendMessage({ type: 'WALLET_LOCKED' }).catch(() => {});
    }, AUTO_LOCK_TIMEOUT);
  }
}

// ============ TADEQS Core Functions ============

/**
 * Generate a new 64KB parent wallet with cryptographically secure entropy
 */
async function generateParentWallet() {
  // Generate 64KB of random entropy in chunks (browser limits single call)
  const entropy = new Uint8Array(PARENT_WALLET_SIZE);
  const chunkSize = 65536; // Max for single getRandomValues call

  for (let offset = 0; offset < PARENT_WALLET_SIZE; offset += chunkSize) {
    const remaining = Math.min(chunkSize, PARENT_WALLET_SIZE - offset);
    const chunk = crypto.getRandomValues(new Uint8Array(remaining));
    entropy.set(chunk, offset);
  }

  return entropy;
}

/**
 * Derive a child key for a specific security level using HKDF
 *
 * Formula: K_{c,l,i} = HKDF-SHA256("quanchain-tadeqs-level-{l}-index-{i}", parentEntropy[0:b_l])
 * Where b_l is proportional to the security level's key requirements
 */
async function deriveChildKey(parentEntropy, level, index) {
  const levelInfo = SECURITY_LEVELS[level];
  if (!levelInfo) {
    throw new Error(`Invalid security level: ${level}`);
  }

  // Calculate how much parent entropy to use based on security level
  // Higher levels use more of the parent entropy
  const entropyBytesToUse = Math.min(
    PARENT_WALLET_SIZE,
    Math.max(256, level * 3277) // ~3.2KB per level, min 256 bytes
  );

  const parentSlice = parentEntropy.slice(0, entropyBytesToUse);

  // Create context for HKDF
  const context = `quanchain-tadeqs-level-${level}-index-${index}`;
  const encoder = new TextEncoder();
  const info = encoder.encode(context);

  // Import parent entropy as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    parentSlice,
    'HKDF',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the required key size for this security level
  const requiredKeySize = levelInfo.keySize;

  // Use HKDF to expand to required size
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(`QuanChain-TADEQS-v1-salt-${level}`),
      info: info
    },
    keyMaterial,
    requiredKeySize * 8 // bits
  );

  const keyBytes = new Uint8Array(derivedBits);

  // Generate address in the chain's native 2-part format: `QC{level}_{base58}`.
  //
  // For level 5 we derive the chain-compatible identity end-to-end:
  //   • secp256k1 + Ed25519 secrets are taken from `keyBytes[0..32]` and
  //     `[32..64]` respectively (matches the Rust chain's level-5 layout).
  //   • Public keys are derived from those secrets (33-byte compressed
  //     secp + 32-byte Ed25519, concatenated → 65 bytes).
  //   • Address hash = first N bytes of SHA3-256(pub_concat) where
  //     N = `address_hash_bytes(level)` (24 for level 5).
  //
  // This matches `Address::from_public_key(level, pub_concat)` on the Rust
  // chain — which is what `verify_tx_signature` checks against `tx.from`
  // when validating signed transactions. We also stash `publicKey` on the
  // child object so `sendTransaction` can include it in `tx_prepareRotate`.
  //
  // For other levels (the wallet doesn't bundle post-quantum signing) we
  // fall back to SHA-256(keyBytes) truncated. Sends from those addresses
  // can't be signed yet so they'll fail verification once enforcement is
  // on; only useful for receiving until those levels are implemented.
  const requiredBytes = ADDRESS_HASH_BYTES[level];
  if (!requiredBytes) {
    throw new Error(`Unknown level ${level}: missing ADDRESS_HASH_BYTES entry`);
  }

  let address;
  let publicKey = null;

  if (level === 5 && globalThis.qcCrypto) {
    const identity = await globalThis.qcCrypto.deriveLevel5Identity(keyBytes);
    publicKey = identity.publicKey;
    address = `QC${level}_${base58Encode(identity.addressBytes)}`;
  } else {
    const fullHash = new Uint8Array(await crypto.subtle.digest('SHA-256', keyBytes));
    const truncated = fullHash.slice(0, requiredBytes);
    address = `QC${level}_${base58Encode(truncated)}`;
  }

  return {
    level,
    index,
    keyBytes,
    publicKey,    // Uint8Array(65) for level 5; null otherwise
    address,
    algorithm: levelInfo.algorithm,
    name: levelInfo.name,
    quantumBits: levelInfo.quantumBits,
    signatureSize: levelInfo.sigSize
  };
}

/**
 * Derive child wallets for all implemented security levels at the same index.
 * Used at first wallet creation/import; for restoring after rotation use
 * `deriveAllChildWalletsAtIndices` with the persisted per-level index map.
 */
async function deriveAllChildWallets(parentEntropy, index = 0) {
  const children = {};

  // Derive for levels 1-15 (implemented)
  // Levels 16-20 are reserved but we derive them anyway for future use
  for (let level = 1; level <= 20; level++) {
    try {
      children[level] = await deriveChildKey(parentEntropy, level, index);
    } catch (e) {
      console.warn(`Failed to derive level ${level}:`, e);
    }
  }

  return children;
}

/**
 * Derive each level's child at its persisted rotation index.
 *
 * `indices` is a map { [level]: number } produced by `saveAllWallets` from
 * the live `wallet.childWallets[level].index` values. Levels missing from
 * the map default to index 0 — that matches both legacy saves (no index
 * tracking) and any new levels added in code after the wallet was last
 * saved.
 */
async function deriveAllChildWalletsAtIndices(parentEntropy, indices) {
  const children = {};

  for (let level = 1; level <= 20; level++) {
    const idx = indices[level] !== undefined ? indices[level] : 0;
    try {
      children[level] = await deriveChildKey(parentEntropy, level, idx);
    } catch (e) {
      console.warn(`Failed to derive level ${level} at index ${idx}:`, e);
    }
  }

  return children;
}

// ============ Parent Identity + Merkle Tree (Track A) ============
//
// Each parent commits to a Merkle tree of (level=5, index=0..N-1) leaves at
// registration time. The wallet caches the tree leaves so it can generate
// proofs for new children at SpendAndRotate time. The tree root is what
// the chain stores as the parent's `derivation_commitment`.
//
// Cap: COMMITTED_LEAF_COUNT = 256 rotations per registration. Re-register
// after that (rare in practice — most users won't do 256 sends).
//
// Storage model:
//   - parentEntropy:     persisted (encrypted) — already existed
//   - parentIdentity:    in-memory only (re-derived on unlock; secret keys
//                        live here, never written to disk)
//   - committedLeaves:   in-memory only (re-derived; 256 × 32B = 8KB)
//   - registered:        persisted (boolean)
//   - committedRoot:     persisted (32-byte hex) — proof anchor
//   - registrationTxHash:persisted (string)

const COMMITTED_LEAF_COUNT = 256;

/**
 * Derive ONLY the keyBytes for a level-5 child at a given index — skips
 * the secp256k1 + Ed25519 keygen step that `deriveChildKey` does, since
 * tree-building only needs the keyBytes (the leaf input). For 256 leaves
 * this is ~25× faster than calling `deriveChildKey` 256 times.
 */
async function deriveLevel5KeyBytesOnly(parentEntropy, index) {
  const levelInfo = SECURITY_LEVELS[5];
  const entropyBytesToUse = Math.min(
    PARENT_WALLET_SIZE,
    Math.max(256, 5 * 3277),
  );
  const parentSlice = parentEntropy.slice(0, entropyBytesToUse);
  const encoder = new TextEncoder();
  const info = encoder.encode(`quanchain-tadeqs-level-5-index-${index}`);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    parentSlice,
    'HKDF',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('QuanChain-TADEQS-v1-salt-5'),
      info,
    },
    keyMaterial,
    levelInfo.keySize * 8,
  );
  return new Uint8Array(derivedBits);
}

/**
 * Build (or rebuild) the parent's level-20 composite identity AND the
 * 256-leaf Merkle tree the wallet commits to at registration.
 *
 * Returns:
 *   {
 *     identity:        // qcParent.deriveParentIdentity(parentEntropy)
 *     committedLeaves: Uint8Array[],   // 256 × 32 bytes
 *     committedRoot:   Uint8Array,      // 32 bytes (top of buildMerkleLayers)
 *   }
 *
 * Both wallet and chain agree byte-for-byte on the inputs (HKDF context
 * strings, leaf computation, tree-build algorithm), so the root computed
 * here is what the chain ends up storing as the registration commitment.
 * Cross-tested via wallet_pq_interop + wallet_merkle_interop.
 */
async function buildParentIdentityAndTree(parentEntropy) {
  if (!globalThis.qcParent || !globalThis.qcMerkle) {
    throw new Error('qc-parent/qc-merkle not loaded — service worker bootstrap broken');
  }

  // 1) Parent identity (level-20 composite ML-DSA-87 + SLH-DSA-256f)
  const identity = globalThis.qcParent.deriveParentIdentity(parentEntropy);

  // 2) Level-5 child keyBytes for indexes 0..255 — these are the per-leaf
  //    "key_material" inputs computeLeaf hashes into the Merkle leaf. Run
  //    HKDF derivations in parallel to keep wall time under ~500ms.
  const keyBytesPromises = [];
  for (let i = 0; i < COMMITTED_LEAF_COUNT; i++) {
    keyBytesPromises.push(deriveLevel5KeyBytesOnly(parentEntropy, i));
  }
  const allKeyBytes = await Promise.all(keyBytesPromises);

  // 3) Compute leaves
  const committedLeaves = allKeyBytes.map((kb, i) =>
    globalThis.qcMerkle.computeLeaf(5, i, kb),
  );

  // 4) Build layers, take the root
  const layers = globalThis.qcMerkle.buildMerkleLayers(committedLeaves);
  const committedRoot = layers[layers.length - 1][0];

  return { identity, committedLeaves, committedRoot };
}

/**
 * Generate the proof for a specific level-5 rotation index against the
 * wallet's cached `committedLeaves`. Used by `sendTransaction` (Track A3)
 * to attach a real Merkle proof to every rotation.
 */
function generateProofForRotationIndex(committedLeaves, rotationIndex) {
  if (!globalThis.qcMerkle) {
    throw new Error('qc-merkle not loaded');
  }
  if (rotationIndex < 0 || rotationIndex >= committedLeaves.length) {
    throw new Error(
      `rotation index ${rotationIndex} out of committed range [0, ${committedLeaves.length}); ` +
      `wallet needs to re-register parent`,
    );
  }
  const layers = globalThis.qcMerkle.buildMerkleLayers(committedLeaves);
  return globalThis.qcMerkle.generateProof(layers, rotationIndex);
}

// ============ Wallet Functions ============

async function getWalletStatus() {
  const { hasWallet } = await chrome.storage.local.get('hasWallet');

  let activeAddress = null;
  let activeWalletName = null;
  const activeWallet = getActiveWallet();

  if (walletState.isUnlocked && activeWallet && activeWallet.childWallets[walletState.activeLevel]) {
    activeAddress = activeWallet.childWallets[walletState.activeLevel].address;
    activeWalletName = activeWallet.name;
  }

  return {
    hasWallet: !!hasWallet,
    isUnlocked: walletState.isUnlocked,
    address: activeAddress,
    activeLevel: walletState.activeLevel,
    activeWalletId: walletState.activeWalletId,
    activeWalletName: activeWalletName,
    totalWallets: Object.keys(walletState.wallets).length,
    supportedLevels: Object.keys(SECURITY_LEVELS).map(Number)
  };
}

async function createWallet(password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Generate 64KB parent wallet
  const parentEntropy = await generateParentWallet();

  // Derive all child wallets
  const childWallets = await deriveAllChildWallets(parentEntropy, 0);

  // Build the parent's level-20 composite identity + Merkle tree of 256
  // committed rotation slots. This is what the wallet will register on
  // chain (when the user clicks 'Register Parent') and what every future
  // SpendAndRotate carries a proof against. Identity + tree live in memory
  // only; only the committed root + registration status get persisted.
  const parentBundle = await buildParentIdentityAndTree(parentEntropy);

  // Create first wallet ID
  const walletId = generateWalletId();

  // Set wallet state with multi-wallet structure
  walletState = {
    wallets: {
      [walletId]: {
        parentEntropy,
        childWallets,
        name: 'Wallet 1',
        createdAt: Date.now(),
        // Track A: parent identity + Merkle commitment
        parentIdentity: parentBundle.identity,
        committedLeaves: parentBundle.committedLeaves,
        committedRoot: parentBundle.committedRoot,
        registered: false,
        registrationTxHash: null,
      }
    },
    activeWalletId: walletId,
    activeLevel: 5, // Default to level 5 (ECDSA+RSA-4096)
    isUnlocked: true,
    sessionPassword: password
  };

  // Save using multi-wallet storage format
  await saveAllWallets(password);

  resetAutoLock();

  // Return all derived addresses for all levels
  const addresses = {};
  for (const [level, wallet] of Object.entries(childWallets)) {
    addresses[level] = {
      address: wallet.address,
      algorithm: wallet.algorithm,
      name: wallet.name,
      quantumBits: wallet.quantumBits
    };
  }

  return {
    success: true,
    activeAddress: childWallets[5].address,
    activeLevel: 5,
    allAddresses: addresses,
    parentWalletSize: PARENT_WALLET_SIZE,
    walletId,
    walletName: 'Wallet 1'
  };
}

async function importWallet(entropyInput, password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Parse input - support both JSON structured format and raw hex
  let parentEntropy;
  let importedAddresses = null;

  try {
    // Try to parse as JSON first (structured format)
    let entropyHex;

    if (entropyInput.trim().startsWith('{')) {
      const parsed = JSON.parse(entropyInput);

      // Validate format
      if (parsed.format !== 'TADEQS-WALLET') {
        throw new Error('Invalid wallet format. Expected TADEQS-WALLET format.');
      }

      // Extract entropy from structured format
      entropyHex = parsed.wallet?.entropy || parsed.entropy;

      // Store addresses for verification
      importedAddresses = parsed.addresses;

      // Log import info
      console.log(`Importing TADEQS wallet v${parsed.version}`);
      console.log(`Protocol: ${parsed.protocol?.name} ${parsed.protocol?.version}`);
    } else {
      // Assume raw hex format
      entropyHex = entropyInput.trim();
    }

    // Convert hex string to Uint8Array
    parentEntropy = hexToBytes(entropyHex);

    if (parentEntropy.length !== PARENT_WALLET_SIZE) {
      throw new Error(`Invalid parent wallet size: expected ${PARENT_WALLET_SIZE} bytes, got ${parentEntropy.length}`);
    }
  } catch (e) {
    if (e.message.includes('Invalid wallet format') || e.message.includes('parent wallet size')) {
      throw e;
    }
    throw new Error('Invalid parent wallet data: ' + e.message);
  }

  // Derive all child wallets
  const childWallets = await deriveAllChildWallets(parentEntropy, 0);

  // Verify addresses match if imported from structured format
  if (importedAddresses) {
    let verified = 0;
    let mismatches = [];

    for (const [level, expectedAddress] of Object.entries(importedAddresses)) {
      const derivedWallet = childWallets[level];
      if (derivedWallet) {
        if (derivedWallet.address === expectedAddress) {
          verified++;
        } else {
          mismatches.push({
            level,
            expected: expectedAddress,
            derived: derivedWallet.address
          });
        }
      }
    }

    if (mismatches.length > 0) {
      console.warn('Address verification mismatches:', mismatches);
      throw new Error(
        `Address verification failed! ${mismatches.length} addresses don't match. ` +
        `This may indicate corrupted data or incompatible derivation. ` +
        `First mismatch at level ${mismatches[0].level}.`
      );
    }

    console.log(`Verified ${verified} addresses successfully`);
  }

  // Build parent identity + Merkle tree (Track A). Imported wallets get
  // the same treatment as freshly-created ones: identity + tree are
  // deterministic from parentEntropy, so re-importing the same entropy
  // gives the same parent_address and committed root as the original.
  const parentBundle = await buildParentIdentityAndTree(parentEntropy);

  // Create wallet ID for imported wallet
  const walletId = generateWalletId();

  walletState = {
    wallets: {
      [walletId]: {
        parentEntropy,
        childWallets,
        name: 'Imported Wallet',
        createdAt: Date.now(),
        parentIdentity: parentBundle.identity,
        committedLeaves: parentBundle.committedLeaves,
        committedRoot: parentBundle.committedRoot,
        registered: false, // imported wallets re-register; don't assume
        registrationTxHash: null,
      }
    },
    activeWalletId: walletId,
    activeLevel: 5,
    isUnlocked: true,
    sessionPassword: password
  };

  // Save using multi-wallet storage format
  await saveAllWallets(password);

  resetAutoLock();

  return {
    success: true,
    activeAddress: childWallets[5].address,
    activeLevel: 5,
    verified: importedAddresses ? Object.keys(importedAddresses).length : 0,
    walletId,
    walletName: 'Imported Wallet'
  };
}

async function unlockWallet(password) {
  try {
    // Use loadAllWallets which handles both multi-wallet and legacy formats
    await loadAllWallets(password);

    resetAutoLock();

    const activeWallet = getActiveWallet();
    const activeChild = activeWallet?.childWallets[walletState.activeLevel];

    return {
      success: true,
      address: activeChild?.address || null,
      activeLevel: walletState.activeLevel,
      activeWalletId: walletState.activeWalletId,
      activeWalletName: activeWallet?.name || 'Wallet 1',
      totalWallets: Object.keys(walletState.wallets).length
    };
  } catch (e) {
    throw new Error('Invalid password');
  }
}

function lockWallet() {
  // Clear sensitive data from all wallets
  for (const wallet of Object.values(walletState.wallets)) {
    if (wallet.parentEntropy) {
      wallet.parentEntropy.fill(0);
    }
    for (const childWallet of Object.values(wallet.childWallets || {})) {
      if (childWallet.keyBytes) {
        childWallet.keyBytes.fill(0);
      }
    }
  }

  walletState = {
    wallets: {},
    activeWalletId: null,
    activeLevel: 5,
    isUnlocked: false,
    sessionPassword: null
  };

  if (lockTimeout) {
    clearTimeout(lockTimeout);
    lockTimeout = null;
  }

  return { success: true };
}

function getAccounts() {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  const activeWallet = getActiveWallet();
  if (!activeWallet) {
    throw new Error('No active wallet');
  }

  const activeChild = activeWallet.childWallets[walletState.activeLevel];

  return {
    accounts: [{
      name: `${activeWallet.name} (Level ${walletState.activeLevel})`,
      address: activeChild.address,
      level: walletState.activeLevel,
      algorithm: activeChild.algorithm
    }],
    activeAccount: 0,
    activeLevel: walletState.activeLevel,
    activeWalletId: walletState.activeWalletId,
    activeWalletName: activeWallet.name
  };
}

function getChildWallet(level, index = 0) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  const activeWallet = getActiveWallet();
  if (!activeWallet) {
    throw new Error('No active wallet');
  }

  const childWallet = activeWallet.childWallets[level];
  if (!childWallet) {
    throw new Error(`No wallet derived for level ${level}`);
  }

  return {
    level: childWallet.level,
    address: childWallet.address,
    algorithm: childWallet.algorithm,
    name: childWallet.name,
    quantumBits: childWallet.quantumBits,
    signatureSize: childWallet.signatureSize
  };
}

async function setActiveLevel(level) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (!SECURITY_LEVELS[level]) {
    throw new Error(`Invalid security level: ${level}`);
  }

  const activeWallet = getActiveWallet();
  if (!activeWallet) {
    throw new Error('No active wallet');
  }

  walletState.activeLevel = level;

  await chrome.storage.local.set({ activeLevel: level });

  const childWallet = activeWallet.childWallets[level];

  return {
    success: true,
    activeLevel: level,
    address: childWallet.address,
    algorithm: childWallet.algorithm
  };
}

function getAllLevels() {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  const activeWallet = getActiveWallet();
  if (!activeWallet) {
    throw new Error('No active wallet');
  }

  const levels = {};
  for (const [level, childWallet] of Object.entries(activeWallet.childWallets)) {
    levels[level] = {
      address: childWallet.address,
      algorithm: childWallet.algorithm,
      name: childWallet.name,
      quantumBits: childWallet.quantumBits,
      signatureSize: childWallet.signatureSize,
      isImplemented: parseInt(level) <= 15,
      isActive: parseInt(level) === walletState.activeLevel
    };
  }

  return {
    levels,
    activeLevel: walletState.activeLevel,
    implementedLevels: 15,
    totalLevels: 20
  };
}

function getSecurityLevelInfo(level) {
  const info = SECURITY_LEVELS[level];
  if (!info) {
    throw new Error(`Invalid security level: ${level}`);
  }

  return {
    level,
    ...info,
    isImplemented: level <= 15,
    isClassical: level <= 5,
    isHybrid: level >= 6 && level <= 11,
    isPostQuantum: level >= 12 && level <= 15,
    isReserved: level >= 16
  };
}

async function getBalance(address) {
  const activeWallet = getActiveWallet();
  const addr = address || (walletState.isUnlocked && activeWallet?.childWallets[walletState.activeLevel]
    ? activeWallet.childWallets[walletState.activeLevel].address
    : null);

  if (!addr) {
    return { address: null, balance: '0' };
  }

  try {
    const result = await rpcCall('chain_getBalance', [addr]);
    return {
      address: addr,
      balance: result.balance || '0',
      level: walletState.activeLevel
    };
  } catch (e) {
    return { address: addr, balance: '0', error: e.message };
  }
}

async function getNetworkInfo() {
  try {
    const result = await rpcCall('net_nodeInfo', []);
    return {
      connected: true,
      endpoint: currentEndpoint,
      nodeInfo: result
    };
  } catch (e) {
    return {
      connected: false,
      endpoint: currentEndpoint,
      error: e.message
    };
  }
}

async function getTransactions(address, limit = 10, offset = 0) {
  const activeWallet = getActiveWallet();
  const addr = address || (walletState.isUnlocked && activeWallet?.childWallets[walletState.activeLevel]
    ? activeWallet.childWallets[walletState.activeLevel].address
    : null);

  if (!addr) {
    return { address: null, transactions: [], total: 0 };
  }

  try {
    const result = await rpcCall('chain_getTransactionsByAddress', [addr, limit, offset]);

    // Format transactions for display
    const transactions = (result?.transactions || []).map(tx => ({
      hash: tx.hash || '',
      from: tx.from || '',
      to: tx.to || '',
      value: tx.value || '0',
      blockHeight: tx.block_height || 0,
      channel: tx.channel || 1,
      timestamp: tx.timestamp || null,
      direction: tx.from === addr ? 'out' : 'in',
      status: 'confirmed'
    }));

    return {
      address: addr,
      transactions,
      total: result?.total || transactions.length,
      hasMore: result?.has_more || false
    };
  } catch (e) {
    console.error('Failed to get transactions:', e);
    return { address: addr, transactions: [], total: 0, error: e.message };
  }
}

function switchEndpoint(endpoint) {
  if (RPC_ENDPOINTS.includes(endpoint)) {
    currentEndpoint = endpoint;
    return { success: true, endpoint };
  }
  throw new Error('Invalid endpoint');
}

function exportParentWallet(password) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (password !== walletState.sessionPassword) {
    throw new Error('Invalid password');
  }

  const activeWallet = getActiveWallet();
  if (!activeWallet) {
    throw new Error('No active wallet');
  }

  // Return the parent entropy with full derivation metadata for cross-wallet compatibility
  const entropyHex = bytesToHex(activeWallet.parentEntropy);

  // Build the standardized TADEQS wallet export format
  const walletExport = {
    // Format identification
    format: 'TADEQS-WALLET',
    version: 1,

    // Protocol specification
    protocol: {
      name: 'QuanChain TADEQS',
      version: '1.0.0',
      specification: 'Transcendent Adapting Dynamic Efficients Quantum Secure Encryption'
    },

    // Derivation parameters (critical for reconstruction)
    derivation: {
      function: 'HKDF-SHA256',
      saltPrefix: 'QuanChain-TADEQS-v1-salt-',
      infoPrefix: 'quanchain-tadeqs-level-',
      infoFormat: 'quanchain-tadeqs-level-{level}-index-{index}',
      entropyBytesFormula: 'min(65536, max(256, level * 3277))',
      addressFormat: 'QC{level}_{base58(SHA256(key)[0:20])}'
    },

    // Security level definitions
    levels: {
      total: 20,
      implemented: 15,
      reserved: [16, 17, 18, 19, 20],
      keySizes: {
        1: 32, 2: 32, 3: 32, 4: 64, 5: 64,
        6: 96, 7: 96, 8: 128, 9: 128, 10: 128, 11: 128,
        12: 64, 13: 96, 14: 128, 15: 256,
        16: 512, 17: 1024, 18: 2048, 19: 4096, 20: 8192
      },
      algorithms: {
        '1-5': 'Classical (ECDSA/RSA)',
        '6-11': 'Hybrid (Dilithium/Falcon + ECDSA)',
        '12-15': 'Post-Quantum (SPHINCS+/DualPQ)',
        '16-20': 'Reserved (Future NIST standards)'
      }
    },

    // Parent wallet data
    wallet: {
      entropy: entropyHex,
      size: PARENT_WALLET_SIZE,
      sizeHex: entropyHex.length,
      checksum: null, // Will be computed below
      createdAt: activeWallet.createdAt,
      exportedAt: Date.now()
    },

    // Derived addresses (for verification)
    addresses: {}
  };

  // Compute checksum (first 8 chars of SHA256 of entropy)
  crypto.subtle.digest('SHA-256', activeWallet.parentEntropy).then(hash => {
    walletExport.wallet.checksum = bytesToHex(new Uint8Array(hash).slice(0, 4));
  });

  // Include all derived addresses for verification
  for (const [level, wallet] of Object.entries(activeWallet.childWallets)) {
    walletExport.addresses[level] = wallet.address;
  }

  return {
    // Full structured export (JSON)
    exportData: walletExport,

    // Also return raw entropy for simple import
    entropy: entropyHex,

    // Human-readable export string
    exportString: JSON.stringify(walletExport, null, 2),

    warning: 'CRITICAL: This export contains your 64KB parent wallet and complete derivation parameters. Anyone with this data can derive ALL your addresses at ALL 20 security levels. Store securely offline!'
  };
}

// ============ Multi-Wallet Management Functions ============

/**
 * Get all wallets (for wallet selector dropdown)
 * Returns wallet summaries without sensitive data
 */
function getAllWallets() {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  const wallets = [];
  for (const [walletId, wallet] of Object.entries(walletState.wallets)) {
    // Get the default address (level 5) for display
    const defaultAddress = wallet.childWallets[5]?.address || wallet.childWallets[1]?.address || '';

    wallets.push({
      id: walletId,
      name: wallet.name || `Wallet ${wallets.length + 1}`,
      address: defaultAddress,
      createdAt: wallet.createdAt,
      isActive: walletId === walletState.activeWalletId
    });
  }

  return {
    wallets,
    activeWalletId: walletState.activeWalletId,
    totalWallets: wallets.length
  };
}

/**
 * Create a new parent wallet
 * Generates new 64KB entropy and derives all child wallets
 */
async function createNewWallet(name, password) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (password !== walletState.sessionPassword) {
    throw new Error('Invalid password');
  }

  // Generate new 64KB parent wallet
  const parentEntropy = await generateParentWallet();

  // Derive all child wallets
  const childWallets = await deriveAllChildWallets(parentEntropy, 0);

  // Build parent identity + Merkle tree (Track A)
  const parentBundle = await buildParentIdentityAndTree(parentEntropy);

  // Create wallet ID
  const walletId = generateWalletId();
  const walletName = name || `Wallet ${Object.keys(walletState.wallets).length + 1}`;

  // Add to wallets
  walletState.wallets[walletId] = {
    parentEntropy,
    childWallets,
    name: walletName,
    createdAt: Date.now(),
    parentIdentity: parentBundle.identity,
    committedLeaves: parentBundle.committedLeaves,
    committedRoot: parentBundle.committedRoot,
    registered: false,
    registrationTxHash: null,
  };

  // Switch to the new wallet
  walletState.activeWalletId = walletId;

  // Persist to storage
  await saveAllWallets(password);

  return {
    success: true,
    walletId,
    name: walletName,
    address: childWallets[5].address,
    totalWallets: Object.keys(walletState.wallets).length
  };
}

/**
 * Switch to a different wallet
 */
async function switchWallet(walletId) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (!walletState.wallets[walletId]) {
    throw new Error('Wallet not found');
  }

  walletState.activeWalletId = walletId;

  // Save active wallet preference
  await chrome.storage.local.set({ activeWalletId: walletId });

  const wallet = walletState.wallets[walletId];
  const activeChild = wallet.childWallets[walletState.activeLevel];

  return {
    success: true,
    walletId,
    name: wallet.name,
    address: activeChild.address,
    activeLevel: walletState.activeLevel
  };
}

/**
 * Rename a wallet
 */
async function renameWallet(walletId, name) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (!walletState.wallets[walletId]) {
    throw new Error('Wallet not found');
  }

  if (!name || name.trim().length === 0) {
    throw new Error('Name cannot be empty');
  }

  walletState.wallets[walletId].name = name.trim();

  // Persist to storage
  await saveAllWallets(walletState.sessionPassword);

  return {
    success: true,
    walletId,
    name: walletState.wallets[walletId].name
  };
}

/**
 * Delete a wallet
 * Cannot delete the last wallet
 */
async function deleteWallet(walletId, password) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (password !== walletState.sessionPassword) {
    throw new Error('Invalid password');
  }

  if (!walletState.wallets[walletId]) {
    throw new Error('Wallet not found');
  }

  const walletCount = Object.keys(walletState.wallets).length;
  if (walletCount <= 1) {
    throw new Error('Cannot delete the last wallet');
  }

  // Clear sensitive data before deleting
  const wallet = walletState.wallets[walletId];
  if (wallet.parentEntropy) {
    wallet.parentEntropy.fill(0);
  }
  for (const childWallet of Object.values(wallet.childWallets)) {
    if (childWallet.keyBytes) {
      childWallet.keyBytes.fill(0);
    }
  }

  // Delete the wallet
  delete walletState.wallets[walletId];

  // If we deleted the active wallet, switch to another
  if (walletState.activeWalletId === walletId) {
    walletState.activeWalletId = Object.keys(walletState.wallets)[0];
  }

  // Persist to storage
  await saveAllWallets(password);

  return {
    success: true,
    deletedWalletId: walletId,
    activeWalletId: walletState.activeWalletId,
    remainingWallets: Object.keys(walletState.wallets).length
  };
}

/**
 * Import an additional wallet from entropy
 */
async function importAdditionalWallet(entropyInput, name, password) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (password !== walletState.sessionPassword) {
    throw new Error('Invalid password');
  }

  // Parse the entropy input (same logic as importWallet)
  let parentEntropy;
  let importedAddresses = null;

  try {
    let entropyHex;

    if (entropyInput.trim().startsWith('{')) {
      const parsed = JSON.parse(entropyInput);

      if (parsed.format !== 'TADEQS-WALLET') {
        throw new Error('Invalid wallet format. Expected TADEQS-WALLET format.');
      }

      entropyHex = parsed.wallet?.entropy || parsed.entropy;
      importedAddresses = parsed.addresses;
    } else {
      entropyHex = entropyInput.trim();
    }

    parentEntropy = hexToBytes(entropyHex);

    if (parentEntropy.length !== PARENT_WALLET_SIZE) {
      throw new Error(`Invalid parent wallet size: expected ${PARENT_WALLET_SIZE} bytes, got ${parentEntropy.length}`);
    }
  } catch (e) {
    if (e.message.includes('Invalid wallet format') || e.message.includes('parent wallet size')) {
      throw e;
    }
    throw new Error('Invalid parent wallet data: ' + e.message);
  }

  // Derive all child wallets
  const childWallets = await deriveAllChildWallets(parentEntropy, 0);

  // Verify addresses if available
  if (importedAddresses) {
    for (const [level, expectedAddress] of Object.entries(importedAddresses)) {
      const derivedWallet = childWallets[level];
      if (derivedWallet && derivedWallet.address !== expectedAddress) {
        throw new Error(`Address verification failed at level ${level}`);
      }
    }
  }

  // Check for duplicate wallets (by comparing level 5 addresses)
  const newAddress = childWallets[5]?.address;
  for (const existingWallet of Object.values(walletState.wallets)) {
    if (existingWallet.childWallets[5]?.address === newAddress) {
      throw new Error('This wallet has already been imported');
    }
  }

  // Build parent identity + Merkle tree (Track A)
  const parentBundle = await buildParentIdentityAndTree(parentEntropy);

  // Create wallet ID and add to wallets
  const walletId = generateWalletId();
  const walletName = name || `Imported Wallet ${Object.keys(walletState.wallets).length + 1}`;

  walletState.wallets[walletId] = {
    parentEntropy,
    childWallets,
    name: walletName,
    createdAt: Date.now(),
    parentIdentity: parentBundle.identity,
    committedLeaves: parentBundle.committedLeaves,
    committedRoot: parentBundle.committedRoot,
    registered: false,
    registrationTxHash: null,
  };

  // Switch to the new wallet
  walletState.activeWalletId = walletId;

  // Persist to storage
  await saveAllWallets(password);

  return {
    success: true,
    walletId,
    name: walletName,
    address: childWallets[5].address,
    verified: importedAddresses ? Object.keys(importedAddresses).length : 0,
    totalWallets: Object.keys(walletState.wallets).length
  };
}

/**
 * Save all wallets to encrypted storage
 */
async function saveAllWallets(password) {
  const walletsToStore = {};
  const walletNames = {};

  for (const [walletId, wallet] of Object.entries(walletState.wallets)) {
    // Encrypt each wallet's parent entropy separately
    const encrypted = await encryptParentWallet(wallet.parentEntropy, password);

    // Snapshot the current per-level child indices so a future restart
    // re-derives each level at the rotated index, not 0. The index isn't
    // sensitive — it doesn't help an attacker derive child keys without
    // the parent entropy — so we store it in plaintext.
    const childIndices = {};
    if (wallet.childWallets) {
      for (const [level, child] of Object.entries(wallet.childWallets)) {
        childIndices[level] = child.index || 0;
      }
    }

    walletsToStore[walletId] = {
      encrypted,
      childIndices,
      createdAt: wallet.createdAt,
      // Track A: registration metadata. The committed root + tx hash are
      // small public values; persist alongside per-level indices. The
      // committedLeaves themselves are NOT persisted (re-derived from
      // parentEntropy on unlock), nor is parentIdentity (secret).
      registered: !!wallet.registered,
      committedRootHex: wallet.committedRoot
        ? bytesToHex(wallet.committedRoot)
        : null,
      registrationTxHash: wallet.registrationTxHash || null,
    };
    walletNames[walletId] = wallet.name;
  }

  await chrome.storage.local.set({
    hasWallet: true,
    multiWallet: true,
    encryptedWallets: walletsToStore,
    walletNames,
    activeWalletId: walletState.activeWalletId,
    activeLevel: walletState.activeLevel
  });
}

/**
 * Load all wallets from encrypted storage
 */
async function loadAllWallets(password) {
  const data = await chrome.storage.local.get([
    'multiWallet', 'encryptedWallets', 'walletNames',
    'activeWalletId', 'activeLevel', 'encryptedWallet'
  ]);

  // Check if this is the new multi-wallet format
  if (data.multiWallet && data.encryptedWallets) {
    const wallets = {};

    for (const [walletId, walletData] of Object.entries(data.encryptedWallets)) {
      const parentEntropy = await decryptParentWallet(walletData.encrypted, password);
      // Re-derive each level's child at its persisted rotation index. If
      // childIndices is missing (legacy save) we fall back to index 0 for
      // every level — same behaviour as before.
      const childWallets = await deriveAllChildWalletsAtIndices(
        parentEntropy,
        walletData.childIndices || {},
      );

      // Re-derive parent identity + Merkle tree (Track A). Both are
      // deterministic from parentEntropy, so this just rebuilds what was
      // computed at create-time. Costs ~500ms once per unlock.
      let parentBundle;
      try {
        parentBundle = await buildParentIdentityAndTree(parentEntropy);
      } catch (e) {
        console.warn(
          `Failed to rebuild parent tree for ${walletId} (qc-pq/qc-merkle missing?): ${e.message}`,
        );
        parentBundle = { identity: null, committedLeaves: null, committedRoot: null };
      }

      // Sanity: if a registered wallet's persisted committedRootHex doesn't
      // match what we just rederived, the entropy or build algorithm has
      // drifted — flag it loudly so we don't silently break proof generation.
      if (
        walletData.registered &&
        walletData.committedRootHex &&
        parentBundle.committedRoot &&
        bytesToHex(parentBundle.committedRoot) !== walletData.committedRootHex
      ) {
        console.error(
          `Parent tree root mismatch for ${walletId}: persisted=${walletData.committedRootHex}, ` +
          `rederived=${bytesToHex(parentBundle.committedRoot)}. Treating as unregistered.`,
        );
        // Force re-registration; don't trust a stale registered flag.
        walletData.registered = false;
      }

      wallets[walletId] = {
        parentEntropy,
        childWallets,
        name: data.walletNames?.[walletId] || `Wallet`,
        createdAt: walletData.createdAt,
        parentIdentity: parentBundle.identity,
        committedLeaves: parentBundle.committedLeaves,
        committedRoot: parentBundle.committedRoot,
        registered: !!walletData.registered,
        registrationTxHash: walletData.registrationTxHash || null,
      };
    }

    walletState = {
      wallets,
      activeWalletId: data.activeWalletId || Object.keys(wallets)[0],
      activeLevel: data.activeLevel || 5,
      isUnlocked: true,
      sessionPassword: password
    };
  } else if (data.encryptedWallet) {
    // Legacy single-wallet format - migrate to multi-wallet
    const parentEntropy = await decryptParentWallet(data.encryptedWallet, password);
    const childWallets = await deriveAllChildWallets(parentEntropy, 0);
    const parentBundle = await buildParentIdentityAndTree(parentEntropy);

    const walletId = generateWalletId();

    walletState = {
      wallets: {
        [walletId]: {
          parentEntropy,
          childWallets,
          name: 'Wallet 1',
          createdAt: data.encryptedWallet.createdAt || Date.now(),
          parentIdentity: parentBundle.identity,
          committedLeaves: parentBundle.committedLeaves,
          committedRoot: parentBundle.committedRoot,
          registered: false,
          registrationTxHash: null,
        }
      },
      activeWalletId: walletId,
      activeLevel: data.activeLevel || 5,
      isUnlocked: true,
      sessionPassword: password
    };

    // Migrate to new format
    await saveAllWallets(password);
  } else {
    throw new Error('No wallet found');
  }

  return walletState;
}

// ============ Migration Functions ============

/**
 * Calculate LQCp/h (Logical Qubit Cost per Hour) based cracking cost
 *
 * Formula: CrackingCost = LQCp/h × Q_l × T_l
 * Where:
 *   - Q_l = qubits needed for level l (based on quantum bits)
 *   - T_l = time needed to crack level l
 *
 * Safety Margin = CrackingCost / Balance
 *   - < 1.5x: Automatic migration required
 *   - < 3.0x: Migration suggested
 */
function calculateLQCphCrackingCost(level, yearsFromNow = 0) {
  const levelInfo = SECURITY_LEVELS[level];

  // Project LQCp/h into the future (declines over time)
  const futureLqcph = LQCPH_CURRENT * Math.pow(LQCPH_YEAR_DECLINE, yearsFromNow);

  // Calculate qubits needed based on quantum bit security
  // Classical levels (1-5): ECDSA can be broken with ~160-256 qubits using Shor's algorithm
  // Hybrid levels (6-11): Require both classical and quantum attacks
  // PQ levels (12-15): Require Grover's algorithm (quadratic speedup only)
  let qubitsNeeded;
  let hoursNeeded;

  if (level <= 5) {
    // Classical ECDSA/RSA - vulnerable to Shor's algorithm
    // ~2n qubits for n-bit security
    qubitsNeeded = levelInfo.quantumBits * 2;
    hoursNeeded = 1; // Shor is fast once you have the qubits
  } else if (level <= 11) {
    // Hybrid - both classical and PQ components need to be broken
    // Classical part: Shor's algorithm
    // PQ part: Grover's algorithm (quadratic speedup)
    const classicalQubits = 256; // For the classical component
    const pqQubits = Math.pow(2, levelInfo.quantumBits / 128); // Grover speedup
    qubitsNeeded = Math.max(classicalQubits, pqQubits);
    hoursNeeded = Math.pow(2, levelInfo.quantumBits / 50); // Much longer for hybrid
  } else {
    // Pure post-quantum - only Grover attack applies
    // Grover provides quadratic speedup: 2^n -> 2^(n/2) operations
    qubitsNeeded = Math.pow(2, levelInfo.quantumBits / 256);
    hoursNeeded = Math.pow(2, levelInfo.quantumBits / 25); // Very long time
  }

  return futureLqcph * qubitsNeeded * hoursNeeded;
}

function getMigrationRecommendation(balanceUsd, currentLevel) {
  const levelInfo = SECURITY_LEVELS[currentLevel];

  // Calculate current cracking cost
  const currentCrackingCost = calculateLQCphCrackingCost(currentLevel, 0);

  // Calculate cracking cost 5 years from now (quantum progress)
  const futureCrackingCost = calculateLQCphCrackingCost(currentLevel, 5);

  // Safety margin based on current quantum capabilities
  const currentSafetyMargin = currentCrackingCost / Math.max(balanceUsd, 1);

  // Safety margin based on projected quantum capabilities
  const futureSafetyMargin = futureCrackingCost / Math.max(balanceUsd, 1);

  let urgency = 'none';
  let deadline = null;
  let message = '';

  if (currentSafetyMargin < MIGRATION_AUTOMATIC_FACTOR) {
    urgency = 'required';
    deadline = Date.now() + (60 * 60 * 1000); // 1 hour
    message = 'URGENT: Balance exceeds safe threshold for this security level. Migrate immediately!';
  } else if (currentSafetyMargin < MIGRATION_SUGGESTED_FACTOR) {
    urgency = 'suggested';
    deadline = Date.now() + (7 * 24 * 60 * 60 * 1000); // 1 week
    message = 'Your balance is approaching the safe threshold. Consider migrating to a higher level.';
  } else if (futureSafetyMargin < MIGRATION_SUGGESTED_FACTOR) {
    urgency = 'future';
    deadline = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year
    message = 'Based on quantum computing projections, consider migrating within the next year.';
  }

  // Find recommended level based on balance value
  let recommendedLevel = currentLevel;
  for (const [level, threshold] of Object.entries(VALUE_THRESHOLDS)) {
    if (balanceUsd < threshold) {
      recommendedLevel = Math.max(parseInt(level), currentLevel);
      break;
    }
  }

  // If safety margin is low, recommend at least next level up
  if (urgency !== 'none' && recommendedLevel === currentLevel) {
    recommendedLevel = Math.min(currentLevel + 1, 15);
  }

  return {
    currentLevel,
    recommendedLevel,
    urgency,
    deadline,
    message,
    safetyMargin: currentSafetyMargin,
    futureSafetyMargin,
    crackingCost: currentCrackingCost,
    futureCrackingCost,
    balanceUsd,
    lqcph: LQCPH_CURRENT,
    quantumBits: levelInfo.quantumBits
  };
}

async function migrateFunds(fromLevel, toLevel, amount, password) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (password !== walletState.sessionPassword) {
    throw new Error('Invalid password');
  }

  if (toLevel <= fromLevel) {
    throw new Error('Can only migrate to higher security levels');
  }

  const activeWallet = getActiveWallet();
  if (!activeWallet) {
    throw new Error('No active wallet');
  }

  const fromWallet = activeWallet.childWallets[fromLevel];
  const toWallet = activeWallet.childWallets[toLevel];

  if (!fromWallet || !toWallet) {
    throw new Error('Invalid wallet levels');
  }

  // Build migration transaction
  const tx = {
    from: fromWallet.address,
    to: toWallet.address,
    value: amount,
    security_level: fromLevel,
    gas_limit: 21000,
    gas_price: '1000000',
    migration: true,
    target_level: toLevel
  };

  const result = await rpcCall('tx_send', [tx]);

  return {
    success: true,
    hash: result.hash || bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
    fromLevel,
    toLevel,
    fromAddress: fromWallet.address,
    toAddress: toWallet.address,
    amount
  };
}

async function sendTransaction(tx, password) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  if (password !== walletState.sessionPassword) {
    throw new Error('Invalid password');
  }

  const activeParentWallet = getActiveWallet();
  if (!activeParentWallet) {
    throw new Error('No active wallet');
  }

  const activeChildWallet = activeParentWallet.childWallets[walletState.activeLevel];
  if (!activeChildWallet) {
    throw new Error('Active security level not found');
  }

  // ── SpendAndRotate flow ─────────────────────────────────────────────
  // Each send rotates this wallet's active child. Steps:
  //   1. Derive a new child at the next index from the parent entropy.
  //   2. Two-phase signed submission:
  //      a. `tx_prepareRotate` — chain returns the unsigned borsh blob
  //         and the 32-byte payload to sign (includes our pubkey so the
  //         chain can verify against tx.from = SHA3(pub_concat)).
  //      b. Sign the payload locally with the active child's secret.
  //      c. `tx_submitSigned` — chain attaches sig, verifies, and
  //         submits a proper SpendAndRotate tx (registers forwarding,
  //         sweeps old → new, updates parent_resolution if applicable).
  //   3. On success, swap the locally-stored active child to the new one
  //      and remember the bumped index for the next rotation.
  //
  // If anything fails before submission we don't rotate locally — so
  // failed sends don't burn child indices.
  const currentIndex = activeChildWallet.index || 0;
  const nextIndex = currentIndex + 1;

  let newChild;
  try {
    newChild = await deriveChildKey(
      activeParentWallet.parentEntropy,
      walletState.activeLevel,
      nextIndex,
    );
  } catch (e) {
    throw new Error(`Failed to derive new child for rotation: ${e.message}`);
  }

  // Two-phase signed SpendAndRotate:
  //   Phase 1: chain builds the unsigned tx (includes our pubkey in the
  //            payload that gets hashed) and returns the borsh blob plus
  //            the 32-byte signing payload.
  //   Phase 2: wallet signs the payload with the active child's secret
  //            material, posts {blob, sig}; chain attaches sig, verifies
  //            cryptographically, and submits to mempool.
  //
  // Only level 5 supports client-side signing right now (secp256k1+Ed25519
  // are bundled in qc-crypto.js). Other levels will fail here until WASM
  // post-quantum signing is integrated.
  if (!activeChildWallet.publicKey) {
    throw new Error(
      `Cannot sign from level ${walletState.activeLevel}: no public key on active child. ` +
      `Only level 5 supports client-side signing in this build.`,
    );
  }
  if (!globalThis.qcCrypto) {
    throw new Error('qc-crypto module not loaded; cannot sign transaction');
  }

  // Track A3: if this wallet's parent is registered on chain, include a
  // real Merkle proof for the new child's leaf. The chain's B5 verifier
  // (apply_spend_and_rotate) will check it against the stored commitment
  // and reject if it doesn't match. Unregistered parents fall through to
  // the existing transition-mode (chain skips proof verification).
  let derivationProof = null;
  if (activeParentWallet.registered && activeParentWallet.committedLeaves) {
    try {
      const proof = generateProofForRotationIndex(
        activeParentWallet.committedLeaves,
        nextIndex,
      );
      derivationProof = {
        leaf_hash: bytesToHex(proof.leaf_hash),
        path: proof.path.map(bytesToHex),
        leaf_index: Number(proof.leaf_index),
      };
    } catch (e) {
      throw new Error(
        `Cannot generate Merkle proof for rotation index ${nextIndex}: ${e.message}. ` +
        `The wallet may have exhausted its committed tree (256 rotations) — ` +
        `re-register parent to commit to a fresh tree.`,
      );
    }
  }

  const prepareRequest = {
    from: activeChildWallet.address,
    to: tx.to,
    value: tx.value,
    new_child: newChild.address,
    signer_public_key: bytesToHex(activeChildWallet.publicKey),
    fee: tx.gasPrice || '5000',
  };
  if (derivationProof) {
    prepareRequest.derivation_proof = derivationProof;
  }

  const prepared = await rpcCall('tx_prepareRotate', [prepareRequest]);
  if (!prepared || !prepared.tx_blob || !prepared.signing_payload) {
    throw new Error('tx_prepareRotate returned malformed response');
  }

  // Re-derive the identity (keyBytes are still on the child object) so we
  // get a fresh `sign(payload)` closure. The result is byte-deterministic
  // — the chain re-derives the same pubkey from `signer_public_key` and
  // verifies our signature against `tx.signing_payload()`.
  let sigBytes;
  try {
    const identity = await globalThis.qcCrypto.deriveLevel5Identity(activeChildWallet.keyBytes);
    sigBytes = await identity.sign(hexToBytes(prepared.signing_payload));
  } catch (e) {
    throw new Error(`Failed to sign rotation tx: ${e.message}`);
  }

  const submitted = await rpcCall('tx_submitSigned', [{
    tx_blob: prepared.tx_blob,
    signature: bytesToHex(sigBytes),
  }]);
  const txHash = submitted && submitted.tx_hash;
  if (!txHash) {
    throw new Error('SpendAndRotate failed: no hash returned from node');
  }

  // Rotation succeeded — swap the active child locally so subsequent
  // sends use the new one (and so balance refresh queries hit the
  // correct address).
  activeParentWallet.childWallets[walletState.activeLevel] = newChild;

  // Persist the bumped index so a wallet lock / browser restart re-derives
  // at the correct rotation index instead of falling back to 0.
  // Best-effort: if storage fails we still return success — the on-chain
  // tx already landed; the worst case is the wallet shows the OLD child
  // address after restart and the user has to manually refresh.
  try {
    await saveAllWallets(walletState.sessionPassword);
  } catch (e) {
    console.warn('Failed to persist rotation; index may reset on restart:', e);
  }

  return {
    success: true,
    hash: txHash,
    level: walletState.activeLevel,
    new_child_address: newChild.address,
    new_child_index: nextIndex,
  };
}

// ============ Track A: Parent Registration ============

/**
 * Get the parent identity status for the active wallet.
 *
 * Cheap, sync-style — just reads the in-memory parentIdentity that was
 * built at unlock time. Used by the popup to show "registered" / "not
 * registered" status and the parent address (so users know where to
 * faucet-fund for registration).
 */
function getParentStatus() {
  if (!walletState.isUnlocked) {
    return { unlocked: false };
  }
  const wallet = getActiveWallet();
  if (!wallet) {
    return { unlocked: true, hasParent: false };
  }
  if (!wallet.parentIdentity) {
    return {
      unlocked: true,
      hasParent: false,
      reason: 'parent identity not derived (qc-pq missing or old wallet format)',
    };
  }
  return {
    unlocked: true,
    hasParent: true,
    parent_address: wallet.parentIdentity.parent_address,
    committed_root_hex: wallet.committedRoot
      ? bytesToHex(wallet.committedRoot)
      : null,
    committed_leaf_count: wallet.committedLeaves
      ? wallet.committedLeaves.length
      : 0,
    registered: !!wallet.registered,
    registration_tx_hash: wallet.registrationTxHash || null,
  };
}

/**
 * Register the active wallet's parent on chain.
 *
 * Steps:
 *   1. Verify the parent identity + 256-leaf tree are present in memory
 *   2. Generate a Merkle proof for the initial child (leaf 0)
 *   3. Call `tx_prepareWalletRegistration` to get tx_blob + signing_payload
 *   4. Composite-sign the signing_payload (~1.5s for SLH-DSA)
 *   5. Call `tx_submitWalletRegistration` to submit
 *   6. Mark the wallet `registered = true` and persist
 *
 * The caller (popup) should make sure the parent_address has been
 * faucet-funded BEFORE calling — we don't do it automatically here so the
 * UI can show the user what's happening. Insufficient parent balance
 * surfaces as an `Insufficient funds` error from the chain.
 */
async function registerParent(password) {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }
  if (password !== walletState.sessionPassword) {
    throw new Error('Invalid password');
  }

  const wallet = getActiveWallet();
  if (!wallet) throw new Error('No active wallet');
  if (!wallet.parentIdentity) {
    throw new Error('Parent identity not available — wallet may need to be unlocked or the qc-pq library failed to load');
  }
  if (wallet.registered) {
    return {
      success: true,
      already_registered: true,
      parent_address: wallet.parentIdentity.parent_address,
      registration_tx_hash: wallet.registrationTxHash,
    };
  }
  if (!wallet.committedLeaves || wallet.committedLeaves.length === 0) {
    throw new Error('Committed Merkle tree not built — wallet bootstrap incomplete');
  }

  // Generate proof for leaf 0 (= the initial child at level 5, index 0)
  const proof = generateProofForRotationIndex(wallet.committedLeaves, 0);

  // The initial child must match the leaf-0 child. Look it up; if the
  // wallet has rotated past index 0 already, register is no longer valid
  // (parent_resolution would already be bound to a later child). Treat
  // that as a fatal error — they should have registered at first launch.
  const level5Child = wallet.childWallets[5];
  if (!level5Child) {
    throw new Error('Active wallet has no level-5 child — cannot register');
  }
  if ((level5Child.index || 0) !== 0) {
    throw new Error(
      `Cannot register parent: active level-5 child is at rotation index ${level5Child.index}, ` +
      `but registration must use index 0 (initial child)`,
    );
  }

  // Pad commitment to 64 bytes (chain stores 64-byte derivation_commitment;
  // we use the first 32 for the Merkle root, remaining 32 are reserved zero).
  const commitment64 = new Uint8Array(64);
  commitment64.set(wallet.committedRoot, 0);

  // Auto-faucet: registration costs a small fee paid out of the parent's
  // balance. If the parent has 0 balance, the chain rejects with an
  // "insufficient funds" error during apply. Drip first, wait a beat for
  // inclusion, then proceed. This is the difference between "click
  // Register and it works" and "click Register and get a confusing error".
  try {
    const bal = await rpcCall('chain_getBalance', [wallet.parentIdentity.parent_address]);
    const balPlanck = BigInt(bal && bal.balance ? bal.balance : '0');
    if (balPlanck === 0n) {
      console.log('Auto-faucet: parent has 0 balance, dripping…');
      await rpcCall('faucet_drip', [wallet.parentIdentity.parent_address]);
      // Wait for the faucet drip to land (channel-1 finality is ~200ms but
      // gossip + inclusion takes a few seconds in practice).
      await new Promise((resolve) => setTimeout(resolve, 9000));
    }
  } catch (e) {
    // Don't fatal here — the user might be running against a chain
    // without faucet, or the faucet might be rate-limited. The
    // tx_submitWalletRegistration call below will surface a clean error
    // if the balance is still insufficient.
    console.warn('Auto-faucet probe failed (continuing anyway):', e.message);
  }

  // Phase 1: prepare
  const prepareReq = {
    parent_address: wallet.parentIdentity.parent_address,
    parent_public_key: bytesToHex(wallet.parentIdentity.parent_public_key),
    derivation_commitment: bytesToHex(commitment64),
    initial_child_address: level5Child.address,
    initial_child_proof: {
      leaf_hash: bytesToHex(proof.leaf_hash),
      path: proof.path.map(bytesToHex),
      leaf_index: Number(proof.leaf_index),
    },
    fee: '5000',
  };
  const prepared = await rpcCall('tx_prepareWalletRegistration', [prepareReq]);
  if (!prepared || !prepared.tx_blob || !prepared.signing_payload) {
    throw new Error('tx_prepareWalletRegistration returned malformed response');
  }

  // Phase 2: composite-sign
  const payload = hexToBytes(prepared.signing_payload);
  const sigs = await globalThis.qcParent.signComposite(
    payload,
    wallet.parentIdentity.dilithium5,
    wallet.parentIdentity.sphincsplus256f,
  );

  // Phase 3: submit
  const submitReq = {
    tx_blob: prepared.tx_blob,
    dilithium5_sig: bytesToHex(sigs.dilithium5_sig),
    sphincsplus256f_sig: bytesToHex(sigs.sphincsplus256f_sig),
  };
  const submitted = await rpcCall('tx_submitWalletRegistration', [submitReq]);
  const txHash = submitted && submitted.tx_hash;
  if (!txHash) {
    throw new Error('tx_submitWalletRegistration returned no tx_hash');
  }

  // Persist registration. Use a try/catch around persist — the on-chain
  // tx already landed; the worst case is the wallet shows "not registered"
  // until next storage write, but the chain still treats it as registered.
  wallet.registered = true;
  wallet.registrationTxHash = txHash;
  try {
    await saveAllWallets(walletState.sessionPassword);
  } catch (e) {
    console.warn('Failed to persist registration flag; will retry on next save:', e);
  }

  return {
    success: true,
    parent_address: wallet.parentIdentity.parent_address,
    registration_tx_hash: txHash,
    committed_root_hex: bytesToHex(wallet.committedRoot),
    committed_leaf_count: wallet.committedLeaves.length,
  };
}

/**
 * Drip 100 QCH from the testnet faucet to one of the wallet's addresses.
 *
 * `target` selects which address gets credited:
 *   - 'active' (default) → the active level-5 child (= the address shown
 *     in the popup; what users send/receive from)
 *   - 'parent' → the level-20 parent address (used by registerParent's
 *     auto-faucet path so the user doesn't have to copy-paste)
 *
 * The faucet is just `faucet_drip` on the chain RPC — no proxy. We surface
 * the resulting tx hash for the popup to show inline.
 */
async function faucetDripToActive(target = 'active') {
  if (!walletState.isUnlocked) {
    throw new Error('Wallet is locked');
  }
  const wallet = getActiveWallet();
  if (!wallet) {
    throw new Error('No active wallet');
  }

  let address;
  if (target === 'parent') {
    if (!wallet.parentIdentity) {
      throw new Error('Parent identity not derived (qc-pq missing or old wallet)');
    }
    address = wallet.parentIdentity.parent_address;
  } else {
    const child = wallet.childWallets[walletState.activeLevel];
    if (!child) {
      throw new Error(`No child wallet at level ${walletState.activeLevel}`);
    }
    address = child.address;
  }

  const result = await rpcCall('faucet_drip', [address]);
  if (!result || !result.success) {
    throw new Error('Faucet rejected the request');
  }
  return {
    success: true,
    address,
    tx_hash: result.tx_hash,
    amount_planck: result.amount,
  };
}

// ============ RPC Client ============

async function rpcCall(method, params) {
  const response = await fetch(currentEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.result;
}

// ============ Encryption Functions ============

async function encryptParentWallet(entropy, password) {
  const encoder = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    entropy
  );

  return {
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
    version: 1,
    createdAt: Date.now()
  };
}

async function decryptParentWallet(encrypted, password) {
  const encoder = new TextEncoder();

  const salt = new Uint8Array(encrypted.salt);
  const iv = new Uint8Array(encrypted.iv);
  const data = new Uint8Array(encrypted.data);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return new Uint8Array(decrypted);
}

// ============ Utilities ============

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  let result = '';
  while (num > 0) {
    result = BASE58_ALPHABET[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }

  for (const byte of bytes) {
    if (byte === 0) result = '1' + result;
    else break;
  }

  return result || '1';
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ============ Initialization ============
console.log('QuanChain TADEQS Wallet service worker initialized');
console.log(`Parent wallet size: ${PARENT_WALLET_SIZE} bytes (64 KB)`);
console.log(`Security levels: 1-20 (15 implemented, 5 reserved)`);
