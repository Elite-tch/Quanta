# QuanVault Build Plan

## Goal

Build a simple testnet wallet and onboarding surface for the QuanChain ecosystem that removes the first major barrier for new users: wallet setup, test funding, and first transaction flow.

QuanVault should feel like the easiest way to start using QuanChain, especially for people who are not blockchain developers.

---

## Product Positioning

QuanVault is not “just another wallet.”

It is the onboarding layer for QuanChain:

- create a wallet in seconds
- receive testnet tokens without manual setup
- send a first transaction
- view balance and activity
- connect to dApps later

The wallet is the wedge because it solves the exact point where users get stuck.

---

## What We Know Exists Already

From the current `quanchain-wallet-chrome (1)` extension bundle:

- Chrome extension shell already exists
- Popup UI already exists
- Background service worker already exists
- Wallet creation/import flows already exist
- Send/receive flows already exist
- Faucet drip flow already exists
- Multi-wallet support already exists
- Security-level switching already exists
- dApp provider bridge exists

That means the fastest path is not to start from zero.
We should trim, stabilize, and reframe what is already there into a focused MVP.

---

## MVP Scope

### Must Have

- Wallet creation
- Wallet import
- Unlock/lock flow
- Testnet balance display
- Receive address display
- Send QCH
- Faucet request from inside the wallet
- Transaction history
- Basic settings
- Clear security warning and recovery instructions

### Should Have

- Wallet rename
- Multiple wallets
- Endpoint switching
- dApp connection via provider bridge
- Network status display

### Not in v1

- Mobile apps
- Hardware wallet support
- Mainnet support
- Cross-chain features
- NFT marketplace features
- Advanced portfolio analytics
- Overly complex security-level UX

---

## Recommended v1 Product Flow

1. User installs the extension.
2. User creates a wallet.
3. Wallet shows the active address immediately.
4. User clicks “Get test QCH.”
5. User sees balance update.
6. User sends a test transaction.
7. User can copy address, view history, and lock/unlock.

If a user can complete those steps without reading docs, the MVP is successful.

---

## Build Phases

### Phase 1: Cleanup and Alignment

- Rename the product consistently to QuanVault
- Remove duplicate or contradictory naming
- Decide whether v1 security levels are really 1-20 or only a smaller subset
- Reduce copy complexity in the UI
- Make the onboarding language simple enough for non-developers

### Phase 2: Core Wallet Experience

- Harden wallet creation and import
- Verify local encryption and storage behavior
- Ensure unlock and lock are stable
- Make balance, address, and history reliable
- Verify send transaction flow end to end

### Phase 3: Testnet Onboarding

- Make faucet flow frictionless
- Add abuse protection and clear rate-limit messaging
- Make network selection automatic by default
- Surface testnet status clearly

### Phase 4: Developer Access

- Support dApp connection
- Provide a clean provider bridge
- Document supported RPC methods
- Add example integration code

### Phase 5: Ecosystem Readiness

- Improve UX polish
- Add better empty states and error handling
- Add export/recovery guidance
- Prepare for later mainnet expansion

---

## Key User Stories

- As a new user, I want to create a wallet quickly so I can start testing.
- As a developer, I want test tokens inside the wallet so I do not need to manually request them elsewhere.
- As a user, I want to see my balance and recent activity so I know the wallet is working.
- As a user, I want to send a transaction so I can test the chain.
- As a developer, I want dApp connection support so I can test app integrations.

---

## Success Criteria

### Product

- A new user can create a wallet and get test tokens in under 2 minutes
- A user can complete a first transfer without visiting external docs
- The wallet feels easier than manually configuring testnet access

### Technical

- Keys stay local
- Recovery/export behavior is clear
- Transactions succeed reliably against testnet
- The extension does not expose private keys to the web page

### Ecosystem

- QuanVault becomes the default “first step” for QuanChain testnet users
- Non-developers can participate without needing engineering help

---

## Main Risks

- The wallet can become too complex too early
- The TADEQS branding may overwhelm the actual onboarding task
- Security claims must match what the code really does
- Faucet abuse can become a support problem
- If the UI confuses users, the product will not solve the barrier it is meant to remove

---

## Product Recommendation

For now, QuanVault should be positioned as:

**“The easiest way to create a QuanChain testnet wallet and start using the ecosystem.”**

That is a sharper and more believable first release than trying to ship the full future vision at once.

---

## Next Best Deliverables

1. Turn this into a detailed PRD with acceptance criteria.
2. Produce a v1 feature list from the existing extension code.
3. Clean the extension copy and UI to match QuanVault branding.
4. Audit the wallet code for correctness and security before shipping.
