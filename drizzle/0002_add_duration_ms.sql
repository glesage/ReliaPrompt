-- Add duration_ms column to track LLM call duration
ALTER TABLE test_results ADD COLUMN duration_ms INTEGER;

