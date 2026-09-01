-- Phase 46: Drop Unused Tables - Database Schema Finalization
-- Removes 15 tables that were never integrated into production code
-- Retains: text_to_sign_logs, gesture_confusion_pairs, and 5 tables with active scripts

-- Drop unused tables in dependency order (leaf tables first)
DROP TABLE IF EXISTS public.gesture_confidence_daily CASCADE;
DROP TABLE IF EXISTS public.confusion_pairs CASCADE;
DROP TABLE IF EXISTS public.dataset_quality CASCADE;
DROP TABLE IF EXISTS public.gesture_metadata CASCADE;
DROP TABLE IF EXISTS public.feedback_summaries CASCADE;
DROP TABLE IF EXISTS public.communication_profiles CASCADE;
DROP TABLE IF EXISTS public.communication_quality_log CASCADE;
DROP TABLE IF EXISTS public.reply_selection_log CASCADE;
DROP TABLE IF EXISTS public.prediction_explanations CASCADE;
DROP TABLE IF EXISTS public.conversation_intelligence CASCADE;
DROP TABLE IF EXISTS public.gesture_retry_log CASCADE;
DROP TABLE IF EXISTS public.learning_recommendations CASCADE;
DROP TABLE IF EXISTS public.drift_snapshots CASCADE;
DROP TABLE IF EXISTS public.dataset_snapshots CASCADE;
DROP TABLE IF EXISTS public.language_profiles CASCADE;
