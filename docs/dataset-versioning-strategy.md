# Dataset Versioning Strategy

## Motivation

As the dataset grows organically through real-world collection, active learning, and targeted campaigns, versioning becomes essential for:
- Reproducibility of training runs
- Regression tracking across model versions
- Dataset quality monitoring (class balance, sample counts)
- Audit trail for thesis validation

## Versioning Scheme

### Format

```
MAJOR.MINOR.PATCH
```

| Component | Bump Condition | Example |
|-----------|----------------|---------|
| MAJOR | Dataset restructuring, new class set, data source change | 1.0.0 → 2.0.0 |
| MINOR | Significant sample addition (>10% increase), new signers | 1.0.0 → 1.1.0 |
| PATCH | Small corrections, validation fixes, metadata updates | 1.0.0 → 1.0.1 |

### Current Version

`1.0.0` — Initial unified dataset (5,721 samples, 133 classes, 1 unknown signer source)

## Dataset Versions Table

```sql
dataset_versions (
  id                  uuid PRIMARY KEY,
  version             text UNIQUE NOT NULL,
  dataset_name        text DEFAULT 'fsl_unified',
  sample_count        integer NOT NULL DEFAULT 0,
  class_count         integer NOT NULL DEFAULT 133,
  signer_count        integer NOT NULL DEFAULT 0,
  source_breakdown    jsonb DEFAULT '{}',
  class_distribution  jsonb DEFAULT '{}',
  mean_confidence     real,
  median_confidence   real,
  min_samples_per_class  integer DEFAULT 0,
  max_samples_per_class  integer DEFAULT 0,
  std_samples_per_class  real DEFAULT 0,
  is_production       boolean NOT NULL DEFAULT false,
  parent_version      text,
  change_log          text,
  created_at          timestamptz DEFAULT now(),
  checksum            text
);
```

## Dataset Snapshots Table

Per-class statistics for each dataset version:

```sql
dataset_snapshots (
  id                    uuid PRIMARY KEY,
  dataset_version_id    uuid REFERENCES dataset_versions(id) ON DELETE CASCADE,
  gesture_label         text NOT NULL,
  sample_count          integer DEFAULT 0,
  unique_signers        integer DEFAULT 0,
  avg_confidence        real,
  min_samples_threshold integer DEFAULT 5,
  meets_threshold       boolean GENERATED ALWAYS AS (sample_count >= min_samples_threshold) STORED,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(dataset_version_id, gesture_label)
);
```

## Versioning Workflow

### 1. Initial Version (1.0.0)
- Seeded during database migration
- Contains the original 5,721-sample unified dataset
- Marked as `is_production = true`

### 2. Active Learning Integration
When approved review samples accumulate:
1. Calculate new sample counts from `training_samples` grouped by label
2. Create new version record with updated counts
3. Set `parent_version` to the current production version
4. Update `change_log` describing additions

### 3. Campaign Integration
When a collection campaign completes:
1. Process collected samples through landmark extraction pipeline
2. Add to training dataset
3. Create new version record
4. Update `source_breakdown` with campaign source counts
5. Update `signer_count` with new unique signers

### 4. Production Promotion
When a version is validated:
1. Verify `sample_count` > previous production version
2. Verify all classes meet `min_samples_threshold`
3. Set `is_production = true` on this version
4. Set `is_production = false` on previous version
5. Update `model_versions` to reference new dataset version

## Quality Thresholds

| Metric | Minimum | Target |
|--------|---------|--------|
| Samples per class | 5 | 20 |
| Unique signers per class | 3 | 10 |
| Class count | 133 | 133 |
| Missing classes | 0 | 0 |
| Source diversity | >= 1 source | >= 3 sources |

## Audit Commands

```bash
# Generate version snapshot from current dataset
node scripts/generate-dataset-version.mjs --output version_1_1_0

# Compare two versions
node scripts/compare-dataset-versions.mjs --v1 1.0.0 --v2 1.1.0

# Validate dataset balance
node scripts/validate-dataset.mjs --version 1.1.0
```

## Integration with Model Versions

Each `model_versions` record should reference its training dataset:

```sql
-- Proposed schema extension (future):
ALTER TABLE model_versions ADD COLUMN dataset_version_id UUID REFERENCES dataset_versions(id);
```

This enables:
- Reproduce any model's training data
- Attribute accuracy changes to dataset changes
- Roll back dataset if model regression is detected
