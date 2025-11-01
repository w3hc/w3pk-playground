# w3pk Playground

Passwordless Ethereum wallets secured by biometric authentication and client-side encryption.

- [**Live playground**](http://w3pk.w3hc.org)
- [w3pk SDK repo](https://github.com/w3hc/w3pk)
- [Stealth Gov (example voting app)](https://github.com/w3hc/stealth-gov)

The w3pk SDK includes the following features:

- 🔐 Passwordless authentication (WebAuthn/FIDO2)
- 🔒 Client-only biometric-gated wallet encryption (AES-GCM-256)
- ⏱️ Session management (configurable duration, prevents repeated prompts)
- 🌱 HD wallet generation (BIP39/BIP44)
- 🔢 Multi-address derivation
- 🥷 ERC-5564 stealth addresses (privacy-preserving transactions with view tags)
- 🧮 ZK primitives (zero-knowledge proof generation and verification)
- 🔗 Chainlist support (2390+ networks, auto-filtered RPC endpoints)
- ⚡ EIP-7702 network detection (329+ supported networks)
- 🛡️ Three-layer backup & recovery system
  - Passkey auto-sync (iCloud/Google/Microsoft)
  - Encrypted backups (ZIP/QR with password protection)
  - Social recovery (Shamir Secret Sharing)

## Install

```bash
pnpm i
```

## Run

Create a `.env` file:

```bash
cp .env.template .env
```

Then:

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Documentation References

- [React 19](https://react.dev/blog/2024/12/05/react-19) - Latest React features
- [Next.js 16.0.0](https://nextjs.org/docs) - React framework
- [Chakra UI v2](https://v2.chakra-ui.com/) - UI component library
- [Ethers.js v6](https://docs.ethers.org/v6/) - Ethereum library
- [w3pk v0.6.0](https://github.com/w3hc/w3pk) - w3pk SDK

## Support

You can reach out to [Julien](https://github.com/julienbrg) on [Farcaster](https://warpcast.com/julien-), [Element](https://matrix.to/#/@julienbrg:matrix.org), [Status](https://status.app/u/iwSACggKBkp1bGllbgM=#zQ3shmh1sbvE6qrGotuyNQB22XU5jTrZ2HFC8bA56d5kTS2fy), [Telegram](https://t.me/julienbrg), [Twitter](https://twitter.com/julienbrg), [Discord](https://discordapp.com/users/julienbrg), or [LinkedIn](https://www.linkedin.com/in/julienberanger/).

<img src="https://bafkreid5xwxz4bed67bxb2wjmwsec4uhlcjviwy7pkzwoyu5oesjd3sp64.ipfs.w3s.link" alt="built-with-ethereum-w3hc" width="100"/>
