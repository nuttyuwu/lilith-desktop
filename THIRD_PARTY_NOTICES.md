# Third-party notices

## Game character and artwork

Lilith, the game character assets, and the game-derived face icon belong to their original rights holders. This is an unofficial fan project. The app reads animation, textures, audio, and dialogue from the player's installed copy of *The NOexistenceN of Lilith*; those extracted resources are excluded from the source archive and Windows packages.

The current local candidate includes a portrait icon copied from the game. Redistribution permission for that icon is not established by this repository. Public publication remains pending that decision.

## Spine runtime

`@esotericsoftware/spine-webgl` and `@esotericsoftware/spine-core` are version 4.2.43 and use the Spine Runtimes License, not the project's license. The exact copyright and license notices shipped with these packages remain in their `LICENSE` files in the application dependencies. Preserve them when distributing a build.

Integration and distribution are subject to the [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license) and the referenced [Spine Editor License Agreement](https://esotericsoftware.com/spine-editor-license). A copy of the notice does not establish the developer's license entitlement. The applicable distribution basis is pending confirmation for this candidate.

## Electron and other dependencies

Electron and its bundled components carry their own licenses. Retain `LICENSE.electron.txt`, `LICENSES.chromium.html`, and dependency license files included by the packager. The lockfile records the exact build dependencies; their licenses do not grant rights to the game's artwork or to the project's own code.

Windows builds include a private Python extraction runtime built with PyInstaller. UnityPy is pinned to 1.25.4; the complete dependency versions are recorded in scripts/extractor-requirements.txt. Python and installed package notices are retained under resources/extractor/notices. Bundling the extraction tool does not bundle the game model, dialogue, textures, or audio.

## Project source

No open-source license has been selected for this project's own implementation. `UNLICENSED` in package metadata records that absence; it does not replace or override any third-party license. Publication and source licensing decisions are recorded in [Release preparation](docs/RELEASE.md).
