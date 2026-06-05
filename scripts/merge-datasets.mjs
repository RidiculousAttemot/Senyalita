import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const ALPHA_DIR = "datasets/processed/fsl_alphabet_v2";
const FSL_DIR = "datasets/processed/fsl_105";
const OUT_DIR = "datasets/processed/fsl_unified";

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const alphabetLabels = JSON.parse(
  readFileSync(join(ALPHA_DIR, "labels.json"), "utf8")
);
const fslLabels = JSON.parse(
  readFileSync(join(FSL_DIR, "labels.json"), "utf8")
);

const unifiedLabels = [...alphabetLabels.labels, ...fslLabels.labels];
const alphaCount = alphabetLabels.labels.length;

writeFileSync(
  join(OUT_DIR, "labels.json"),
  JSON.stringify({ labels: unifiedLabels }, null, 2)
);

// Write metadata about the splits
const getCount = (dir, split) => {
  const p = join(dir, `${split}.json`);
  if (!existsSync(p)) return 0;
  const d = JSON.parse(readFileSync(p, "utf8"));
  if (Array.isArray(d)) return d.length;
  return d.samples?.length ?? 0;
};

const meta = {
  totalLabels: unifiedLabels.length,
  labelCount: alphaCount,
  fslLabelCount: fslLabels.labels.length,
  alphabetLabels: alphabetLabels.labels,
  fslLabels: fslLabels.labels,
  splits: {}
};

for (const split of ["train", "validation", "test"]) {
  const alphaCount_ = getCount(ALPHA_DIR, split);
  const fslCount = getCount(FSL_DIR, split);
  meta.splits[split] = {
    alphabet: alphaCount_,
    fsl: fslCount,
    total: alphaCount_ + fslCount
  };
}

writeFileSync(join(OUT_DIR, "metadata.json"), JSON.stringify(meta, null, 2));
console.log("Unified dataset prepared:");
console.log(`  Labels: ${unifiedLabels.length} (${alphaCount} alphabet + ${fslLabels.labels.length} FSL-105)`);
for (const [split, counts] of Object.entries(meta.splits)) {
  console.log(`  ${split}: ${counts.total} samples (${counts.alphabet} + ${counts.fsl})`);
}
