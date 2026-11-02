# 1.0.2 — Setup-only installation and maintenance

- Distribute only the setup installer; it installs Lilith.exe locally.
- Reopen setup to check the latest stable GitHub release and install a checksum-verified update.
- Uninstall from setup or Windows Settings; preserve settings and extracted game assets.

## 1.0.1 — public Windows release

- Installer and portable Lilith.exe are provided as release downloads, not repository files.
- Original game voices and dialogue, compact Claude/GPT/music controls, glass-style chat, and sparkle tuck/return.
- Corrected lingering peek eyes, lying pose offsets, duplicate post-pat flirt, and dialogue audio timing.
- Separate everyday and Claude-present chat prompts; AI-generated speech remains paused.
- Unsigned Windows x64 builds. Requires your own game installation for initial asset preparation.

## Original game voice and interactions — development history

- Pause AI speech and remove English AI voice controls; retain Qwen for future development.
- Wait for game recordings to finish before advancing dialogue or showing replies.
- Remove the extra delayed head-pat flirt and prioritize the original touch graph.
- Add once-daily morning greeting and first-morning-touch going-out conversation using game dialogue.

## Faster Qwen speech — unpublished

- Reuse the same model and approved voice references with NVIDIA CUDA graph acceleration; stream validated audio into an ordered playback queue.
- Keep the model warm for five minutes between replies while preserving immediate unload when voice is disabled.
- Retain standard Qwen for CPU/AMD and older runtimes without acceleration; GPU setup installs the pinned accelerator.
- Warm short-sample first audio measured at 0.77–0.98 seconds on the 6 GB RTX 3060 laptop; cold startup remains slower. No EXE build or GitHub push.

## Local GPU speech and profile correction — unpublished

- Add Automatic/GPU-only/CPU-only modes for Qwen, with CUDA/ROCm reduced-precision inference and official GPU runtime setup paths.
- Switching AI voice off immediately stops playback and unloads its model process; disabled voice does not start an inference worker.
- Make the development preview use the saved user profile instead of Visitor, and anchor generated dialogue to the saved preferred name.
- No EXE build or GitHub publication.

## Local approved Qwen voices and compact controls — unpublished

- Connect approved English/Chinese synthetic references to offline Qwen3-TTS0.6B speech for Ollama replies; replace active Kokoro backend.
- Keep inference in an owned subprocess with cancellation, bounded output and idle unloading; retain text if speech fails.
- Shrink the Claude/GPT/media pill and remove automatic red focus around Claude.
- CPU speech is functional but slow on the tested laptop:45–82seconds for short lines. No EXE build or GitHub push.

## Local AI speech work — not packaged or published

- Add optional CPU-based English/Mandarin speech for Ollama replies, automatic verified model setup, voice previews/selectors, independent mute, speed, and cancellation.
- Default to af_maple and provisional Chinese acoustic-match candidate zf_076; preserve recorded game voice controls.
- Keep native inference outside the animation process; release idle model memory and retain text on speech failure.

# Changelog

## 1.0.1-rc.6 — local development; release on hold

- Widen transparent side margins for live hair physics; derive tucked width from height so narrow displays do not shrink her. This margin fix is local only.
- Restore sparkle teleport for tuck/return instead of sliding the window. Remember the previous position, correct seated offsets, and clamp the return if a display changes.
- Advance Spine’s physics clock and feed actual window-drag movement to the existing physics constraints, restoring hair motion. Preserve the pointer-down anchor for fast drag pickup.
- Queue tuck requests during transitions and reconcile automatic fullscreen changes without losing manual overrides.
- Include decoded clip duration, channels and audio-engine state in the copied log after Test game voice. Audible playback on the reported new desktop remains unconfirmed; this motion checkpoint preceded the local AI speech work above.

## 1.0.1-rc.5 — private prerelease

- Replace the hover toolbar with the original desktop pet’s vertical right-click controls, using its normal and red-corner hover button sprites from locally extracted assets.
- Keep talk, outfits and Exit Realm in the main menu; place voice testing, coding integrations, music, tuck and tray settings in More controls.
- Add keyboard dismissal, hidden-page focus isolation and bounded scrolling for small windows. Close controls on focus loss, setup and demos; pause idle roaming while browsing controls.

## 1.0.1-rc.4 — private prerelease

- Replace the delayed tuck/return teleport with a continuous window slide, keeping Lilith visible during return.
- Use consistent outer-window coordinates for walking, dragging and falling on scaled Windows displays; retain walking root-motion cancellation through animation blends.
- Match the game’s star dialogue bubbles and checkerboard panels using UI sprites from the player’s extracted assets, with a CSS fallback.
- Add a Voice button and Settings > Voice > Test voice, report playback failures, and bound audio-output resume waits. Windows mute and user voice preferences remain under user control.
- The user reports successful rc.3 installation on a second desktop. Six extraction audio-format warnings and reported silence remain distinct from a verified audio-device diagnosis. That candidate did not include generated chat speech.

## 1.0.1-rc.3 — private prerelease

- Document the model actually used, Llama 3.2 (`llama3.2:latest`), with official Ollama and model links and the download command.
- At launch, show a clickable model-setup speech bubble when Ollama is unavailable or no chat model is installed. Ready installations are not prompted to reinstall.
- Correct the old Llama 3.1 suggestion, prefer installed Llama 3.2 after a named Lilith model, check configured model availability, and bound model discovery to three seconds.
- Setup messages are displayed as text; they do not synthesize new voice audio. No automatic model download is performed.

## 1.0.1-rc.2 — unreleased

- Bundle the asset extractor and its Python dependencies in both Windows builds. End users no longer need Python, pip, or an extraction-time dependency download.
- Keep game assets out of the packages. Fresh setup locates the user's installed game, asks once to prepare its assets, and launches the companion after preparation.
- Allow retrying Steam detection after installing the game without restarting Lilith, and retry an invalid folder selection.
- Preserve extraction dependency notices and verify every bundled runtime file during release assembly.
- Manual rc.2 check: the packaged runtime found the installed game, prepared an empty asset folder after one Start click with Python absent from PATH, and rendered Lilith. Six audio-format errors remain recorded; audio completeness, a clean Windows machine, the rc.2 installer wrapper, and retry dialogs are unverified. Earlier rc.1 UI observations remain historical.

## 1.0.1-rc.1 — unreleased

Local GitHub release candidate for `nuttyuwu/lilith-desktop`. Public publication is blocked by the unresolved artwork and Spine distribution questions below.

### Implemented fixes

- **BUG-001: screen-edge clipping.** Keep ordinary horizontal positions within the selected work area, including restored positions, walking, dropping, and following a window. This addresses placement that let body parts and speech bubbles extend beyond the screen. Intentional tuck/peek positions remain separate. The observed Medium-size restore, reset, and left/right drag-release checks showed the full character and speech bubble; right tuck/return worked. Other paths and display combinations remain unverified.
- Persist the Claude hook preference across launches, store hook scripts outside the portable build's temporary runtime, trim events before local transmission, and pass an explicitly configured hook port. Report missing Node.js, remove the raw-request fallback, and replace legacy Lilith hook entries during registration.
- Restrict `lilith://` resource requests by host, path, and resolved filesystem containment. Accept app IPC only from trusted main frames, restrict external links to HTTP(S), and guard app-window navigation.
- Pin Electron to `45.2.1` and electron-builder to `26.18.0`; rebuild and inspect both Windows executable payloads.

### Release preparation

- Windows installer and portable build configuration, with face-icon support.
- User installation, local-data, integration, and contributor documentation.
- Source exclusions for extracted game files, dependency/build directories, and private manual-QA evidence.
- `npm run release:prepare` fully rebuilds both Windows executables with publishing disabled, checks packaged inputs, and creates an allowlisted source archive, build/source manifests, release notes, and SHA-256 checksums.
- A manually dispatched Windows build workflow saves candidate artifacts for review. It does not publish a release or run the automated test suite.
- Third-party notices and explicit `UNLICENSED` project metadata while the source-license decision remains open.

### Validation status

On 2026-11-01, the `1.0.1-rc.1` current-user update completed on an existing configured machine, and the installed app launched and rendered. A Medium-size pajama outfit restored from an earlier off-screen-left position visibly clamped into the work area. Reset-right and real left/right drag-release observations showed the complete body and speech bubble. Right tuck/return worked, and tray Quit left no Lilith process. This did not exercise a clean installation or first extraction.

The candidate portable executable launched directly through Explorer from a temporary runtime. Medium, Large, Small, and Mini each rendered fully inside the right work area; Medium was restored afterward. Left-edge, drag-release, and tuck/return coverage was limited to Medium.

Turning Claude hooks off in the installed app persisted into the portable launch: its tray item stayed unchecked and a read-only settings check found zero Lilith hook registrations. Re-enabling through the portable tray created five registrations pointing to persistent app-data hook files, with no temporary-runtime paths and the explicit default port `47824`. After portable tray Quit, no Lilith/Electron processes or windows remained and the temporary runtime folder was gone. The persistent hook and trimming scripts remained and exactly matched their source hashes. The final saved preferences were Medium size and hooks enabled; the app was left quit.

Only the current-run log additions were reviewed: two installed-run entries and five portable voice-resource entries, with no errors in those lines. This is a bounded log observation, not a claim about every application path.

Code review is complete. Both executable payloads independently matched the unpacked application by filename, size, and CRC, with required dependency notices retained. The 39-file source allowlist passed the secrets/private-data scan. Final documentation assembly preserves the exact tested executables and their hashes, refreshing only the unbundled documentation, source archive, and manifests/checksums. Exact artifact identifiers are recorded in the candidate's `BUILD_INFO.json` and `SHA256SUMS.txt`.

Audio, the full animation reel, clean-machine discovery/extraction, an additional or continuously observed long-run session, sleep/lock/lid behavior, other monitor/scaling configurations, live custom-port and missing-Node handling, and comprehensive hook event delivery remain NOT TESTED. Broader animation, language, fullscreen, and movement coverage must not be inferred from the bounded observations above. No automated tests or existing test suite were run.

### Earlier local observations

The earlier `1.0.0` local build installed for the current user, created Desktop and Start Menu shortcuts, and launched through the Start Menu shortcut. The portable executable launched separately and removed its temporary runtime directory after tray Quit. Those observations do not verify this candidate's rebuilt binaries.

The earlier source process survived a launch-to-exit-verification interval of about 4 hours 32 minutes. Intermediate observations and Task Manager CPU/GPU/RAM readings were missed or unavailable. This was not continuous visual or audio coverage. One screen-edge clipping defect was confirmed; the full manual checklist remained incomplete. Automated tests and the existing test suite were not run during that session.

See [Release preparation](docs/RELEASE.md) for the current candidate record. Historical process lifetime is not evidence of a new candidate long-run pass.

### Publication blockers

- Confirm the redistribution basis for the bundled game-derived face icon, or replace it with artwork cleared for distribution.
- Resolve the applicable Spine runtime licensing requirements and include its required notices.
- Retain the untested checks in any eventual prerelease notes; the bounded manual candidate session is complete.

## 1.0.0 — local build, 2026-10-31

- Created x64 NSIS installer and portable executables with a game-derived face icon.
- Completed the bounded installation and launch observations described above.
- This entry records local artifacts, not a published GitHub release.
