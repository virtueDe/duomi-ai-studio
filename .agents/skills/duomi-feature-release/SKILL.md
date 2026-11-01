---
name: duomi-feature-release
description: Use when developing, validating, versioning, tagging, or deploying Duomi AI Studio changes in the duomi-ai-studio repository.
---

# Duomi AI Studio Feature Release

Use this skill for work in `virtueDe/duomi-ai-studio`. Keep the existing working tree changes intact and make each change reviewable.

## Modes

Choose one mode from the user's request:

- **Start development**: inspect the repository state and create a focused branch when needed.
- **Finish development**: validate the requested change, review the diff, and prepare a scoped commit and branch push.
- **Release**: synchronize the package version, create an exact version tag, and use the repository's independent container release flow.

## Start development

1. Inspect `git status`, remotes, the current branch, and the package version before editing.
2. Preserve unrelated local work. Do not reset, clean, or stage the whole tree when the checkout already contains Duomi work.
3. Use a focused branch such as `feature/<topic>`, `fix/<topic>`, or `chore/<topic>`. The normal integration branch is `master` unless the repository explicitly says otherwise.
4. Read the relevant source and deployment files before changing shared contracts, migrations, workflows, or environment configuration.

## Finish development

Run checks that match the change. For a release-affecting change, run at least:

```text
pnpm run type-check
pnpm run build:client
pnpm run build:service
```

Also validate workflow YAML, `deploy/docker-compose.duomi.yml`, `deploy/remote-deploy.sh`, and `git diff --check` when those files are involved. Review `git status` and `git diff`; stage only the requested files, create a scoped commit, and push the feature branch only when the user asked for that operation. Merging into `master` requires explicit authorization.

## Release

- The canonical application version is `package.json`; keep `pnpm-lock.yaml` synchronized when its importer metadata changes.
- The release tag must be exactly `v<package.json version>`. Do not release a tag that differs from the package version.
- `.github/workflows/docker-image.yml` builds and publishes `ghcr.io/virtuede/duomi-ai-studio` for `v*` tags and then deploys with `deploy/docker-compose.duomi.yml` and `deploy/remote-deploy.sh`.
- `.github/workflows/deploy.yml` is the manual image deployment and rollback path. It must use an existing immutable image tag.
- Before tagging, verify the intended commit, package version, workflow validation, and deployment configuration. Never overwrite or force-move a release tag.
- Creating or pushing a release tag is an external release action. Do it only after the user explicitly authorizes that exact release.

## Stop conditions

Stop and report the blocker when the worktree contains ambiguous local edits, the version/tag do not match, a migration or workflow conflict needs a product decision, required release secrets are unavailable, or a validation command fails without a safe fix. Do not hide failures with fallback behavior.
