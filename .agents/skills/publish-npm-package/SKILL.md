---
name: publish-npm-package
description: Publish error2fix npm packages through the repository's Changesets and GitHub Actions OIDC release workflow.
---

# Publish npm Package

Use this skill when the user asks to publish, release, bump, version, or ship the `error2fix` npm packages.

## Guardrails

- Prefer the GitHub Actions OIDC publish workflow. Do not run `npm publish`, `pnpm publish`, or `changeset publish` locally unless the user explicitly requests a local publish.
- Do not run `npm whoami`; local npm identity is irrelevant because publishing must use GitHub OIDC.
- Do not run `npm view` as a publish-success check; npm email notification is the expected confirmation path.
- Do not publish from a dirty worktree.
- Do not amend existing commits unless explicitly requested.
- Keep `@error2fix/core` private unless the user explicitly changes the package strategy.
- Report the exact package versions being released before creating or triggering a release.

## Current Release Model

- Public packages: `@error2fix/cli`, `@error2fix/mcp`.
- Private package: `@error2fix/core`.
- Versioning: Changesets.
- Publish command used by CI: `pnpm release`.
- Publish trigger: pushing a `v*` git tag triggers `.github/workflows/npm-publish.yml`.
- npm auth: trusted publishing / OIDC, not a local `NPM_TOKEN`.

## Release Workflow

Follow this order. Do not repeat `pnpm verify` or `pnpm build` later unless a command changes files after validation.

### 1. Start from a clean master branch

Check the worktree before switching branches:

```bash
git status --short
git branch --show-current
```

If `git status --short` is not empty, stop the release workflow and ask the user to manually clear the local worktree. Do not stash, commit, reset, or discard changes for the user.

If the current branch is not `master`, switch to `master` only after confirming the worktree is clean:

```bash
git switch master
git status --short
```

Stop if the worktree is not clean after switching to `master`.

Then inspect the recent release base:

```bash
git log --oneline --decorate --max-count=5
```

### 2. Validate before versioning

Run once before changing versions:

   ```bash
   pnpm verify
   pnpm build
   ```

If either command fails, fix the failure before continuing. Do not create version commits or tags before this step passes.

### 3. Bump versions and generate changelog

Create or confirm the changeset for the requested version, then run:

```bash
pnpm version:packages
```

For a requested exact version, confirm the generated public package versions match it:

```bash
node -p "require('./packages/cli/package.json').version"
node -p "require('./packages/mcp/package.json').version"
```

If Changesets updates formatting, run:

```bash
pnpm format
```

### 4. Record changelog, commit, tag, and push

Read and summarize the generated changelog entries:

```bash
git diff -- packages/cli/CHANGELOG.md packages/mcp/CHANGELOG.md
```

Commit the version update:

```bash
git add package.json pnpm-lock.yaml packages/cli/package.json packages/mcp/package.json packages/cli/CHANGELOG.md packages/mcp/CHANGELOG.md .changeset
git commit -m "chore: release packages <version>"
```

Create and push the release tag:

```bash
git tag -a v<version> -m "v<version>"
git push origin HEAD
git push origin v<version>
```

Pushing the tag starts the GitHub Actions OIDC publish workflow. Report the pushed commit, tag, package versions, changelog summary, and that publishing is now owned by GitHub Actions.

## Publish Trigger

Publishing starts automatically after the `v*` tag is pushed. Manually creating a GitHub Release is still allowed, but it is optional and should not be treated as a required release step. Do not run local npm verification commands afterward.

## If GitHub Actions Publishing Fails

- Check the GitHub Actions logs first.
- For `E404 Not Found` on scoped packages, verify the package exists or that npm org/package permissions allow first publish with public access.
- For OIDC/trusted publishing failures, verify npm trusted publishing is configured for the package and repository workflow.
- Do not retry by local publish unless the user explicitly approves that fallback.
