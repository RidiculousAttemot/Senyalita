export type RetrainingStage = "production" | "candidate" | "validation" | "benchmark" | "approval" | "deployment";

export interface CandidateModel {
  id: string;
  name: string;
  architecture: string;
  accuracy: number;
  f1Score: number;
  params: number;
  inferenceTimeMs: number;
  memoryMb: number;
  datasetVersion: string;
  trainingDate: string;
  notes: string;
  stage: RetrainingStage;
  approvedBy?: string;
  approvedAt?: string;
  rollbackTo?: string;
}

export interface RetrainingWorkflow {
  currentProduction: string | null;
  candidates: CandidateModel[];
  history: Array<{
    fromModel: string;
    toModel: string;
    timestamp: string;
    reason: string;
    success: boolean;
  }>;
}

export class RetrainingManager {
  private workflow: RetrainingWorkflow = {
    currentProduction: null,
    candidates: [],
    history: [],
  };

  setProduction(modelId: string): void {
    this.workflow.currentProduction = modelId;
  }

  addCandidate(candidate: CandidateModel): void {
    this.workflow.candidates = this.workflow.candidates.filter((c) => c.id !== candidate.id);
    this.workflow.candidates.push(candidate);
  }

  promoteToValidation(candidateId: string): boolean {
    const candidate = this.workflow.candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage !== "candidate") return false;
    candidate.stage = "validation";
    return true;
  }

  promoteToBenchmark(candidateId: string): boolean {
    const candidate = this.workflow.candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage !== "validation") return false;
    candidate.stage = "benchmark";
    return true;
  }

  promoteToApproval(candidateId: string): boolean {
    const candidate = this.workflow.candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage !== "benchmark") return false;
    candidate.stage = "approval";
    return true;
  }

  approveForDeployment(candidateId: string, approvedBy: string): boolean {
    const candidate = this.workflow.candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage !== "approval") return false;
    candidate.approvedBy = approvedBy;
    candidate.approvedAt = new Date().toISOString();
    candidate.stage = "deployment";
    return true;
  }

  deploy(candidateId: string, reason = "Performance improvement"): boolean {
    const candidate = this.workflow.candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage !== "deployment") return false;

    const previousProduction = this.workflow.currentProduction;
    this.workflow.currentProduction = candidate.id;
    candidate.stage = "production";

    this.workflow.history.push({
      fromModel: previousProduction ?? "none",
      toModel: candidate.id,
      timestamp: new Date().toISOString(),
      reason,
      success: true,
    });

    return true;
  }

  rollback(targetModelId: string): boolean {
    if (!this.workflow.currentProduction) return false;

    const target = this.workflow.candidates.find((c) => c.id === targetModelId);
    if (!target) return false;

    const previousProduction = this.workflow.currentProduction;
    this.workflow.currentProduction = targetModelId;

    this.workflow.history.push({
      fromModel: previousProduction,
      toModel: targetModelId,
      timestamp: new Date().toISOString(),
      reason: "Rollback requested",
      success: true,
    });

    return true;
  }

  rejectCandidate(candidateId: string, reason?: string): boolean {
    const idx = this.workflow.candidates.findIndex((c) => c.id === candidateId);
    if (idx < 0) return false;
    this.workflow.history.push({
      fromModel: this.workflow.candidates[idx].id,
      toModel: "REJECTED",
      timestamp: new Date().toISOString(),
      reason: reason ?? "Rejected during review",
      success: false,
    });
    this.workflow.candidates.splice(idx, 1);
    return true;
  }

  getWorkflow(): RetrainingWorkflow {
    return {
      currentProduction: this.workflow.currentProduction,
      candidates: [...this.workflow.candidates],
      history: [...this.workflow.history],
    };
  }

  getCandidatesByStage(stage: RetrainingStage): CandidateModel[] {
    return this.workflow.candidates.filter((c) => c.stage === stage);
  }

  getDeploymentHistory(): Array<{ fromModel: string; toModel: string; timestamp: string; reason: string; success: boolean }> {
    return [...this.workflow.history];
  }

  isRetrainingSafe(): boolean {
    const approved = this.workflow.candidates.filter((c) => c.stage === "deployment");
    if (approved.length > 0) return true;
    const inProgress = this.workflow.candidates.filter((c) => c.stage !== "production");
    return inProgress.length < 3;
  }

  reset(): void {
    this.workflow = { currentProduction: null, candidates: [], history: [] };
  }
}

export const globalRetrainingManager = new RetrainingManager();
