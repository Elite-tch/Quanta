# QuanVault Feature Map

This document compares the current QuanChain wallet extension bundle with the QuanVault product we want to build in the `quanta` Next.js app.

The goal is not to copy their UI.
The goal is to reuse the right wallet behavior, then build a better product experience on top of it.

---

## 1. Side-by-Side View

| Area | Their Extension | QuanVault Goal |
|---|---|---|
| Product form | Chrome extension wallet | Web-first wallet + onboarding product in Next.js |
| First-run experience | Wallet screens and technical setup language | Guided onboarding that feels simple to non-developers |
| Wallet creation | Present | Present, but easier to understand |
| Wallet import | Present | Present, with clearer recovery language |
| Unlock / lock | Present | Present |
| Balance display | Present | Present, but cleaner and more readable |
| Receive address | Present | Present |
| Send QCH | Present | Present |
| Faucet access | Present | Present, but better guided |
| Transaction history | Present | Present |
| Security levels | Very prominent, highly technical | Available, but simplified in the default UX |
| Multi-wallet support | Present | Optional in later phase |
| dApp provider bridge | Present | Present or planned depending on app architecture |
| Visual design | Functional extension UI | Product-grade, premium onboarding UI |
| Target user | Crypto-native / technical user | New user, developer, and non-developer tester |

---

## 2. What We Can Reuse Conceptually

These are the useful ideas from their extension, even if we do not reuse the actual UI:

- Wallet creation and import flow
- Local wallet encryption model
- Unlock / lock flow
- Testnet balance and address display
- Faucet request inside the wallet
- Transaction history
- Provider-based dApp connection concept
- Endpoint switching
- Multi-wallet model if needed later
- Security warnings around recovery and backups

These are the behaviors worth preserving.

---

## 3. What We Should Improve

This is where QuanVault can become stronger than the extension:

### Onboarding

- Replace technical jargon with step-by-step guidance
- Use a guided “create, fund, test” flow
- Make the first session feel like a product, not a protocol demo

### UX

- Use better hierarchy and spacing
- Make the primary call to action obvious
- Show progress and next steps
- Reduce the amount of crypto-native language in the default view

### Trust

- Explain recovery in plain English
- Explain why the wallet matters before showing advanced features
- Make the testnet-only state very clear

### Accessibility

- Ensure good mobile responsiveness
- Make copy actions easy
- Avoid dense screens with too many controls at once

### Product Clarity

- Present the wallet as the best way to begin using QuanChain
- Separate beginner flow from advanced settings
- Hide advanced security detail unless the user asks for it

---

## 4. What We Should Replace

These parts should be rethought rather than copied:

- Heavy TADEQS branding as the first thing users see
- Security-level jargon in the default onboarding path
- Screens that assume the user already understands wallet mechanics
- Technical detail overload in the first screen
- Extension-first mental model as the only product shape

QuanVault should feel calmer and more guided.

---

## 5. Recommended QuanVault Product Structure

### Phase 1: Simple Onboarding Wallet

Primary goal:

- create wallet
- fund wallet
- send first transaction
- see activity

Recommended screens:

1. Welcome
2. Create wallet
3. Recovery reminder
4. Wallet dashboard
5. Receive / faucet / send

### Phase 2: Developer Tools

- dApp connection
- endpoint switching
- network status
- quick testing tools

### Phase 3: Advanced Wallet

- multiple wallets
- security profile controls
- deeper transaction settings
- export and migration tools

---

## 6. What Makes QuanVault More Advanced

QuanVault can be more advanced without being more complicated.

That means:

- better product architecture
- better onboarding
- cleaner visual design
- smarter defaults
- easier non-developer usage
- a more complete ecosystem entry point

Advanced does not have to mean “more buttons.”
It can mean:

- less friction
- better guidance
- stronger trust
- more clarity
- smoother first use

---

## 7. Product Direction

The best positioning for QuanVault is:

**The simplest way to create a QuanChain wallet, get test QCH, and start using the ecosystem.**

That gives us a product that is:

- useful to developers
- understandable to new users
- stronger than a pure extension UX
- easier to evolve into a full ecosystem wallet later

---

## 8. Build Rule

Use their wallet as a behavior reference.

Use `quanta` as the product canvas.

That means we do not imitate the interface directly.
We build a cleaner version of the same underlying idea with better UX and a more complete product feel.

