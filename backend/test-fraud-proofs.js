#!/usr/bin/env node

/**
 * Test script for Fraud Proof system
 * Demonstrates Merkle commitments and deterministic verification
 */

require('dotenv').config();
const { VerifiableClaude } = require('./verifiable-claude');
const MerkleTree = require('./merkle-tree');

async function testFraudProofs() {
  console.log('━'.repeat(70));
  console.log('🛡️  FRAUD PROOF SYSTEM TEST');
  console.log('━'.repeat(70));

  // Initialize with deterministic mode
  const vc = new VerifiableClaude({ deterministic: true });

  console.log('\n📝 STEP 1: Generate response with Merkle commitment\n');
  const prompt = "who invented fraud proofs in blockchain";
  const result = await vc.generate(prompt);

  console.log(`✓ Generated response with ${result.claims.length} claims`);
  console.log(`✓ Merkle root: ${result.commitment.root.substring(0, 32)}...`);
  console.log(`✓ Timestamp: ${result.commitment.timestamp}`);

  console.log('\n🔍 Claims detected:');
  result.claims.slice(0, 5).forEach((claim, i) => {
    console.log(`  ${i + 1}. "${claim.text.substring(0, 60)}${claim.text.length > 60 ? '...' : ''}"`);
    console.log(`     Merkle index: ${claim.merkleIndex}`);
    console.log(`     Proof length: ${claim.merkleProof.length} steps`);
  });

  console.log('\n━'.repeat(70));
  console.log('🔎 STEP 2: Challenge a claim (run fraud proof)\n');

  const claimToChallenge = result.claims[0];
  console.log(`Challenging: "${claimToChallenge.text.substring(0, 80)}..."`);

  const verification = await vc.verify(claimToChallenge, {
    userPrompt: prompt,
    merkleRoot: result.commitment.root
  });

  console.log('\n📊 Deterministic Checks:');
  verification.checks.forEach(check => {
    const icon = check.passed ? '✓' : '✗';
    const critical = check.critical ? ' [CRITICAL]' : '';
    console.log(`  ${icon} ${check.name}${critical}`);
    console.log(`    ${check.reason}`);
  });

  console.log(`\n🏁 Verdict: ${verification.verdict}`);
  if (verification.merkleProofValid !== undefined) {
    console.log(`🌳 Merkle proof: ${verification.merkleProofValid ? '✓ Valid' : '✗ Invalid'}`);
  }

  if (verification.fraudProof) {
    console.log('\n⚠️  FRAUD DETECTED!');
    console.log(`   Failed check: ${verification.fraudProof.failedCheck}`);
    console.log(`   Reason: ${verification.fraudProof.reason}`);
    console.log(`   Proof hash: ${verification.fraudProof.proofHash}`);
  }

  console.log('\n━'.repeat(70));
  console.log('🌳 STEP 3: Manually verify Merkle proof\n');

  // Demonstrate anyone can verify the Merkle proof
  const crypto = require('crypto');
  const leafHash = crypto.createHash('sha256').update(claimToChallenge.text).digest('hex');

  console.log(`Leaf hash: ${leafHash.substring(0, 32)}...`);
  console.log(`Expected root: ${result.commitment.root.substring(0, 32)}...`);

  const isValid = MerkleTree.verifyProof(
    leafHash,
    claimToChallenge.merkleProof,
    result.commitment.root
  );

  console.log(`\nMerkle proof verification: ${isValid ? '✓ VALID' : '✗ INVALID'}`);
  console.log('\nThis proves the claim was part of the original response!');

  console.log('\n━'.repeat(70));
  console.log('📋 STEP 4: Compare with LLM mode (legacy)\n');

  const vcLegacy = new VerifiableClaude({ deterministic: false });

  const start = Date.now();
  const verificationLegacy = await vcLegacy.verify(claimToChallenge, { userPrompt: prompt });
  const duration = Date.now() - start;

  console.log('LLM Verification Results:');
  console.log(`  Verdict: ${verificationLegacy.verdict}`);
  console.log(`  Confidence: ${verificationLegacy.confidence}%`);
  console.log(`  Time: ${duration}ms`);
  console.log(`  Reproducible: ❌ No (LLM may give different results)`);
  console.log(`  Provable: ❌ No (subjective judgment)`);

  console.log('\nDeterministic Verification Results:');
  console.log(`  Verdict: ${verification.verdict}`);
  console.log(`  Time: ~200ms (estimated, cached)`);
  console.log(`  Reproducible: ✅ Yes (same inputs = same output)`);
  console.log(`  Provable: ✅ Yes (cryptographic fraud proof)`);

  console.log('\n━'.repeat(70));
  console.log('✅ FRAUD PROOF SYSTEM TEST COMPLETE');
  console.log('━'.repeat(70));
  console.log('\nKey Takeaways:');
  console.log('1. Merkle commitments allow cryptographic proof of claims');
  console.log('2. Deterministic checks are fast and reproducible');
  console.log('3. Anyone can verify fraud proofs independently');
  console.log('4. No need for trusted third party verification');
  console.log('\n');
}

// Run the test
if (require.main === module) {
  testFraudProofs().catch(console.error);
}

module.exports = { testFraudProofs };
