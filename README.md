<p align="center">
  <img src="docs/images/lilith-hero.png" alt="Lilith — a little company, a little mischief" width="100%">
</p>

<h1 align="center">☾ Lilith Desktop ✦</h1>
<p align="center"><strong>A little company. A little mischief.</strong><br>A desktop pet, a coding companion, and someone to steal a little space on your screen.</p>

<p align="center">
  <img alt="Windows x64" src="https://img.shields.io/badge/Windows-x64-b9a8db?style=flat-square&labelColor=211d2d">
  <img alt="Original game voice" src="https://img.shields.io/badge/Voice-original_game-d8b6cb?style=flat-square&labelColor=211d2d">
  <img alt="Optional local chat" src="https://img.shields.io/badge/Chat-local_Ollama-abc7d9?style=flat-square&labelColor=211d2d">
  <img alt="Unofficial fan project" src="https://img.shields.io/badge/Unofficial-fan_project-c8bedc?style=flat-square&labelColor=211d2d">
</p>

<p align="center"><a href="#why-shes-here">Our little introduction</a> · <a href="#see-her-on-your-desktop">Meet Lilith</a> · <a href="#install-or-run">Get started</a> · <a href="#controls">Controls</a> · <a href="#give-lilith-a-chat-model">Local chat</a></p>

---

## Why she's here

**Me:** I'll be honest: I don't really like where the second game is going. The original theme and aesthetic were a big part of why I loved it, and I feel like some of that got stripped away.

But the desktop pet? I still love that part.

The creators had already given her the model, the animations, the voices, and all those little reactions. I wanted to take that pet and make her more interactive—to have her around while I'm coding, listening to music, or just spending too much time at my desk.

So I added Claude Code reactions, time awareness, music controls, and optional local chat. I'm trying to keep what made her feel like Lilith in the first place, especially her original voice and interactions.

> **Lilith:** “He says it's a project. I think he just wanted me to stay a little longer.”

I still want you to get the game and support its creators. This companion prepares its character assets from **your own installed copy**. Their character work is theirs; the added desktop behavior is my part.


## See her on your desktop

<p align="center">
  <img src="docs/images/lilith-in-action.gif" alt="Lilith greeting, waving, giggling, and casting magic using her actual animations" width="500"><br>
  <sub>✦ A familiar face. A little hello. Some room for mischief. ✦</sub>
</p>

<table>
<tr>
<td align="center" width="50%"><img src="docs/images/lilith-greeting.png" alt="Lilith in her casual outfit" width="350"><br><strong>Someone to come back to</strong><br>Original expressions, game recordings, and little reactions.</td>
<td align="center" width="50%"><img src="docs/images/lilith-chat.png" alt="Earlier preview of Lilith's chat and compact controls" width="350"><br><strong>Company while you work</strong><br>Coding shortcuts, conversation, and music within reach.</td>
</tr>
</table>

<sub>These are staged renderer captures using the real character animations. Captions are demo text. The still images show an earlier interface; the current source has a smaller toolbar and glass-style text bar. This gallery is an animation showcase, not proof of every integration below.</sub>

## What we do together

| | Me | Lilith |
|---|---|---|
| **✦ Coding company** | Claude Code hooks tell her when coding activity happens. | “I'll be here for the little victories.” |
| **♫ Music** | Previous, play/pause, and next controls in her compact right-click toolbar. | “You pick the song. I'll keep you company.” |
| **☾ A little space** | Tuck her away with sparkles and bring her back to her previous spot. | “Call me when you want me back.” |
| **♡ Everyday moments** | Head pats, game dialogue, morning greetings, outfits, and resting on your desktop. | “Not everything needs to be a big conversation.” |
| **✎ Optional chat** | Text conversations through a local Ollama model. | “You can tell me what's on your mind.” |

**Her voice comes from the game.** AI-generated speech is paused while I work on its quality. You don't need an LLM or a voice model just to enjoy the desktop pet.

## Make yourself at home

1. **Install your own copy of the original game.** Her first setup uses it to prepare the assets.
2. **Start Lilith and follow asset setup.** The prepared assets are reused afterward.
3. **Make room for her.** Drag her, right-click for the compact toolbar, or use the tray for the rest of her settings.
4. **Add local chat if you want it.** [Ollama and model instructions are below](#give-lilith-a-chat-model).

> **Lilith:** “We can start with just a hello.”

---

## Current status

**Version 1.0.3 — Windows x64.** [Download Lilith Setup](https://github.com/nuttyuwu/lilith-desktop/releases/latest). Executables are release attachments, not files in the source repository.

This release brings the compact controls, glass-style text input, sparkle tuck/return, original game dialogue and voice timing, and separate everyday/Claude chat contexts. AI-generated speech is paused; local text chat is optional.

I've checked the source app on my Windows laptop. Clean-machine setup, sleep/wake, multiple monitors, and the exact screenshot-overlay case still need broader testing. See the [changelog](CHANGELOG.md) and [validation record](docs/RELEASE.md) for what was actually checked. The Windows downloads are unsigned.

## Requirements

- Windows x64. Windows 11 is the platform used for the recorded manual session; other Windows versions have not been verified for this candidate.
- Your own installed copy of *The NOexistenceN of Lilith* for first-time asset preparation. Install the game before setting up this companion. After preparation, Lilith reuses the extracted assets in `%USERPROFILE%\LilithRip`; normal use does not require another extraction or the original game files.
- No separate Python installation is needed for the Windows executables: the extraction tool and its dependencies are included. Python 3.12 is a build-from-source prerequisite only.
- About 1–2 GB for extracted game data, in addition to the app and any optional Ollama models. Size and duration vary with the game version.
- Optional: Spotify desktop for music controls; Ollama with a downloaded chat model for generated replies; Claude Code and Node.js on PATH for coding activity reactions.

The animated model, textures, voices, and dialogue are extracted from the player's installed game once, then loaded from the extracted asset folder. These assets are not bundled in the current executables or downloaded from this project. The current local build also contains a face icon copied from the game; permission to redistribute that artwork has not been established. Do not treat the local build as cleared for public redistribution.

## Install, update, or uninstall

Download the current [Windows release](https://github.com/nuttyuwu/lilith-desktop/releases/latest). The Windows binaries are unsigned.

| File | Use |
|---|---|
| `Lilith.Setup.<version>.exe` | Install Lilith with Desktop and Start Menu shortcuts. Current-user installation is the manually checked option. |

**One download: Lilith Setup.** Setup installs `Lilith.exe` on your PC; there is no separate portable download.

- **Install:** open setup and choose Next.
- **Update:** reopen setup and press **Update from GitHub**. It checks the latest stable release, downloads its setup, verifies the SHA-256, and asks before installing. Your settings and game assets stay in place.
- **Uninstall:** reopen setup and press **Uninstall Lilith**, or use Windows Settings → Apps → Installed apps → Lilith → Uninstall. The app and shortcuts are removed; settings and extracted game assets are kept for reinstalling.

The locally built executables are unsigned. Publisher signing has not been configured.

For a fresh setup, install *The NOexistenceN of Lilith* through Steam, then launch this companion to prepare the assets from your copy. If the game cannot be found, setup offers to find it on Steam or lets you choose its installed folder. Preparation cannot continue without the game files.

Lilith checks for the required extracted assets at startup. If they are already present, she can run without the original game files or another extraction. Keep the extracted asset folder: the app uses it on every launch.

If required extracted files are missing, Lilith asks to prepare them from your installed game. It looks in Steam libraries; if it cannot find the game, choose the folder containing `Lilith_Data`. Preparation runs the included extraction tool without installing Python or downloading dependencies. Click Start once to begin; Lilith opens when preparation finishes. If you open Steam from setup, click Check again after the game finishes installing; there is no need to restart Lilith. Extracted files go into `%USERPROFILE%\LilithRip` by default.

If an instance is already running, launching again brings that instance back into view. Use the tray menu to quit before testing a different build.

## Controls

| Action | Control |
|---|---|
| Open the app menu | Right-click Lilith's system-tray icon; it may be in the hidden-icons area. |
| Tuck or bring her back | `Ctrl+Alt+C` |
| Open chat and conversation topics | `Ctrl+Alt+L`, or tray → Talk |
| Move her | Drag the character, then release. |
| Change outfit, size, screen, voice, or language | Tray → Settings, or the outfit items in the tray menu |
| Recenter her | Tray → Settings → Reset position |
| Play a demonstration | Tray → Demo |
| Exit | Tray → Quit |

The tray also controls app awareness, fullscreen hiding, day/night behavior, chatter frequency, and whether she stays on top. Audio, the full animation reel, and other unobserved behavior remain NOT TESTED; see the release notes for the exact coverage.

## Give Lilith a chat model

The model used with this project is **Llama 3.2 (`llama3.2:latest`) through Ollama**. The game provides Lilith's existing voice clips and reactions; the local language model lets her generate new chat replies.

1. [Download Ollama for Windows](https://ollama.com/download/windows), install it, and open it.
2. Open PowerShell and download the model:

   ```powershell
   ollama pull llama3.2:latest
   ```

3. Wait for the download to finish, then talk to Lilith with **Ctrl+Alt+L**. If she is already running, try chatting again; reinstalling Lilith is unnecessary.

[Model download page and details](https://ollama.com/library/llama3.2). The default model currently has 3 billion parameters and a download of about 2 GB. The model download needs internet access; once installed, chat uses the local Ollama service by default.

At launch, Lilith checks whether her chat backend and a model are available. If Ollama is unavailable, her speech bubble offers this setup guide. If Ollama is running without a chat model, she says, “In order for me to chat with you, please install the Llama 3.2 model,” and clicking the bubble copies the download command. This is an on-screen setup message, not newly synthesized voice audio.

If Ollama is already installed but stopped, open it or try chatting so Lilith can attempt to start it. For a custom `LILITH_OLLAMA` endpoint, make sure that server is reachable and has the model installed. `LILITH_MODEL` can select another installed model; otherwise Lilith prefers an installed model named Lilith, then `llama3.2:latest`, then another non-embedding model. Basic pet animations and recorded reactions still work without a language model.

## Quick controls

Right-click Lilith for the compact dark toolbar: **Claude**, **GPT**, **Previous song**, **Play / pause**, and **Next song**. All other options are in her system-tray menu, including chat, outfits, tuck, voice settings, and Quit. **Ctrl+Alt+L** still opens chat; Escape or another right-click dismisses the quick menu.

## Voice: original game recordings

AI-generated speech is disabled for now, including English voice selection and auditions. Lilith uses the original Chinese or Japanese recordings extracted from your copy of the game. Choose the game voice in tray Settings; text chat still works without synthesized speech.

The experimental local Qwen implementation and downloaded models are retained for future work, but no speech worker starts. Morning greetings use the game's dialogue during 06:00–09:00; the first later morning touch offers the game's going-out conversation once per day. This touch mapping is a desktop adaptation using the original dialogue and reply choices. Dialogue chains wait for each recording to finish, and head pats no longer schedule an extra random flirt line.

## Optional integrations and local data

| Location or service | What it is used for |
|---|---|
| `%APPDATA%\lilith-pet\` | Settings and profile answers, day/activity records, Electron local storage, and the stable Claude hook scripts. |
| `%USERPROFILE%\LilithRip\` | Extracted model, images, dialogue, voices, sound effects, and the rotating `lilith-pet.log`. |
| `%USERPROFILE%\.claude\settings.json` | Claude Code hook registration. An existing file is backed up as `settings.json.lilith-bak` before the first write. |
| `127.0.0.1:47824` | Default local Claude event receiver. |
| `http://127.0.0.1:11434` | Default Ollama endpoint. |

**Ollama:** chat sends the conversation and persona context to the configured endpoint. Claude completion summaries can also be sent there. A stopped local Ollama service may be started when you use chat. Changing `LILITH_OLLAMA` to another host sends that content to that host; the default loopback address is not a guarantee for a customized configuration.

**Claude Code:** the tray's Claude hook preference persists across launches. Hook events can include prompts, paths, command descriptions, and Claude's last reply. The Node hook trims events before sending them to the local receiver; Node.js on PATH is required, and a missing Node executable is reported instead of falling back to an untrimmed request. Hook scripts are stored under the app's user-data directory so app updates do not remove them. Registration replaces legacy Lilith hook entries and passes the configured `LILITH_PORT` to the hook command. `LILITH_NO_HOOK=1` prevents automatic registration on that launch. Candidate runtime verification is recorded separately in [Release preparation](docs/RELEASE.md).

**App awareness:** the Windows watcher reads foreground application information and window titles locally to classify activity and recognize private contexts. Day records use app names and times. The app-awareness switch disables those comments and recording of the current app name. Do not publish raw settings, copied logs, screenshots, extracted data, or hook backups: they may contain personal information.

The installer retains app data on uninstall. Quit Lilith and make your own backup before changing or removing saved data. 

## Build from source

Use Windows with Node.js, npm, and Python 3.12 (including the Windows `py` launcher). Release builds create an isolated build environment and bundle Python, UnityPy, and their runtime dependencies; end users do not install them. The pinned dependency list is in `scripts/extractor-requirements.txt`. Electron `45.2.1` and electron-builder `26.18.0` are pinned in `lilith-pet/package-lock.json`. The manual GitHub build workflow uses Node.js 24.

```bash
cd lilith-pet
npm ci
npm start
```

Prepare a local release candidate:

```bash
cd lilith-pet
npm run release:prepare
```

This command rebuilds both x64 executables with publishing disabled, checks the packaged runtime and source against the pinned inputs, and assembles an allowlisted source archive, manifests, release notes, and SHA-256 checksums under `release/v<package-version>/`. The build outputs also remain in `lilith-pet/dist/`. Building downloads Electron and packaging tools if they are not cached. The command does not upload anything; a successful build does not replace the manual checks in [Release preparation](docs/RELEASE.md).

Use the candidate's `SHA256SUMS.txt` and `BUILD_INFO.json` for exact artifact hashes and build information. The GitHub Actions workflow runs only when manually dispatched. It saves a candidate artifact for review and does not publish a GitHub release or run the automated test suite.

For DevTools, launch from Git Bash with:

```bash
LILITH_DEBUG=1 npm start
```

| Environment variable | Purpose |
|---|---|
| `LILITH_GAME` | Installed game folder containing `Lilith_Data`. |
| `LILITH_RIP` | Extracted-data and log directory. |
| `LILITH_PYTHON` | Python executable for source development; packaged builds use the bundled extractor. |
| `LILITH_OLLAMA` | Ollama base URL; default is loopback. |
| `LILITH_MODEL` | Ollama model name. |
| `LILITH_PORT` | Local Claude hook port; registration passes this value to its hook command. |
| `LILITH_NO_HOOK` | Any nonempty value prevents automatic Claude hook registration on launch. |

## Troubleshooting and reports

- **No character:** confirm the game is installed, then inspect the preparation message or log. The Windows build includes its own extraction runtime. Existing cached data can make a launch succeed without exercising first-time extraction.
- **Chat has no response:** check Ollama is installed, a chat model is downloaded, and the configured endpoint is reachable. Include whether the tray shows Ollama running.
- **Character is off-screen:** use Reset position and report the display scale, selected size, monitor arrangement, outfit, and preceding steps.
- **Need diagnostics:** Tray → Copy log includes versions and recent log output. Review it for private information before sharing.

For a useful issue, include the app version, setup version, Windows version, display scale, reproduction steps, expected behavior, actual behavior, and a cropped screenshot when appropriate. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Attribution and distribution status

This is an unofficial fan project, not affiliated with the game's developers or publisher. Buying or installing the game is not documented here as permission to redistribute its artwork or assets.

The project depends on Esoteric Software's Spine runtime under its [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license), with conditions referring to the [Spine Editor License Agreement](https://esotericsoftware.com/spine-editor-license). It is not an MIT-licensed dependency. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the included notices and outstanding distribution questions. The project's own package metadata remains `UNLICENSED` unless the rights holder chooses a source-code license. No new license grant is implied by this README.

### If Lilith is silent

Use **Settings → Voice → Test voice** in the tray menu. Select Japanese or Chinese if her voice is off. If there is no playback error but you hear nothing, check Windows mute, Volume mixer, and the selected output device. The game’s recorded lines have voices. Generated chat is text-only while AI speech is paused; setup notices also remain on-screen text.

Right-click Lilith for the compact dark Claude/GPT and music toolbar above her head. Other commands are in the tray menu. Escape or clicking another app closes the quick menu.






