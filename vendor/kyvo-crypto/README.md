kyvo-crypto.min.js = esbuild IIFE bundle (global `KyvoCrypto`) of source-entry.js with:
- tweetnacl 1.0.3 (Unlicense) — ed25519 verify (Solana signMessage)
- @noble/secp256k1 1.7.1 (MIT) — recoverPublicKey (EVM personal_sign)
- @noble/hashes 1.3.3 (MIT) — keccak_256
Verification only; no key generation or signing happens in Kyvo.
