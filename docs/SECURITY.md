# Security

- RLS scopes business rows to the authenticated `user_id`.
- Application RPCs are restricted to `authenticated`; never expose a service-role credential to the frontend.
- Private Broadcast uses topic `user:<auth.uid()>:sync` and a `realtime.messages` receive policy. Keep Realtime public-channel access disabled.
- Trigger function execution is revoked from client roles; triggers send Broadcasts after committed writes.
- `created_at` and `updated_at` are database-owned audit fields. Optimistic write RPCs accept only an expected `updated_at` and return the new database version.
- Soft-delete, task-completion, and focus-session boundary timestamps are database-owned state-transition facts; clients invoke constrained RPCs rather than setting those fields directly.
- Before modifying database or native permissions, review RLS, function grants, Realtime topics, and Tauri capabilities.
