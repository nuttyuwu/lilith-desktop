# 1.0.1 publication

The user authorized building the installer and portable Lilith.exe, publishing a live release, and making nuttyuwu/lilith-desktop public on November 2, 2026. This supersedes the earlier publication freeze recorded below. EXEs are release attachments only; Git ignores binary build output. Build result: installer and portable wrappers completed. Packaged source hashes, production dependency versions, extractor resource hashes, and Electron 45.2.1 identity passed validation. A platform-aware optional-dependency check was corrected after it incorrectly required a macOS package in the Windows build. The portable EXE was launched and visibly rendered Lilith. The installer launch did not expose a setup window to the UI tool; installation of this exact build remains unverified. Git history inspection found no matching credential/private-path patterns or excluded runtime/binary files, and no EXEs are staged in Git. Historical validation limits below remain applicable. Builds are unsigned; public availability does not grant rights to third-party game artwork or change dependency licenses.

# Screenshot-overlay handling, chat styling, and personal README — development record

Chat context follow-up: removed the unconditional claim that Lilith can see Claude's work. chat-prompts.js contains separate Claude-open and everyday prompts appended to the shared persona. A bounded per-reply local presence query checks desktop window handles and recognized native/npm Claude Code paths; browser tabs are not tracked. Detection failure uses everyday mode. Live hook asides use the Claude prompt but cannot treat an open app as evidence of coding activity. Mode changes clear conversational history; stale async checks cannot affect newer turns. Syntax checks and code review passed; current-machine presence query returned true. Open/close transition conversation has not been manually exercised. Source restarted; no build or push.

Follow-up: the body-track clear left peek eye attachments behind on return. Tuck completion now removes gaze offsets, clears all animation tracks, restores the skeleton setup pose, and applies the destination animation before resetting physics and revealing her. Native Ctrl+Alt+C tuck/return in pajamas showed a single normal pair of eyes after return. Syntax check and independent review passed; no build or push.

Screenshot capture processes (SnippingTool, ScreenClippingHost, ScreenSketch, ScreenCaptureHost) no longer feed the fullscreen auto-tuck logic. The previous foreground state is retained through the transient capture overlay. Tuck clears the outgoing body track and seat/root offsets so the lying animation cannot reapply its large root displacement during teleport; return starts the standing greeting without a lying-to-standing mix.

The text input is a centered, narrower dark translucent pill with a soft lilac focus indicator instead of the red border. Backdrop filtering only affects content available inside the Electron surface; this is glass-style transparency, not a promise of Windows desktop blur. Native source inspection confirmed the new input renders with no red ring. Syntax checks passed. The exact Windows+Shift+S sequence while lying remains NOT TESTED manually; no clock change, EXE build, or GitHub push.

README now uses a personal Me/Lilith presentation, restrained themed badges, the existing gallery, actual feature descriptions and source-versus-download status. Decorative Lilith quotes are explicitly distinguished from original dialogue. AI voice remains paused.

# Game voice restoration and AI speech pause — unpublished source

AI speech is forcibly disabled when loading settings and guarded at live/audition/setup entry points. Its tray submenu, including English selection, is removed; Qwen code, references and downloaded files are retained for future work. Saved production/preview settings were set to aiSpeech=false. The source pet was restarted; Chinese game voice remains selected. No qwen-worker process remained after restart.

The reported Chinese AI gaps coincide with a log entry of 38532 ms generation for 3.52 s audio (first packet 8391 ms), so the stream could not sustain playback. This is not evidence that original game recordings were damaged. Independently, game dialogue timers previously ignored clip length; chains now wait for decoded recording duration, including before exposing reply choices. Active game speech rejects incidental overlapping speech. Head pats no longer force-restart a live chain or schedule an extra flirt at 2.5 s; repeated movement within one pat is consumed. Generic body touches now use the original TouchBody graph before random fallback. Removed the additional random idle-flirt injection.

Morning greetings use original TimeMorning nodes once per local date, 06:00–09:00, including while left running overnight. First subsequent morning touch offers the game's s26_out conversation once per date. That touch/time mapping is an adaptation; the extracted original node itself is PlayerInitiated. Preserved original recorded lines and reply chains. The exact 'How are you feeling today?' line is an evening Idle node (18:00–21:59), so it was not reassigned to morning. No clock was changed and overnight/morning behavior has not been manually observed. Syntax checks and independent review were used; no automated app suite, packaging, or publication.

# Faster local Qwen speech — unpublished source

NVIDIA speech now uses faster-qwen3-tts 0.2.5 CUDA graphs with the same Qwen3-TTS 0.6B weights, full ICL prompts and approved synthetic reference clips. No quantization, pitch modification, time stretching, or voice replacement. Python emits bounded audio chunks followed by completion; the speech service validates and forwards them to a serialized Web Audio playback queue. Mute/cancel/tuck discard pending chunks and queued sources. The model stays warm for five minutes after completion; disabling voice still unloads immediately. CPU/ROCm retain standard inference. Old prepared runtimes without the accelerator fall back to standard Qwen with a repair hint.

November 2 production service measurements on the 6 GB RTX 3060 laptop: cold English first audio 30343 ms, complete 32687 ms for 3.12 s audio; warm Chinese first audio 984 ms, complete 3125 ms for 2.8 s audio; warm English first audio 766 ms, complete 4047 ms for 4.16 s audio. First-audio numbers are worker packets, excluding Ollama and output-device delay. The separately running Lilith AI app was temporarily stopped with user permission to free GPU memory; Ollama and other apps remained open. Prior 26–45 s baseline and these runs have different memory pressure, so do not attribute all improvement solely to code. Samples and log are under .cache/tts/qwen-stream-final.log and qwen-auditions. Voice identity inputs are unchanged; listening quality is not asserted from timings.

Syntax checks passed and independent code review approved after fixing compatibility with older runtimes and bubble lifetime for queued speech. No automated app suite, EXE build, or GitHub push was performed. Native source-preview chat was exercised using its isolated Ctrl+Alt+Shift+L shortcut (the installed pet owns Ctrl+Alt+L). The log recorded cold first audio 49062 ms / total 51078 ms, then warm first audio 891 ms / total 3047 ms for 2.64 s audio. The response bubble was observed and no playback error appeared in the current log. Physical speaker audibility and absence of audible chunk seams were not independently confirmed. The temporary source preview was closed after checking; the installed pet was left running and the separately paused Lilith AI host was restarted.

# GPU speech, lightweight off switch, and preview profile correction

Added persisted Automatic/GPU-only/CPU-only speech modes. The worker uses CUDA/ROCm when exposed by the installed PyTorch runtime, reduced precision on GPU, and float32 CPU otherwise. No inference process is spawned merely by launching Lilith. Disabling AI voice stops audio and unloads even an idle worker immediately; device changes discard the old worker. Runtime setup blocks generation while packages change and removes the readiness marker until successful completion.

GPU setup uses official NVIDIA CUDA12.8 Torch/TorchAudio2.9.1 wheels or AMD's documented ROCm7.2.1 Python3.12 Windows wheels for RX9070. AMD requires a compatible Radeon driver; its branch is not tested on that desktop. No global graphics drivers are installed by the script. Setup can repair an existing prepared development runtime as well as the standard AppData runtime.

The repeated Visitor name was from the isolated source-preview profile, not a lost production profile. The development launcher now reads the saved real profile before booting its isolated preview, which also clears the old in-memory chat history. Other test settings remain isolated; no real settings backup was restored. The saved name was confirmed in the preview settings without publishing it in this report.

Production speech.js/worker generation was verified on the NVIDIA GeForce RTX 3060 Laptop GPU (6 GB) using GPU-only mode and Torch/TorchAudio 2.9.1+cu128. English produced 3.04 seconds of audio in 45.015 seconds including cold startup; Chinese produced 3.6 seconds in 25.641 seconds with the warm worker. Both returned backend CUDA. GPU memory rose from 2817 MiB to 5635 MiB during synthesis. Explicit service unload removed all owned qwen-worker processes and returned GPU memory to 2817 MiB. The native off-menu click and physical speaker audibility were not observed in this check. The source preview was restarted with the saved profile and GPU-only speech enabled. AMD RX 9070 remains untested. No automated app suite, EXE build, or GitHub push was performed.

# Approved voices connected locally; compact toolbar correction

The user approved both Qwen-designed voice auditions and explicitly selected local-only speech. The active source backend now uses Qwen3-TTS-12Hz-0.6B-Base with those English/Chinese synthetic reference clips. Model loading is offline-only, on CPU, and there is no hosted fallback for live replies. The local preview has AI speech enabled in its isolated Visitor profile. The installed EXE and private GitHub remain untouched.

The toolbar was reduced to12px text,24px button height,11px media icons, and compact padding. Removed automatic focus on Claude (the red oval); keyboard focus uses a muted outline. Native UI observation showed the smaller five-control pill without the oval. Scale-to-fit is retained.

Local runtime import succeeded: qwen-tts0.1.1, Torch2.15.0+cpu, TorchAudio2.11.1+cpu, Transformers4.57.3, Accelerate1.12.0. Inference-only dependencies were installed; the optional Gradio web UI was deliberately omitted. The prepared development runtime is .cache/qwen-venv; source detects its completion marker. Standard setup targets APPDATA/lilith-pet/qwen-runtime and requires an existing Python3.12 launcher. New-PC setup through the native menu is NOT TESTED end-to-end.

Model revision:5d83992436eae1d760afd27aff78a71d676296fc. Both downloaded weights matched their published SHA-256: main180b3b10eb1c9f1b4db7806d5475bae3071c0243c299d49926bab1da3b6946f6; tokenizer836b7b357f5ea43e889936a3709af68dfe3751881acefe4ecf0dbd30ba571258. About2.51GB of weights. A stalled initial transfer was completed with verified ranged downloads; no clock changes or unrelated-app closures.

Local voice production through the same speech.js/Python worker path produced English3.84s audio in82s including cold startup and Chinese3.28s audio in45.34s. Observed worker RAM was about3.8GiB. Samples: .cache/tts/qwen-auditions/local-english.wav and local-chinese.wav. These are not real-time results; RX9070/other machines have not been benchmarked.

Native UI check: Ctrl+Alt+L, entered a short Ollama request. While Qwen was running, Ctrl+Alt+C tucked Lilith; both owned Python PIDs disappeared. Restored her and entered another request: app log at2026-11-01T16:11:08.184Z recorded Qwen sid0,65156ms generation,2.8s audio, and a reply bubble was observed. This verifies generation/dispatch and cancellation, not physical speaker audibility. After the45-second idle interval, process inspection found no remaining qwen-worker Python processes. No automated test suite was run.

Code review corrected old Kokoro ID migration, incomplete-setup readiness, an unavailable TorchAudio pin, and Windows venv child-process termination. Required scripts and synthetic references are included in the future packaging/source allowlists, but NO build or publication was performed.

# Restored compact toolbar and Qwen audition

Restored the screenshot-style horizontal dark pill: Claude, GPT, divider, previous/play-pause/next icons. Right-click opens it above Lilith's head; all other controls remain in the tray. Icon buttons retain accessible names. Width is scaled to fit narrow pet windows and vertical placement accounts for that scale. Normal-size native UI observation showed all five controls above her head. Mini/high-DPI fitting was code-reviewed, not manually exercised. No EXE build or GitHub push.

Qwen3-TTS-1.7B VoiceDesign was tried through Qwen's official Hugging Face demo (https://huggingface.co/spaces/Qwen/Qwen3-TTS), using only a synthetic sample line and description of a soft, youthful, shy feminine delivery. No game audio or user chat was uploaded. Both requests succeeded: English 7.58 s, Chinese 6.70 s, 24 kHz WAV. Local outputs and exact prompts are in .cache/tts/qwen-auditions. These are auditions awaiting user listening feedback, not an accepted voice and not integrated into live chat. No physical listening claim or local performance benchmark is made.

An isolated .cache/qwen-venv was created. Local PyTorch setup was stopped during download after observing about1.5 GiB free system RAM; the lighter gradio_client is installed there for auditions. No large Qwen model was loaded and no other apps were closed. The shipped speech backend remains unchanged/muted in the preview.

# Menu correction and voice audition feedback

Right-click now contains only Claude Code and previous/play-pause/next music. Other commands stay accessible in the tray; AI voice selection and speed were moved to the native tray submenu along with preview/download/mute/stop. Manual native UI check after restarting the source preview showed exactly the four requested right-click buttons in the original white/red game styling. Code review found no missing tray paths or renderer references. No automated suite was run. The user rejected Kokoro af_maple/zf_076 as unlike Lilith's soft, youthful, shy voice. These are experimental demos, not an accepted character voice. AI speech remains off by default; the isolated preview is muted for this correction.

Next voice candidate: Qwen3-TTS VoiceDesign, using an original synthetic voice described as soft, youthful feminine, shy, gentle, quiet conversational delivery, light breathiness, no theatrical announcer tone. Official reference: https://github.com/QwenLM/Qwen3-TTS . This candidate has NOT been installed, auditioned, integrated or benchmarked on either target PC. Keep hardware suitability and perceptual matching unverified until measured/heard. No packaging or GitHub publication authorized.

# Local AI speech implementation — release remains on hold

Kokoro v1.1-zh via sherpa-onnx-node 2.0.1 now synthesizes English/Mandarin Ollama replies on CPU, in an Electron utility process. Source changes only: no EXE build or GitHub push for this work. Model archive downloaded from the official release and verified against SHA-256 b78e1ac42b852e839cceaafbe88f66806bf5860992d1d7b9a3f2ad1198427aed. Development installed that same archive through the unpack path; the new UI download path has not been exercised end-to-end on a clean PC.

Manual source-preview checks on November 1: opened More controls → AI voice at small pet size; installed-model status and selectors rendered. Preview English generated 3.67 seconds in 11.35 seconds; Preview Chinese zf_076 generated 7.22 seconds in 13.56 seconds. Both reached the renderer's playback-ended “Ready for the next reply” status. The first preview exposed Electron's external-buffer restriction; setting enableExternalBuffer:false per sherpa's documented guidance corrected it. This verifies scheduling/completion, not physical speaker audibility or the new desktop's output device.

Enabled AI speech through the native menu and opened chat. A real Ollama reply reached synthesis (15.26 seconds generation, 7.90 seconds audio); the visible bubble contained the generated reply. The user began interacting with the preview, so further stop/mute/tuck interruption checks were left NOT TESTED manually. Code paths were reviewed but that is not a substitute for observed interaction. The preview remains running with AI speech enabled in its isolated Visitor profile. One runtime lexicon warning skipped the possessive name Visitor’s; uncommon names are a known pronunciation limitation.

Generated audition files for all 58 female presets locally; a simple pitch/spectral comparison against game lines 1000202/1000230 ranked zf_076 first and af_maple first among English presets. This is a provisional acoustic shortlist, not a listening-panel result or an actor clone. Local full-sample generation used roughly 610–660 MiB process RAM. RX 9070/RTX 3060 machines remain unbenchmarked. No automated app test suite was run. Code review covered cancellation, stale replies, model integrity and renderer playback; the download-completion mute race was corrected.

# Publication on hold

The user requested no more EXE builds or GitHub pushes until explicitly told. The rc.6 source commit and installer build preceded that request; the remaining portable build was stopped and no rc.6 GitHub release was uploaded. Hair-margin changes after that request are local only. Manual small-preview dragging/landing kept sampled horizontal drawing bounds within the expanded window (528 CSS pixels wide). Narrow-display tuck width is derived from height rather than capped window width; not manually verified on a portrait display.

# rc.6 motion update

Manual source-preview observations: native drag changed the window position; the existing hair constraints now have advancing time and nonzero motion. Tuck and return showed outgoing/incoming sparkles, and observed return bounds matched the previous standing position. Review caught and corrected seated offsets and queued fullscreen transitions. No automated test suite was run. Fresh-machine voice playback remains unconfirmed; Test game voice now logs decoded playback details. At the time of this motion check, AI speech synthesis was not implemented; the later local speech work is documented above. Earlier observations below are version-specific history.

# rc.5 controls update

The original desktop pet control sprites and serialized vertical menu layout were inspected locally. The new right-click menu and More controls page were opened manually in the small source preview; Escape dismissal was observed. Outfit selection changed Lilith to pajamas. After review, native window blur was connected to menu dismissal; a real click on Explorer’s title bar visibly closed the menu. Movement/audio verification below belongs to rc.4, not a new full regression pass. No automated test suite was run.

The current-user installer upgrade to rc.5 completed. Installed version metadata and all six changed runtime files matched source. The installed app rendered the original-style right-click menu and hover artwork; Escape dismissed it. Existing local assets and preferences were reused.

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



