-- 000004_normalize_daily_reviews_content.sql: Normalize legacy wrapped daily reviews content to canonical Tiptap jsonb
-- +goose Up

-- 1. Unwrap serialized Tiptap doc string stored in legacy { "text": "{\"type\":\"doc\",...}" } format
UPDATE daily_reviews
SET content = (content->>'text')::jsonb,
    updated_at = now()
WHERE content ? 'text'
  AND jsonb_typeof(content->'text') = 'string'
  AND (content->>'text') LIKE '{"type":"doc"%';

-- 2. Unwrap if content->'text' is already a jsonb object with type = 'doc'
UPDATE daily_reviews
SET content = content->'text',
    updated_at = now()
WHERE content ? 'text'
  AND jsonb_typeof(content->'text') = 'object'
  AND content->'text'->>'type' = 'doc';

-- +goose Down
-- Canonical format is preferred and backwards-compatible, no down conversion needed
