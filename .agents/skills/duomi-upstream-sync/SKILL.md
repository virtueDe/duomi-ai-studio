---
name: duomi-upstream-sync
description: Use when synchronizing Duomi AI Studio with the upstream CanvasMind project while preserving Duomi-specific integrations and deployment behavior.
---

# Duomi AI Studio Upstream Sync

This repository is a customized fork of `xpnobug/CanvasMind`, published as `virtueDe/duomi-ai-studio`. Upstream synchronization is a deliberate maintenance operation, separate from feature release.

## Source and branch rules

- `upstream` points to `git@github.com:xpnobug/CanvasMind.git`.
- Treat an official upstream release tag as immutable. Do not use a moving upstream branch as a release source without an explicit decision.
- Start from a clean, reviewed checkout based on `master` and create `sync/vX.Y.Z` (or another focused sync branch) before merging upstream.
- Inspect remotes, tags, current version, and local changes before fetching. Never discard or overwrite uncommitted Duomi work.

## Sync procedure

1. Fetch upstream refs and verify the requested official tag or commit.
2. Inventory Duomi-only behavior before merging: Sub login and API-key integration, `/duomi-studio/` deployment assumptions, Duomi routes and stores, Prisma migrations, server generation/history code, `.github/workflows`, and `deploy/` files.
3. Merge the selected upstream tag with an explicit merge commit. Resolve conflicts semantically and preserve Duomi behavior; do not blindly accept either side.
4. Treat conflicts in migrations, shared types, authentication, generation endpoints, storage, or release workflows as a hard stop for review. Never silently rewrite migration history.
5. Regenerate derived files only when required by the repository, then run the release checks from `duomi-feature-release`.
6. Keep synchronization, feature integration, and release tagging as separate commits or separately reviewable operations.

## Safety boundary

Do not auto-merge, create release tags, force-push, or publish images as part of an upstream sync. Report the exact conflict, affected files, and validation result when a decision is needed.
