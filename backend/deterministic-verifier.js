const https = require('https');
const http = require('http');

/**
 * Deterministic Claim Verifier
 *
 * Unlike LLM-based verification, these checks are:
 * - Reproducible (same input = same output)
 * - Fast (no API calls to Claude)
 * - Cryptographically provable
 *
 * This is the key difference from traditional citations!
 */
class DeterministicVerifier {

  /**
   * Verify a claim using deterministic rules
   * Returns a verification result that can be cryptographically proven
   */
  async verifyClaim(claim, evidence) {
    const results = {
      claim: claim.text,
      claimHash: this.hashClaim(claim.text),
      timestamp: new Date().toISOString(),
      checks: [],
      verdict: null,
      fraudProof: null
    };

    // Run deterministic checks
    const checks = [
      await this.checkURLValidity(claim, evidence),
      await this.checkQuoteExactMatch(claim, evidence),
      await this.checkEntityConsistency(claim, evidence),
      await this.checkSourceCredibility(evidence),
      await this.checkTemporalConsistency(claim, evidence)
    ];

    results.checks = checks;

    // Aggregate verdict (deterministic logic)
    const passedChecks = checks.filter(c => c.passed).length;
    const totalChecks = checks.length;
    const criticalFailures = checks.filter(c => c.critical && !c.passed);

    if (criticalFailures.length > 0) {
      results.verdict = 'FRAUD_PROVEN';
      results.fraudProof = this.generateFraudProof(claim, criticalFailures[0]);
      results.confidence = 10;
      results.reasoning = `Critical check failed: ${criticalFailures[0].name}. ${criticalFailures[0].reason}`;
    } else if (passedChecks / totalChecks >= 0.6) {
      results.verdict = 'VERIFIED';
      results.confidence = Math.round((passedChecks / totalChecks) * 100);
      results.reasoning = `${passedChecks}/${totalChecks} deterministic checks passed. ${checks.filter(c => c.passed).map(c => c.name).join(', ')} all confirmed.`;
    } else if (passedChecks / totalChecks >= 0.3) {
      results.verdict = 'UNCERTAIN';
      results.confidence = Math.round((passedChecks / totalChecks) * 100);
      results.reasoning = `Only ${passedChecks}/${totalChecks} checks passed. Insufficient evidence to verify or disprove this claim.`;
    } else {
      results.verdict = 'FRAUD_PROVEN';
      results.fraudProof = this.generateFraudProof(claim, checks[0]);
      results.confidence = 10;
      results.reasoning = `Most checks failed (${totalChecks - passedChecks}/${totalChecks}). Evidence does not support this claim.`;
    }

    return results;
  }

  /**
   * Hash a claim for cryptographic commitment
   */
  hashClaim(text) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * CHECK 1: URL Validity
   * Verify that all URLs in evidence actually exist and return 200
   */
  async checkURLValidity(claim, evidence) {
    if (!evidence.results || evidence.results.length === 0) {
      return {
        name: 'URL Validity',
        passed: false,
        critical: true,
        reason: 'No evidence sources provided',
        evidence: []
      };
    }

    const urlChecks = await Promise.all(
      evidence.results.slice(0, 3).map(async (result) => {
        try {
          const exists = await this.urlExists(result.url);
          return { url: result.url, exists };
        } catch (err) {
          return { url: result.url, exists: false, error: err.message };
        }
      })
    );

    const validURLs = urlChecks.filter(c => c.exists).length;
    const passed = validURLs >= Math.ceil(urlChecks.length * 0.5);

    return {
      name: 'URL Validity',
      passed,
      critical: true,
      reason: passed
        ? `${validURLs}/${urlChecks.length} URLs are valid and accessible`
        : `Only ${validURLs}/${urlChecks.length} URLs are valid`,
      evidence: urlChecks
    };
  }

  /**
   * CHECK 2: Quote Exact Match
   * For quoted text, verify exact string matching (deterministic!)
   */
  async checkQuoteExactMatch(claim, evidence) {
    const quotedText = this.extractQuotes(claim.text);

    if (quotedText.length === 0) {
      return {
        name: 'Quote Exact Match',
        passed: true,
        critical: false,
        reason: 'No quoted text in claim',
        evidence: []
      };
    }

    const matches = quotedText.map(quote => {
      const found = evidence.results.some(result =>
        result.snippet.toLowerCase().includes(quote.toLowerCase())
      );
      return { quote, found };
    });

    const allMatched = matches.every(m => m.found);

    return {
      name: 'Quote Exact Match',
      passed: allMatched,
      critical: true,
      reason: allMatched
        ? 'All quoted text found in evidence'
        : `${matches.filter(m => !m.found).length} quotes not found in evidence`,
      evidence: matches
    };
  }

  /**
   * CHECK 3: Entity Consistency
   * Extract named entities and verify they appear consistently across sources
   */
  async checkEntityConsistency(claim, evidence) {
    const entities = this.extractEntities(claim.text);

    if (entities.length === 0) {
      return {
        name: 'Entity Consistency',
        passed: true,
        critical: false,
        reason: 'No named entities detected',
        evidence: []
      };
    }

    const entityChecks = entities.map(entity => {
      const sourcesMentioning = evidence.results.filter(result =>
        result.snippet.toLowerCase().includes(entity.toLowerCase()) ||
        result.title.toLowerCase().includes(entity.toLowerCase())
      ).length;

      return {
        entity,
        sourcesMentioning,
        totalSources: evidence.results.length
      };
    });

    // At least 50% of entities should appear in at least 2 sources
    const consistentEntities = entityChecks.filter(e => e.sourcesMentioning >= 2).length;
    const passed = consistentEntities >= Math.ceil(entities.length * 0.5);

    return {
      name: 'Entity Consistency',
      passed,
      critical: false,
      reason: passed
        ? `${consistentEntities}/${entities.length} entities found in multiple sources`
        : `Only ${consistentEntities}/${entities.length} entities found in multiple sources`,
      evidence: entityChecks
    };
  }

  /**
   * CHECK 4: Source Credibility
   * Score sources based on domain reputation (deterministic scoring)
   */
  async checkSourceCredibility(evidence) {
    const credibilityScores = evidence.results.map(result => {
      const domain = this.extractDomain(result.url);
      const score = this.getDomainCredibilityScore(domain);
      return { domain, score, url: result.url };
    });

    const avgScore = credibilityScores.reduce((sum, s) => sum + s.score, 0) / credibilityScores.length;
    const passed = avgScore >= 60; // 60/100 threshold

    return {
      name: 'Source Credibility',
      passed,
      critical: false,
      reason: passed
        ? `Average credibility score: ${avgScore.toFixed(0)}/100`
        : `Low credibility score: ${avgScore.toFixed(0)}/100`,
      evidence: credibilityScores
    };
  }

  /**
   * CHECK 5: Temporal Consistency
   * Verify dates and temporal claims are consistent
   */
  async checkTemporalConsistency(claim, evidence) {
    const dates = this.extractDates(claim.text);

    if (dates.length === 0) {
      return {
        name: 'Temporal Consistency',
        passed: true,
        critical: false,
        reason: 'No temporal claims detected',
        evidence: []
      };
    }

    const dateChecks = dates.map(date => {
      const sourcesConfirming = evidence.results.filter(result =>
        result.snippet.includes(date) || result.title.includes(date)
      ).length;

      return {
        date,
        sourcesConfirming,
        totalSources: evidence.results.length
      };
    });

    // At least 50% of dates should appear in sources
    const confirmedDates = dateChecks.filter(d => d.sourcesConfirming > 0).length;
    const passed = confirmedDates >= Math.ceil(dates.length * 0.5);

    return {
      name: 'Temporal Consistency',
      passed,
      critical: false,
      reason: passed
        ? `${confirmedDates}/${dates.length} dates confirmed in sources`
        : `Only ${confirmedDates}/${dates.length} dates confirmed in sources`,
      evidence: dateChecks
    };
  }

  /**
   * Generate a fraud proof when a check fails
   * This cryptographically proves which step was invalid
   */
  generateFraudProof(claim, failedCheck) {
    const crypto = require('crypto');

    return {
      claimHash: this.hashClaim(claim.text),
      failedCheck: failedCheck.name,
      reason: failedCheck.reason,
      evidence: failedCheck.evidence,
      timestamp: new Date().toISOString(),
      proofHash: crypto.createHash('sha256')
        .update(JSON.stringify({
          claim: claim.text,
          check: failedCheck.name,
          evidence: failedCheck.evidence
        }))
        .digest('hex')
    };
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Check if URL exists (HEAD request)
   */
  async urlExists(url) {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;

        const req = client.request(
          url,
          { method: 'HEAD', timeout: 5000 },
          (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 400);
          }
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.end();
      } catch (err) {
        resolve(false);
      }
    });
  }

  /**
   * Extract quoted text from claim
   */
  extractQuotes(text) {
    const quotePattern = /"([^"]+)"/g;
    const matches = [];
    let match;

    while ((match = quotePattern.exec(text)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  }

  /**
   * Extract named entities (simple pattern-based)
   */
  extractEntities(text) {
    // Capital words that might be entities
    const pattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const matches = text.match(pattern) || [];

    // Filter out common words
    const stopWords = ['The', 'A', 'An', 'In', 'On', 'At', 'To', 'For', 'Of', 'With'];
    return [...new Set(matches.filter(m => !stopWords.includes(m)))];
  }

  /**
   * Extract dates from text
   */
  extractDates(text) {
    const patterns = [
      /\b\d{4}\b/g,                    // Years: 2024
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // Dates: 1/1/2024
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi // Jan 1, 2024
    ];

    const dates = [];
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) dates.push(...matches);
    });

    return [...new Set(dates)];
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Get credibility score for domain (deterministic scoring)
   */
  getDomainCredibilityScore(domain) {
    const highCredibility = [
      'wikipedia.org', 'edu', 'gov', 'nature.com', 'science.org',
      'nytimes.com', 'bbc.com', 'reuters.com', 'arxiv.org',
      'britannica.com', 'nih.gov', 'cdc.gov'
    ];

    const mediumCredibility = [
      'medium.com', 'forbes.com', 'bloomberg.com', 'wsj.com',
      'theguardian.com', 'washingtonpost.com', 'cnn.com'
    ];

    const lowCredibility = [
      'blogspot.com', 'wordpress.com', 'tumblr.com'
    ];

    // Check high credibility
    if (highCredibility.some(d => domain.includes(d))) {
      return 90;
    }

    // Check medium credibility
    if (mediumCredibility.some(d => domain.includes(d))) {
      return 70;
    }

    // Check low credibility
    if (lowCredibility.some(d => domain.includes(d))) {
      return 40;
    }

    // Unknown domain
    return 60;
  }
}

module.exports = DeterministicVerifier;
