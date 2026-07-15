/**
 * QuanChain Wallet - Popup UI Controller
 * TADEQS (Transcendent Adapting Dynamic Efficients Quantum Secure Encryption) Support
 */

// Security level definitions for UI
const SECURITY_LEVELS = {
  1: { name: 'ECDSA-128', category: 'classical', quantumBits: 50 },
  2: { name: 'ECDSA-192', category: 'classical', quantumBits: 75 },
  3: { name: 'Ed25519', category: 'classical', quantumBits: 100 },
  4: { name: 'ECDSA+RSA-2048', category: 'classical', quantumBits: 112 },
  5: { name: 'ECDSA+RSA-4096', category: 'classical', quantumBits: 128 },
  6: { name: 'Dilithium2+ECDSA', category: 'hybrid', quantumBits: 150 },
  7: { name: 'Dilithium2+P256', category: 'hybrid', quantumBits: 150 },
  8: { name: 'Dilithium3+P384', category: 'hybrid', quantumBits: 175 },
  9: { name: 'Dilithium3+Ed25519', category: 'hybrid', quantumBits: 175 },
  10: { name: 'Falcon-512+RSA', category: 'hybrid', quantumBits: 180 },
  11: { name: 'Falcon-512+P384', category: 'hybrid', quantumBits: 180 },
  12: { name: 'SPHINCS+-128f', category: 'pq', quantumBits: 200 },
  13: { name: 'SPHINCS+-192f', category: 'pq', quantumBits: 225 },
  14: { name: 'SPHINCS+-256f', category: 'pq', quantumBits: 256 },
  15: { name: 'Dilithium5+Falcon-1024', category: 'pq', quantumBits: 300 },
  16: { name: 'Reserved-NIST-L16', category: 'reserved', quantumBits: 350 },
  17: { name: 'Reserved-NIST-L17', category: 'reserved', quantumBits: 400 },
  18: { name: 'Reserved-NIST-L18', category: 'reserved', quantumBits: 450 },
  19: { name: 'Reserved-NIST-L19', category: 'reserved', quantumBits: 480 },
  20: { name: 'Maximum-Security', category: 'reserved', quantumBits: 512 }
};

// DOM Elements
const screens = {
  loading: document.getElementById('loading-screen'),
  welcome: document.getElementById('welcome-screen'),
  create: document.getElementById('create-screen'),
  created: document.getElementById('created-screen'),
  import: document.getElementById('import-screen'),
  unlock: document.getElementById('unlock-screen'),
  main: document.getElementById('main-screen'),
  levels: document.getElementById('levels-screen'),
  send: document.getElementById('send-screen'),
  receive: document.getElementById('receive-screen'),
  migrate: document.getElementById('migrate-screen'),
  settings: document.getElementById('settings-screen'),
  addresses: document.getElementById('addresses-screen'),
  renameWallet: document.getElementById('rename-wallet-screen'),
  createAdditionalWallet: document.getElementById('create-additional-wallet-screen'),
  importAdditionalWallet: document.getElementById('import-additional-wallet-screen')
};

// State
let currentAddress = null;
let currentLevel = 5;
let allLevels = {};
let allWallets = [];
let activeWalletId = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  showScreen('loading');

  await new Promise(r => setTimeout(r, 500));

  try {
    const status = await sendMessage({ type: 'GET_WALLET_STATUS' });

    if (!status || !status.hasWallet) {
      showScreen('welcome');
    } else if (status.isUnlocked) {
      currentAddress = status.address;
      currentLevel = status.activeLevel || 5;
      showScreen('main');
      await loadMainScreen();
    } else {
      showScreen('unlock');
    }
  } catch (error) {
    console.error('Init error:', error);
    showScreen('welcome');
  }

  setupEventListeners();
}

function setupEventListeners() {
  // Welcome screen
  document.getElementById('btn-create-wallet').addEventListener('click', () => showScreen('create'));
  document.getElementById('btn-import-wallet').addEventListener('click', () => showScreen('import'));

  // Create screen
  document.getElementById('btn-back-create').addEventListener('click', () => showScreen('welcome'));
  document.getElementById('btn-create-confirm').addEventListener('click', handleCreateWallet);

  // Created screen
  document.getElementById('btn-created-continue').addEventListener('click', async () => {
    showScreen('main');
    await loadMainScreen();
  });

  // Import screen
  document.getElementById('btn-back-import').addEventListener('click', () => showScreen('welcome'));
  document.getElementById('btn-import-confirm').addEventListener('click', handleImportWallet);

  // Unlock screen
  document.getElementById('btn-unlock').addEventListener('click', handleUnlock);
  document.getElementById('unlock-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUnlock();
  });

  // Main screen
  document.getElementById('btn-header-refresh').addEventListener('click', handleHeaderRefresh);
  document.getElementById('btn-settings').addEventListener('click', () => showScreen('settings'));
  document.getElementById('btn-change-level').addEventListener('click', () => {
    showScreen('levels');
    loadLevelsScreen();
  });
  document.getElementById('btn-send').addEventListener('click', () => {
    showScreen('send');
    document.getElementById('send-level').textContent = currentLevel;
    document.getElementById('send-error').textContent = '';
    document.getElementById('send-success').textContent = '';
  });
  document.getElementById('btn-receive').addEventListener('click', () => {
    showScreen('receive');
    loadReceiveScreen();
  });
  document.getElementById('btn-refresh').addEventListener('click', handleRefresh);
  document.getElementById('btn-lock').addEventListener('click', handleLock);
  document.getElementById('btn-copy-address').addEventListener('click', () => copyToClipboard(currentAddress));
  document.getElementById('btn-get-test-qch').addEventListener('click', handleFaucetDrip);
  document.getElementById('btn-migrate').addEventListener('click', () => {
    showScreen('migrate');
    loadMigrateScreen();
  });

  // Levels screen
  document.getElementById('btn-back-levels').addEventListener('click', () => showScreen('main'));
  document.querySelectorAll('.levels-tabs .tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.levels-tabs .tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderLevelsList(e.target.dataset.category);
    });
  });

  // Send screen
  document.getElementById('btn-back-send').addEventListener('click', () => showScreen('main'));
  document.getElementById('btn-send-max').addEventListener('click', handleSendMax);
  document.getElementById('btn-send-confirm').addEventListener('click', handleSendTransaction);

  // Receive screen
  document.getElementById('btn-back-receive').addEventListener('click', () => showScreen('main'));
  document.getElementById('btn-copy-receive').addEventListener('click', () => {
    const addr = document.getElementById('receive-address').textContent;
    copyToClipboard(addr);
  });
  document.getElementById('receive-level-select').addEventListener('change', handleReceiveLevelChange);

  // Migrate screen
  document.getElementById('btn-back-migrate').addEventListener('click', () => showScreen('main'));
  document.getElementById('btn-migrate-max').addEventListener('click', handleMigrateMax);
  document.getElementById('btn-migrate-confirm').addEventListener('click', handleMigrateFunds);

  // Settings screen
  document.getElementById('btn-back-settings').addEventListener('click', () => showScreen('main'));
  document.getElementById('settings-endpoint').addEventListener('change', handleEndpointChange);
  document.getElementById('btn-export-wallet').addEventListener('click', handleExportWallet);
  document.getElementById('btn-view-all-addresses').addEventListener('click', () => {
    showScreen('addresses');
    loadAllAddresses();
  });
  document.getElementById('btn-reset-wallet').addEventListener('click', handleResetWallet);

  // Addresses screen
  document.getElementById('btn-back-addresses').addEventListener('click', () => showScreen('settings'));

  // Wallet selector dropdown
  document.getElementById('btn-wallet-selector').addEventListener('click', toggleWalletDropdown);
  document.getElementById('btn-create-new-wallet').addEventListener('click', () => {
    closeWalletDropdown();
    showScreen('createAdditionalWallet');
    document.getElementById('create-additional-error').textContent = '';
    document.getElementById('create-additional-success').textContent = '';
  });
  document.getElementById('btn-import-new-wallet').addEventListener('click', () => {
    closeWalletDropdown();
    showScreen('importAdditionalWallet');
    document.getElementById('import-additional-error').textContent = '';
    document.getElementById('import-additional-success').textContent = '';
  });

  // Rename wallet screen
  document.getElementById('btn-back-rename').addEventListener('click', () => showScreen('settings'));
  document.getElementById('btn-rename-confirm').addEventListener('click', handleRenameWallet);
  document.getElementById('btn-rename-wallet').addEventListener('click', () => {
    showScreen('renameWallet');
    loadRenameScreen();
  });

  // Create additional wallet screen
  document.getElementById('btn-back-create-additional').addEventListener('click', () => showScreen('main'));
  document.getElementById('btn-create-additional-confirm').addEventListener('click', handleCreateAdditionalWallet);

  // Import additional wallet screen
  document.getElementById('btn-back-import-additional').addEventListener('click', () => showScreen('main'));
  document.getElementById('btn-import-additional-confirm').addEventListener('click', handleImportAdditionalWallet);

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const selector = document.querySelector('.wallet-selector');
    if (selector && !selector.contains(e.target)) {
      closeWalletDropdown();
    }
  });
}

// Screen Management
function showScreen(name) {
  Object.values(screens).forEach(s => {
    if (s) s.classList.remove('active');
  });
  if (screens[name]) {
    screens[name].classList.add('active');
  }
}

// Message passing to background
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response || {});
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Handlers
async function handleCreateWallet() {
  const password = document.getElementById('create-password').value;
  const confirmPassword = document.getElementById('create-password-confirm').value;

  if (password.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }

  try {
    const result = await sendMessage({
      type: 'CREATE_WALLET',
      password
    });

    currentAddress = result.activeAddress;
    currentLevel = result.activeLevel;

    document.getElementById('created-level').textContent = result.activeLevel;

    showScreen('created');
  } catch (error) {
    alert('Failed to create wallet: ' + error.message);
  }
}

async function handleImportWallet() {
  const entropy = document.getElementById('import-entropy').value.trim();
  const password = document.getElementById('import-password').value;

  if (!entropy) {
    alert('Please enter your parent wallet data');
    return;
  }

  if (entropy.length !== 131072) {
    alert(`Invalid parent wallet size. Expected 131,072 hex characters (64 KB), got ${entropy.length}`);
    return;
  }

  if (password.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }

  try {
    const result = await sendMessage({
      type: 'IMPORT_WALLET',
      entropy,
      password
    });

    currentAddress = result.activeAddress;
    currentLevel = result.activeLevel;
    showScreen('main');
    await loadMainScreen();
  } catch (error) {
    alert('Failed to import wallet: ' + error.message);
  }
}

async function handleUnlock() {
  const password = document.getElementById('unlock-password').value;
  const errorEl = document.getElementById('unlock-error');

  try {
    const result = await sendMessage({
      type: 'UNLOCK_WALLET',
      password
    });

    currentAddress = result.address;
    currentLevel = result.activeLevel;
    document.getElementById('unlock-password').value = '';
    errorEl.textContent = '';
    showScreen('main');
    await loadMainScreen();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function handleLock() {
  await sendMessage({ type: 'LOCK_WALLET' });
  showScreen('unlock');
}

/**
 * Drip 100 testnet QCH from the chain faucet to the active child address.
 *
 * Inline result/error in the `#faucet-feedback` div under the balance.
 * Refreshes the balance after a short wait so the user sees the new total.
 */
async function handleFaucetDrip() {
  const btn = document.getElementById('btn-get-test-qch');
  const fb = document.getElementById('faucet-feedback');
  if (!btn || !fb) return;

  btn.disabled = true;
  fb.classList.remove('hidden', 'success', 'error');
  fb.classList.add('loading');
  fb.textContent = 'Requesting 100 QCH from faucet…';

  try {
    const result = await sendMessage({ type: 'FAUCET_DRIP', target: 'active' });
    if (!result || !result.success) {
      throw new Error('Faucet returned no success');
    }
    fb.classList.remove('loading');
    fb.classList.add('success');
    const txShort = result.tx_hash
      ? `${result.tx_hash.slice(0, 14)}…`
      : '';
    fb.textContent = `100 QCH sent (tx ${txShort}). Refreshing balance…`;

    // Wait a few seconds for inclusion, then refresh balance.
    setTimeout(async () => {
      try { await loadMainScreen(); } catch {}
      // Auto-clear feedback after a longer delay so user sees the result.
      setTimeout(() => fb.classList.add('hidden'), 6000);
    }, 7000);
  } catch (err) {
    fb.classList.remove('loading');
    fb.classList.add('error');
    fb.textContent = `Faucet failed: ${err.message || err}`;
  } finally {
    // Re-enable after a short cooldown to discourage rapid re-clicks.
    setTimeout(() => {
      btn.disabled = false;
    }, 4000);
  }
}

async function handleRefresh() {
  const btn = document.getElementById('btn-refresh');
  const icon = btn.querySelector('.action-icon');

  // Add spinning animation
  icon.classList.add('spinning');
  btn.disabled = true;

  try {
    await loadMainScreen();
  } finally {
    // Remove spinning animation after a minimum delay for visual feedback
    setTimeout(() => {
      icon.classList.remove('spinning');
      btn.disabled = false;
    }, 500);
  }
}

async function handleHeaderRefresh() {
  const btn = document.getElementById('btn-header-refresh');

  // Add spinning animation
  btn.classList.add('spinning');
  btn.disabled = true;

  try {
    await loadMainScreen();
    showToast('Balance updated');
  } catch (error) {
    showToast('Failed to refresh: ' + error.message, 'error');
  } finally {
    // Remove spinning animation after a minimum delay for visual feedback
    setTimeout(() => {
      btn.classList.remove('spinning');
      btn.disabled = false;
    }, 500);
  }
}

function showToast(message, type = 'success') {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after 2 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

async function loadMainScreen() {
  try {
    // Get accounts
    const accounts = await sendMessage({ type: 'GET_ACCOUNTS' });
    if (accounts && accounts.accounts && accounts.accounts.length > 0) {
      const activeAccount = accounts.accounts[0];
      document.getElementById('account-name').textContent = activeAccount.name || 'Account 1';
      document.getElementById('account-address').textContent = truncateAddress(activeAccount.address);
      currentAddress = activeAccount.address;
      currentLevel = activeAccount.level || accounts.activeLevel;
    }

    // Update security level badge
    const levelInfo = SECURITY_LEVELS[currentLevel];
    document.getElementById('level-number').textContent = currentLevel;
    document.getElementById('level-name').textContent = levelInfo ? levelInfo.name : `Level ${currentLevel}`;

    // Update badge color based on category
    const badge = document.getElementById('security-badge');
    badge.className = 'security-level-badge';
    if (levelInfo) {
      badge.classList.add(levelInfo.category);
    }

    // Get balance
    const balance = await sendMessage({ type: 'GET_BALANCE' });
    if (balance && balance.balance !== undefined) {
      document.getElementById('balance-amount').textContent = formatBalance(balance.balance);
    }

    // Get network info
    const network = await sendMessage({ type: 'GET_NETWORK_INFO' });
    const statusEl = document.getElementById('network-status');
    if (network && network.connected) {
      statusEl.textContent = 'Testnet';
      statusEl.parentElement.querySelector('.dot').style.background = 'var(--success)';
    } else {
      statusEl.textContent = 'Disconnected';
      statusEl.parentElement.querySelector('.dot').style.background = 'var(--error)';
    }

    // Check for migration recommendations using LQCp/h metric
    await checkMigrationRecommendation();

    // Refresh parent registration status (Track A)
    await renderParentStatus();

    // Load recent transactions
    await loadTransactions();

  } catch (error) {
    console.error('Failed to load main screen:', error);
  }
}

async function loadTransactions() {
  const listEl = document.getElementById('transactions-list');

  try {
    const result = await sendMessage({ type: 'GET_TRANSACTIONS', limit: 5 });

    if (!result || !result.transactions || result.transactions.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No transactions yet</div>';
      return;
    }

    listEl.innerHTML = result.transactions.map(tx => {
      const isOutgoing = tx.direction === 'out';
      const icon = isOutgoing ? '&#8593;' : '&#8595;';
      const iconClass = isOutgoing ? 'send' : 'receive';
      const amountClass = isOutgoing ? 'negative' : 'positive';
      const amount = formatTxAmount(tx.value);
      const hashDisplay = tx.hash ? (tx.hash.length > 16 ? tx.hash.slice(0, 12) + '...' : tx.hash) : 'pending';
      const otherParty = isOutgoing ? tx.to : tx.from;
      const otherPartyShort = otherParty ? truncateAddress(otherParty) : 'Unknown';
      const explorerUrl = tx.hash ? `https://www.quanchain.ai/testnet/tx/${encodeURIComponent(tx.hash)}` : '#';

      return `
        <a href="${explorerUrl}" target="_blank" class="transaction-item-link" title="View on Explorer">
          <div class="transaction-item">
            <div class="tx-info">
              <div class="tx-icon ${iconClass}">${icon}</div>
              <div class="tx-details">
                <div class="tx-type">${isOutgoing ? 'Sent' : 'Received'}</div>
                <div class="tx-address">${isOutgoing ? 'To: ' : 'From: '}${otherPartyShort}</div>
              </div>
            </div>
            <div class="tx-amount">
              <div class="amount ${amountClass}">${isOutgoing ? '-' : '+'}${amount} QCH</div>
              <div class="time">${hashDisplay}</div>
            </div>
          </div>
        </a>
      `;
    }).join('');

  } catch (error) {
    console.error('Failed to load transactions:', error);
    listEl.innerHTML = '<div class="empty-state">Unable to load transactions</div>';
  }
}

function formatTxAmount(value) {
  const num = parseInt(value || '0') / 1e9;
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  if (num >= 1) {
    return num.toFixed(2);
  }
  return num.toFixed(4);
}

/**
 * Check for migration recommendations based on LQCp/h economic model
 * This implements the TADEQS safety margin calculation:
 *   - Safety Margin = CrackingCost / Balance
 *   - < 1.5x: Automatic migration required
 *   - < 3.0x: Migration suggested
 */
/**
 * Track A: render the parent registration banner.
 *
 * Three states:
 *   - "no parent / unsupported" → hide entirely (legacy wallets)
 *   - "registered" → green check + tx hash + parent address (truncated)
 *   - "unregistered" → warning + parent address + Register button
 */
async function renderParentStatus() {
  const el = document.getElementById('parent-status');
  if (!el) return;

  let status;
  try {
    status = await sendMessage({ type: 'GET_PARENT_STATUS' });
  } catch (e) {
    console.warn('GET_PARENT_STATUS failed:', e);
    el.classList.add('hidden');
    return;
  }

  if (!status || !status.unlocked || !status.hasParent) {
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');
  const parentShort = status.parent_address
    ? `${status.parent_address.slice(0, 18)}…${status.parent_address.slice(-8)}`
    : '';

  if (status.registered) {
    el.className = 'parent-status registered';
    const txShort = status.registration_tx_hash
      ? `${status.registration_tx_hash.slice(0, 14)}…`
      : '—';
    el.innerHTML = `
      <div class="parent-icon">✓</div>
      <div class="parent-content">
        <div class="parent-title">Parent registered</div>
        <div class="parent-subtitle">
          ${escapeHtml(parentShort)}<br>
          tx: ${escapeHtml(txShort)}
        </div>
      </div>
    `;
  } else {
    el.className = 'parent-status unregistered';
    el.innerHTML = `
      <div class="parent-icon">⚠</div>
      <div class="parent-content">
        <div class="parent-title">Parent not registered</div>
        <div class="parent-subtitle">
          Fund this address, then click Register to anchor your wallet on-chain:<br>
          ${escapeHtml(parentShort)}
        </div>
      </div>
      <button class="btn-register" id="btn-register-parent" type="button">Register</button>
    `;
    const btn = document.getElementById('btn-register-parent');
    if (btn) btn.addEventListener('click', onRegisterParentClick);
  }
}

/**
 * Click handler: prompt for password (we don't store it in popup),
 * then trigger the service-worker REGISTER_PARENT flow.
 */
async function onRegisterParentClick() {
  const pwd = prompt(
    'Enter your wallet password to sign the parent registration. ' +
    'This will take ~1-2 seconds (SLH-DSA signing).',
  );
  if (!pwd) return;

  const el = document.getElementById('parent-status');
  if (el) {
    el.className = 'parent-status signing';
    el.innerHTML = `
      <div class="parent-icon">⟳</div>
      <div class="parent-content">
        <div class="parent-title">Signing parent registration…</div>
        <div class="parent-subtitle">Composite ML-DSA-87 + SLH-DSA-256f signature in progress.</div>
      </div>
    `;
  }

  try {
    const result = await sendMessage({ type: 'REGISTER_PARENT', password: pwd });
    if (result && result.success) {
      // Re-render to show the new "registered" state.
      await renderParentStatus();
    } else {
      alert('Registration failed: unexpected response from service worker');
      await renderParentStatus();
    }
  } catch (err) {
    alert(`Registration failed: ${err.message || err}`);
    await renderParentStatus();
  }
}

/**
 * Tiny HTML-escape — used in renderParentStatus to be safe with addresses
 * that contain only base58 chars but defensive in case of future formats.
 */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function checkMigrationRecommendation() {
  const migrationAlert = document.getElementById('migration-alert');
  const migrationText = document.getElementById('migration-text');

  try {
    // Get current balance
    const balance = await sendMessage({ type: 'GET_BALANCE' });
    const balanceBase = parseInt(balance.balance || '0');

    // Estimate USD value (using approximate QCH price)
    // In production, this would query an oracle or price feed
    const QCH_PRICE_USD = 0.01; // Example: $0.01 per QCH
    const balanceQch = balanceBase / 1e9;
    const balanceUsd = balanceQch * QCH_PRICE_USD;

    // Get migration recommendation from service worker
    const recommendation = await sendMessage({
      type: 'GET_MIGRATION_RECOMMENDATION',
      balance: balanceUsd,
      currentLevel: currentLevel
    });

    if (recommendation.urgency === 'none') {
      migrationAlert.classList.add('hidden');
      return;
    }

    // Show migration alert based on urgency
    migrationAlert.classList.remove('hidden');

    if (recommendation.urgency === 'required') {
      migrationAlert.style.borderColor = 'var(--error)';
      migrationAlert.style.background = 'rgba(239, 68, 68, 0.1)';
      migrationAlert.querySelector('.alert-icon').textContent = '!!';
      migrationAlert.querySelector('.alert-icon').style.color = 'var(--error)';
      migrationAlert.querySelector('.alert-title').textContent = 'Migration Required';
      migrationAlert.querySelector('.alert-title').style.color = 'var(--error)';
      migrationText.textContent = recommendation.message;
      migrationAlert.querySelector('.btn-migrate').style.background = 'var(--error)';
    } else if (recommendation.urgency === 'suggested') {
      migrationAlert.style.borderColor = 'var(--warning)';
      migrationAlert.style.background = 'rgba(251, 191, 36, 0.1)';
      migrationAlert.querySelector('.alert-icon').textContent = '!';
      migrationAlert.querySelector('.alert-icon').style.color = 'var(--warning)';
      migrationAlert.querySelector('.alert-title').textContent = 'Migration Suggested';
      migrationAlert.querySelector('.alert-title').style.color = 'var(--warning)';
      migrationText.textContent = recommendation.message;
      migrationAlert.querySelector('.btn-migrate').style.background = 'var(--warning)';
    } else if (recommendation.urgency === 'future') {
      migrationAlert.style.borderColor = 'var(--primary)';
      migrationAlert.style.background = 'rgba(122, 149, 199, 0.1)';
      migrationAlert.querySelector('.alert-icon').textContent = 'i';
      migrationAlert.querySelector('.alert-icon').style.color = 'var(--primary)';
      migrationAlert.querySelector('.alert-title').textContent = 'Consider Upgrading';
      migrationAlert.querySelector('.alert-title').style.color = 'var(--primary)';
      migrationText.textContent = recommendation.message;
      migrationAlert.querySelector('.btn-migrate').style.background = 'var(--primary)';
    }

    // Store recommendation for migration screen
    window.lastMigrationRecommendation = recommendation;

  } catch (error) {
    console.error('Failed to check migration recommendation:', error);
    migrationAlert.classList.add('hidden');
  }
}

async function loadLevelsScreen() {
  try {
    const result = await sendMessage({ type: 'GET_ALL_LEVELS' });
    allLevels = result.levels;
    currentLevel = result.activeLevel;
    renderLevelsList('classical');
  } catch (error) {
    console.error('Failed to load levels:', error);
  }
}

function renderLevelsList(category) {
  const container = document.getElementById('levels-list');
  container.innerHTML = '';

  for (let level = 1; level <= 20; level++) {
    const levelDef = SECURITY_LEVELS[level];
    if (levelDef.category !== category) continue;

    const levelData = allLevels[level] || {};
    const isActive = level === currentLevel;
    const isImplemented = level <= 15;

    const div = document.createElement('div');
    div.className = `level-item ${isActive ? 'active' : ''} ${!isImplemented ? 'reserved' : ''}`;
    div.innerHTML = `
      <div class="level-header">
        <span class="level-num">${level}</span>
        <span class="level-title">${levelDef.name}</span>
        ${isActive ? '<span class="active-badge">Active</span>' : ''}
      </div>
      <div class="level-details">
        <span class="quantum-bits">${levelDef.quantumBits} quantum bits</span>
        ${levelData.address ? `<span class="level-address">${truncateAddress(levelData.address)}</span>` : ''}
      </div>
      ${!isImplemented ? '<div class="reserved-notice">Reserved for future NIST standards</div>' : ''}
    `;

    if (isImplemented && !isActive) {
      div.addEventListener('click', () => handleSelectLevel(level));
    }

    container.appendChild(div);
  }
}

async function handleSelectLevel(level) {
  try {
    const result = await sendMessage({
      type: 'SET_ACTIVE_LEVEL',
      level
    });

    currentLevel = result.activeLevel;
    currentAddress = result.address;

    showScreen('main');
    await loadMainScreen();
  } catch (error) {
    alert('Failed to change level: ' + error.message);
  }
}

async function loadReceiveScreen() {
  // Populate level selector
  const select = document.getElementById('receive-level-select');
  select.innerHTML = '';

  for (let level = 1; level <= 15; level++) {
    const levelDef = SECURITY_LEVELS[level];
    const option = document.createElement('option');
    option.value = level;
    option.textContent = `Level ${level} - ${levelDef.name}`;
    if (level === currentLevel) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  await updateReceiveAddress(currentLevel);
}

async function handleReceiveLevelChange(e) {
  const level = parseInt(e.target.value);
  await updateReceiveAddress(level);
}

async function updateReceiveAddress(level) {
  try {
    const result = await sendMessage({
      type: 'GET_CHILD_WALLET',
      level
    });

    document.getElementById('receive-level-label').textContent = level;
    document.getElementById('receive-address').textContent = result.address;
  } catch (error) {
    console.error('Failed to get receive address:', error);
  }
}

async function loadMigrateScreen() {
  const fromSelect = document.getElementById('migrate-from');
  const toSelect = document.getElementById('migrate-to');

  fromSelect.innerHTML = '';
  toSelect.innerHTML = '';

  // Check for stored recommendation
  const recommendation = window.lastMigrationRecommendation;

  for (let level = 1; level <= 15; level++) {
    const levelDef = SECURITY_LEVELS[level];

    const fromOption = document.createElement('option');
    fromOption.value = level;
    fromOption.textContent = `Level ${level} - ${levelDef.name}`;
    if (level === currentLevel) fromOption.selected = true;
    fromSelect.appendChild(fromOption);

    if (level > 1) {
      const toOption = document.createElement('option');
      toOption.value = level;
      toOption.textContent = `Level ${level} - ${levelDef.name}`;
      // Pre-select recommended level if available
      if (recommendation && level === recommendation.recommendedLevel) {
        toOption.selected = true;
      }
      toSelect.appendChild(toOption);
    }
  }

  // Show recommendation info if available
  if (recommendation && recommendation.urgency !== 'none') {
    const infoBox = document.querySelector('#migrate-screen .info-box');
    if (infoBox) {
      let urgencyText = '';
      if (recommendation.urgency === 'required') {
        urgencyText = '<strong style="color: var(--error);">URGENT:</strong> ';
      } else if (recommendation.urgency === 'suggested') {
        urgencyText = '<strong style="color: var(--warning);">Recommended:</strong> ';
      }
      infoBox.innerHTML = `
        ${urgencyText}${recommendation.message}<br><br>
        <small>
          Current Safety Margin: ${recommendation.safetyMargin.toFixed(1)}x<br>
          Recommended Level: ${recommendation.recommendedLevel} (${SECURITY_LEVELS[recommendation.recommendedLevel].name})
        </small>
      `;
    }
  }
}

async function handleMigrateFunds() {
  const fromLevel = parseInt(document.getElementById('migrate-from').value);
  const toLevel = parseInt(document.getElementById('migrate-to').value);
  const amount = document.getElementById('migrate-amount').value;
  const password = document.getElementById('migrate-password').value;
  const errorEl = document.getElementById('migrate-error');
  const successEl = document.getElementById('migrate-success');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (toLevel <= fromLevel) {
    errorEl.textContent = 'Target level must be higher than source level';
    return;
  }

  if (!amount || parseFloat(amount) <= 0) {
    errorEl.textContent = 'Invalid amount';
    return;
  }

  if (!password) {
    errorEl.textContent = 'Password required';
    return;
  }

  try {
    const value = BigInt(Math.floor(parseFloat(amount) * 1e9)).toString();

    const result = await sendMessage({
      type: 'MIGRATE_FUNDS',
      fromLevel,
      toLevel,
      amount: value,
      password
    });

    successEl.textContent = `Migration successful! Hash: ${(result.hash || '').slice(0, 16)}...`;

    document.getElementById('migrate-amount').value = '';
    document.getElementById('migrate-password').value = '';

    setTimeout(loadMainScreen, 2000);
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function handleMigrateMax() {
  try {
    const balance = await sendMessage({ type: 'GET_BALANCE' });
    const balanceNum = parseInt(balance.balance || '0') / 1e9;
    const fee = 0.01;
    const maxAmount = Math.max(0, balanceNum - fee);
    document.getElementById('migrate-amount').value = maxAmount.toFixed(9);
  } catch (error) {
    console.error('Failed to get max:', error);
  }
}

async function handleSendTransaction() {
  const to = document.getElementById('send-to').value.trim();
  const amount = document.getElementById('send-amount').value;
  const password = document.getElementById('send-password').value;
  const errorEl = document.getElementById('send-error');
  const successEl = document.getElementById('send-success');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!to || !to.startsWith('QC')) {
    errorEl.textContent = 'Invalid recipient address';
    return;
  }

  if (!amount || parseFloat(amount) <= 0) {
    errorEl.textContent = 'Invalid amount';
    return;
  }

  if (!password) {
    errorEl.textContent = 'Password required';
    return;
  }

  try {
    const value = BigInt(Math.floor(parseFloat(amount) * 1e9)).toString();

    const result = await sendMessage({
      type: 'SEND_TRANSACTION',
      tx: { to, value },
      password
    });

    successEl.textContent = 'Transaction sent! Hash: ' + (result.hash || '').slice(0, 16) + '...';

    document.getElementById('send-to').value = '';
    document.getElementById('send-amount').value = '';
    document.getElementById('send-password').value = '';

    setTimeout(loadMainScreen, 2000);
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function handleSendMax() {
  try {
    const balance = await sendMessage({ type: 'GET_BALANCE' });
    const balanceNum = parseInt(balance.balance || '0') / 1e9;
    const fee = 0.0252;
    const maxAmount = Math.max(0, balanceNum - fee);
    document.getElementById('send-amount').value = maxAmount.toFixed(9);
  } catch (error) {
    console.error('Failed to get max:', error);
  }
}

async function handleEndpointChange(e) {
  try {
    await sendMessage({
      type: 'SWITCH_ENDPOINT',
      endpoint: e.target.value
    });
    await loadMainScreen();
  } catch (error) {
    alert('Failed to switch endpoint: ' + error.message);
  }
}

async function handleExportWallet() {
  const password = prompt('Enter your password to export the 64KB parent wallet:');
  if (!password) return;

  try {
    const result = await sendMessage({
      type: 'EXPORT_PARENT_WALLET',
      password
    });

    // Ask user which format they want
    const useStructured = confirm(
      'Export Options:\n\n' +
      'OK = Full structured export (JSON with derivation metadata)\n' +
      'Cancel = Raw entropy only (131,072 hex characters)\n\n' +
      'The structured format is recommended for cross-wallet compatibility.'
    );

    let blob, filename;

    if (useStructured) {
      // Full structured export with metadata
      blob = new Blob([result.exportString], { type: 'application/json' });
      filename = `quanchain-tadeqs-wallet-${Date.now()}.json`;
    } else {
      // Raw entropy only
      blob = new Blob([result.entropy], { type: 'text/plain' });
      filename = `quanchain-parent-wallet-${Date.now()}.txt`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    alert(
      'Parent wallet exported!\n\n' +
      'CRITICAL: Keep this file extremely secure!\n' +
      'It can derive ALL your addresses at ALL 20 security levels.\n\n' +
      'Store offline in multiple secure locations.'
    );
  } catch (error) {
    alert('Failed to export: ' + error.message);
  }
}

async function loadAllAddresses() {
  try {
    const result = await sendMessage({ type: 'GET_ALL_LEVELS' });
    const container = document.getElementById('all-addresses-list');
    container.innerHTML = '';

    for (let level = 1; level <= 20; level++) {
      const levelData = result.levels[level];
      const levelDef = SECURITY_LEVELS[level];

      if (!levelData) continue;

      const div = document.createElement('div');
      div.className = `address-item ${levelDef.category}`;
      div.innerHTML = `
        <div class="address-header">
          <span class="level-badge">${level}</span>
          <span class="level-name">${levelDef.name}</span>
          ${level > 15 ? '<span class="reserved-tag">Reserved</span>' : ''}
        </div>
        <div class="address-full">${levelData.address}</div>
        <button class="btn-copy-small" data-address="${levelData.address}">Copy</button>
      `;
      container.appendChild(div);
    }

    // Add copy handlers
    container.querySelectorAll('.btn-copy-small').forEach(btn => {
      btn.addEventListener('click', () => {
        copyToClipboard(btn.dataset.address);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    });
  } catch (error) {
    console.error('Failed to load addresses:', error);
  }
}

async function handleResetWallet() {
  if (!confirm('Are you sure you want to reset your wallet? This cannot be undone!')) {
    return;
  }

  if (!confirm('Have you exported your 64KB parent wallet? You will lose access to ALL funds at ALL security levels without it.')) {
    return;
  }

  await chrome.storage.local.clear();
  location.reload();
}

// Utilities
function truncateAddress(address) {
  if (!address) return '';
  if (address.length <= 20) return address;
  return address.slice(0, 12) + '...' + address.slice(-8);
}

function formatBalance(balance) {
  const num = parseInt(balance || '0') / 1e9;
  if (num >= 1000000) {
    // Show 3 decimal places for millions to show balance changes
    return (num / 1000000).toFixed(3) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toFixed(4);
}

async function copyToClipboard(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

// ==========================================
// Multi-Wallet Functions
// ==========================================

// Toggle wallet selector dropdown
function toggleWalletDropdown(e) {
  e.stopPropagation();
  const selector = document.querySelector('.wallet-selector');
  const dropdown = document.getElementById('wallet-dropdown');

  if (dropdown.classList.contains('hidden')) {
    dropdown.classList.remove('hidden');
    selector.classList.add('open');
    loadWalletList();
  } else {
    closeWalletDropdown();
  }
}

// Close wallet dropdown
function closeWalletDropdown() {
  const selector = document.querySelector('.wallet-selector');
  const dropdown = document.getElementById('wallet-dropdown');
  dropdown.classList.add('hidden');
  selector.classList.remove('open');
}

// Load wallet list in dropdown
async function loadWalletList() {
  try {
    const result = await sendMessage({ type: 'GET_ALL_WALLETS' });
    allWallets = result.wallets || [];
    activeWalletId = result.activeWalletId;

    const listEl = document.getElementById('wallet-list');

    if (allWallets.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No wallets found</div>';
      return;
    }

    listEl.innerHTML = allWallets.map((wallet, index) => {
      const isActive = wallet.id === activeWalletId;
      const displayAddress = wallet.childWallets && wallet.childWallets[5]
        ? truncateAddress(wallet.childWallets[5].address)
        : 'No address';
      const displayName = wallet.name || `Wallet ${index + 1}`;
      const initial = displayName.charAt(0).toUpperCase();

      return `
        <div class="wallet-list-item ${isActive ? 'active' : ''}" data-wallet-id="${wallet.id}">
          <div class="wallet-icon">${initial}</div>
          <div class="wallet-info">
            <div class="wallet-name">${displayName}</div>
            <div class="wallet-address-preview">${displayAddress}</div>
          </div>
          ${isActive ? '<span class="wallet-check">&#10003;</span>' : ''}
        </div>
      `;
    }).join('');

    // Add click handlers for wallet switching
    listEl.querySelectorAll('.wallet-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const walletId = item.dataset.walletId;
        handleSwitchWallet(walletId);
      });
    });

    // Update current wallet name in header
    updateCurrentWalletName();

  } catch (error) {
    console.error('Failed to load wallet list:', error);
  }
}

// Update current wallet name in header
function updateCurrentWalletName() {
  const activeWallet = allWallets.find(w => w.id === activeWalletId);
  const nameEl = document.getElementById('current-wallet-name');
  if (activeWallet) {
    const index = allWallets.indexOf(activeWallet);
    nameEl.textContent = activeWallet.name || `Wallet ${index + 1}`;
  }
}

// Switch to a different wallet
async function handleSwitchWallet(walletId) {
  try {
    const result = await sendMessage({
      type: 'SWITCH_WALLET',
      walletId
    });

    activeWalletId = result.activeWalletId;
    currentAddress = result.address;
    currentLevel = result.activeLevel;

    closeWalletDropdown();
    await loadMainScreen();
    showToast('Wallet switched');

  } catch (error) {
    showToast('Failed to switch wallet: ' + error.message, 'error');
  }
}

// Load rename screen with current wallet info
function loadRenameScreen() {
  const activeWallet = allWallets.find(w => w.id === activeWalletId);
  const index = allWallets.indexOf(activeWallet);
  const currentName = activeWallet?.name || `Wallet ${index + 1}`;

  document.getElementById('rename-current-name').textContent = currentName;
  document.getElementById('rename-new-name').value = '';
  document.getElementById('rename-error').textContent = '';
  document.getElementById('rename-success').textContent = '';
}

// Handle wallet rename
async function handleRenameWallet() {
  const newName = document.getElementById('rename-new-name').value.trim();
  const errorEl = document.getElementById('rename-error');
  const successEl = document.getElementById('rename-success');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!newName) {
    errorEl.textContent = 'Please enter a name';
    return;
  }

  if (newName.length > 32) {
    errorEl.textContent = 'Name must be 32 characters or less';
    return;
  }

  try {
    await sendMessage({
      type: 'RENAME_WALLET',
      walletId: activeWalletId,
      name: newName
    });

    successEl.textContent = 'Wallet renamed successfully!';

    // Refresh wallet list
    await loadWalletList();

    // Update wallet count info
    updateWalletCountInfo();

    setTimeout(() => {
      showScreen('settings');
    }, 1000);

  } catch (error) {
    errorEl.textContent = error.message;
  }
}

// Handle create additional wallet
async function handleCreateAdditionalWallet() {
  const name = document.getElementById('create-additional-name').value.trim();
  const password = document.getElementById('create-additional-password').value;
  const errorEl = document.getElementById('create-additional-error');
  const successEl = document.getElementById('create-additional-success');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!password) {
    errorEl.textContent = 'Please enter your password';
    return;
  }

  try {
    const result = await sendMessage({
      type: 'CREATE_ADDITIONAL_WALLET',
      name: name || undefined,
      password
    });

    activeWalletId = result.walletId;
    currentAddress = result.activeAddress;
    currentLevel = result.activeLevel;

    successEl.textContent = 'New wallet created!';

    // Clear form
    document.getElementById('create-additional-name').value = '';
    document.getElementById('create-additional-password').value = '';

    setTimeout(async () => {
      showScreen('main');
      await loadMainScreen();
      showToast('New wallet created');
    }, 1000);

  } catch (error) {
    errorEl.textContent = error.message;
  }
}

// Handle import additional wallet
async function handleImportAdditionalWallet() {
  const name = document.getElementById('import-additional-name').value.trim();
  const entropy = document.getElementById('import-additional-entropy').value.trim();
  const password = document.getElementById('import-additional-password').value;
  const errorEl = document.getElementById('import-additional-error');
  const successEl = document.getElementById('import-additional-success');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!entropy) {
    errorEl.textContent = 'Please enter the 64KB parent wallet data';
    return;
  }

  if (entropy.length !== 131072) {
    errorEl.textContent = `Invalid wallet size. Expected 131,072 hex characters, got ${entropy.length}`;
    return;
  }

  if (!password) {
    errorEl.textContent = 'Please enter your password';
    return;
  }

  try {
    const result = await sendMessage({
      type: 'IMPORT_ADDITIONAL_WALLET',
      name: name || undefined,
      entropy,
      password
    });

    activeWalletId = result.walletId;
    currentAddress = result.activeAddress;
    currentLevel = result.activeLevel;

    successEl.textContent = 'Wallet imported successfully!';

    // Clear form
    document.getElementById('import-additional-name').value = '';
    document.getElementById('import-additional-entropy').value = '';
    document.getElementById('import-additional-password').value = '';

    setTimeout(async () => {
      showScreen('main');
      await loadMainScreen();
      showToast('Wallet imported');
    }, 1000);

  } catch (error) {
    errorEl.textContent = error.message;
  }
}

// Update wallet count info in settings
function updateWalletCountInfo() {
  const infoEl = document.getElementById('wallet-count-info');
  if (infoEl) {
    infoEl.innerHTML = `You have <span class="count">${allWallets.length}</span> wallet${allWallets.length !== 1 ? 's' : ''}`;
  }
}

// Listen for wallet lock events from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'WALLET_LOCKED') {
    showScreen('unlock');
  }
});
