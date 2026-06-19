# Runtime Optimization Report

Generated: 2026-06-16

## Executive Summary

| Metric | Measured | Target | Status |
|--------|:--------:|:------:|:------:|
| Load time | 11ms | < 250ms | ✅ |
| Stable prediction | 90ms (per 10 inferences) | < 500ms | ✅ |
| FPS | 110.7 | >= 30 | ✅ |
| Memory | 31.3MB | < 150MB | ✅ |

## Model Details

| Property | Value |
|----------|-------|
| Model | BiLSTM v1 (TFJS) |
| Format | TensorFlow.js graph model |
| JSON size | 2.7KB |
| Weights size | 192.8KB |
| Total size | 195.5KB |

## Inference Latency

| Metric | Value |
|--------|:-----:|
| Mean | 9.04ms |
| Median | 8.93ms |
| Min | 8.02ms |
| Max | 12.17ms |
| P99 | 12.17ms |
| Std Dev | 0.63ms |
| FPS | 110.7 |

## Memory Profile

| Metric | Value |
|--------|:-----:|
| Heap (before) | 18.3MB |
| Heap (after) | 31.3MB |
| Heap total | 54.6MB |
| Tensor memory | 0.2MB |
| Active tensors | 18 |
| Allocation per inference | -70.9KB |

## Optimization Opportunities

| Area | Current | Target | Gap |
|------|:-------:|:------:|:---:|
| Load time | 11ms | 250ms | Within target |
| Inference | 9.04ms | < 10ms | Within target |
| FPS | 110.7 | 30 | Within target |

## Recommendations


