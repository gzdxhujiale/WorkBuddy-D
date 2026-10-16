-- name: ListAIChannels :many
SELECT * FROM ai_channels
WHERE user_id = $1
ORDER BY priority DESC, created_at ASC;

-- name: GetActiveAIChannels :many
SELECT * FROM ai_channels
WHERE user_id = $1 AND is_active = true
ORDER BY priority DESC, created_at ASC;

-- name: GetAIChannelByID :one
SELECT * FROM ai_channels
WHERE id = $1 AND user_id = $2;

-- name: CreateAIChannel :one
INSERT INTO ai_channels (
    user_id, name, provider, base_url, api_key, models, is_active, priority
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: UpdateAIChannel :one
UPDATE ai_channels
SET name = $3,
    provider = $4,
    base_url = $5,
    api_key = $6,
    models = $7,
    is_active = $8,
    priority = $9,
    updated_at = now()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteAIChannel :exec
DELETE FROM ai_channels
WHERE id = $1 AND user_id = $2;

-- name: ListAISkills :many
SELECT * FROM ai_skills
WHERE user_id = $1
ORDER BY code ASC;

-- name: GetAISkillByCode :one
SELECT * FROM ai_skills
WHERE user_id = $1 AND code = $2;

-- name: UpsertAISkill :one
INSERT INTO ai_skills (
    user_id, code, name, system_prompt, temperature, bound_tools, is_enabled
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) ON CONFLICT (user_id, code) DO UPDATE
SET name = EXCLUDED.name,
    system_prompt = EXCLUDED.system_prompt,
    temperature = EXCLUDED.temperature,
    bound_tools = EXCLUDED.bound_tools,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now()
RETURNING *;

-- name: CreateAIInvocationLog :one
INSERT INTO ai_invocation_logs (
    user_id, skill_code, model_name, provider,
    prompt_tokens, completion_tokens, total_latency_ms, ttft_ms,
    status_code, error_msg
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING *;

-- name: ListAIInvocationLogs :many
SELECT * FROM ai_invocation_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetAIUsageMetrics :one
SELECT
    COUNT(*) AS total_calls,
    COALESCE(SUM(prompt_tokens), 0)::BIGINT AS total_prompt_tokens,
    COALESCE(SUM(completion_tokens), 0)::BIGINT AS total_completion_tokens,
    COALESCE(AVG(total_latency_ms), 0)::BIGINT AS avg_latency_ms,
    COALESCE(AVG(ttft_ms), 0)::BIGINT AS avg_ttft_ms
FROM ai_invocation_logs
WHERE user_id = $1 AND created_at >= $2;

-- name: ListAISessions :many
SELECT * FROM ai_sessions
WHERE user_id = $1
ORDER BY is_pinned DESC, updated_at DESC;

-- name: GetAISessionByID :one
SELECT * FROM ai_sessions
WHERE id = $1 AND user_id = $2;

-- name: CreateAISession :one
INSERT INTO ai_sessions (
    user_id, title, skill_code, model_name, is_pinned
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: UpdateAISession :one
UPDATE ai_sessions
SET title = $3,
    skill_code = $4,
    model_name = $5,
    is_pinned = $6,
    updated_at = now()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteAISession :exec
DELETE FROM ai_sessions
WHERE id = $1 AND user_id = $2;

-- name: TouchAISession :exec
UPDATE ai_sessions
SET updated_at = now()
WHERE id = $1 AND user_id = $2;

-- name: ListAIMessagesBySession :many
SELECT * FROM ai_messages
WHERE session_id = $1
ORDER BY created_at ASC;

-- name: CreateAIMessage :one
INSERT INTO ai_messages (
    session_id, role, content, reasoning_content, tool_calls, thinking_duration_ms
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: DeleteAIMessagesBySession :exec
DELETE FROM ai_messages
WHERE session_id = $1;
