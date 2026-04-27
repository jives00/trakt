# /commit — Test, commit, and push to main

Runs the test suite, commits if everything passes, and pushes to main (which triggers the EC2 auto-deploy via GitHub Actions).

## Flags

| Flag | What it does |
|---|---|
| `--e2e` | Also run Playwright end-to-end tests before committing (slower; use for significant UI changes) |
| `--apk-local` | After a successful commit and push, build an Android APK on this machine via `eas build --platform android --local` |
| `--apk-cloud` | After a successful commit and push, trigger an EAS cloud APK build via `eas build --platform android` (uses an EAS build slot) |

Flags can be combined: `/commit --e2e --apk-local`

---

## Steps

### 1. Show what will be committed
Run `git diff --stat` and `git status` so the user can see exactly what's changing before anything is committed.

### 2. Run the test suite
Always run:
```bash
pnpm --filter api test
pnpm --filter web test
pnpm --filter stremio-addon test
pytest apps/kodi-addon/tests/
```

If `--e2e` was passed, also run:
```bash
pnpm --filter web test:e2e
```

### 3a. If ALL tests pass
- Generate a commit message from the diff (one concise sentence describing what changed and why)
- Stage changed files, commit, and push to `main`
- Report: "Pushed to main. GitHub Actions will run CI and deploy to EC2 automatically."
- If `--apk-local` was passed, run: `eas build --platform android --local` and report the output path when complete
- If `--apk-cloud` was passed, run: `eas build --platform android` and report the build URL

### 3b. If ANY tests fail
- Show which tests failed and the relevant error output (not the full log — just what's needed to understand the failure)
- Diagnose the root cause and fix the failing code
- Re-run only the previously failing tests to confirm they pass
- Report that tests are passing and proceed to commit without asking for confirmation
- Return to step 3a

---

## Rules
- Never commit or push if any test is failing
- Never skip tests (`--no-verify` is not allowed)
- Always show `git diff --stat` before committing so the user knows what's going out
- Never amend a commit that has already been pushed
- APK builds always happen after push, never before — the build uses the committed code
- If the same test keeps failing after two fix attempts, stop and explain the situation to the user rather than continuing to loop
