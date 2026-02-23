# Prepare Release

Run all pre-release checks and prepare a version bump for the automated release pipeline.

## Step 1: Determine Version

Ask the user what version to release. Show the current version from `package.json` and ask:

- **What type of version bump?** Options: patch, minor, major, prerelease (e.g. `1.0.0-rc.1`), or custom version string.
- If prerelease, ask for the prerelease identifier (e.g. `rc.1`, `beta.1`).
- Show what the new version will be before proceeding. Confirm with the user.

## Step 2: Check Working Tree

Run `git status` to verify the working tree is clean (no uncommitted changes). If there are uncommitted changes, warn the user and ask whether to proceed or abort.

## Step 3: Bump Version

Update the version in `package.json` using the appropriate method:
- For patch/minor/major: run `npm version <type> --no-git-tag-version`
- For prerelease or custom: edit `package.json` directly with the exact version string

## Step 4: Run Quality Checks

Run these checks sequentially. Stop and report on the first failure:

1. **Lint**: `npm run lint`
2. **Format**: `npm run format:check` — if this fails, run `npm run format` to auto-fix, then re-check
3. **Type Check**: `npm run typecheck`
4. **Tests**: `npm run test`
5. **Build**: `npm run build`
6. **Security Audit**: `npm audit --audit-level moderate --omit=dev`

If any check fails (except format, which auto-fixes), stop and help the user fix the issue before continuing.

## Step 5: Commit and Push

After all checks pass:

1. Stage `package.json` (and any files changed by formatting)
2. Create a commit with message: `chore: bump version to <new-version>`
3. Push to the current branch

## Step 6: Summary

Print a summary:
- Previous version → New version
- All checks passed
- Branch and commit hash
- Remind the user: "Merge this branch to `main` to trigger the automated release pipeline."
