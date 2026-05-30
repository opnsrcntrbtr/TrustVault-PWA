---
type: "query"
date: "2026-05-30T08:28:09.891287+00:00"
question: "How does Zero-Knowledge Architecture relate to WebAuthn PRF S1?"
contributor: "graphify"
source_nodes: ["Zero-Knowledge Architecture", "WebAuthn PRF Vault Unlock (S1)"]
---

# Q: How does Zero-Knowledge Architecture relate to WebAuthn PRF S1?

## Answer

Zero-Knowledge Architecture (documented in README.md Architecture Snapshot) is the abstract architectural principle. WebAuthn PRF S1 (SECURITY.md Biometric Authentication section) is the concrete cryptographic instantiation. The vault key is wrapped with HKDF-SHA256 derived from authenticator PRF output, never persisted, making the system demonstrably zero-knowledge: stored data alone cannot unlock the vault. Cross-references now link both sections bidirectionally.

## Source Nodes

- Zero-Knowledge Architecture
- WebAuthn PRF Vault Unlock (S1)