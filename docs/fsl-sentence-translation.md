# FSL Sentence Translation Engine

## Overview

The FSL Sentence Translation Engine converts natural language text (English, Tagalog, or mixed) into Filipino Sign Language (FSL) gloss sequences. Unlike word-for-word substitution, the engine applies FSL grammar rules — Time-Subject-Verb-Object ordering, article removal, negation fronting, and question marking.

## Pipeline

1. **Normalization**: Strip emoji, expand abbreviations/contractions, clean punctuation
2. **Tokenization**: Split into sentences and tokens
3. **Language Detection**: English vs Tagalog vs mixed using marker word ratios
4. **Intent Detection**: Greeting, farewell, question, request, affirmation, negation, statement
5. **Gloss Generation**: Multi-level dictionary lookup with synonym resolution
6. **Grammar Application**: FSL word-order rules, article removal, Tagalog simplification
7. **Confidence Scoring**: Per-word and overall sentence confidence

## Supported Patterns

| English | FSL Gloss |
|---------|-----------|
| I need help | NEED I HELP |
| What is your name | NAME YOUR WHAT |
| I am happy | I HAPPY |
| How are you | YOU HOW |
| Nice to meet you | NICE MEET YOU |
| I don't understand | I UNDERSTAND NOT |

## Language Support

- **English**: Full grammar transformation (SVO → SOV/OSV for FSL)
- **Tagalog**: Marker word recognition, grammar simplification
- **Mixed**: Combined rule application where both languages are detected
