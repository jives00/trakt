# Android APK Build Reference

## Preferred Method: GitHub Actions (Gradle on Linux)

Push an `apk-*` tag to trigger a Gradle build on `ubuntu-latest`. No EAS tokens, no Windows path issues:

```bash
git tag apk-<description>
git push origin apk-<description>
```

The APK appears as a downloadable artifact in the GitHub Actions run (`app-release` under the Artifacts section). Builds take ~20–30 minutes. Uses the free GitHub Actions Linux runner (2,000 min/month on private repos; unlimited on public).

**Why not EAS?** EAS tokens are limited per month and burn even on failed builds.

**Why not local Windows Gradle?** CMake mangles out-of-source generated paths to `C_/Users/...` which routinely exceed 260 chars. `ninja.exe` in the Android SDK is not long-path-aware. See [Local Gradle Builds](#local-gradle-builds-emergency-fallback) for the full workaround if truly needed.

---

## Pre-Build Checklist

### 1. `android/` excluded from git and EAS

`apps/mobile/.gitignore` has `/android` and `apps/mobile/.easignore` has `android/`. Both exclude the entire generated directory — never add partial exclusions.

### 2. Verify TypeScript compiles

```bash
npx tsc --project apps/mobile/tsconfig.json --noEmit
```

Metro doesn't type-check, so TS errors that would crash at runtime only surface here.

### 3. Check for dependency version mismatches

```bash
cd apps/mobile
npx expo install --check
```

Fix any reported mismatches with `npx expo install` (not `npm install --legacy-peer-deps` — that corrupts the workspace).

### 4. Check for new native packages

If a package was added since the last APK build, verify its Expo plugin is declared in `app.json` `plugins` array and any required Android permissions are present.

---

## Common Failures

### expo-av crash at startup (RN 0.83+)

**Symptom:** App crashes before JS loads with `UnsatisfiedLinkError` referencing `libexpo-av.so`.

**Cause:** `expo-av` ≤ 15.1.7 references a symbol removed from RN 0.83's new architecture.

**Fix:** Remove `expo-av` from `package.json` entirely.

---

## Local Gradle Builds (Emergency Fallback)

Only attempt if GitHub Actions is unavailable.

### Prerequisites (one-time)

- Android Studio installed (provides JDK at `C:\Program Files\Android\Android Studio\jbr`)
- Android SDK installed (`C:\Users\jbrom\AppData\Local\Android\Sdk`)
- NDK 27.1.12297006 and CMake 3.30.3 via SDK Manager
- Windows long paths enabled (elevated PowerShell, one time):
  ```powershell
  Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1
  git config --global core.longpaths true
  ```
- `C:\t` junction pointing to the project root (elevated PowerShell, one time):
  ```powershell
  New-Item -ItemType Junction -Path "C:\t" -Target "C:\Users\jbrom\SynologyDrive\Development\Trakt"
  ```

> **Do NOT use `subst E:`** — it breaks Node.js codegen (`Path.relativize()` fails across drive roots).

### Path length fix: node-linker=hoisted

pnpm's default virtual store places packages at paths with long hash suffixes that push CMake over its 250-char object path limit. The `.npmrc` at the project root contains `node-linker=hoisted`, which keeps paths short.

**Important:** If `node_modules` is ever deleted and reinstalled without `.npmrc` in place, hash paths return and the build fails. Verify `.npmrc` contains `node-linker=hoisted` before building.

### Generate the android directory

Build from the `C:\t` junction, not the long Synology path. Run from `C:\t\apps\mobile`:

```powershell
Set-Location "C:\t\apps\mobile"
node "C:\t\node_modules\expo\bin\cli" prebuild --platform android
```

> `npx expo` fails with `node-linker=hoisted` because Expo is hoisted to the workspace root, not `apps/mobile/node_modules`. Use `node ... expo\bin\cli` directly.

Regenerate `android/` after: fresh `pnpm install`, changes to `app.json`, or adding/removing native modules.

### Build

Pause Synology Drive before building (file sync interferes with Gradle file locking).

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\jbrom\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
$env:CMAKE_VERSION = "3.30.3"
Set-Location "C:\t\apps\mobile\android"
.\gradlew.bat app:assembleRelease -x lint -x test --% -PreactNativeArchitectures=arm64-v8a
```

APK output: `apps\mobile\android\app\build\outputs\apk\release\app-release.apk`

### Troubleshooting local builds

**CMake path too long:** `.npmrc` is missing or `pnpm install` ran before it was in place. Ensure `node-linker=hoisted`, delete `node_modules`, reinstall, regenerate `android/`.

**"No matching variant" for react-native-\*:** `android/` is stale. Delete it and run prebuild again.

**CMake stale cache:**
```powershell
Remove-Item "C:\t\node_modules\react-native-reanimated\android\.cxx" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\t\apps\mobile\android\app\.cxx" -Recurse -Force -ErrorAction SilentlyContinue
```

**`REACT_NATIVE_WORKLETS_NODE_MODULES_DIR` in gradle.properties:** This hardcoded path was added to fix a node resolver issue. If it breaks after a version bump, update the path to match the new location (`C:/t/node_modules/react-native-worklets` with `node-linker=hoisted`).
