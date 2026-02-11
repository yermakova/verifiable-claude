const { VerifiableClaude } = require('./verifiable-claude');

async function testFalseClaim() {
  const vc = new VerifiableClaude({ cache: false }); // Disable cache for this test
  
  console.log('\n' + '='.repeat(60));
  console.log('FRAUD PROOF TEST: Can it catch a hallucination?');
  console.log('='.repeat(60) + '\n');
  
  // Ask about a book where Claude often gets details wrong
  const prompt = "Tell me about the book 'The Left Hand of Darkness' - when was it published and what's it about?";
  
  const result = await vc.generate(prompt);
  
  console.log('\n📝 Response:');
  console.log(result.text);
  console.log(`\n📋 Found ${result.claims.length} claims to verify`);
  
  // Verify ALL claims to find any false ones
  console.log('\n' + '='.repeat(60));
  console.log('VERIFYING ALL CLAIMS...');
  console.log('='.repeat(60));
  
  let verifiedCount = 0;
  let falseCount = 0;
  let uncertainCount = 0;
  
  for (let i = 0; i < result.claims.length; i++) {
    const claim = result.claims[i];
    console.log(`\n${i + 1}. Checking: "${claim.text}"`);
    
    const verification = await vc.verify(claim, { subject: 'The Left Hand of Darkness' });
    
    if (verification.verdict === 'VERIFIED') {
      console.log(`   ✅ VERIFIED (${verification.confidence}%)`);
      verifiedCount++;
    } else if (verification.verdict === 'FALSE') {
      console.log(`   ❌ FALSE! (${verification.confidence}% confidence it's wrong)`);
      console.log(`   Reasoning: ${verification.reasoning}`);
      falseCount++;
    } else {
      console.log(`   ⚠️  UNCERTAIN (${verification.confidence}%)`);
      uncertainCount++;
    }
    
    // Wait a bit between searches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('FRAUD PROOF RESULTS:');
  console.log('='.repeat(60));
  console.log(`✅ Verified: ${verifiedCount}`);
  console.log(`❌ False claims caught: ${falseCount}`);
  console.log(`⚠️  Uncertain: ${uncertainCount}`);
  console.log(`\n📊 Accuracy: ${Math.round(verifiedCount / result.claims.length * 100)}%`);
  
  if (falseCount > 0) {
    console.log('\n🎯 SUCCESS! Fraud proof system caught hallucinations!');
  }
}

testFalseClaim().catch(console.error);