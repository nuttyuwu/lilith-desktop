# Lilith delivery preference

For this project, the user authorized publishing future minor fixes through the setup updater (November 2, 2026). Unless a later instruction holds publishing:

- Finish minor fixes with a patch version bump and appropriate validation.
- Build using scripts/prepare-release.cjs.
- Push source, then publish a stable GitHub release marked latest with the setup installer and SHA256SUMS.txt.
- Verify the public latest-release endpoint and installer checksum.
- Never commit EXEs or attach a standalone Lilith.exe. Setup installs Lilith.exe locally.
- Report checks honestly; do not describe unobserved visual or installation checks as passed.

See docs/RELEASE.md for validation history and limitations.
