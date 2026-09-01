// Supabase database types — keep in sync with supabase/migrations/*.sql.
// Use `type` aliases (not interfaces) so the supabase-js generic
// constraints resolve correctly under postgrest-js v2.107+.

export type UserRole = "user" | "admin";

export type TranslationSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  source: "web" | "mobile" | "embedded";
  created_at: string;
};

export type TranslationLog = {
  id: string;
  session_id: string;
  user_id: string;
  gesture_label: string;
  confidence: number;
  inference_time_ms: number;
  selected_reply: string | null;
  was_custom_reply: boolean;
  recognition_source: "static" | "temporal" | "hybrid" | "unknown" | null;
  created_at: string;
};

export type TranscriptEntryRow = {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Gesture = {
  id: string;
  label: string;
  description: string;
  video_path: string | null;
  thumbnail_path: string | null;
  is_active: boolean;
  status: "draft" | "review" | "approved" | "archived";
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type GestureReply = {
  id: string;
  gesture_id: string;
  reply_text: string;
  display_order: number;
  is_active: boolean;
  video_path: string | null;
  created_at: string;
};

export type GestureWithReplies = Gesture & {
  replies: Pick<GestureReply, "id" | "reply_text" | "display_order">[];
};

export type AdminAnalyticsTotals = {
  users: number;
  translations: number;
  sessions: number;
  avg_confidence: number;
  avg_inference_ms: number;
};

export type AdminAnalyticsRecognition = {
  total: number;
  today: number;
  this_week: number;
  this_month: number;
  low_confidence_rate: number;
};

export type AdminAnalyticsTopGesture = {
  label: string;
  count: number;
  avg_confidence: number;
};

export type AdminAnalyticsTopReply = {
  reply_text: string;
  count: number;
};

export type AdminAnalyticsUsers = {
  total: number;
  active_30d: number;
  sessions_per_user: number;
  avg_session_duration_ms: number | null;
};

export type AdminAnalyticsDailyCount = {
  day: string;
  count: number;
};

export type AdminAnalytics = {
  totals: AdminAnalyticsTotals;
  recognition: AdminAnalyticsRecognition;
  top_gestures: AdminAnalyticsTopGesture[];
  top_replies: AdminAnalyticsTopReply[];
  users: AdminAnalyticsUsers;
  daily_counts: AdminAnalyticsDailyCount[];
  active_users_30d: number;
};

export type TelemetryEvent = {
  id: string;
  event_type: "recognition_success" | "recognition_failure" | "low_confidence" | "ai_reply_used" | "conversation_completed" | "session_abandoned" | "gesture_used" | "reply_used" | "translation_started" | "translation_completed" | "translation_failed" | "model_loaded" | "model_prediction" | "admin_login" | "retraining_started" | "retraining_completed";
  event_data: Record<string, unknown>;
  user_id: string | null;
  session_id: string | null;
  session_token: string | null;
  gesture_label: string | null;
  confidence: number | null;
  created_at: string;
};

export type ReviewQueueItem = {
  id: string;
  gesture_label: string;
  landmarks_data: Record<string, unknown>;
  confidence: number;
  source: "low_confidence" | "user_correction" | "admin_flag";
  original_prediction: string;
  corrected_label: string | null;
  corrected_by: string | null;
  status: "pending" | "approved" | "rejected" | "relabeled";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  session_id: string | null;
  created_at: string;
};

export type ModelVersion = {
  id: string;
  version: string;
  accuracy: number | null;
  dataset_size: number | null;
  num_classes: number;
  architecture: string;
  deployment_date: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  notes: string | null;
  created_at: string;
};

export type TranslationEntry = {
  id: string;
  language_code: string;
  gesture_label: string;
  translated_text: string;
  context_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GestureKnowledgeBase = {
  id: string;
  label: string;
  display_name: string;
  category: "alphabet" | "phrase";
  description: string | null;
  usage_explanation: string | null;
  reference_video_url: string | null;
  difficulty_level: number;
  frequency_of_use: number;
  common_mistakes: string | null;
  related_gestures: string[];
  suggested_replies: string[];
  created_at: string;
  updated_at: string;
};

export type GestureConfusionPair = {
  id: string;
  gesture_label: string;
  confused_with: string;
  count: number;
  created_at: string;
  updated_at: string;
};

export type ModelMetricsDailyRow = {
  day: string;
  total_predictions: number;
  low_confidence_count: number;
  unknown_count: number;
  avg_confidence: number | null;
  avg_inference_ms: number | null;
  failure_rate: number | null;
};

export type FeedbackRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  gesture_label: string;
  rating: "correct" | "incorrect";
  comment: string | null;
  feedback_category: string | null;
  severity: string | null;
  context_json: Record<string, unknown> | null;
  created_at: string;
};

export type PredictionCorrection = {
  id: string;
  user_id: string;
  predicted_label: string;
  corrected_label: string;
  confidence: number | null;
  source: "static" | "temporal" | "hybrid" | "unknown" | null;
  created_at: string;
};

export type TrainingSample = {
  id: string;
  original_prediction: string;
  corrected_label: string;
  confidence: number | null;
  source: "correction" | "review_approval" | "admin_upload" | null;
  landmark_snapshot: Record<string, unknown> | null;
  review_queue_id: string | null;
  approved_by: string | null;
  approved_at: string;
  created_at: string;
};

export type DatasetVersion = {
  id: string;
  version: string;
  dataset_name: string;
  sample_count: number;
  class_count: number;
  signer_count: number;
  source_breakdown: Record<string, unknown>;
  class_distribution: Record<string, unknown>;
  mean_confidence: number | null;
  median_confidence: number | null;
  min_samples_per_class: number;
  max_samples_per_class: number;
  std_samples_per_class: number | null;
  is_production: boolean;
  parent_version: string | null;
  change_log: string | null;
  created_at: string;
  checksum: string | null;
};

export type SignerProfile = {
  id: string;
  signer_id: string;
  age_range: string | null;
  handedness: string | null;
  signing_experience: string | null;
  region: string | null;
  total_sessions: number;
  total_gestures: number;
  unique_gestures: number;
  avg_confidence: number | null;
  last_active_at: string | null;
  first_active_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SessionDiversity = {
  id: string;
  session_id: string;
  signer_id: string | null;
  lighting: string | null;
  camera_angle: string | null;
  background: string | null;
  hand_dominance: string | null;
  environment: string | null;
  device_type: string | null;
  resolution_width: number | null;
  resolution_height: number | null;
  fps: number | null;
  noise_level: number | null;
  created_at: string;
};

export type DailyPerformance = {
  id: string;
  day: string;
  total_predictions: number;
  total_sessions: number;
  avg_confidence: number | null;
  median_confidence: number | null;
  low_confidence_rate: number | null;
  failure_rate: number | null;
  correction_rate: number | null;
  conversation_success_rate: number | null;
  avg_inference_time_ms: number | null;
  p95_inference_time_ms: number | null;
  model_version: string | null;
  signer_count: number | null;
  created_at: string;
};

// Phase 44 — Supabase Integration
export type TextToSignLog = {
  id: string;
  input_text: string;
  translated_gloss: string | null;
  confidence_score: number | null;
  processing_time_ms: number | null;
  unknown_token_count: number;
  model_version: string | null;
  user_id: string | null;
  session_id: string | null;
  source: "web" | "api" | "mobile";
  success: boolean;
  error_message: string | null;
  created_at: string;
};

export type RetrainingJob = {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  trigger_reason: string;
  dataset_version_id: string | null;
  model_version_id: string | null;
  accuracy_before: number | null;
  accuracy_after: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metrics_snapshot: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DeploymentHistory = {
  id: string;
  model_version_id: string;
  environment: "development" | "staging" | "production";
  status: "pending" | "deploying" | "active" | "rolled_back" | "failed";
  deployed_by: string | null;
  deployed_at: string | null;
  rollback_at: string | null;
  rollback_reason: string | null;
  validation_status: string | null;
  notes: string | null;
  created_at: string;
};

type Tables = {
  translation_sessions: {
    Row: TranslationSession;
    Insert: {
      id?: string;
      user_id: string;
      started_at?: string;
      ended_at?: string | null;
      duration_ms?: number | null;
      source?: TranslationSession["source"];
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      started_at?: string;
      ended_at?: string | null;
      duration_ms?: number | null;
      source?: TranslationSession["source"];
      created_at?: string;
    };
    Relationships: [];
  };
  translation_logs: {
    Row: TranslationLog;
    Insert: {
      id?: string;
      session_id: string;
      user_id?: string;
      gesture_label: string;
      confidence: number;
      inference_time_ms: number;
      selected_reply?: string | null;
      was_custom_reply?: boolean;
      recognition_source?: "static" | "temporal" | "hybrid" | "unknown" | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      session_id?: string;
      user_id?: string;
      gesture_label?: string;
      confidence?: number;
      inference_time_ms?: number;
      selected_reply?: string | null;
      was_custom_reply?: boolean;
      recognition_source?: "static" | "temporal" | "hybrid" | "unknown" | null;
      created_at?: string;
    };
    Relationships: [];
  };
  transcripts: {
    Row: TranscriptEntryRow;
    Insert: {
      id?: string;
      session_id: string;
      user_id?: string;
      content: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      session_id?: string;
      user_id?: string;
      content?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  gestures: {
    Row: Gesture;
    Insert: {
      id?: string;
      label: string;
      description?: string;
      video_path?: string | null;
      thumbnail_path?: string | null;
      is_active?: boolean;
      status?: Gesture["status"];
      display_order?: number;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      label?: string;
      description?: string;
      video_path?: string | null;
      thumbnail_path?: string | null;
      is_active?: boolean;
      status?: Gesture["status"];
      display_order?: number;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  gesture_replies: {
    Row: GestureReply;
    Insert: {
      id?: string;
      gesture_id: string;
      reply_text: string;
      display_order?: number;
      is_active?: boolean;
      video_path?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      gesture_id?: string;
      reply_text?: string;
      display_order?: number;
      is_active?: boolean;
      video_path?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  feedback: {
    Row: FeedbackRow;
    Insert: {
      id?: string;
      user_id: string;
      session_id?: string | null;
      gesture_label: string;
      rating: FeedbackRow["rating"];
      comment?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      session_id?: string | null;
      gesture_label?: string;
      rating?: FeedbackRow["rating"];
      comment?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  gesture_captures: {
    Row: {
      id: string;
      label: string;
      video_url: string;
      captured_by: string;
      status: "pending_review" | "approved" | "rejected";
      reviewed_by: string | null;
      reviewed_at: string | null;
      notes: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      label: string;
      video_url: string;
      captured_by: string;
      status?: "pending_review" | "approved" | "rejected";
      reviewed_by?: string | null;
      reviewed_at?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      label?: string;
      video_url?: string;
      captured_by?: string;
      status?: "pending_review" | "approved" | "rejected";
      reviewed_by?: string | null;
      reviewed_at?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  conversation_sessions: {
    Row: ConversationSession;
    Insert: {
      id?: string;
      user_id: string;
      started_at?: string;
      ended_at?: string | null;
      status?: ConversationSession["status"];
      participant_name?: string | null;
      total_messages?: number;
      communication_success?: boolean | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      started_at?: string;
      ended_at?: string | null;
      status?: ConversationSession["status"];
      participant_name?: string | null;
      total_messages?: number;
      communication_success?: boolean | null;
      created_at?: string;
    };
    Relationships: [];
  };
  conversation_messages: {
    Row: ConversationMessage;
    Insert: {
      id?: string;
      session_id: string;
      sender_type: ConversationMessage["sender_type"];
      gesture_label?: string | null;
      translated_text: string;
      confidence?: number | null;
      reply_to_message_id?: string | null;
      is_selected_reply?: boolean;
      created_at?: string;
    };
    Update: {
      id?: string;
      session_id?: string;
      sender_type?: ConversationMessage["sender_type"];
      gesture_label?: string | null;
      translated_text?: string;
      confidence?: number | null;
      reply_to_message_id?: string | null;
      is_selected_reply?: boolean;
      created_at?: string;
    };
    Relationships: [];
  };
  gesture_reply_relationships: {
    Row: GestureReplyRelationship;
    Insert: {
      id?: string;
      gesture_label: string;
      suggested_reply: string;
      priority?: number;
      context_tags?: string[] | null;
      is_active?: boolean;
      response_video_url?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      gesture_label?: string;
      suggested_reply?: string;
      priority?: number;
      context_tags?: string[] | null;
      is_active?: boolean;
      response_video_url?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  model_metrics_daily: {
    Row: ModelMetricsDailyRow & { id: string; updated_at: string };
    Insert: {
      id?: string;
      day: string;
      total_predictions?: number;
      low_confidence_count?: number;
      unknown_count?: number;
      avg_confidence?: number | null;
      avg_inference_ms?: number | null;
      failure_rate?: number | null;
      updated_at?: string;
    };
    Update: {
      id?: string;
      day?: string;
      total_predictions?: number;
      low_confidence_count?: number;
      unknown_count?: number;
      avg_confidence?: number | null;
      avg_inference_ms?: number | null;
      failure_rate?: number | null;
      updated_at?: string;
    };
    Relationships: [];
  };
  telemetry_events: {
    Row: TelemetryEvent;
    Insert: {
      id?: string;
      event_type: TelemetryEvent["event_type"];
      event_data?: Record<string, unknown>;
      user_id?: string | null;
      session_id?: string | null;
      session_token?: string | null;
      gesture_label?: string | null;
      confidence?: number | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      event_type?: TelemetryEvent["event_type"];
      event_data?: Record<string, unknown>;
      user_id?: string | null;
      session_id?: string | null;
      session_token?: string | null;
      gesture_label?: string | null;
      confidence?: number | null;
      created_at?: string;
    };
    Relationships: [];
  };
  review_queue: {
    Row: ReviewQueueItem;
    Insert: {
      id?: string;
      gesture_label: string;
      landmarks_data: Record<string, unknown>;
      confidence: number;
      source: ReviewQueueItem["source"];
      original_prediction: string;
      corrected_label?: string | null;
      corrected_by?: string | null;
      status?: ReviewQueueItem["status"];
      reviewed_by?: string | null;
      reviewed_at?: string | null;
      review_notes?: string | null;
      session_id?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      gesture_label?: string;
      landmarks_data?: Record<string, unknown>;
      confidence?: number;
      source?: ReviewQueueItem["source"];
      original_prediction?: string;
      corrected_label?: string | null;
      corrected_by?: string | null;
      status?: ReviewQueueItem["status"];
      reviewed_by?: string | null;
      reviewed_at?: string | null;
      review_notes?: string | null;
      session_id?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  model_versions: {
    Row: ModelVersion;
    Insert: {
      id?: string;
      version: string;
      accuracy?: number | null;
      dataset_size?: number | null;
      num_classes?: number;
      architecture?: string;
      deployment_date?: string | null;
      is_active?: boolean;
      metadata?: Record<string, unknown>;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      version?: string;
      accuracy?: number | null;
      dataset_size?: number | null;
      num_classes?: number;
      architecture?: string;
      deployment_date?: string | null;
      is_active?: boolean;
      metadata?: Record<string, unknown>;
      notes?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  translations: {
    Row: TranslationEntry;
    Insert: {
      id?: string;
      language_code: string;
      gesture_label: string;
      translated_text: string;
      context_notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      language_code?: string;
      gesture_label?: string;
      translated_text?: string;
      context_notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  gesture_knowledge_base: {
    Row: GestureKnowledgeBase;
    Insert: {
      id?: string;
      label: string;
      display_name: string;
      category: GestureKnowledgeBase["category"];
      description?: string | null;
      usage_explanation?: string | null;
      reference_video_url?: string | null;
      difficulty_level?: number;
      frequency_of_use?: number;
      common_mistakes?: string | null;
      related_gestures?: string[];
      suggested_replies?: string[];
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      label?: string;
      display_name?: string;
      category?: GestureKnowledgeBase["category"];
      description?: string | null;
      usage_explanation?: string | null;
      reference_video_url?: string | null;
      difficulty_level?: number;
      frequency_of_use?: number;
      common_mistakes?: string | null;
      related_gestures?: string[];
      suggested_replies?: string[];
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  gesture_confusion_pairs: {
    Row: GestureConfusionPair;
    Insert: {
      id?: string;
      gesture_label: string;
      confused_with: string;
      count?: number;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      gesture_label?: string;
      confused_with?: string;
      count?: number;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  prediction_corrections: {
    Row: PredictionCorrection;
    Insert: {
      id?: string;
      user_id: string;
      predicted_label: string;
      corrected_label: string;
      confidence?: number | null;
      source?: "static" | "temporal" | "hybrid" | "unknown" | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      predicted_label?: string;
      corrected_label?: string;
      confidence?: number | null;
      source?: "static" | "temporal" | "hybrid" | "unknown" | null;
      created_at?: string;
    };
    Relationships: [];
  };
  training_samples: {
    Row: TrainingSample;
    Insert: {
      id?: string;
      original_prediction: string;
      corrected_label: string;
      confidence?: number | null;
      source?: "correction" | "review_approval" | "admin_upload" | null;
      landmark_snapshot?: Record<string, unknown> | null;
      review_queue_id?: string | null;
      approved_by?: string | null;
      approved_at?: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      original_prediction?: string;
      corrected_label?: string;
      confidence?: number | null;
      source?: "correction" | "review_approval" | "admin_upload" | null;
      landmark_snapshot?: Record<string, unknown> | null;
      review_queue_id?: string | null;
      approved_by?: string | null;
      approved_at?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  dataset_versions: {
    Row: DatasetVersion;
    Insert: {
      id?: string;
      version: string;
      dataset_name?: string;
      sample_count?: number;
      class_count?: number;
      signer_count?: number;
      source_breakdown?: Record<string, unknown>;
      class_distribution?: Record<string, unknown>;
      mean_confidence?: number | null;
      median_confidence?: number | null;
      min_samples_per_class?: number;
      max_samples_per_class?: number;
      std_samples_per_class?: number | null;
      is_production?: boolean;
      parent_version?: string | null;
      change_log?: string | null;
      created_at?: string;
      checksum?: string | null;
    };
    Update: {
      id?: string;
      version?: string;
      dataset_name?: string;
      sample_count?: number;
      class_count?: number;
      signer_count?: number;
      source_breakdown?: Record<string, unknown>;
      class_distribution?: Record<string, unknown>;
      mean_confidence?: number | null;
      median_confidence?: number | null;
      min_samples_per_class?: number;
      max_samples_per_class?: number;
      std_samples_per_class?: number | null;
      is_production?: boolean;
      parent_version?: string | null;
      change_log?: string | null;
      created_at?: string;
      checksum?: string | null;
    };
    Relationships: [];
  };
  signer_profiles: {
    Row: SignerProfile;
    Insert: {
      id?: string;
      signer_id: string;
      age_range?: string | null;
      handedness?: string | null;
      signing_experience?: string | null;
      region?: string | null;
      total_sessions?: number;
      total_gestures?: number;
      unique_gestures?: number;
      avg_confidence?: number | null;
      last_active_at?: string | null;
      first_active_at?: string;
      metadata?: Record<string, unknown>;
      created_at?: string;
    };
    Update: {
      id?: string;
      signer_id?: string;
      age_range?: string | null;
      handedness?: string | null;
      signing_experience?: string | null;
      region?: string | null;
      total_sessions?: number;
      total_gestures?: number;
      unique_gestures?: number;
      avg_confidence?: number | null;
      last_active_at?: string | null;
      first_active_at?: string;
      metadata?: Record<string, unknown>;
      created_at?: string;
    };
    Relationships: [];
  };
  session_diversity_metadata: {
    Row: SessionDiversity;
    Insert: {
      id?: string;
      session_id: string;
      signer_id?: string | null;
      lighting?: string | null;
      camera_angle?: string | null;
      background?: string | null;
      hand_dominance?: string | null;
      environment?: string | null;
      device_type?: string | null;
      resolution_width?: number | null;
      resolution_height?: number | null;
      fps?: number | null;
      noise_level?: number | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      session_id?: string;
      signer_id?: string | null;
      lighting?: string | null;
      camera_angle?: string | null;
      background?: string | null;
      hand_dominance?: string | null;
      environment?: string | null;
      device_type?: string | null;
      resolution_width?: number | null;
      resolution_height?: number | null;
      fps?: number | null;
      noise_level?: number | null;
      created_at?: string;
    };
    Relationships: [{ foreignKeyName: "fk_diversity_session", columns: ["session_id"], referencedRelation: "translation_sessions", referencedColumns: ["id"] }];
  };
  daily_performance_metrics: {
    Row: DailyPerformance;
    Insert: {
      id?: string;
      day: string;
      total_predictions?: number;
      total_sessions?: number;
      avg_confidence?: number | null;
      median_confidence?: number | null;
      low_confidence_rate?: number | null;
      failure_rate?: number | null;
      correction_rate?: number | null;
      conversation_success_rate?: number | null;
      avg_inference_time_ms?: number | null;
      p95_inference_time_ms?: number | null;
      model_version?: string | null;
      signer_count?: number | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      day?: string;
      total_predictions?: number;
      total_sessions?: number;
      avg_confidence?: number | null;
      median_confidence?: number | null;
      low_confidence_rate?: number | null;
      failure_rate?: number | null;
      correction_rate?: number | null;
      conversation_success_rate?: number | null;
      avg_inference_time_ms?: number | null;
      p95_inference_time_ms?: number | null;
      model_version?: string | null;
      signer_count?: number | null;
      created_at?: string;
    };
    Relationships: [];
  };
  gesture_difficulty_tracking: {
    Row: GestureDifficultyTracking;
    Insert: {
      id?: string;
      gesture_label: string;
      total_recognitions?: number;
      avg_confidence?: number | null;
      correction_count?: number;
      confusion_count?: number;
      retry_count?: number;
      last_updated?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      gesture_label?: string;
      total_recognitions?: number;
      avg_confidence?: number | null;
      correction_count?: number;
      confusion_count?: number;
      retry_count?: number;
      last_updated?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  communication_quality_log: {
    Row: CommunicationQualityLog;
    Insert: {
      id?: string;
      conversation_id?: string | null;
      session_token?: string | null;
      response_delay_ms?: number | null;
      correction_count?: number;
      avg_recognition_confidence?: number | null;
      communication_completion?: number | null;
      conversation_duration_seconds?: number | null;
      successful_exchanges?: number;
      total_exchanges?: number;
      created_at?: string;
    };
    Update: {
      id?: string;
      conversation_id?: string | null;
      session_token?: string | null;
      response_delay_ms?: number | null;
      correction_count?: number;
      avg_recognition_confidence?: number | null;
      communication_completion?: number | null;
      conversation_duration_seconds?: number | null;
      successful_exchanges?: number;
      total_exchanges?: number;
      created_at?: string;
    };
    Relationships: [];
  };
  text_to_sign_logs: {
    Row: TextToSignLog;
    Insert: {
      id?: string;
      input_text: string;
      translated_gloss?: string | null;
      confidence_score?: number | null;
      processing_time_ms?: number | null;
      unknown_token_count?: number;
      model_version?: string | null;
      user_id?: string | null;
      session_id?: string | null;
      source?: TextToSignLog["source"];
      success?: boolean;
      error_message?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      input_text?: string;
      translated_gloss?: string | null;
      confidence_score?: number | null;
      processing_time_ms?: number | null;
      unknown_token_count?: number;
      model_version?: string | null;
      user_id?: string | null;
      session_id?: string | null;
      source?: TextToSignLog["source"];
      success?: boolean;
      error_message?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  retraining_jobs: {
    Row: RetrainingJob;
    Insert: {
      id?: string;
      status?: RetrainingJob["status"];
      trigger_reason: string;
      dataset_version_id?: string | null;
      model_version_id?: string | null;
      accuracy_before?: number | null;
      accuracy_after?: number | null;
      started_at?: string | null;
      completed_at?: string | null;
      error_message?: string | null;
      metrics_snapshot?: Record<string, unknown> | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      status?: RetrainingJob["status"];
      trigger_reason?: string;
      dataset_version_id?: string | null;
      model_version_id?: string | null;
      accuracy_before?: number | null;
      accuracy_after?: number | null;
      started_at?: string | null;
      completed_at?: string | null;
      error_message?: string | null;
      metrics_snapshot?: Record<string, unknown> | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  deployment_history: {
    Row: DeploymentHistory;
    Insert: {
      id?: string;
      model_version_id: string;
      environment: DeploymentHistory["environment"];
      status?: DeploymentHistory["status"];
      deployed_by?: string | null;
      deployed_at?: string | null;
      rollback_at?: string | null;
      rollback_reason?: string | null;
      validation_status?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      model_version_id?: string;
      environment?: DeploymentHistory["environment"];
      status?: DeploymentHistory["status"];
      deployed_by?: string | null;
      deployed_at?: string | null;
      rollback_at?: string | null;
      rollback_reason?: string | null;
      validation_status?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  animation_assets: {
    Row: {
      id: string;
      gloss: string;
      published_version_id: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      gloss: string;
      published_version_id?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      gloss?: string;
      published_version_id?: string | null;
      updated_at?: string;
    };
    Relationships: [];
  };
  // Admin-managed word→sign mappings. The gloss stays the identity: a phrase
  // here points at an asset and is never itself an asset lookup key.
  animation_asset_aliases: {
    Row: {
      id: string;
      asset_id: string;
      phrase: string;
      language: "en" | "tl";
      is_canonical: boolean;
      sort_order: number;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      asset_id: string;
      phrase: string;
      language: "en" | "tl";
      is_canonical?: boolean;
      sort_order?: number;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      phrase?: string;
      language?: "en" | "tl";
      is_canonical?: boolean;
      sort_order?: number;
      updated_at?: string;
    };
    Relationships: [
      {
        foreignKeyName: "animation_asset_aliases_asset_id_fkey";
        columns: ["asset_id"];
        referencedRelation: "animation_assets";
        referencedColumns: ["id"];
      },
    ];
  };
  animation_asset_versions: {
    Row: {
      id: string;
      asset_id: string;
      version: number;
      source_video_path: string | null;
      landmark_json_path: string | null;
      status: "pending" | "processing" | "failed" | "ready" | "approved" | "published" | "archived";
      fps: number | null;
      total_frames: number | null;
      duration_ms: number | null;
      quality_score: number | null;
      // Added by 0038_animation_asset_metadata.sql
      language: string;
      thumbnail_path: string | null;
      storage_bytes: number | null;
      extraction_metadata: Record<string, unknown>;
      created_by: string | null;
      approved_by: string | null;
      approved_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      asset_id: string;
      version: number;
      language?: string;
      thumbnail_path?: string | null;
      storage_bytes?: number | null;
      source_video_path?: string | null;
      landmark_json_path?: string | null;
      status?: "pending" | "processing" | "failed" | "ready" | "approved" | "published" | "archived";
      fps?: number | null;
      total_frames?: number | null;
      duration_ms?: number | null;
      quality_score?: number | null;
      extraction_metadata?: Record<string, unknown>;
      created_by?: string | null;
      approved_by?: string | null;
      approved_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      source_video_path?: string | null;
      landmark_json_path?: string | null;
      status?: "pending" | "processing" | "failed" | "ready" | "approved" | "published" | "archived";
      fps?: number | null;
      total_frames?: number | null;
      duration_ms?: number | null;
      quality_score?: number | null;
      language?: string;
      thumbnail_path?: string | null;
      storage_bytes?: number | null;
      extraction_metadata?: Record<string, unknown>;
      approved_by?: string | null;
      approved_at?: string | null;
      updated_at?: string;
    };
    Relationships: [];
  };
  animation_processing_jobs: {
    Row: {
      id: string;
      version_id: string;
      status: "queued" | "processing" | "completed" | "failed";
      progress: number;
      error_message: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      version_id: string;
      status?: "queued" | "processing" | "completed" | "failed";
      progress?: number;
      error_message?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      status?: "queued" | "processing" | "completed" | "failed";
      progress?: number;
      error_message?: string | null;
      updated_at?: string;
    };
    Relationships: [];
  };
  animation_asset_reviews: {
    Row: {
      id: string;
      version_id: string;
      reviewer_id: string;
      decision: "approved" | "rejected";
      notes: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      version_id: string;
      reviewer_id: string;
      decision: "approved" | "rejected";
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      decision?: "approved" | "rejected";
      notes?: string | null;
    };
    Relationships: [];
  };
};

type Views = {
  gestures_with_replies: {
    Row: GestureWithReplies;
    Relationships: [];
  };
};

export type ConversationSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  status: "active" | "ended";
  participant_name: string | null;
  total_messages: number;
  communication_success: boolean | null;
  created_at: string;
};

export type ConversationMessage = {
  id: string;
  session_id: string;
  sender_type: "signer" | "responder";
  gesture_label: string | null;
  translated_text: string;
  confidence: number | null;
  reply_to_message_id: string | null;
  is_selected_reply: boolean;
  created_at: string;
};

export type GestureReplyRelationship = {
  id: string;
  gesture_label: string;
  suggested_reply: string;
  priority: number;
  context_tags: string[] | null;
  is_active: boolean;
  response_video_url: string | null;
  selection_count: number;
  acceptance_rate: number | null;
  last_selected_at: string | null;
  created_at: string;
};

export type GestureDifficultyTracking = {
  id: string;
  gesture_label: string;
  total_recognitions: number;
  avg_confidence: number | null;
  correction_count: number;
  confusion_count: number;
  retry_count: number;
  difficulty_score: number;
  last_updated: string | null;
  created_at: string;
};

export type CommunicationQualityLog = {
  id: string;
  conversation_id: string | null;
  session_token: string | null;
  response_delay_ms: number | null;
  correction_count: number;
  avg_recognition_confidence: number | null;
  communication_completion: number | null;
  conversation_duration_seconds: number | null;
  successful_exchanges: number;
  total_exchanges: number;
  created_at: string;
};

type Functions = {
  get_admin_analytics: {
    Args: { p_days_back?: number };
    Returns: AdminAnalytics;
  };
  get_model_metrics_daily: {
    Args: { p_days_back?: number };
    Returns: ModelMetricsDailyRow[];
  };
  upsert_model_metrics_daily: {
    Args: {
      p_day: string;
      p_total: number;
      p_low_conf: number;
      p_unknown: number;
      p_avg_conf: number | null;
      p_avg_inference_ms: number | null;
    };
    Returns: undefined;
  };
  promote_user: {
    Args: { user_email: string };
    Returns: undefined;
  };
  demote_user: {
    Args: { user_email: string };
    Returns: undefined;
  };
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: Tables;
    Views: Views;
    Functions: Functions;
    Enums: { user_role: UserRole };
    CompositeTypes: Record<string, never>;
  };
};
