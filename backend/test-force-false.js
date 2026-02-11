// Create: backend/test-force-false.js

const { VerifiableClaude } = require('./verifiable-claude');

async function testFalseDetection() {
  const vc = new VerifiableClaude({ cache: false });
  
  console.log('\n' + '='.repeat(60));
  console.log('TESTING FALSE CLAIM DETECTION');
  console.log('='.repeat(60) + '\n');
  
  // Create INTENTIONALLY FALSE claims
  const falseClaims = [
    {
      id: 'test_1',
      text: 'The Left Hand of Darkness was published in 1987',
      type: 'date'
    },
    {
      id: 'test_2', 
      text: 'Neil Armstrong landed on the Moon in 1972',
      type: 'date'
    },
    {
      id: 'test_3',
      text: 'The Eiffel Tower was built in 1920',
      type: 'date'
    },
    {
      id: 'test_4',
      text: 'World War 2 ended in 1950',
      type: 'date'
    }
  ];
  
  let caughtCount = 0;
  
  for (const claim of falseClaims) {
    console.log(`\nTesting: "${claim.text}"`);
    console.log('Expected: FALSE ❌\n');
    
    const verification = await vc.verify(claim);
    
    if (verification.verdict === 'FALSE') {
      console.log(`✅ CAUGHT IT! System correctly identified this as FALSE`);
      console.log(`   Confidence: ${verification.confidence}%`);
      console.log(`   Reasoning: ${verification.reasoning.substring(0, 150)}...`);
      caughtCount++;
    } else if (verification.verdict === 'VERIFIED') {
      console.log(`❌ MISSED! System incorrectly said this was VERIFIED`);
      console.log(`   This is a bug - the fraud proof failed!`);
    } else {
      console.log(`⚠️  UNCERTAIN - System wasn't confident enough to call it false`);
    }
    
    console.log('\n' + '-'.repeat(60));
    
    // Wait between searches
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('RESULTS:');
  console.log(`${'='.repeat(60)}`);
  console.log(`False claims tested: ${falseClaims.length}`);
  console.log(`Correctly caught: ${caughtCount}`);
  console.log(`Detection rate: ${Math.round(caughtCount / falseClaims.length * 100)}%`);
  
  if (caughtCount === falseClaims.length) {
    console.log('\n🎯 PERFECT! Fraud proof system is working!');
  } else if (caughtCount > 0) {
    console.log('\n✓ System catches some false claims, may need tuning');
  } else {
    console.log('\n⚠️  System not catching false claims - needs debugging');
  }
}

testFalseDetection().catch(console.error);