---
name: publish-npm-package
description: Publish error2fix npm packages through the repository's Changesets and GitHub Actions OIDC release workflow.
---

# Publish npm Package

Use this skill when the user asks to publish, release, bump, version, or ship the `error2fix` npm packages.

## Guardrails

- Prefer the GitHub Actions OIDC publish workflow. Do not run `npm publish`, `pnpm publish`, or `changeset publish` locally unless the user explicitly requests a local publish.
- Do not publish from a dirty worktree.
- Do not amend existing commits unless explicitly requested.
- Keep `@error2fix/core` private unless the user explicitly changes the package strategy.
- Report the exact package versions being released before creating or triggering a release.

## Current Release Model

- Public packages: `@error2fix/cli`, `@error2fix/mcp`.
- Private package: `@error2fix/core`.
- Versioning: Changesets.
- Publish command used by CI: `pnpm release`.
- Publish trigger: GitHub release `published` event in `.github/workflows/npm-publish.yml`.
- npm auth: trusted publishing / OIDC, not a local `NPM_TOKEN`.

## Preflight

1. Check repository state:

   ```bash
   git status --short
   git branch --show-current
   git log --oneline --decorate --max-count=5
   ```

2. Inspect release configuration:

   ```bash
   cat package.json
   cat packages/cli/package.json
   cat packages/mcp/package.json
   cat .github/workflows/npm-publish.yml
   ```

3. Run verification before versioning or release:

   ```bash
   pnpm verify
   pnpm build
   ```

## Versioning Workflow

Use this when unreleased changes need a package version bump.

1. Check pending changesets:

   ```bash
   find .changeset -maxdepth 1 -type f -name "*.md" -print
   ```

2. If no changeset exists, ask the user for the release type and changelog intent before creating one.

3. Apply version changes:

   ```bash
   pnpm version:packages
   ```

4. Review changed files:

   ```bash
   git diff -- package.json pnpm-lock.yaml packages/cli/package.json packages/mcp/package.json .changeset
   ```

5. Commit the version update:

   ```bash
   git add package.json pnpm-lock.yaml packages/cli/package.json packages/mcp/package.json .changeset
   git commit -m "chore: version packages"
   ```

6. Push a branch and open a PR to `master`. Do not publish until the version PR is merged.

## Publishing Workflow

Use this after the version bump is merged to `master`.

1. Ensure local `master` is clean and up to date:

   ```bash
   git switch master
   git pull --ff-only
   git status --short
   ```

2. Confirm package versions:

   ```bash
   node -p "require('./packages/cli/package.json').version"
   node -p "require('./packages/mcp/package.json').version"
   ```

3. Create a GitHub release for the version being published. Prefer a tag that clearly matches the release, for example `v0.3.1`.

4. After publishing the GitHub release, inspect the `Publish npm packages` workflow run and report whether it succeeded.

5. Verify npm after CI completes:

   ```bash
   npm view @error2fix/cli version
   npm view @error2fix/mcp version
   ```

## If Publishing Fails

- Check the GitHub Actions logs first.
- For `E404 Not Found` on scoped packages, verify the package exists or that npm org/package permissions allow first publish with public access.
- For OIDC/trusted publishing failures, verify npm trusted publishing is configured for the package and repository workflow.
- Do not retry by local publish unless the user explicitly approves that fallback.
