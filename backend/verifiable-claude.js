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
const MerkleTree = require('./merkle-tree');
const DeterministicVerifier = require('./deterministic-verifier');

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
    
    const prompt = `Extract individual factual claims from this text. Each claim must be SHORT (under 20 words) and verifiable.

TEXT:
"${text}"

CRITICAL RULES:
- Extract SHORT, ATOMIC facts - each claim must be ONE specific fact
- Each claim MUST be under 20 words
- DO NOT return the entire text as one claim
- Extract EXACT text from the source (copy it word-for-word)
- Break down complex sentences into multiple small claims
- Extract: dates, names, numbers, events, relationships, locations

Format as JSON:
{
  "claims": [
    {
      "text": "exact short claim from source (under 20 words)",
      "type": "date|name|number|event|relationship|attribution"
    }
  ]
}

Example:
Input: "Vitalik Buterin and Joseph Poon formalized fraud proofs in their Plasma whitepaper in 2017."
Output:
{
  "claims": [
    {"text": "Vitalik Buterin and Joseph Poon formalized fraud proofs in their Plasma whitepaper", "type": "attribution"},
    {"text": "Plasma whitepaper in 2017", "type": "date"}
  ]
}

Extract ONLY short, individual facts. Return many small claims, not one big claim.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', // Use Sonnet to save costs
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      // Strip markdown code blocks if present (very robust)
      let jsonText = response.content[0].text.trim();

      // Log what we received
      console.log('Raw response first 200 chars:', jsonText.substring(0, 200));

      // More aggressive cleaning
      if (jsonText.includes('```')) {
        // Find the JSON content between code blocks
        const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (match) {
          jsonText = match[1].trim();
        } else {
          // Fallback: just remove all ```
          jsonText = jsonText.replace(/```(?:json)?/g, '').trim();
        }
      }

      console.log('Cleaned JSON first 200 chars:', jsonText.substring(0, 200));

      const result = JSON.parse(jsonText);

      // Convert to our claim format and filter out overly long claims
      const claims = result.claims
        .filter(claim => {
          // Reject claims that are too long (likely the entire text)
          const wordCount = claim.text.split(/\s+/).length;
          if (wordCount > 30) {
            console.log(`⚠️  Skipping overly long claim (${wordCount} words)`);
            return false;
          }
          return true;
        })
        .map((claim, index) => ({
          id: `claim_${index}`,
          text: claim.text,  // Keep original text with markdown for matching
          type: claim.type,
          confidence: 'MEDIUM',
          verified: false,
          evidence: null
        }));

      console.log(`✓ Detected ${claims.length} factual claims`);
      claims.forEach(c => console.log(`  - "${c.text.substring(0, 60)}${c.text.length > 60 ? '...' : ''}"`));
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
      text: trimmed,  // Keep original text with markdown for matching
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
    // If we have the original user prompt, use it as context
    if (context.userPrompt) {
      // Extract key terms from the user's question to add context
      const contextTerms = context.userPrompt
        .replace(/^(what|who|when|where|why|how|tell me about|explain)\s+/i, '')
        .replace(/\?$/,'')
        .trim();
      return `${contextTerms} ${claimText}`;
    }

    // Fallback: If we have context subject (backward compatibility)
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
    
    const contextInfo = evidence.query ? `\n\nORIGINAL CONTEXT: The user asked about "${evidence.query.split(' ').slice(0, 10).join(' ')}"` : '';

    const prompt = `You are a fact-checker. A claim was made, and we found some evidence.
Your job is to determine if the evidence supports, contradicts, or is uncertain about the claim.${contextInfo}

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
    this.deterministicVerifier = new DeterministicVerifier();

    // Toggle between LLM verification (slow, subjective) and deterministic verification (fast, provable)
    this.useDeterministicVerification = options.deterministic || false;

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
   * Search the web and format results for AI context
   */
  async searchWeb(query) {
    try {
      const evidence = await this.verifier.searchForEvidence(query, {});

      if (!evidence.results || evidence.results.length === 0) {
        console.log('⚠️  No search results found');
        return null;
      }

      console.log(`✓ Found ${evidence.results.length} web sources`);
      return evidence;
    } catch (error) {
      console.error('Web search error:', error.message);
      return null;
    }
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
    
    // 4. Generate Merkle tree commitment (fraud proof infrastructure)
    let merkleCommitment = null;
    if (claims.length > 0) {
      const claimTexts = claims.map(c => c.text);
      const merkleTree = new MerkleTree(claimTexts);
      merkleCommitment = {
        root: merkleTree.getRoot(),
        timestamp: new Date().toISOString(),
        claimCount: claims.length
      };
      console.log(`🌳 Merkle commitment: ${merkleCommitment.root.substring(0, 16)}...`);

      // Attach Merkle proofs to each claim so they can be challenged later
      claims.forEach((claim, index) => {
        claim.merkleProof = merkleTree.getProof(index);
        claim.merkleIndex = index;
      });
    }

    // 5. Build result
    const result = {
      text: response.text,
      claims: claims,
      commitment: merkleCommitment, // Cryptographic commitment to all claims
      metadata: {
        model: response.model,
        tokens: response.usage,
        cached: false,
        verificationMode: this.useDeterministicVerification ? 'deterministic' : 'llm'
      }
    };

    // 6. Save to cache
    this.cache[cacheKey] = { ...result, metadata: { ...result.metadata, cached: true } };
    this.saveCache();

    return result;
  }
  
  /**
   * Verify a specific claim (fraud proof)
   *
   * Two modes:
   * - LLM verification: Uses Claude to judge evidence (slower, subjective, not reproducible)
   * - Deterministic verification: Rule-based checks (faster, reproducible, cryptographically provable)
   */
  async verify(claim, context = {}) {
    console.log('🔎 Running fraud proof...');

    // Cache verification results too
    const verificationMode = this.useDeterministicVerification ? 'deterministic' : 'llm';
    const cacheKey = `verify:${verificationMode}:${claim.text}:${JSON.stringify(context)}`;
    if (this.cache[cacheKey]) {
      console.log('💾 Using cached verification (saved $0.02)');
      return this.cache[cacheKey];
    }

    let result;

    if (this.useDeterministicVerification) {
      // DETERMINISTIC MODE: Fast, reproducible, provable
      console.log('⚡ Using deterministic verification (fraud proof mode)');

      // First get evidence from search
      const evidence = await this.verifier.searchForEvidence(claim.text, context);

      // Then run deterministic checks
      result = await this.deterministicVerifier.verifyClaim(claim, evidence);

      // Add evidence to result for frontend display
      result.evidence = evidence.results || [];

      // Add Merkle proof verification if available
      if (claim.merkleProof && context.merkleRoot) {
        const leafHash = this.deterministicVerifier.hashClaim(claim.text);
        const proofValid = MerkleTree.verifyProof(leafHash, claim.merkleProof, context.merkleRoot);
        result.merkleProofValid = proofValid;

        if (!proofValid) {
          result.verdict = 'FRAUD_PROVEN';
          result.fraudProof = {
            reason: 'Merkle proof invalid - claim was not in original commitment',
            claimHash: leafHash,
            expectedRoot: context.merkleRoot
          };
        }
      }
    } else {
      // LLM MODE: Slower, subjective, not reproducible (legacy)
      console.log('🤖 Using LLM verification (legacy mode)');
      result = await this.verifier.verifyClaim(claim, context);
    }

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
    // Build the user message - include web search results if provided
    let userPrompt = prompt;

    if (options.searchContext && options.searchContext.results && options.searchContext.results.length > 0) {
      const searchResults = options.searchContext.results
        .map((result, i) => {
          return `[${i + 1}] ${result.title}
${result.snippet}
Source: ${result.url}`;
        })
        .join('\n\n');

      userPrompt = `Here are current web search results for context:

${searchResults}

---

Based on the above sources and your knowledge, please answer the following question:

${prompt}

IMPORTANT: Use the web search results above to provide up-to-date, accurate information. If the search results contain current data, use that instead of relying solely on your training data.`;
    }

    const response = await anthropic.messages.create({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 2000,
      system: `Provide concise, factual responses. Keep answers brief and to the point, focusing on verifiable facts. Use clear paragraphs and bullet points where appropriate.

IMPORTANT: When answering "who invented/created X" questions:
- If multiple people/teams contributed, list them all with their specific contributions
- Include timeframes when concepts evolved over time
- Distinguish between early theoretical work and practical implementations
- Be precise about who did what, rather than oversimplifying

When web search results are provided, prioritize information from those sources as they contain the most current data.

Format your response to make individual factual claims easy to extract and verify.`,
      messages: [{
        role: 'user',
        content: userPrompt
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