# Contributing

This project is being prepared for `nuttyuwu/lilith-desktop`. Public contributions and releases depend on resolving the licensing and publication requirements in [docs/RELEASE.md](docs/RELEASE.md). The package is currently marked `UNLICENSED`; no source-code license grant is implied.

## Report a bug

Include:

1. App version, Windows version, and whether you used the installer, portable executable, or source.
2. Display scale, selected character size, monitor arrangement, taskbar position, and outfit.
3. Numbered reproduction steps, expected behavior, actual behavior, and frequency.
4. A cropped screenshot or recording and relevant log lines, with private information removed.

Use Tray → Copy log for diagnostics. Review the text before posting: paths, usernames, application activity, and integration details can identify you or your work. Do not upload complete `%APPDATA%\lilith-pet`, `%USERPROFILE%\LilithRip`, Claude settings, or desktop screenshots containing private messages or documents.

## Work on the code

Start with [README.md](README.md) for Windows prerequisites and build commands. Keep extracted game assets on your machine; do not commit them. Keep source changes focused and explain the user-visible behavior they change.

For movement changes, check both work-area edges, restored settings, every affected size, walking, dragging/dropping, window following, and intentional tucking. Report the exact build and display scale. For integration changes, state which local or remote endpoint received data and what you observed; check persisted preferences, hook registration, custom ports, and missing dependencies when affected. Preserve the resource-path containment, trusted-main-frame IPC, and navigation restrictions when changing renderer access.

No automated tests or existing test suite were run for the current preparation session. Verification used manual regression under the maintainer's instruction, code review, and release-content inspection; document actual checks rather than inferred results. Consult the candidate record in [docs/RELEASE.md](docs/RELEASE.md) before treating any behavior as verified.

Use `npm run release:prepare` from `lilith-pet` to assemble a candidate. It rebuilds both executables before creating the allowlisted source archive and checksums; it does not publish. The Windows GitHub Actions workflow is manually dispatched and saves an artifact for review. Packaging and syntax checks are separate from observed application behavior.

## Pull requests

Describe the bug or requested behavior, the resulting behavior, and the verification performed. List checks you could not perform. Keep machine-specific logs and screenshots out of commits; sanitized examples belong in the issue or review only when necessary.

Do not introduce third-party artwork, game data, dependencies, or copied code without recording their provenance and applicable license. Do not add a source-code license on behalf of a rights holder without authorization.
