-- 000003_cleanup_empty_daily_reviews.sql: Cleanup empty daily reviews and ensure physical deletion
-- +goose Up

DELETE FROM daily_reviews
WHERE content IS NULL
   OR content = '{}'::jsonb
   OR content = 'null'::jsonb
   OR content = '{"text":""}'::jsonb
   OR content = '{"text":" "}'::jsonb
   OR content = '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
   OR (content->>'text' IS NOT NULL AND trim(content->>'text') = '');

-- +goose Down
-- Physical cleanup cannot be undone
