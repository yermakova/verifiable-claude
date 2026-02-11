# 🛡️ Verifiable Claude

**Fraud Proofs for LLM Outputs** — Bringing blockchain-style verification to AI responses.

Inspired by **Optimistic Rollups**, Verifiable Claude allows users to challenge and verify factual claims made by LLMs against external sources, ensuring trust through verification rather than blind acceptance.

---

## 🎯 Concept

Just as blockchain brought verification to computation, Verifiable Claude brings verification to AI:

1. **Optimistic Response**: Claude responds quickly with factual claims
2. **Claim Detection**: AI automatically identifies verifiable facts
3. **Fraud Proofs**: Users can challenge any claim
4. **External Verification**: Claims are verified against real-world sources
5. **Confidence Scoring**: Each verification includes confidence levels and evidence

Like Optimistic Rollups assume transactions are valid unless challenged, Verifiable Claude assumes claims are accurate until a user requests verification.

---

## ✨ Features

- **🤖 AI-Powered Claim Detection**: Automatically extracts verifiable facts from Claude's responses
- **🔍 External Verification**: Searches multiple sources to validate claims
- **📊 Confidence Scoring**: Provides percentage-based confidence with detailed reasoning
- **📚 Evidence Collection**: Shows sources and snippets that support or refute claims
- **⚡ Smart Caching**: Caches searches to speed up repeated verifications
- **🎨 Claude Dark Mode UI**: Beautiful interface matching Claude's signature design
- **🔌 REST API**: Easy integration with any frontend or application

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  • React (inline in HTML)                                   │
│  • Tailwind CSS (Claude dark mode colors)                  │
│  • Interactive claim verification UI                        │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/REST
┌──────────────────▼──────────────────────────────────────────┐
│                      BACKEND API                            │
│  • Express.js server                                        │
│  • POST /api/generate - Generate with claims                │
│  • POST /api/verify   - Run fraud proof                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              VERIFIABLE CLAUDE CORE                         │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────┐                │
│  │ Claim Detector  │  │ Fraud Prover     │                │
│  │                 │  │                  │                │
│  │ • AI-powered    │  │ • Web search     │                │
│  │ • Pattern-based │  │ • Source eval    │                │
│  └─────────────────┘  │ • Confidence     │                │
│                       └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
  Anthropic API              Brave Search API
  (Claude Opus 4)           (External verification)
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Anthropic API key
- Brave Search API key (optional but recommended)

### 1. Clone & Install

```bash
git clone <repository-url>
cd verifiable-claude

# Install backend dependencies
cd backend
npm install
```

### 2. Configure Environment

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
BRAVE_API_KEY=your_brave_search_api_key_here  # Optional
PORT=3001
```

**Get API Keys:**
- Anthropic: https://console.anthropic.com/
- Brave Search: https://brave.com/search/api/

### 3. Start the Backend

```bash
cd backend
npm start
```

Server runs on `http://localhost:3001`

### 4. Open the Frontend

Simply open `frontend/index.html` in your browser:

```bash
open frontend/index.html
```

Or use a local server:

```bash
cd frontend
python -m http.server 8000
# Visit http://localhost:8000
```

---

## 💻 Usage

### Web Interface

1. **Enter a prompt** asking about verifiable facts:
   - "Tell me about Apollo 11"
   - "When was the Eiffel Tower built?"
   - "Who wrote The Left Hand of Darkness?"

2. **Claude responds** with automatic claim detection

3. **Click any claim** to run a fraud proof verification

4. **Review evidence** from external sources with confidence scores

### Example Flow

```
User: "Tell me about Apollo 11"
       ↓
Claude generates response with claims:
  ✓ "Apollo 11 launched on July 16, 1969"
  ✓ "Neil Armstrong was the mission commander"
  ✓ "They landed in the Sea of Tranquility"
       ↓
User clicks first claim
       ↓
Fraud Proof runs:
  • Searches Brave for "Apollo 11 launch date"
  • Evaluates 3-5 top sources
  • Compares claim against evidence
       ↓
Result: VERIFIED (95% confidence)
Evidence:
  • NASA: "Apollo 11 launched July 16, 1969..."
  • Wikipedia: "The mission launched on July 16..."
  • History.com: "On July 16, 1969, Apollo 11..."
```

---

## 🔌 API Reference

### Generate Response with Claims

```bash
POST http://localhost:3001/api/generate
Content-Type: application/json

{
  "prompt": "Tell me about Apollo 11"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "## Apollo 11\n\nApollo 11 launched on July 16, 1969...",
    "claims": [
      {
        "id": "claim_0",
        "text": "Apollo 11 launched on July 16, 1969",
        "type": "date",
        "confidence": "high"
      }
    ],
    "metadata": {
      "model": "claude-opus-4",
      "timestamp": "2025-02-11T..."
    }
  }
}
```

### Verify a Claim (Fraud Proof)

```bash
POST http://localhost:3001/api/verify
Content-Type: application/json

{
  "claim": {
    "id": "claim_0",
    "text": "Apollo 11 launched on July 16, 1969",
    "type": "date"
  },
  "context": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verdict": "VERIFIED",
    "confidence": 95,
    "reasoning": "Multiple reliable sources confirm...",
    "evidence": [
      {
        "title": "Apollo 11 - Wikipedia",
        "url": "https://...",
        "snippet": "Apollo 11 launched on July 16, 1969..."
      }
    ],
    "searchQuery": "Apollo 11 launch date July 16 1969"
  }
}
```

### Other Endpoints

```bash
# Health check
GET http://localhost:3001/health

# Clear cache
POST http://localhost:3001/api/cache/clear
```

---

## 🎨 Color Scheme

The UI uses Claude's signature dark mode colors:

| Element | Color |
|---------|-------|
| Background | `#0F0F0F` |
| Cards | `#1E1E1E` |
| Inputs | `#2D2D2D` |
| Borders | `#3D3D3D`, `#404040` |
| Text | `gray-100` to `gray-400` |
| **Accent (Orange)** | `#CC785C`, `#D97757` |

---

## 🛠️ Tech Stack

**Frontend:**
- React 18 (CDN)
- Tailwind CSS (CDN)
- Babel Standalone

**Backend:**
- Node.js
- Express.js
- Anthropic SDK (Claude API)
- Axios (for Brave Search)

**AI Models:**
- Claude Opus 4 (claim detection & generation)
- Claude Sonnet 3.5 (verification)

---

## 🧪 How Fraud Proofs Work

### 1. Claim Detection
```javascript
Input: "Apollo 11 launched on July 16, 1969"
   ↓
AI analyzes and extracts:
{
  text: "Apollo 11 launched on July 16, 1969",
  type: "date",
  confidence: "high"
}
```

### 2. Search Query Generation
```javascript
Claim → AI generates search query
   ↓
"Apollo 11 launch date July 16 1969"
```

### 3. External Source Search
```javascript
Query Brave Search API
   ↓
Retrieve top 3-5 results
   ↓
Extract relevant snippets
```

### 4. Evidence Evaluation
```javascript
AI compares claim against evidence:
- Does evidence support the claim?
- How reliable are the sources?
- Are there contradictions?
   ↓
Verdict: VERIFIED / FALSE / INSUFFICIENT
Confidence: 0-100%
```

### 5. Return Fraud Proof Receipt
```javascript
{
  verdict: "VERIFIED",
  confidence: 95,
  reasoning: "Multiple sources confirm...",
  evidence: [...]
}
```

---

## 📝 Development

### Run Tests

```bash
cd backend

# Test basic generation
node test.js

# Test with false claims
node test-false.js
```

### Enable Dev Mode

```bash
npm run dev  # Uses nodemon for auto-restart
```

### Clear Cache

```bash
curl -X POST http://localhost:3001/api/cache/clear
```

---

## 🤔 Philosophy

**Why Fraud Proofs for AI?**

LLMs are powerful but can hallucinate or present outdated information. Traditional approaches:
- ❌ Blindly trust the AI
- ❌ Manually fact-check everything
- ❌ Restrict AI to only verified data (slow, limited)

**Verifiable Claude's approach:**
- ✅ Optimistic: Fast, unrestricted responses
- ✅ Verifiable: Users can challenge any claim
- ✅ Transparent: Shows sources and confidence
- ✅ Practical: Only verify what matters to you

Like blockchain's "don't trust, verify" — but for AI.

---

## 🚧 Limitations

- Search API rate limits may apply
- Verification quality depends on available sources
- Some claims may not be easily searchable
- Requires internet connection for verification

---

## 📄 License

ISC

---

## 🙏 Acknowledgments

Inspired by:
- **Optimistic Rollups** (Ethereum L2 scaling)
- **Anthropic's Constitutional AI**
- The blockchain principle: "Don't trust, verify"

Built with **Claude Code** ⚡

---

## 🔗 Links

- [Anthropic API Docs](https://docs.anthropic.com/)
- [Brave Search API](https://brave.com/search/api/)
- [Optimistic Rollups Explained](https://ethereum.org/en/developers/docs/scaling/optimistic-rollups/)

---

**Made with 🛡️ by Verifiable Claude — Because AI should be verifiable, not just believable.**
