# Smart Sessions Module Implementation Guidelines

This document explains the difference between the current simplified session key implementation and the full Smart Sessions Module integration for production use.

---

## Current Implementation (What We Have Now)

### How It Works

1. **Session Key Creation**: User creates a "session key" which is a W3PK-derived address (index 1)
2. **Metadata Storage**: We store metadata (expiry, spending limits) in **localStorage only**
3. **Transaction Flow**:
   - User signs with session key (for verification)
   - User signs Safe transaction with owner key (index 0)
   - Backend validates: "Is signature valid? Is key expired?"
   - If checks pass → execute transaction

### Security Model

✅ **Strengths:**
- User must authenticate with passkey
- Backend verifies signatures
- Simple implementation for demos/prototypes
- Lower gas costs (fewer on-chain transactions)

❌ **Limitations:**
- Spending limits are NOT enforced on-chain
- Session permissions are NOT stored on the blockchain
- Requires trusting the backend/relayer
- If backend is bypassed, limits can be ignored

### Analogy
It's like writing "spending limit: $100" on a sticky note, but the bank (blockchain) doesn't actually know about it.

### Code Example
```typescript
// Backend validation (current)
if (Date.now() > sessionKey.validUntil * 1000) {
  return error('Session expired') // We check this in backend
}
// Execute transaction (no on-chain verification)
await safe.executeTransaction(tx)
```

---

## Full Smart Sessions Module (Future Production)

### Overview

The Smart Sessions Module is an on-chain system that stores session permissions directly on the blockchain and enforces them through smart contracts. This enables trustless, cryptographically-verified session management.

### Implementation Steps

#### 1. **Encode Session Validator Init Data**

Tell the Smart Sessions module which address is a valid session key for the Safe.

```typescript
import { getSessionKeyModule } from '@rhinestone/module-sdk'

// Initialize the module
const sessionModule = getSessionKeyModule({
  moduleAddress: SMART_SESSIONS_MODULE,
  provider: ethersProvider,
})

// Encode session data
const sessionData = encodeSessionData({
  sessionKey: '0x7a71CD...', // W3PK-derived address
  validator: OWNABLE_VALIDATOR, // Rules for who can use it
})
```

#### 2. **Define Action Policies (On-Chain)**

Create policies that will be enforced by the smart contract.

```typescript
const policy = {
  // Enforced by smart contract on every transaction
  spendingLimit: ethers.parseEther('0.1'), // 0.1 ETH max

  // Only allow these tokens
  allowedTokens: [
    ethers.ZeroAddress, // Native token (ETH/xDAI)
    '0x...', // Specific ERC20 tokens
  ],

  // Time restrictions
  validAfter: Math.floor(Date.now() / 1000),
  validUntil: Math.floor(Date.now() / 1000) + 86400, // 24 hours

  // Optional: whitelist specific addresses
  allowedRecipients: ['0x...', '0x...'],

  // Optional: specific function calls allowed
  allowedCalls: [
    {
      to: '0x...', // Contract address
      selector: '0xa9059cbb', // transfer(address,uint256)
    }
  ],
}
```

#### 3. **Enable Session On-Chain**

Register the session key with the Safe and store permissions on the blockchain.

```typescript
// Create the enable session transaction
const enableSessionTx = await sessionModule.getEnableSessionTransaction({
  safe: safeAddress,
  sessionKey: sessionKeyAddress,
  policy: policy,
})

// Execute through Safe (requires owner signature)
const protocolKit = await Safe.init({
  provider: rpcUrl,
  signer: userPrivateKey, // Owner signs
  safeAddress: safeAddress,
})

const safeTx = await protocolKit.createTransaction({
  transactions: [enableSessionTx],
})

const signedTx = await protocolKit.signTransaction(safeTx)

// Relayer executes (pays gas)
const relayerKit = await Safe.init({
  provider: rpcUrl,
  signer: relayerPrivateKey,
  safeAddress: safeAddress,
})

await relayerKit.executeTransaction(signedTx)
```

#### 4. **Execute Transactions with Session Key**

Transactions are now verified and enforced on-chain.

```typescript
// Execute a transaction using the session key
const txResponse = await sessionModule.executeWithSession({
  safe: safeAddress,
  sessionKey: sessionKeyAddress,
  transaction: {
    to: recipientAddress,
    value: ethers.parseEther('0.05'),
    data: '0x',
  },
})

// Smart contract automatically checks:
// - Is session key registered for this Safe?
// - Has spending limit been exceeded?
// - Is current timestamp within validAfter/validUntil?
// - Is recipient address allowed?
// - If ANY check fails → transaction REVERTS on-chain
```

### On-Chain Verification Flow

```solidity
// Simplified Solidity pseudocode of what happens on-chain

function executeWithSession(
  address safe,
  address sessionKey,
  Transaction memory tx
) external {
  Session memory session = sessions[safe][sessionKey];

  // Check 1: Is session registered?
  require(session.enabled, "Session not enabled");

  // Check 2: Is session still valid?
  require(block.timestamp >= session.validAfter, "Session not started");
  require(block.timestamp <= session.validUntil, "Session expired");

  // Check 3: Spending limit check
  require(
    session.spentAmount + tx.value <= session.spendingLimit,
    "Spending limit exceeded"
  );

  // Check 4: Is token/recipient allowed?
  require(
    session.allowedTokens.contains(tx.token),
    "Token not allowed"
  );

  // Update spent amount
  session.spentAmount += tx.value;

  // Execute transaction
  safe.execTransactionFromModule(tx);
}
```

### Security Model

✅ **Strengths:**
- Session permissions stored on blockchain (immutable, verifiable)
- Smart contract enforces spending limits automatically
- No need to trust backend/relayer
- Anyone can verify session permissions on-chain
- Cryptographic proof of permissions
- Composable with other DeFi protocols
- True decentralization

❌ **Tradeoffs:**
- Higher gas costs (on-chain storage and verification)
- More complex implementation
- Requires Rhinestone SDK integration
- Additional transactions for session management

### Analogy
The bank (blockchain) now has your actual spending limit in their database. Even if you try to bypass their app, the ATM (smart contract) will reject transactions over the limit.

---

## Comparison Table

| Feature | Current Implementation | Full Smart Sessions Module |
|---------|----------------------|---------------------------|
| **Session registration** | localStorage (client-side) | On-chain (blockchain state) |
| **Spending limits** | Backend validation | Smart contract enforcement |
| **Expiry check** | Backend validation | Smart contract enforcement |
| **Security model** | Trust backend/relayer | Trustless (blockchain verification) |
| **Permission storage** | Client localStorage | Blockchain state |
| **Verification** | Backend API | Smart contract |
| **Complexity** | Simple ✅ | Complex (SDK integration) |
| **Gas costs** | Lower (fewer transactions) | Higher (on-chain storage) |
| **Implementation time** | Days | Weeks |
| **Good for demo?** | ✅ Yes | Overkill |
| **Production ready?** | ⚠️ Requires trusted backend | ✅ Fully trustless |
| **Composability** | Limited | Full DeFi composability |

---

## When to Use Each Approach

### Use Current Implementation (Simplified) When:

- Building a demo or prototype
- Backend/relayer is trusted
- Speed of development is priority
- Lower gas costs are important
- Single-party execution (your own relayer)
- MVP stage

### Use Full Smart Sessions Module When:

- Building production dApp
- Need trustless execution
- Multiple relayers/executors
- Require cryptographic proof
- Integration with other protocols
- Need on-chain verifiable permissions
- Security is paramount
- Post-MVP, scaling phase

---

## Migration Path

### Phase 1: Current Implementation (✅ Completed)
- Session keys via W3PK derivation
- Backend signature verification
- localStorage metadata tracking
- Basic spending limit checks

### Phase 2: Hybrid Approach
- Keep current backend validation
- Add on-chain session registration
- Dual verification (backend + on-chain)
- Gradual SDK integration

### Phase 3: Full On-Chain (Future)
- Complete Rhinestone SDK integration
- Remove backend validation
- Pure on-chain permission enforcement
- Trustless execution

---

## Implementation Resources

### Required Packages
```bash
npm install @rhinestone/module-sdk
```

### Key Addresses
```typescript
// Smart Sessions Module (deterministic across all EVM chains)
const SMART_SESSIONS_MODULE = '0x00000000008bDABA73cD9815d79069c247Eb4bDA'

// Ownable Validator
const OWNABLE_VALIDATOR = '0x000000000013fdB5234E4E3162a810F54d9f7E98'
```

### Documentation Links
- [Rhinestone Module SDK](https://docs.rhinestone.wtf/)
- [Smart Sessions Module](https://docs.rhinestone.wtf/module-sdk/smart-sessions)
- [Safe Protocol Kit](https://docs.safe.global/sdk/protocol-kit)
- [Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)

---

## Code References

### Current Implementation Files
- `src/app/api/safe/create-session-key/route.ts` - Session creation (simplified)
- `src/app/api/safe/send-tx/route.ts` - Transaction execution with backend validation
- `src/app/safe/page.tsx` - Frontend session key management

### Future Implementation TODOs
Look for comments marked:
```typescript
// FUTURE ENHANCEMENT: Full Smart Sessions Module SDK integration
```

These indicate where the full module integration would be added.

---

## Conclusion

The current implementation is **perfectly adequate** for:
- Demos and prototypes
- Educational purposes
- Trusted environment applications
- MVPs and proof-of-concepts

The full Smart Sessions Module is **necessary** for:
- Production dApps
- Trustless execution
- Multi-party systems
- DeFi integrations
- Maximum security

Choose based on your project stage, security requirements, and trust assumptions.
