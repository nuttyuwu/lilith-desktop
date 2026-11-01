# Release preparation

Target repository: `nuttyuwu/lilith-desktop`.

Target candidate: `1.0.1-rc.4`. Private GitHub prerelease with movement corrections, game-style UI textures loaded from the player's assets, and explicit voice diagnostics. Existing status rows below describe earlier candidates unless noted. Public distribution decisions remain unresolved.

## rc.4 observations

- User reports rc.3 installed successfully on another Windows desktop, with silent audio and six extraction audio-format warnings. This is user-reported installation evidence, not an independently observed clean-machine or audible-output check.
- Inspected the actual rig: `stand_casual_peek_end` lasts four seconds and moves the character sideways out of view; the old app waited before teleporting its window. The new path slides the window over 480 ms with a visible pose.
- Manual Windows preview: tuck and return remained visible, the original star bubble appeared, walking left moved across the desktop, and the voice test displayed its diagnostic message. Runtime observation showed an audio source started and the AudioContext running; physical speaker output was not heard/verified.
- Scaled Windows initial bounds needed correction before walking. Movement now uses getBounds/setBounds consistently, normalises the initial window, and only stops at the boundary in the direction of travel. Walking root translation is also suppressed while outgoing walk animations blend into other poses.
- Packaged unpacked rc.4 application launched with the existing medium/high-quality profile; manual tuck/return remained visible and returned fully on-screen, and the new toolbar Voice button displayed its diagnostic bubble. This is a packaged-runtime check, not a repeat of fresh installation.
- Manual current-user installer upgrade completed from the previous installed version to rc.4, followed by launch and visible character rendering. Installed version metadata and all five changed runtime files matched source. This is an in-place upgrade using existing assets/preferences, not a fresh-machine install.
- No automated test suite was run. Multi-monitor/DPI combinations, all outfits and sizes, physical audio output, and the six unsupported audio clips remain outside this focused check.

## Current status

| Area | Status |
|---|---|
| BUG-001 screen-edge clipping | Implemented and reviewed. Medium restore/reset and both drag-release edges showed the full character and bubble; right tuck/return worked. All four sizes rendered fully inside the right work area. Remaining paths/displays are unverified. |
| Claude hook corrections | Implemented and reviewed. Off persisted from installed to portable launch; re-enabling created five persistent-path registrations with default port `47824`. Scripts survived portable Quit and matched source hashes. Custom port, missing-Node live behavior, and comprehensive event delivery are NOT TESTED. |
| App access restrictions | Resource host/path/realpath containment, trusted-main-frame IPC, HTTP(S)-only external links, and navigation guards implemented and reviewed. |
| Windows packaging | Both candidate executables built and their payloads audited against the unpacked application. Final documentation assembly preserves the exact tested EXEs and refreshes the source archive, manifests, and checksums. |
| Runtime support | Electron `45.2.1` and electron-builder `26.18.0` pinned; installed and portable candidate launch/rendering observed. |
| Game-derived face icon | Redistribution permission has not been established. |
| Spine runtime | Custom license; notices retained in inspected payloads, but the applicable distribution basis remains unconfirmed. |
| Project source license | Package metadata is `UNLICENSED`; no source-code license has been selected or granted. |
| Privacy/source cleanup | The 39-file source allowlist passed the secrets/private-data scan. Private QA evidence and extracted/build data remain excluded. |
| Build workflow | Manual `workflow_dispatch` only; saves review artifacts and does not publish a release. |
| Public GitHub release | Not published. |

## Required publication decisions

1. Resolve the face artwork: retain the game-derived icon only with an established redistribution basis, or use original artwork cleared for the public build. Keep personal-use artifacts distinct from public candidates.
2. Confirm the applicable [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license) and [Spine Editor License Agreement](https://esotericsoftware.com/spine-editor-license) requirements, and retain the exact dependency license/copyright notices. This document does not determine that a license has been obtained.
3. Keep this candidate a prerelease with incomplete manual coverage explicit in its release description.

The project's source remains `UNLICENSED` unless the rights holder chooses a license. Do not label it MIT or otherwise grant source-code rights without authorization.

## Build and package

Build on Windows using the committed lockfile:

```bash
cd lilith-pet
npm ci
npm run release:prepare
```

The preparation script always builds both the NSIS installer and portable executable with `--publish never`. It then verifies packaged source, extra resources, dependency versions, and the packaged Electron version before assembling an allowlisted source archive. It writes the two executables, source archive, `SOURCE_MANIFEST.json`, `BUILD_INFO.json`, `RELEASE_NOTES.md`, and `SHA256SUMS.txt` under `release/v1.0.1-rc.3/`. It does not upload or publish anything.

Use the generated `BUILD_INFO.json`, `SOURCE_MANIFEST.json`, and `SHA256SUMS.txt` for exact artifact identities, sizes, source-file inventory, and build versions. Do not embed a source-archive hash inside documentation contained in that same archive. Electron `45.2.1` and electron-builder `26.18.0` are pinned; the observed local build used Node.js `24.18.1`. Do not substitute successful compilation, packaging, or code review for runtime observation.

The expected Windows assets are `Lilith Setup 1.0.1-rc.3.exe` and `Lilith.exe`. GitHub normalizes the installer download name to `Lilith.Setup.1.0.1-rc.3.exe`. The source archive is `lilith-desktop-1.0.1-rc.3-source.tar.gz`. Describe unsigned binaries accurately; do not claim publisher verification or code signing.

The Windows GitHub Actions workflow is started only through `workflow_dispatch`. It uses Node.js 24, installs pinned dependencies, checks JavaScript syntax, runs the same preparation command, and saves a candidate artifact for review. It does not run an automated test suite or publish a GitHub release. No successful workflow run is claimed here.

Inspect the final archive and executables, not only `.gitignore`. Ignore rules do not prevent an ad-hoc archive or upload command from including private files.

| Include when cleared | Exclude |
|---|---|
| App source, extractors, package manifests and lockfile | `node_modules`, caches, intermediate builder files |
| README, changelog, contributor/release documentation | `tests/manual` reports, copied logs, backups, and desktop screenshots |
| Explicitly approved icons and third-party notices | Game dumps, extracted models, textures, voices, dialogue, and the user's game files |
| Final rebuilt EXEs and checksums as release assets | Live settings, local storage, day records, Claude settings, tokens, keys, and environment files |

## Manual verification to record

Use the actual candidate binaries and preserve the original QA report as historical evidence. Record the exact artifact hash and separate each new run from the earlier source session.

- Confirm first appearance, correct outfit, visible face, and a readable speech bubble.
- Recheck BUG-001 at both work-area edges: default and restored positions, walking, dragging/dropping, window following, and every affected size. Confirm intentional tuck and return still work. Check fractional display scaling and available monitor configurations.
- Check that turning Claude hooks off persists after restart, portable runtime cleanup does not strand registered hooks, and a custom port is used by both hook and receiver. Confirm how missing Node.js is reported.
- Install for the current user, inspect both shortcut icons/targets, launch through a shortcut, and verify existing data remains available. Clean-machine game discovery and first extraction are separate checks.
- Quit through the tray and verify no Lilith process remains. Then launch the portable file directly, confirm its runtime path and drawing, and repeat Quit/process verification.
- Review only current-run log entries for failures. Record unavailable metrics explicitly. A long process lifetime is not continuous animation, audio, sleep/wake, or resource-trend coverage.
- For unobserved full-reel, audio, lock/lid/sleep, long idle, language, fullscreen, or multi-monitor behavior, mark the item NOT TESTED and explain the concrete limitation.

No automated tests or existing test suite were run in the earlier authorized manual QA session. Do not rewrite that historical record as a passing automated run. Any later verification must identify its own method and results.

## Candidate validation record

These observations were made on the `1.0.1-rc.1` candidate on 2026-11-01. The bounded manual session is complete. Final documentation assembly preserves the exact tested executables and their hashes; only four unbundled Markdown documents, the source archive, and associated manifests/checksums are refreshed. Manual observations do not establish untested behavior:

| Field | Result |
|---|---|
| Source archive and inventory | `lilith-desktop-1.0.1-rc.1-source.tar.gz`; exact identity in `SHA256SUMS.txt`, inventory and per-file hashes in `SOURCE_MANIFEST.json`. |
| Build versions | Electron `45.2.1`, builder `26.18.0`, Node.js `24.18.1`; recorded in `BUILD_INFO.json`. |
| Installer | `Lilith Setup 1.0.1-rc.1.exe`; exact size/hash in `BUILD_INFO.json` and `SHA256SUMS.txt`. |
| Portable | `Lilith.exe`; exact size/hash in `BUILD_INFO.json` and `SHA256SUMS.txt`. |
| Fixed-build edge regression | Medium pajamas restored from an earlier off-screen-left position into view. Reset-right and left/right drag-release showed the full body and bubble. Right tuck/return worked. |
| Size changes | Portable Medium, Large, Small, and Mini showed the full body within the right work area. Medium was restored and drawing verified. Left-edge, drag-release, and tuck checks covered Medium only. |
| Claude hook preference | Off persisted from installed to portable launch; portable tray unchecked and zero Lilith registrations confirmed through read-only settings inspection. Re-enabling through the portable tray produced five registrations using persistent app-data hooks, no temporary paths, and explicit default port `47824`. |
| Hook files after portable Quit | Persistent hook and trimming scripts remained and exactly matched source hashes. This verifies file persistence and registration, not comprehensive event delivery. |
| Installed update / launch / Quit | Current-user candidate update completed on an existing configured machine; app launched and rendered. Tray Quit left no Lilith process. Candidate shortcut inspection was not separately recorded. Clean installation and extraction were not exercised. |
| Portable launch / Quit | Direct Explorer launch ran from a temporary runtime and rendered. Tray Quit at 02:32:28 Asia/Ulaanbaatar; at 02:32:40 no Lilith/Electron processes or windows remained, and the temporary runtime folder was gone. |
| Current-run log review | Two new installed-run entries and five new portable voice-resource entries were reviewed; no errors appeared in those lines. |
| Final state | App quit; saved size Medium and Claude hooks enabled. |
| Executable contents | Both executable payloads independently matched the unpacked payload by filename, size, and CRC; dependency notices retained. |
| Source privacy review | 39 allowlisted source files passed the secrets/private-data scan; private paths and evidence omitted from public documentation. |
| Artwork / Spine distribution / source license | Unresolved; game-derived icon permission unanswered, Spine distribution basis unconfirmed, project source `UNLICENSED`. |

**NOT TESTED:** audio; full animation reel; clean-machine game discovery and extraction; another or continuously observed long-run session; sleep, lock, and lid behavior; other monitor/scaling configurations; live custom-port and missing-Node handling; comprehensive hook event delivery. Fullscreen, languages, walking/following edge paths, resource trends, and other unobserved checklist items are also unverified. No automated tests or existing test suite were run. These limits remain part of the completed candidate record.

## Publish only the reviewed result

Prepare the release title, notes, hashes, and exact asset list before any upload. Use the intended repository only after confirming its identity. Do not include private QA attachments to demonstrate coverage. Keep the candidate local while artwork and Spine distribution questions remain unresolved. Once those questions are resolved, any prerelease with incomplete manual coverage must list the unverified checks and must not be described as fully tested.

## rc.2 bundled extraction observation — 2026-11-01

The packaged unpacked app was launched with an empty asset destination under the ignored local build cache and a process PATH containing only Windows and System32. No Python or pip command was available through that PATH. Claude hook registration was disabled for this check; the user's existing extracted assets were not changed.

The UI found the installed Steam game automatically and displayed Prepare Lilith from your game files. Clicking Start launched the bundled extractor. The log recorded extraction from 04:45:25 to 04:46:18 UTC (about 53 seconds), then Lilith visibly rendered. The output contained 2,823 voice files and 93 sound-effect files, matching the counts in the existing asset folder. The extractor reported six AudioClip FORMAT errors; counts alone do not establish complete or correct audio. No audio playback was assessed.

The intentionally restricted PATH also prevented the PowerShell app/Spotify watchers from starting; this is an environment limitation of this check, not a normal-install result. Alt+F4 closed the app and a process check found no Lilith processes. An earlier hidden launch was explicitly terminated before this visible observation. No automated tests were run.

This verifies fresh asset preparation on this existing machine with the packaged runtime. A clean Windows machine, installing rc.2 through its setup wrapper, absent-game/invalid-folder retries, and audio completeness remain NOT TESTED. The prior rc.1 installer observations are not substituted for these checks.

## rc.3 model setup validation — 2026-11-01

Read-only inspection of the existing runtime log and Ollama model inventory confirmed `llama3.2:latest` as the model used. Official Ollama download/model pages were checked for the README links. JavaScript syntax checks passed for main.js, ollama.js, and i18n.js.

The startup logic now checks model availability, with a three-second timeout, and displays setup guidance for unavailable Ollama, missing chat models, or a missing explicitly configured model. Existing ready installations receive no setup prompt. This is an on-screen speech bubble, not synthesized audio.

A live source launch with an intentionally unavailable Ollama endpoint was rejected by automatic approval review (blocked by policy). No claim is made that the new startup bubbles or their click actions were observed in the UI. No automated tests were run. Earlier rc.1 and rc.2 manual observations remain scoped to those builds.
