# Roboflow Label Mapping Report

Generated: 2026-06-09

## Existing Labels (26)

These Roboflow labels directly match existing alphabet labels:

| Roboflow Label | Existing Label | Category |
|---------------|---------------|----------|
| A | a | alphabet |
| B | b | alphabet |
| C | c | alphabet |
| D | d | alphabet |
| E | e | alphabet |
| F | f | alphabet |
| G | g | alphabet |
| H | h | alphabet |
| I | i | alphabet |
| J | j | alphabet |
| K | k | alphabet |
| L | l | alphabet |
| M | m | alphabet |
| N | n | alphabet |
| O | o | alphabet |
| P | p | alphabet |
| Q | q | alphabet |
| R | r | alphabet |
| S | s | alphabet |
| T | t | alphabet |
| U | u | alphabet |
| V | v | alphabet |
| W | w | alphabet |
| X | x | alphabet |
| Y | y | alphabet |
| Z | z | alphabet |

## Alias Labels (2)

| Roboflow Label | Existing Label | Notes |
|---------------|---------------|-------|
| Hello | HELLO | Case-insensitive match |
| I love you | I LOVE YOU | Case-insensitive match |

## Requires Manual Review (3)

| Roboflow Label | Notes |
|---------------|-------|
| Good | Could be "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING" fragment |
| Morning | Likely part of "GOOD MORNING" — isolated usage unclear |
| Afternoon | Likely part of "GOOD AFTERNOON" — isolated usage unclear |

## New Gestures (17)

These labels do not exist in the current 133-label mapping:

| Roboflow Label | Suggested Category | Samples | Usable? |
|---------------|-------------------|---------|---------|
| Are | phrase | 1 | ❌ Too few |
| Boss | phrase | 143 | ✅ |
| Father | phrase | 141 | ⚠️ Existing "FATHER" in FSL-105 |
| Give | phrase | 1 | ❌ Too few |
| How | phrase | 1 | ❌ Too few |
| Me | phrase | 138 | ✅ |
| Mine | phrase | 150 | ✅ |
| Mother | phrase | 141 | ⚠️ Existing "MOTHER" in FSL-105 |
| Night | phrase | 1 | ❌ Too few |
| Quiet | phrase | 147 | ✅ |
| See | phrase | 1 | ❌ Too few |
| Serious | phrase | 145 | ✅ |
| Think | phrase | 148 | ✅ |
| This | phrase | 197 | ✅ |
| Wait | phrase | 50 | ⚠️ Low count |
| Water | phrase | 142 | ✅ |
| You | phrase | 124 | ✅ |

Note: "Father" and "Mother" are duplicates of existing FSL-105 entries (FATHER, MOTHER). They should be mapped to existing labels.

## Summary

| Classification | Count |
|---------------|-------|
| Existing | 26 |
| Alias | 2 |
| Requires Manual Review | 3 |
| New Gestures | 17 |
| **Total** | **48** |
