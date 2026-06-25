# Design Decisions: RedactKit

This document outlines the key design choices and trade-offs made during the development of RedactKit.

## 1. Local-First Architecture

We decided early on that **100% on-device local processing** is non-negotiable. 
- **Rationale**: Any privacy tool that uploads data to a third-party server to redact it defeats its own purpose (violates zero-trust boundaries).
- **Trade-off**: Higher client-side CPU/VRAM usage when using semantic tiers (NER, LLM). To mitigate this, we keep the default tier (`rules`) dependency-free and instant, allowing users to opt into heavier models only when needed.

## 2. Scoped NPM Name (`@pras-ops/redactkit`)

The generic name `redactkit` was already taken on public npm.
- **Decision**: We shifted to the scoped package `@pras-ops/redactkit`.
- **Significance**: Ensures a reliable `npm install` command for portfolio validation and prevents dependency confusion attacks.

## 3. Tiered Detection Model

Instead of a single heavy model, RedactKit uses a 3-tier pipeline:
- **Tier 1 (Regex)**: Zero-cold-start, sync, covers 90% of structural PII (emails, cards, IPs, keys).
- **Tier 2 (NER)**: Medium weight (~100MB model), offloaded to Web Workers. Excellent for contextual names and locations.
- **Tier 3 (LLM)**: Heavy weight (1B+ parameters via WebLLM/Ollama). Handles complex semantic classification.

## 4. Framework Middleware

We prioritize developer ergonomics by introducing framework-specific middleware:
- **Vercel AI SDK**: Implements `LanguageModelV3Middleware` (compatible with V4) to transparently redact prompt messages on-the-fly and restore placeholders in streaming/non-streaming outputs. We dynamically support both `textDelta` and `delta` chunk structures to remain robust across AI SDK minor version changes.
- **Mastra**: Implements Agent processor hooks (`processInput`, `processOutputStep`, `processOutputResult`) as an input/output guardrail.

## 5. WeakMap Request Context Binding

To support concurrent request flows in singleton middleware instances (like the Mastra Agent processor):
- **Decision**: We use a `WeakMap` keyed by the request's execution/context object.
- **Rationale**: Since Javascript garbage collects WeakMap keys when they go out of scope, request-scoped redact maps are automatically cleaned up, eliminating memory leaks without requiring manual cache eviction.

## 6. Web Worker Offloading

Named Entity Recognition (NER) model inference via ONNX/transformers.js is computationally expensive.
- **Decision**: We offload all browser-side NER execution to `src/workers/redact-worker.js`.
- **Design**: The `WorkerPool` class manages Web Worker scheduling and falls back cleanly to in-thread execution in Node.js environments (where the browser Web Worker API is unavailable).
