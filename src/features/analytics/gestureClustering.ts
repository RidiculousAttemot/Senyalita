export interface GestureSample {
  id: string;
  label: string;
  landmarks: Array<{ x: number; y: number; z: number }>;
  signerId?: string;
  region?: string;
  cameraModel?: string;
  timestamp: string;
}

export interface GestureCluster {
  id: string;
  label: string;
  centroid: number[];
  samples: GestureSample[];
  variation: "natural" | "signer" | "regional" | "camera" | "unknown";
  variationDescription: string;
  intraClusterDistance: number;
}

export class GestureClusteringEngine {
  private samples: GestureSample[] = [];

  addSample(sample: GestureSample): void {
    this.samples.push(sample);
  }

  addBatch(samples: GestureSample[]): void {
    for (const s of samples) this.addSample(s);
  }

  cluster(label?: string, maxClusters = 5): GestureCluster[] {
    const targetSamples = label
      ? this.samples.filter((s) => s.label === label)
      : this.samples;

    if (targetSamples.length < 3) return [];

    const features = targetSamples.map((s) => this.extractFeatureVector(s));
    const clusters = this.kMeans(features, Math.min(maxClusters, Math.floor(targetSamples.length / 2)));

    return clusters.map((cluster, i) => {
      const sampleIndices = cluster.indices;
      const clusterSamples = sampleIndices.map((idx) => targetSamples[idx]);
      const variation = this.classifyVariation(clusterSamples);
      const centroid = cluster.centroid;

      return {
        id: `cluster-${label ?? "all"}-${i}`,
        label: label ?? "all",
        centroid,
        samples: clusterSamples,
        variation: variation.type,
        variationDescription: variation.description,
        intraClusterDistance: computeClusterDistance(sampleIndices.map((idx) => features[idx]), centroid),
      };
    });
  }

  classifyVariation(samples: GestureSample[]): { type: GestureCluster["variation"]; description: string } {
    if (samples.length < 2) return { type: "unknown", description: "Insufficient samples to classify" };

    const uniqueSigners = new Set(samples.map((s) => s.signerId).filter(Boolean));
    const uniqueRegions = new Set(samples.map((s) => s.region).filter(Boolean));
    const uniqueCameras = new Set(samples.map((s) => s.cameraModel).filter(Boolean));

    if (uniqueRegions.size > 1) {
      return { type: "regional", description: `Variant across ${uniqueRegions.size} regions` };
    }
    if (uniqueSigners.size > 1 && uniqueCameras.size <= 1) {
      return { type: "signer", description: `Variant across ${uniqueSigners.size} signers` };
    }
    if (uniqueCameras.size > 1) {
      return { type: "camera", description: `Variant across ${uniqueCameras.size} camera types` };
    }
    return { type: "natural", description: "Natural within-class variation" };
  }

  private extractFeatureVector(sample: GestureSample): number[] {
    const lm = sample.landmarks;
    if (lm.length === 0) return [];
    const centerX = lm.reduce((s, p) => s + p.x, 0) / lm.length;
    const centerY = lm.reduce((s, p) => s + p.y, 0) / lm.length;
    const centerZ = lm.reduce((s, p) => s + p.z, 0) / lm.length;

    const features: number[] = [];
    for (const p of lm) {
      features.push(p.x - centerX, p.y - centerY, p.z - centerZ);
    }
    return features;
  }

  private kMeans(features: number[][], k: number): Array<{ centroid: number[]; indices: number[] }> {
    if (features.length === 0 || features[0].length === 0) return [];
    k = Math.max(1, Math.min(k, features.length));

    const centroids = initializeCentroids(features, k);
    const assignments = new Array(features.length).fill(0);
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 100) {
      changed = false;
      iterations++;

      for (let i = 0; i < features.length; i++) {
        let minDist = Infinity;
        let bestCluster = 0;
        for (let j = 0; j < k; j++) {
          const dist = euclideanDistance(features[i], centroids[j]);
          if (dist < minDist) { minDist = dist; bestCluster = j; }
        }
        if (assignments[i] !== bestCluster) { assignments[i] = bestCluster; changed = true; }
      }

      for (let j = 0; j < k; j++) {
        const clusterPoints = features.filter((_, i) => assignments[i] === j);
        if (clusterPoints.length > 0) {
          const dim = features[0].length;
          centroids[j] = Array(dim).fill(0);
          for (const pt of clusterPoints) {
            for (let d = 0; d < dim; d++) centroids[j][d] += pt[d];
          }
          for (let d = 0; d < dim; d++) centroids[j][d] /= clusterPoints.length;
        }
      }
    }

    return centroids.map((centroid, j) => ({
      centroid,
      indices: assignments.map((a, i) => (a === j ? i : -1)).filter((i) => i >= 0),
    })).filter((c) => c.indices.length > 0);
  }

  getSamples(): GestureSample[] {
    return [...this.samples];
  }

  clear(): void {
    this.samples = [];
  }
}

function initializeCentroids(features: number[][], k: number): number[][] {
  const centroids: number[][] = [features[0]];
  for (let i = 1; i < k; i++) {
    const dists = features.map((f) => Math.min(...centroids.map((c) => euclideanDistance(f, c))));
    const totalDist = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * totalDist;
    let chosen = 0;
    for (let j = 0; j < dists.length; j++) {
      r -= dists[j];
      if (r <= 0) { chosen = j; break; }
    }
    centroids.push(features[chosen]);
  }
  return centroids;
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function computeClusterDistance(features: number[][], centroid: number[]): number {
  if (features.length === 0) return 0;
  return features.reduce((s, f) => s + euclideanDistance(f, centroid), 0) / features.length;
}

export const globalClusteringEngine = new GestureClusteringEngine();
