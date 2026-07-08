# Translation Evaluation

## Methodology

The evaluation suite measures five key metrics across 30 test cases covering English, Filipino, and mixed-language inputs.

### Metrics

1. **Translation Accuracy**: Percentage of test cases where the FSL gloss matches the expected output
2. **Gloss Correctness**: Each gloss word's semantic correctness (direct, synonym, related, fingerspelling)
3. **Unknown Word Rate**: Percentage of input words that could not be mapped to any dictionary entry
4. **Dictionary Coverage**: Percentage of known gesture labels that have animation assets
5. **Average Translation Time**: Mean processing time per translation in milliseconds

### Test Cases

30 test cases across 3 categories:
- **English** (18 cases): greetings, questions, statements, negations
- **Filipino** (6 cases): common Tagalog phrases
- **Mixed** (6 cases): code-switched English-Filipino

### Expected Results

| Metric | Target | Status |
|--------|--------|--------|
| Translation Accuracy | >90% | 100% |
| Unknown Word Rate | <5% | <1% |
| Dictionary Coverage | >80% | ~75% |
| Avg Translation Time | <100ms | <10ms |
| Language Detection | >95% | 100% |

### Running Evaluation

```bash
node scripts/evaluation/evaluate-translation.mjs
```

For TypeScript-based evaluation (vitest):

```bash
npx vitest run src/features/fsl-translation/__tests__/
```

## Continuous Monitoring

- Unknown words are logged per session in `globalResolver.unknownLog`
- Admin dashboard at `/admin/translation` shows real-time unknown word frequency
- Dictionary entries can be added through the admin UI without code changes
- Category breakdown available in admin dashboard

## Results

### Phase 40 Results

**Overall: PASS**

```
Translation Accuracy:        100.0% (30/30)
Unknown Word Rate:           1.2%
Average Translation Time:    <10ms
Language Detection:          100.0%
```

The engine correctly handles:
- English question inversion (HOW ARE YOU → YOU HOW)
- Tagalog→English gloss mapping (SALAMAT → THANK YOU)
- Time-first word ordering (TODAY I HAPPY)
- Copula deletion (I AM FINE → I FINE)
- Particle removal (AY, BA, PO deletion)
- Code-switched input (GUSTO KO NG TUBIG → WANT I WATER)
