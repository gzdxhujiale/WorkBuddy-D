# Security

## Purpose

This is the security contract for WorkBuddy-D’s desktop client, Supabase data boundary, Realtime, and Tauri capabilities. It records repository evidence and does not replace a live Supabase-dashboard audit.

## Security model and trust boundaries

| Boundary | Trust model | Required control |
| --- | --- | --- |
| User input in a Tauri webview -> frontend state | Browser/webview input is untrusted. | Preserve local validation and send only supported fields. |
| Frontend -> Supabase Auth/PostgREST/RPC | The client uses a public URL and publishable key; it is not privileged. | Authenticated sessions, RLS, constrained RPCs, and database constraints. |
| Database trigger -> Realtime | Trigger code can publish committed-change hints. | Private per-user topic and `realtime.messages` receive policy. |
| Frontend -> Tauri APIs | A webview obtains the APIs granted by its capability. | Minimal, reviewed capability/window permissions. |

## Authentication and authorization

The main app retrieves and observes the Supabase session in `src/App.tsx`; secondary authenticated windows use `src/windowSessionGate.tsx`. Login and password signup use Supabase Auth in `src/components/LoginPage.tsx`.

Authentication does not authorize access to another user’s data. User-owned tables are scoped by `user_id` under RLS, and application RPCs are granted to `authenticated`, not `anon` or `public`. RPCs that mutate owned records check the authenticated owner. Read the current table/policy/RPC state in [docs/generated/db-schema.md](generated/db-schema.md) and the authoritative SQL in `supabase/migrations/`.

## Data and mutation invariants

| Invariant | Why | Evidence |
| --- | --- | --- |
| Never expose a service-role or other secret key in frontend code or `VITE_*` variables. | All `VITE_*` values are bundled into the client. | `src/lib/supabase.ts` uses only a publishable key. |
| Every new user-owned exposed table needs RLS and ownership-aware policies. | `TO authenticated` alone does not prevent cross-user access. | Existing migration policies; generated schema snapshot. |
| Update authorization must preserve ownership. | A write must not reassign a row to a different user. | RLS `USING`/`WITH CHECK` patterns in migrations. |
| Privileged database behavior must have reviewed grants and a safe search path. | Functions and triggers can bypass normal client expectations. | Latest hardening migrations. |
| Clients do not set authoritative audit or transition facts. | Client clocks and stale cache are not authoritative. | RPCs/triggers; [Architecture](/architecture). |

## Realtime

The supported Supabase topic is `user:<user_id>:sync`, configured as private. The receive policy matches `auth.uid()` to the topic, and triggers emit only table/operation/id/folder context after committed changes. Do not re-enable public-channel access or include note bodies/full row replicas in these payloads.

The repository cannot prove the current Supabase-dashboard setting for “Allow public access to channels.” Its enforcement and two-window verification remain an open item in [the technical-debt tracker](exec-plans/tech-debt-tracker.md).

## Input validation and sensitive data

Client-side forms improve usability but are not a security boundary. No repository-wide client validation library or schema-validation convention is configured; database constraints, RLS, and constrained RPCs remain the verified enforcement points. New RPCs must validate their own supported state transitions and ownership rather than trusting browser fields.

The repository contains environment configuration for the Supabase URL and publishable key. Do not copy credentials into source, logs, docs, or error messages. No application-owned server secret store, webhook endpoint, file upload path, or third-party API integration is configured here.

## Tauri client security

`src-tauri/capabilities/default.json` grants a broad set of core window, webview, and event permissions to windows matching `*`, alongside opener and notification permissions. `src-tauri/tauri.conf.json` currently sets `app.security.csp` to `null`. Treat changes to either file, new plugins, new windows, and new `invoke` commands as security-sensitive. Scope permissions to the smallest necessary window/API and review the relevant Tauri skill before editing.

## Security-sensitive change checklist

For Auth, RLS, RPC, migration, Realtime, environment, capability, plugin, or native-command work:

1. Read this document, the relevant migration, and `.agents/skills/supabase/SKILL.md` or `.agents/skills/tauri/SKILL.md`.
2. Verify ownership enforcement, function grants, trigger execution, private-topic authorization, and returned database versions.
3. Confirm no privileged credential or sensitive payload reaches frontend source or logs.
4. Review the exact capability/window scope and CSP effect for native changes.
5. Run the applicable build; validate changed database behavior with the relevant Supabase workflow.

## Known gaps

- A restrictive Tauri CSP is not configured.
- Private Broadcast dashboard enforcement is not verified in repository configuration.
- There is no automated RLS/RPC/capability security test suite or CI workflow.
- Centralized validation and log redaction conventions are not present; do not assume they exist.

These are quality gaps, not evidence that a protection is currently absent beyond the stated configuration. Track remediation in [QUALITY_SCORE.md](QUALITY_SCORE.md) or an execution plan.
