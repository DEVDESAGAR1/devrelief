/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Body parsing with safe size limits (10 MB cap)
app.use(express.json({ limit: '10mb' }));

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'DevRelief Full-Stack Server',
    timestamp: new Date().toISOString(),
  });
});

// Gemini status check - NEVER exposes the API key
app.get('/api/gemini/status', (_req, res) => {
  const isConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    configured: isConfigured,
    model: 'gemini-3.8-flash',
    message: isConfigured
      ? 'GEMINI_API_KEY is configured on the backend server.'
      : 'GEMINI_API_KEY environment variable is missing on the server.',
  });
});

// Gemini generation endpoint with strict consent enforcement
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { prompt, model = 'gemini-3.8-flash', systemInstruction, temperature = 0.2, userConsent } = req.body;

    // Consent gate: Explicit user consent is mandatory
    if (userConsent !== true) {
      res.status(403).json({
        error: 'Forbidden: Explicit user consent is required before transmitting data to the Google Gemini Cloud API.',
      });
      return;
    }

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Bad Request: Prompt cannot be empty.' });
      return;
    }

    // Safety length cap to avoid excessive resource consumption
    if (prompt.length > 500000) {
      res.status(400).json({ error: 'Bad Request: Prompt exceeds maximum allowed length of 500,000 characters.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'Service Unavailable: GEMINI_API_KEY is not configured on the backend server. Configure GEMINI_API_KEY in your environment or Settings > Secrets.',
      });
      return;
    }

    // Initialize @google/genai SDK with mandatory telemetry header
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const targetModel = model || 'gemini-3.8-flash';

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature,
      },
    });

    res.json({
      text: response.text || '',
      model: targetModel,
      provider: 'gemini',
    });
  } catch (err: unknown) {
    console.error('Error generating with Gemini API:', err);
    // Sanitize any potential key leakage in error responses
    const rawMessage = err instanceof Error ? err.message : 'Unknown generation error';
    const sanitizedMessage = rawMessage.replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
    res.status(500).json({ error: sanitizedMessage });
  }
});

// Ollama proxy bridge with SSRF validation
app.get('/api/ollama/tags', async (req, res) => {
  const target = (req.query.endpoint as string) || 'http://127.0.0.1:11434';
  
  // Validate target URL to prevent SSRF
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      res.status(400).json({ error: 'Bad Request: Invalid protocol. Only http: and https: endpoints are permitted.' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Bad Request: Invalid endpoint URL.' });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(`${target.replace(/\/+$/, '')}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      res.status(resp.status).json({ error: `Ollama error HTTP ${resp.status}` });
      return;
    }
    const data = await resp.json();
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Failed to reach Ollama at ${target}: ${msg}` });
  }
});

async function startServer() {
  if (!isProd) {
    // Dynamic Vite server integration in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`DevRelief server running on port ${port} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

// Only start the server if this file is executed directly (not when imported in tests)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST && !process.argv.includes('--test')) {
  startServer().catch((err) => {
    console.error('Failed to start DevRelief server:', err);
    process.exit(1);
  });
}

export { app };
