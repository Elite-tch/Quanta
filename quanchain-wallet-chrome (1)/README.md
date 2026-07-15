# QuanVault Extension

A Chrome browser extension wallet for the QuanChain testnet and ecosystem onboarding flow.

## Features

- **Create & Import Wallets**: Generate new wallets with 24-word BIP-39 mnemonic phrases or import existing ones
- **Multiple Security Levels**: Choose from Classical (ECDSA), Hybrid (ECDSA + Dilithium), or Post-Quantum (Dilithium) cryptography
- **Send & Receive QCH**: Transfer tokens on the QuanChain testnet
- **dApp Integration**: Connect to decentralized applications via `window.quanchain` provider
- **Multi-Node Support**: Switch between testnet RPC endpoints
- **Encrypted Storage**: Wallet data is AES-256-GCM encrypted with PBKDF2 key derivation
- **Auto-Lock**: Automatically locks after 15 minutes of inactivity

## Installation

### Development Mode

1. Clone or download this extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `quanchain-wallet-extension` folder
5. The QuanVault icon should appear in your extensions bar

### Building Icons

The extension requires PNG icons. Create or replace the following files:
- `icons/icon16.png` (16x16)
- `icons/icon48.png` (48x48)
- `icons/icon128.png` (128x128)

## Usage

### Creating a New Wallet

1. Click the QuanVault extension icon
2. Click "Create New Wallet"
3. Enter a strong password (minimum 8 characters)
4. Select your security level:
   - **Level 5 (Classical)**: Standard ECDSA, smaller signatures
   - **Level 7 (Hybrid)**: ECDSA + Dilithium, quantum-resistant
   - **Level 12 (Post-Quantum)**: Pure Dilithium, fully quantum-safe
5. **Important**: Write down and safely store your 24-word recovery phrase
6. Confirm you've saved your recovery phrase

### Importing an Existing Wallet

1. Click "Import Existing Wallet"
2. Enter your 24-word recovery phrase
3. Create a new password
4. Select the security level that matches your original wallet

### Sending QCH

1. Click the "Send" button
2. Enter the recipient's QuanChain address (starts with `QC`)
3. Enter the amount in QCH
4. Enter your password to sign the transaction
5. Click "Send Transaction"

### Receiving QCH

1. Click the "Receive" button
2. Share your address with the sender
3. Use the "Copy Address" button for convenience

## dApp Integration

Web applications can interact with QuanVault through the injected provider:

```javascript
// Check if QuanVault is installed
if (window.quanchain) {
  // Connect to wallet
  const accounts = await window.quanchain.connect();
  console.log('Connected:', accounts[0]);

  // Get balance
  const balance = await window.quanchain.request({
    method: 'qc_getBalance',
    params: [accounts[0]]
  });

  // Send transaction
  const txHash = await window.quanchain.request({
    method: 'qc_sendTransaction',
    params: [{
      to: 'QC5_recipient_address...',
      value: '1000000000' // 1 QCH in base units (9 decimals)
    }]
  });
}
```

### Available Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `qc_requestAccounts` | Connect and get accounts | None |
| `qc_accounts` | Get connected accounts | None |
| `qc_chainId` | Get chain ID | None |
| `qc_getBalance` | Get account balance | `[address]` |
| `qc_sendTransaction` | Send transaction | `[{to, value, data?}]` |
| `qc_estimateGas` | Estimate gas for transaction | `[{to, value, data?}]` |
| `qc_getTransaction` | Get transaction by hash | `[hash]` |
| `qc_networkInfo` | Get network information | None |

### Events

```javascript
// Account changed
window.quanchain.on('accountsChanged', (accounts) => {
  console.log('Accounts:', accounts);
});

// Connected
window.quanchain.on('connect', ({ chainId }) => {
  console.log('Connected to chain:', chainId);
});

// Disconnected
window.quanchain.on('disconnect', () => {
  console.log('Disconnected');
});
```

## Testnet Information

The wallet connects to the QuanChain testnet — 4 validators on a single Contabo VPS at `5.189.184.7`, exposed on ports 8545–8548:

| Validator | RPC Endpoint | Role |
|-----------|--------------|------|
| validator-1 | `http://5.189.184.7:8545` | Faucet + producer |
| validator-2 | `http://5.189.184.7:8546` | Producer |
| validator-3 | `http://5.189.184.7:8547` | Producer |
| validator-4 | `http://5.189.184.7:8548` | Producer |

### Token Amounts

QuanChain uses 9 decimal places:
- 1 QCH = 1,000,000,000 base units
- 1,000 QCH = 1,000,000,000,000 base units
- 1,000,000 QCH = 1,000,000,000,000,000 base units

## Security Notes

- **Never share your recovery phrase** - Anyone with your phrase can access your funds
- **Use a strong password** - Your password encrypts the wallet locally
- **Verify addresses** - Always double-check recipient addresses before sending
- **This is testnet** - Do not use for real value transactions

## File Structure

```
quanchain-wallet-extension/
├── manifest.json          # Extension manifest
├── background/
│   └── service-worker.js  # Background service worker
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Styles
│   └── popup.js           # UI logic
├── content/
│   └── inject.js          # Content script (bridge)
├── inpage/
│   └── inpage.js          # Injected provider (window.quanchain)
├── lib/
│   ├── wallet.js          # Wallet implementation
│   ├── crypto.js          # Cryptographic functions
│   ├── secp256k1.js       # Elliptic curve operations
│   ├── bip39.js           # Mnemonic generation
│   └── rpc.js             # JSON-RPC client
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Development

### Debugging

1. Open `chrome://extensions/`
2. Click "Inspect views: service worker" to debug background script
3. Right-click the popup and select "Inspect" to debug the UI

### Testing RPC

```bash
# Check balance
curl -X POST http://5.189.184.7:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"chain_getBalance","params":["QC5_..."],"id":1}'

# Get network info
curl -X POST http://5.189.184.7:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_nodeInfo","params":[],"id":1}'
```

## License

MIT License - QuanChain Project
