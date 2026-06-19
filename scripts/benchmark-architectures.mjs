import fs from "fs";
import path from "path";

const MODELS_DIR = path.join(process.cwd(), "models", "fsl_unified");
const V3_DIR = path.join(process.cwd(), "models", "fsl_unified_v3");

const ARCHITECTURES = [
  { name: "BiLSTM v1", dir: "bilstm", type: "bilstm", modelsDir: MODELS_DIR },
  { name: "BiLSTM v2", dir: "bilstm_v2", type: "bilstm", modelsDir: MODELS_DIR },
  { name: "BiLSTM v3", dir: "", type: "attention_bilstm", modelsDir: V3_DIR },
  { name: "CNN-BiLSTM", dir: "cnn_bilstm", type: "cnn_bilstm", modelsDir: MODELS_DIR },
  { name: "Attention-BiLSTM", dir: "attention_bilstm", type: "attention_bilstm", modelsDir: MODELS_DIR },
  { name: "Transformer", dir: "transformer", type: "transformer", modelsDir: MODELS_DIR },
];

const readJson = (fp) => { try { return JSON.parse(fs.readFileSync(fp, "utf8")); } catch { return null; } };

const benchmarkModel = (arch) => {
  const modelDir = path.join(arch.modelsDir, arch.dir);
  const metricsPath = path.join(modelDir, "metrics.json");
  const configPath = path.join(modelDir, "config.json");
  const modelPath = path.join(modelDir, "model.json");

  const metrics = readJson(metricsPath);
  const config = readJson(configPath);

  if (!metrics) return { name: arch.name, status: "no-metrics" };

  const params = estimateParams(arch, config);
  const inferenceMs = estimateInferenceTime(arch, params);

  return {
    name: arch.name,
    status: "available",
    testAccuracy: metrics.testAccuracy ?? metrics.testAcc,
    macroF1: metrics.macroF1,
    weightedF1: metrics.weightedF1,
    testLoss: metrics.testLoss,
    params,
    estimatedInferenceMs: inferenceMs,
    memoryFootprintKB: Math.round(params * 4 / 1024),
    epochsTrained: metrics.history?.length ?? config?.epochsCompleted ?? config?.epochs,
    comparisons: {},
  };
};

const estimateParams = (arch, config) => {
  switch (arch.type) {
    case "bilstm": {
      const hs = config?.architecture?.recurrentLayers?.[0]?.hiddenSize ?? 32;
      const fd = config?.architecture?.recurrentLayers?.[0]?.temporalFrameIndices?.length ?? 30;
      const nClasses = config?.architecture?.classifier?.outputClasses ?? 133;
      const lstmParams = 4 * (fd + hs + 1) * hs;
      const denseParams = (hs * 2) * nClasses + nClasses;
      return (lstmParams * 2 + denseParams);
    }
    case "cnn_bilstm": {
      const hs = config?.arch?.lstm?.hiddenSize ?? 32;
      const nClasses = config?.arch?.outputClasses ?? 133;
      const cnnFilters = config?.arch?.cnn?.filters ?? 64;
      const cnnK = config?.arch?.cnn?.kernelSize ?? 3;
      const cnnParams = (126 * cnnK + 1) * cnnFilters;
      const lstmParams = 4 * (cnnFilters + hs + 1) * hs;
      const denseParams = (hs * 2) * nClasses + nClasses;
      return cnnParams + lstmParams * 2 + denseParams;
    }
    case "transformer": {
      const dm = config?.arch?.dModel ?? 64;
      const nHeads = config?.arch?.nHeads ?? 4;
      const nLayers = config?.arch?.nLayers ?? 2;
      const dff = config?.arch?.dFF ?? 128;
      const nClasses = config?.arch?.nClasses ?? 133;
      const attnParams = 4 * dm * dm;
      const ffParams = 2 * dm * dff + dm + dff;
      const clfParams = dm * nClasses + nClasses;
      return 126 * dm + dm + nLayers * (attnParams + ffParams) + clfParams;
    }
    case "attention_bilstm": {
      const hs = config?.arch?.lstm?.hiddenSize ?? 32;
      const attnSize = config?.arch?.attention?.size ?? 64;
      const nClasses = config?.arch?.nClasses ?? 133;
      const lstmParams = 4 * (126 + hs + 1) * hs;
      const attnParams = (hs * 2) * attnSize + attnSize;
      const denseParams = (hs * 2) * nClasses + nClasses;
      return lstmParams * 2 + attnParams + denseParams;
    }
    default:
      return 0;
  }
};

const estimateInferenceTime = (arch, params) => {
  const baseTime = 0.5;
  const perParam = 0.0005;
  const overhead = arch.type === "transformer" ? 2 : arch.type === "cnn_bilstm" ? 1.2 : arch.type === "attention_bilstm" ? 1.3 : 1;
  return Number((overhead * (baseTime + params * perParam) + Math.random() * 0.3).toFixed(2));
};

const report = {
  benchmarkDate: new Date().toISOString(),
  hardware: "Node.js inference benchmark (simulated)",
  architectures: ARCHITECTURES.map(benchmarkModel),
};

const best = report.architectures
  .filter((a) => a.status === "available")
  .sort((a, b) => (b.macroF1 ?? 0) - (a.macroF1 ?? 0));

if (best.length > 0) {
  report.bestArchitecture = best[0].name;
  report.targetMet = best[0].macroF1 >= 0.90 && best[0].testAccuracy >= 0.93;
  report.recommended = best[0].name;
}

for (let i = 0; i < best.length; i++) {
  for (let j = i + 1; j < best.length; j++) {
    const a = best[i], b = best[j];
    a.comparisons[b.name] = {
      accuracyDelta: Number(((a.testAccuracy - b.testAccuracy) * 100).toFixed(2)),
      f1Delta: Number(((a.macroF1 - b.macroF1) * 100).toFixed(2)),
      paramRatio: (a.params / b.params).toFixed(2),
      speedRatio: (b.estimatedInferenceMs / a.estimatedInferenceMs).toFixed(2),
    };
  }
}

const outPath = path.join(process.cwd(), "models", "benchmark.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
