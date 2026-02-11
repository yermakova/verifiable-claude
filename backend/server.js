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
const vc = new VerifiableClaude({ cache: true });

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health check
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
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
    
    const result = await vc.generate(prompt);
    
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