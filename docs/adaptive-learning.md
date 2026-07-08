# Adaptive Learning System

## Overview

The adaptive learning system enables the FSL platform to improve automatically from real-world usage without manual retraining. It combines translation memory, adaptive thresholds, and analytics to create a continuously improving AI system.

## Core Components

### Translation Memory (`src/features/adaptive-memory/`)
- Persistent storage of successful translations
- LRU cache (1000 entries) with frequency tracking
- Administrator correction history
- Consulted before grammar engine for faster common translations

### Adaptive Confidence Thresholds (`src/features/adaptive-thresholds/`)
- Per-gesture dynamic thresholds (range 0.4–0.9)
- Adjusts based on: confidence variance, recent trend, high/low confidence rates, motion quality, lighting quality
- Minimum 3 samples before adjustment begins

### Knowledge Base Auto-Expansion (`src/features/knowledge-expansion/`)
- Records administrator actions to detect patterns
- Generates suggestions for related gestures, replies, and aliases
- All suggestions require admin approval before publication

## Configuration

Default global threshold: 0.6
Adaptive range: 0.4–0.9
TM cache size: 1000 entries
Knowledge expansion: admin-approval required

## Persistence

- Translation memory: file-based JSON (`data/translation-memory/`)
- Adaptive thresholds: localStorage
- Animation tracking: JSONL (`data/animation-tracking/`)
- Knowledge expansion: localStorage
