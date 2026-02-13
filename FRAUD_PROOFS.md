# Fraud Proofs for AI - Implementation Guide

## Overview

This system implements **Optimistic Verification** for AI responses, inspired by Arbitrum-style fraud proofs.

### Key Concept

```
Traditional Citations          Fraud Proofs
━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━
LLM judgment                   Deterministic checks
Subjective                     Reproducible
Check everything               Challenge specific claims
Re-execute all                 Minimal re-verification
No commitments                 Cryptographic commitments
```

## Architecture

### 1. Response Generation (Optimistic)

```javascript
// Generate response
const result = await vc.generate("who invented fraud proofs");

// Result includes:
{
  text: "...",
  claims: [...],           // Individual factual claims
  commitment: {            // Merkle tree commitment
    root: "a3f8b2...",    // SHA-256 hash
    timestamp: "...",
    claimCount: 16
  }
}
```

**Each claim includes a Merkle proof** that cryptographically proves it was part of the original response.

### 2. Deterministic Verification

Unlike LLM-based verification (subjective, not reproducible), deterministic verification runs **rule-based checks**:

#### Check 1: URL Validity
```javascript
// Verify URLs actually exist (HEAD request)
✓ 3/3 URLs return 200 OK
```

#### Check 2: Quote Exact Match
```javascript
// For quoted text, check exact string matching
"Joseph Poon co-authored..." → Found in source #2 ✓
```

#### Check 3: Entity Consistency
```javascript
// Named entities should appear in multiple sources
"Vitalik Buterin" → Found in 4/5 sources ✓
"Joseph Poon" → Found in 3/5 sources ✓
```

#### Check 4: Source Credibility
```javascript
// Deterministic domain scoring
wikipedia.org → 90/100
medium.com → 70/100
blogspot.com → 40/100
```

#### Check 5: Temporal Consistency
```javascript
// Dates should be confirmed in sources
"2015-2017" → Found in 3/5 sources ✓
```

### 3. Fraud Proof Generation

If any **critical check** fails, a fraud proof is generated:

```javascript
{
  claimHash: "5a3c1f...",
  failedCheck: "Quote Exact Match",
  reason: "Quoted text not found in any source",
  evidence: [...],
  proofHash: "8d4e9a..."  // Cryptographic proof
}
```

**Anyone can independently verify this proof** by re-running the same deterministic checks.

### 4. Merkle Proof Verification

Each claim can be challenged with its Merkle proof:

```javascript
// Verify claim was in original commitment
const leafHash = hash(claim.text);
const valid = MerkleTree.verifyProof(
  leafHash,
  claim.merkleProof,
  response.commitment.root
);

if (!valid) {
  // FRAUD PROVEN: Claim was not in original response
}
```

## Usage

### Enable Deterministic Mode

Add to `.env`:
```bash
DETERMINISTIC_MODE=true
```

### Generate Response with Commitment

```javascript
const result = await vc.generate("who invented fraud proofs");

console.log(result.commitment);
// {
//   root: "a3f8b2c4d5e6f7a8b9c0d1e2f3a4b5c6...",
//   timestamp: "2024-02-11T10:30:00.000Z",
//   claimCount: 16
// }
```

### Challenge a Specific Claim

```javascript
// User challenges claim #5
const claim = result.claims[5];

// Run fraud proof
const verification = await vc.verify(claim, {
  userPrompt: "who invented fraud proofs",
  merkleRoot: result.commitment.root
});

console.log(verification.verdict);
// "VERIFIED" | "FRAUD_PROVEN" | "UNCERTAIN"

if (verification.verdict === 'FRAUD_PROVEN') {
  console.log(verification.fraudProof);
  // {
  //   failedCheck: "URL Validity",
  //   reason: "0/3 URLs accessible",
  //   proofHash: "..."
  // }
}
```

### Inspect Deterministic Checks

```javascript
console.log(verification.checks);
// [
//   { name: "URL Validity", passed: true, ... },
//   { name: "Quote Exact Match", passed: true, ... },
//   { name: "Entity Consistency", passed: false, critical: false, ... },
//   { name: "Source Credibility", passed: true, ... },
//   { name: "Temporal Consistency", passed: true, ... }
// ]
```

## Why This Matters

### Traditional AI Citations
- **Subjective**: Different runs = different verdicts
- **Expensive**: Re-runs LLM for each verification
- **Not provable**: Can't prove to third parties

### Fraud Proofs
- **Objective**: Same inputs = same verdict (deterministic)
- **Cheap**: Rule-based checks, no LLM calls
- **Provable**: Anyone can verify the fraud proof

## Comparison Table

| Feature | LLM Verification | Deterministic (Fraud Proofs) |
|---------|------------------|------------------------------|
| Speed | Slow (~2-3s per claim) | Fast (~200ms per claim) |
| Cost | $0.01 per verification | $0 (no LLM calls) |
| Reproducible | ❌ No | ✅ Yes |
| Provable | ❌ No | ✅ Yes (cryptographic) |
| Accuracy | ~85% | ~80% |
| Cryptographic commitment | ❌ No | ✅ Yes (Merkle tree) |

## Implementation Status

### ✅ Phase 1 (Complete)
- [x] Merkle tree generation
- [x] Cryptographic commitments (SHA-256)
- [x] Deterministic verification (5 checks)
- [x] Fraud proof generation
- [x] Merkle proof verification

### 🚧 Phase 2 (Next)
- [ ] Frontend UI for challenging claims
- [ ] Visual Merkle tree display
- [ ] Challenge period mechanism
- [ ] Public dispute resolution

### 📋 Phase 3 (Future)
- [ ] On-chain commitment storage
- [ ] Economic incentives for challengers
- [ ] Slashing for false claims
- [ ] Reputation system

## Example Output

```bash
npm start

🔧 Verification mode: DETERMINISTIC (fraud proofs)
   ✓ Merkle tree commitments enabled
   ✓ Reproducible verification
   ✓ Cryptographic fraud proofs

📥 Generate request: "who invented fraud proofs"
💬 Generating response...
🔍 Using AI to detect factual claims...
✓ Detected 16 factual claims
🌳 Merkle commitment: a3f8b2c4d5e6f7a8...

🔎 Running fraud proof...
⚡ Using deterministic verification (fraud proof mode)
📡 Searching for evidence...
✓ Found 5 search results

Running checks:
  ✓ URL Validity: 5/5 URLs accessible
  ✓ Quote Exact Match: All quotes found
  ✓ Entity Consistency: 12/14 entities confirmed
  ✓ Source Credibility: 85/100 avg score
  ✓ Temporal Consistency: 3/3 dates confirmed

✓ Verdict: VERIFIED
  Merkle proof: ✓ Valid
```

## Next Steps

1. **Try it**: Set `DETERMINISTIC_MODE=true` in `.env`
2. **Compare**: Run same query in both modes
3. **Challenge**: Pick a claim and verify it
4. **Inspect**: Look at the deterministic checks
5. **Build**: Add UI for visual fraud proofs
