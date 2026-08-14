# Design documents

This directory contains accepted, durable decisions that explain *why* the system has a boundary or invariant. It does not replace the repository map in [Architecture](/architecture), feature behavior in [product specifications](/product-specs/), or implementation workflows in `.agents/skills/`.

| Document | Status | Use it when working on |
| --- | --- | --- |
| [Core beliefs](core-beliefs.md) | Accepted | Any cross-cutting change that affects data authority, loading, user isolation, or recovery. |
| [同步、版本与编辑器一致性](sync-and-editor-consistency.md) | Accepted; implementation divergence recorded | Supabase Realtime, versioned writes, offline recovery, Tiptap, or cross-window synchronization. |
| [全局背景配色与视觉层级规范](color-scheme.md) | Accepted | Cross-screen background colors, 5-level elevation, and Tailwind surface tokens. |
| [Architecture](/architecture) | Canonical system map | Locating the owning layer, runtime boundary, or external dependency. |

## Decision lifecycle

Add a design decision when a choice is cross-cutting, difficult to reverse, or repeatedly needed to evaluate changes. Each decision should state its status, scope, constraints, evidence paths, and verification. Move temporary investigation detail to an execution plan; move feature-specific behavior to `docs/product-specs/`.

When current code diverges from an accepted decision, document the divergence in the decision and track the reconciliation rather than silently treating one source as authoritative.
