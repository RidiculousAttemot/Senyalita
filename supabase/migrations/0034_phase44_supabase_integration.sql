-- Phase 44: Supabase Integration (Drift, Retraining, Deployment, Text-to-Sign Logging)
-- Extends the database for production model management and observability.

-- ============================================================================
-- 1. TEXT-TO-SIGN TRANSLATION LOGS
-- Separate from recognition translation_logs — tracks text-to-sign pipeline runs.
-- ============================================================================
CREATE TABLE IF NOT EXISTS text_to_sign_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text  TEXT NOT NULL,
  translated_gloss TEXT,
  confidence_score  REAL,
  processing_time_ms INTEGER,
  unknown_token_count INTEGER NOT NULL DEFAULT 0,
  model_version TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  TEXT,
  source      TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','api','mobile')),
  success     BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_text_to_sign_logs_created_at ON text_to_sign_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_text_to_sign_logs_user_id    ON text_to_sign_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_text_to_sign_logs_success    ON text_to_sign_logs (success);

-- ============================================================================
-- 2. DRIFT SNAPSHOTS
-- Periodic snapshots of model accuracy / distribution for drift detection.
-- ============================================================================
CREATE TABLE IF NOT EXISTS drift_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  model_version   TEXT NOT NULL,
  total_samples   INTEGER NOT NULL DEFAULT 0,
  class_accuracy  JSONB NOT NULL DEFAULT '{}',
  overall_accuracy REAL,
  drift_score     REAL,  -- composite drift metric (0 = no drift)
  distribution_shift JSONB,
  low_confidence_rate  REAL,
  unknown_rate    REAL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drift_snapshots_date ON drift_snapshots (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_drift_snapshots_version ON drift_snapshots (model_version);

-- ============================================================================
-- 3. RETRAINING JOBS
-- Tracks model retraining lifecycle (triggered by drift or manually).
-- ============================================================================
CREATE TABLE IF NOT EXISTS retraining_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  trigger_reason    TEXT NOT NULL,
  dataset_version_id UUID REFERENCES dataset_versions(id) ON DELETE SET NULL,
  model_version_id  UUID REFERENCES model_versions(id) ON DELETE SET NULL,
  accuracy_before   REAL,
  accuracy_after    REAL,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,
  metrics_snapshot  JSONB,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retraining_jobs_status    ON retraining_jobs (status);
CREATE INDEX IF NOT EXISTS idx_retraining_jobs_created   ON retraining_jobs (created_at DESC);

-- ============================================================================
-- 4. DEPLOYMENT HISTORY
-- Tracks model deployments across environments.
-- ============================================================================
CREATE TABLE IF NOT EXISTS deployment_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id  UUID NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  environment       TEXT NOT NULL CHECK (environment IN ('development','staging','production')),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','deploying','active','rolled_back','failed')),
  deployed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deployed_at       TIMESTAMPTZ,
  rollback_at       TIMESTAMPTZ,
  rollback_reason   TEXT,
  validation_status TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployment_history_env    ON deployment_history (environment, status);
CREATE INDEX IF NOT EXISTS idx_deployment_history_model  ON deployment_history (model_version_id);

-- ============================================================================
-- 5. ENABLE ROW-LEVEL SECURITY
-- ============================================================================
ALTER TABLE text_to_sign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE retraining_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- text_to_sign_logs: users see own logs; admins see all
CREATE POLICY text_to_sign_logs_own_select
  ON text_to_sign_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY text_to_sign_logs_own_insert
  ON text_to_sign_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY text_to_sign_logs_admin_all
  ON text_to_sign_logs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- drift_snapshots: all authenticated users can view; only service_role inserts
CREATE POLICY drift_snapshots_select
  ON drift_snapshots FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- retraining_jobs: admins only
CREATE POLICY retraining_jobs_admin_all
  ON retraining_jobs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- deployment_history: admins only
CREATE POLICY deployment_history_admin_all
  ON deployment_history FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
