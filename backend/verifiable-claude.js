/**
 * Verifiable Claude - Core System
 * Fraud Proofs for LLM Outputs
 * 
 * Inspired by Optimistic Rollups:
 * 1. Claude responds optimistically (fast)
 * 2. Claims are flagged with confidence levels
 * 3. Users can challenge claims (fraud proofs)
 * 4. System verifies and rolls back if false
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// CLAIM DETECTION
// ============================================================================

/**
 * Detect factual claims in text
 * 
 * A factual claim is a statement that can be objectively verified:
 * - "Published in 1969" ✓
 * - "The main character is Genly" ✓
 * - "I think the themes are..." ✗ (opinion)
 */
class ClaimDetector {
  
  constructor() {
    this.useAdvancedDetection = true; // Toggle for AI-powered detection
  }
  
  /**
   * Detect claims using AI classification (more accurate)
   */
  async detectClaims(text) {
    if (this.useAdvancedDetection) {
      return await this.detectClaimsWithAI(text);
    } else {
      return this.detectClaimsWithPatterns(text);
    }
  }
  
  /**
   * Use Claude to intelligently detect factual claims
   */
  async detectClaimsWithAI(text) {
    console.log('🔍 Using AI to detect factual claims...');
    
    const prompt = `Analyze this text and extract ONLY the factual claims that can be objectively verified.

TEXT:
"${text}"

Rules:
- Extract individual factual statements (names, dates, numbers, events)
- Skip opinions, interpretations, or subjective statements
- Break down complex sentences into individual verifiable facts
- Return as JSON array

Format:
{
  "claims": [
    {
      "text": "exact claim text",
      "type": "date" | "name" | "number" | "event" | "relationship"
    }
  ]
}

Example:
Input: "Apollo 11 launched on July 16, 1969, with Neil Armstrong as commander."
Output: {
  "claims": [
    {"text": "Apollo 11 launched on July 16, 1969", "type": "date"},
    {"text": "Neil Armstrong was the commander of Apollo 11", "type": "relationship"}
  ]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-20250514', // Use Opus for this hard task
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      const result = JSON.parse(response.content[0].text);
      
      // Convert to our claim format
      const claims = result.claims.map((claim, index) => ({
        id: `claim_${index}`,
        text: claim.text,
        type: claim.type,
        confidence: 'MEDIUM',
        verified: false,
        evidence: null
      }));
      
      console.log(`✓ Detected ${claims.length} factual claims`);
      return claims;
      
    } catch (error) {
      console.error('AI claim detection failed, falling back to patterns:', error.message);
      return this.detectClaimsWithPatterns(text);
    }
  }
  
  /**
   * Pattern-based detection (fallback)
   */
  detectClaimsWithPatterns(text) {
    const claims = [];
    
    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    sentences.forEach((sentence, index) => {
      const claim = this.analyzeSentence(sentence, index);
      if (claim) {
        claims.push(claim);
      }
    });
    
    return claims;
  }
  
  /**
   * Analyze if a sentence is a factual claim
   */
  analyzeSentence(sentence, index) {
    const trimmed = sentence.trim();
    
    // Skip if it's clearly opinion/interpretation
    const opinionMarkers = [
      'I think', 'I believe', 'In my opinion', 'It seems',
      'Perhaps', 'Maybe', 'Possibly', 'Could be'
    ];
    
    const isOpinion = opinionMarkers.some(marker => 
      trimmed.toLowerCase().includes(marker.toLowerCase())
    );
    
    if (isOpinion) return null;
    
    // Detect factual claim patterns
    const factualPatterns = [
      // Dates and numbers
      /\b(published|written|released|born|died|launched)\s+(on\s+)?(\w+\s+)?\d{1,2},?\s+\d{4}\b/i,
      /\b\d{4}\b.*\b(book|novel|work|publication|mission)\b/i,
      
      // Definitive statements about entities
      /\b(is|was|are|were)\s+(a|an|the)\s+\w+/i,
      
      // Names and roles
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(was|is|served as)\b/i,
      
      // Author attributions
      /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
      /\b(written|authored|created)\s+by\b/i,
      
      // Titles and names
      /["'][^"']+["']/,  // Quoted titles
      
      // Locations and places
      /\b(set|takes place|located|landed)\s+in\s+[A-Z]/i,
    ];
    
    const hasFactualPattern = factualPatterns.some(pattern => 
      pattern.test(trimmed)
    );
    
    if (!hasFactualPattern) return null;
    
    return {
      id: `claim_${index}`,
      text: trimmed,
      confidence: 'MEDIUM',
      verified: false,
      evidence: null
    };
  }
}

// ============================================================================
// VERIFICATION SYSTEM (FRAUD PROOFS)
// ============================================================================

/**
 * Verify claims against external sources
 * Like a fraud proof validator checking state transitions
 */
class ClaimVerifier {
  
  constructor() {
    this.searchCache = new Map();
  }
  
  /**
   * Verify a claim by searching for evidence
   * Returns: VERIFIED | UNCERTAIN | FALSE
   */
  async verifyClaim(claim, context = {}) {
    console.log(`🔍 Verifying claim: "${claim.text}"`);
    
    try {
      // Search for evidence
      const evidence = await this.searchForEvidence(claim.text, context);
      
      // Compare claim to evidence
      const verdict = await this.compareClaimToEvidence(claim.text, evidence);
      
      return {
        claim: claim.text,
        verdict: verdict.status,
        confidence: verdict.confidence,
        evidence: evidence.results,
        reasoning: verdict.reasoning
      };
      
    } catch (error) {
      console.error('Verification failed:', error);
      return {
        claim: claim.text,
        verdict: 'UNCERTAIN',
        confidence: 0,
        evidence: [],
        reasoning: 'Verification system error'
      };
    }
  }
  
  /**
   * Search for evidence using Brave Search API
   */
  async searchForEvidence(claimText, context) {
    console.log(`📡 Searching for: "${claimText}"`);
    
    // Extract search query from claim
    const query = this.extractSearchQuery(claimText, context);
    
    // Check cache first
    const cacheKey = query.toLowerCase();
    if (this.searchCache.has(cacheKey)) {
      console.log('✓ Using cached results');
      return this.searchCache.get(cacheKey);
    }
    
    try {
      // Call Brave Search API
      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': process.env.BRAVE_API_KEY
        },
        params: {
          q: query,
          count: 5, // Get top 5 results
          text_decorations: false,
          search_lang: 'en'
        }
      });
      
      // Extract useful information from results
      const results = {
        query,
        results: (response.data.web?.results || []).map(result => ({
          title: result.title,
          snippet: result.description,
          url: result.url
        }))
      };
      
      console.log(`✓ Found ${results.results.length} search results`);
      
      // Cache the results
      this.searchCache.set(cacheKey, results);
      
      return results;
      
    } catch (error) {
      console.error('Search API error:', error.message);
      
      // Fallback to empty results if search fails
      return {
        query,
        results: [],
        error: 'Search failed'
      };
    }
  }
  
  /**
   * Extract a good search query from a claim
   */
  extractSearchQuery(claimText, context) {
    // If we have context (like book title), include it
    if (context.subject) {
      return `${context.subject} ${claimText}`;
    }
    
    // Otherwise, clean up the claim for search
    return claimText
      .replace(/^(It is|It was|The|This is|This was)\s+/i, '')
      .substring(0, 100);
  }
  
  /**
   * Compare claim to evidence using Claude
   * This is where fraud proof validation happens
   */
  async compareClaimToEvidence(claimText, evidence) {
    console.log('🤔 Analyzing evidence...');
    
    // Handle case where no evidence was found
    if (!evidence.results || evidence.results.length === 0) {
      console.log('⚠️  No evidence found');
      return {
        status: 'UNCERTAIN',
        confidence: 0,
        reasoning: 'No search results found to verify this claim'
      };
    }
    
    // Show what evidence we're analyzing
    console.log('\n📚 Evidence retrieved:');
    evidence.results.forEach((result, i) => {
      console.log(`\n  ${i + 1}. ${result.title}`);
      console.log(`     ${result.snippet.substring(0, 100)}...`);
      console.log(`     ${result.url}`);
    });
    console.log('');
    
    const prompt = `You are a fact-checker. A claim was made, and we found some evidence.
Your job is to determine if the evidence supports, contradicts, or is uncertain about the claim.

CLAIM: "${claimText}"

EVIDENCE FOUND:
${evidence.results.map((r, i) => `
Source ${i + 1}: ${r.title}
URL: ${r.url}
Content: ${r.snippet}
`).join('\n')}

Respond in JSON format:
{
  "status": "VERIFIED" | "FALSE" | "UNCERTAIN",
  "confidence": 0-100,
  "reasoning": "Brief explanation of why you chose this verdict"
}

Rules:
- VERIFIED: Evidence clearly supports the claim (confidence 70+)
- FALSE: Evidence clearly contradicts the claim (confidence 70+)
- UNCERTAIN: Evidence is missing, unclear, mixed, or low confidence (<70)

Be strict. If multiple sources agree, increase confidence. If sources conflict, mark UNCERTAIN.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      const result = JSON.parse(response.content[0].text);
      console.log(`✓ Verdict: ${result.status} (${result.confidence}% confidence)`);
      console.log(`  Reasoning: ${result.reasoning}`);
      
      return result;
      
    } catch (error) {
      console.error('Evidence comparison failed:', error);
      return {
        status: 'UNCERTAIN',
        confidence: 0,
        reasoning: 'Could not analyze evidence'
      };
    }
  }
}

// ============================================================================
// VERIFIABLE CLAUDE WRAPPER
// ============================================================================

/**
 * Verifiable Claude Wrapper
 */
class VerifiableClaude {
  
  constructor(options = {}) {
    this.detector = new ClaimDetector();
    this.verifier = new ClaimVerifier();
    
    // Enable caching to save API costs during development
    this.enableCache = options.cache !== false; // Default: true
    this.cacheFile = options.cacheFile || './cache.json';
    this.cache = this.loadCache();
  }
  
  /**
   * Load cache from disk
   */
  loadCache() {
    if (!this.enableCache) return {};
    
    try {
      const fs = require('fs');
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        console.log('💾 Loaded cache from disk');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log('⚠️  Could not load cache:', error.message);
    }
    return {};
  }
  
  /**
   * Save cache to disk
   */
  saveCache() {
    if (!this.enableCache) return;
    
    try {
      const fs = require('fs');
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('Could not save cache:', error.message);
    }
  }
  
  /**
   * Generate cache key from prompt and options
   */
  getCacheKey(prompt, options = {}) {
    const model = options.model || 'claude-sonnet-4-20250514';
    return `${model}:${prompt}`;
  }
  
  /**
   * Generate a response with verifiable claims
   */
  async generate(prompt, options = {}) {
    console.log('💬 Generating response...');
    
    // 1. Check cache first
    const cacheKey = this.getCacheKey(prompt, options);
    if (this.cache[cacheKey]) {
      console.log('💾 Using cached response (saved $0.02)');
      return this.cache[cacheKey];
    }
    
    // 2. Get response from Claude (optimistic execution)
    const response = await this.callClaude(prompt, options);
    
    // 3. Detect factual claims (now async with AI)
    const claims = await this.detector.detectClaims(response.text);
    console.log(`📋 Detected ${claims.length} factual claims`);
    
    if (claims.length > 0) {
      console.log('\nClaims found:');
      claims.forEach((claim, i) => {
        console.log(`  ${i + 1}. "${claim.text}" [${claim.type || 'unknown'}]`);
      });
    }
    
    // 4. Build result
    const result = {
      text: response.text,
      claims: claims,
      metadata: {
        model: response.model,
        tokens: response.usage,
        cached: false
      }
    };
    
    // 5. Save to cache
    this.cache[cacheKey] = { ...result, metadata: { ...result.metadata, cached: true } };
    this.saveCache();
    
    return result;
  }
  
  /**
   * Verify a specific claim (fraud proof)
   */
  async verify(claim, context = {}) {
    console.log('🔎 Running fraud proof...');
    
    // Cache verification results too
    const cacheKey = `verify:${claim.text}:${JSON.stringify(context)}`;
    if (this.cache[cacheKey]) {
      console.log('💾 Using cached verification (saved $0.02)');
      return this.cache[cacheKey];
    }
    
    const result = await this.verifier.verifyClaim(claim, context);
    
    // Cache the result
    this.cache[cacheKey] = result;
    this.saveCache();
    
    return result;
  }
  
  /**
   * Clear cache (useful when you want fresh responses)
   */
  clearCache() {
    console.log('🗑️  Clearing cache...');
    this.cache = {};
    this.saveCache();
  }
  
  /**
   * Regenerate response with constraints after fraud detected
   */
  async regenerate(originalPrompt, falseClaimText, options = {}) {
    console.log('🔄 Regenerating with constraints...');
    
    const constrainedPrompt = `${originalPrompt}

IMPORTANT CONSTRAINT:
Previous response included this false claim: "${falseClaimText}"
Do NOT make this claim again. If you're uncertain about facts, say so explicitly.`;

    return await this.generate(constrainedPrompt, options);
  }
  
  /**
   * Call Claude API
   */
  async callClaude(prompt, options = {}) {
    const response = await anthropic.messages.create({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    return {
      text: response.content[0].text,
      model: response.model,
      usage: response.usage
    };
  }
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

async function example() {
  const vc = new VerifiableClaude();
  
  // Test with your book summary example
  const prompt = "Summarize the book 'The Left Hand of Darkness' by Ursula K. Le Guin";
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing Verifiable Claude');
  console.log('='.repeat(60) + '\n');
  
  // Generate response
  const result = await vc.generate(prompt);
  
  console.log('\n📝 Response:');
  console.log(result.text);
  console.log('\n📋 Claims detected:', result.claims.length);
  
  // Verify first claim
  if (result.claims.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('Testing Fraud Proof on First Claim');
    console.log('='.repeat(60) + '\n');
    
    const verification = await vc.verify(
      result.claims[0],
      { subject: 'The Left Hand of Darkness' }
    );
    
    console.log('\n✅ Verification Result:');
    console.log(JSON.stringify(verification, null, 2));
  }
}

// Export for use in server
module.exports = { VerifiableClaude, ClaimDetector, ClaimVerifier };

// Run example if called directly
if (require.main === module) {
  example().catch(console.error);
}