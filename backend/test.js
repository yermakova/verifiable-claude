const { VerifiableClaude } = require('./verifiable-claude');

async function test() {
  // Enable caching (default, but showing it explicitly)
  const vc = new VerifiableClaude({ 
    cache: true,
    cacheFile: './cache.json' 
  });
  
  // To clear cache and start fresh, uncomment:
  // vc.clearCache();
  
  const prompt = "Tell me about the Apollo 11 mission";
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: "${prompt}"`);
  console.log(`${'='.repeat(60)}\n`);
  
  // First run: Will hit API (costs money)
  // Second run: Will use cache (free!)
  const result = await vc.generate(prompt);
  
  console.log('\n📝 Response:');
  console.log(result.text);
  console.log(`\n📋 Found ${result.claims.length} claims`);
  
  if (result.metadata.cached) {
    console.log('\n💰 Cost: $0.00 (cached)');
  } else {
    console.log('\n💰 Cost: ~$0.02 (fresh API call)');
  }
  
  // Verify first claim if any exist
  if (result.claims.length > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 Verifying first claim...');
    console.log(`${'='.repeat(60)}\n`);
    
    const verification = await vc.verify(result.claims[0]);
    
    console.log(`\n✅ Verdict: ${verification.verdict} (${verification.confidence}% confidence)`);
    console.log(`📄 Reasoning: ${verification.reasoning}`);
    
    if (verification.evidence && verification.evidence.length > 0) {
      console.log(`\n📚 Evidence sources:`);
      verification.evidence.slice(0, 3).forEach((source, i) => {
        console.log(`  ${i + 1}. ${source.title}`);
        console.log(`     ${source.url}`);
      });
    }
  }
}

async function testMultipleRuns() {
  console.log('\n' + '='.repeat(60));
  console.log('CACHE EFFICIENCY TEST');
  console.log('='.repeat(60));
  
  const vc = new VerifiableClaude();
  const prompt = "When was the Eiffel Tower built?";
  
  console.log('\n🔄 Run 1: Fresh API call...');
  const start1 = Date.now();
  await vc.generate(prompt);
  const time1 = Date.now() - start1;
  console.log(`   Time: ${time1}ms, Cost: ~$0.02`);
  
  console.log('\n🔄 Run 2: Should be cached...');
  const start2 = Date.now();
  await vc.generate(prompt);
  const time2 = Date.now() - start2;
  console.log(`   Time: ${time2}ms, Cost: $0.00`);
  
  console.log(`\n⚡ Speed improvement: ${Math.round(time1 / time2)}x faster`);
  console.log(`💰 Cost savings: $0.02 saved on run 2`);
}

async function testCacheClear() {
  console.log('\n' + '='.repeat(60));
  console.log('CACHE CLEARING TEST');
  console.log('='.repeat(60));
  
  const vc = new VerifiableClaude();
  const prompt = "Quick test";
  
  console.log('\n1️⃣ First call (will cache)');
  await vc.generate(prompt);
  
  console.log('\n2️⃣ Second call (will use cache)');
  await vc.generate(prompt);
  
  console.log('\n3️⃣ Clearing cache...');
  vc.clearCache();
  
  console.log('\n4️⃣ Third call (cache cleared, fresh call)');
  await vc.generate(prompt);
}

// Run tests
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--efficiency')) {
    await testMultipleRuns();
  } else if (args.includes('--clear')) {
    await testCacheClear();
  } else {
    await test();
  }
}

main().catch(console.error);

// Usage:
// node test.js                  # Normal test
// node test.js --efficiency     # Show cache efficiency
// node test.js --clear          # Test cache clearing