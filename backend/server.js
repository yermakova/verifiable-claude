/**
 * Express API Server for Verifiable Claude
 * Exposes the fraud proof system via REST API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { VerifiableClaude } = require('./verifiable-claude');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Initialize Verifiable Claude
// Use deterministic verification (fraud proofs) if DETERMINISTIC_MODE=true in .env
const useDeterministic = process.env.DETERMINISTIC_MODE === 'true';
const vc = new VerifiableClaude({
  cache: true,
  deterministic: useDeterministic
});

console.log(`🔧 Verification mode: ${useDeterministic ? 'DETERMINISTIC (fraud proofs)' : 'LLM (legacy)'}`);
if (useDeterministic) {
  console.log('   ✓ Merkle tree commitments enabled');
  console.log('   ✓ Reproducible verification');
  console.log('   ✓ Cryptographic fraud proofs');
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health check
 * GET /health
 */
app.get('/health', (req, res) => {
  const hasAPIKey = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 0);
  const isDeterministic = process.env.DETERMINISTIC_MODE === 'true';
  // Default model is Sonnet (claude-sonnet-4-20250514)
  const modelMode = hasAPIKey ? 'sonnet' : 'test';
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: modelMode,
    usingOpus: false, // Not using Opus by default, using Sonnet
    verificationMode: isDeterministic ? 'deterministic' : 'llm',
    fraudProofsEnabled: isDeterministic
  });
});

/**
 * Generate response with verifiable claims
 * POST /api/generate
 * 
 * Body: { prompt: string }
 * Returns: { text: string, claims: [...], metadata: {...} }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`📥 Generate request: "${prompt.substring(0, 50)}..."`);

    // Search the web FIRST to get current data
    console.log('🔍 Searching web before generating...');
    const searchResults = await vc.searchWeb(prompt);

    // Generate response with search context
    const result = await vc.generate(prompt, { searchContext: searchResults });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Verify a specific claim (run fraud proof)
 * POST /api/verify
 * 
 * Body: { claim: {...}, context?: {...} }
 * Returns: { verdict, confidence, evidence, reasoning }
 */
app.post('/api/verify', async (req, res) => {
  try {
    const { claim, context } = req.body;
    
    if (!claim || !claim.text) {
      return res.status(400).json({ error: 'Claim is required' });
    }
    
    console.log(`🔍 Verify request: "${claim.text.substring(0, 50)}..."`);
    
    const verification = await vc.verify(claim, context || {});
    
    res.json({
      success: true,
      data: verification
    });
    
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Clear cache
 * POST /api/cache/clear
 */
app.post('/api/cache/clear', (req, res) => {
  try {
    vc.clearCache();
    res.json({
      success: true,
      message: 'Cache cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('🛡️  Verifiable Claude - API Server');
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /api/generate - Generate response with claims');
  console.log('  POST /api/verify   - Verify a claim (fraud proof)');
  console.log('  POST /api/cache/clear - Clear response cache');
  console.log('='.repeat(60));
  console.log('');
});

module.exports = app;