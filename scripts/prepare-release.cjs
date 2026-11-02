'use strict';

// Assemble a local candidate from an allowlist. This script never uploads or publishes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'lilith-pet');
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) throw new Error('Invalid release version');
// Always build the setup here; unpacked files alone cannot prove EXE freshness.
const buildEnv = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  ELECTRON_BUILDER_CACHE: path.join(appDir, 'node_modules', '.cache', 'electron-builder'),
};
delete buildEnv.ELECTRON_RUN_AS_NODE;
const extractorBuild = spawnSync('py', ['-3.12', path.join(root, 'scripts', 'build-extractor.py')], {
  cwd: root, env: buildEnv, stdio: 'inherit', windowsHide: true,
});
if (extractorBuild.error || extractorBuild.status !== 0) throw new Error('Bundled extractor build failed');
const build = spawnSync(process.execPath, [
  require.resolve('electron-builder/cli.js', { paths: [appDir] }),
  '--win', 'nsis', '--x64', '--publish', 'never',
], { cwd: appDir, env: buildEnv, stdio: 'inherit', windowsHide: true });
if (build.error || build.status !== 0) throw new Error(`Windows build failed: ${build.error?.message || build.status}`);
const packedDir = path.join(appDir, 'dist', 'win-unpacked', 'resources', 'app');
const packedPkg = JSON.parse(fs.readFileSync(path.join(packedDir, 'package.json'), 'utf8'));
if (packedPkg.version !== pkg.version) throw new Error('Rebuild the Windows packages before preparing this candidate');
if (JSON.stringify(packedPkg.dependencies) !== JSON.stringify(pkg.dependencies)) throw new Error('Packaged runtime dependencies are stale');

const sourceFiles = [
  'AGENTS.md', '.gitignore', '.gitattributes', '.github/workflows/windows-build.yml',
  'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md', 'docs/RELEASE.md',
  'docs/images/lilith-hero.png', 'docs/images/lilith-greeting.png', 'docs/images/lilith-chat.png',
  'docs/images/lilith-in-action.gif',
  'extract_lilith.py', 'lilith_text.py', 'scripts/prepare-release.cjs',
  'scripts/build-extractor.py', 'scripts/extractor-notices.py', 'scripts/extractor-requirements.txt',
  'lilith-pet/index.html', 'lilith-pet/package.json', 'lilith-pet/package-lock.json',
  'lilith-pet/icon.png', 'lilith-pet/build/icon.ico',
  'lilith-pet/build/installer.nsh', 'lilith-pet/build/update.ps1',
  'lilith-pet/qwen-worker.py', 'lilith-pet/qwen-download.py',
  ...fs.readdirSync(path.join(appDir, 'voices')).map(name => `lilith-pet/voices/${name}`),
  ...fs.readdirSync(appDir).filter(name => /\.(?:js|ps1)$/.test(name)).map(name => `lilith-pet/${name}`),
].sort();
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const regularFile = file => {
  if (!fs.lstatSync(file).isFile()) throw new Error(`Expected a regular file: ${path.relative(root, file)}`);
};

// Prevent stale runtime source from being silently paired with newly edited documentation.
for (const relative of sourceFiles.filter(file => /^lilith-pet\/[^/]+\.(?:js|ps1|html|png)$/.test(file))) {
  const source = path.join(root, relative);
  const packed = path.join(packedDir, path.basename(relative));
  regularFile(source);
  regularFile(packed);
  if (hash(source) !== hash(packed)) throw new Error(`Packaged file is stale: ${relative}`);
}
const resourcesDir = path.dirname(packedDir);
function verifyResource(source, packed) {
  if (fs.lstatSync(source).isDirectory()) {
    if (!fs.lstatSync(packed).isDirectory()) throw new Error(`Missing resource directory: ${packed}`);
    const entries = fs.readdirSync(source).sort();
    if (JSON.stringify(entries) !== JSON.stringify(fs.readdirSync(packed).sort())) throw new Error(`Resource directory differs: ${packed}`);
    for (const name of entries) verifyResource(path.join(source, name), path.join(packed, name));
    return;
  }
  regularFile(source);
  regularFile(packed);
  if (hash(source) !== hash(packed)) throw new Error(`Packaged extra resource is stale: ${packed}`);
}
for (const resource of pkg.build.extraResources) {
  const source = path.resolve(appDir, resource.from), packed = path.join(resourcesDir, resource.to);
  verifyResource(source, packed);
}
const lock = JSON.parse(fs.readFileSync(path.join(appDir, 'package-lock.json'), 'utf8'));
const supports = (values, target) => !values || (!values.includes(`!${target}`) && (!values.some(value => !value.startsWith('!')) || values.includes(target)));
for (const [relative, metadata] of Object.entries(lock.packages)) {
  if (!relative.startsWith('node_modules/') || metadata.dev || metadata.devOptional) continue;
  if (metadata.optional && (!supports(metadata.os, 'win32') || !supports(metadata.cpu, 'x64'))) continue;
  const file = path.join(packedDir, relative, 'package.json');
  regularFile(file);
  if (JSON.parse(fs.readFileSync(file, 'utf8')).version !== metadata.version) throw new Error(`Packaged dependency is stale: ${relative}`);
}
// Read the actual packaged runtime's version metadata, without starting the pet.
const runtime = spawnSync(path.join(appDir, 'dist', 'win-unpacked', 'Lilith.exe'), ['-p', 'process.versions.electron'], {
  windowsHide: true, encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 10000,
});
if (runtime.error || runtime.status !== 0 || runtime.stdout.trim() !== pkg.devDependencies.electron) {
  throw new Error('Packaged Electron runtime does not match the pinned dependency');
}

const releaseRoot = path.join(root, 'release');
fs.mkdirSync(releaseRoot, { recursive: true });
const stageParent = fs.mkdtempSync(path.join(releaseRoot, '.stage-'));
const stage = path.join(stageParent, 'lilith-desktop');
const output = path.join(releaseRoot, `v${pkg.version}`);
fs.mkdirSync(output, { recursive: true });

const manifest = [];
for (const relative of sourceFiles) {
  const from = path.join(root, relative), to = path.join(stage, relative);
  regularFile(from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  manifest.push({ path: relative, sha256: hash(to), bytes: fs.statSync(to).size });
}
const sourceArchive = `lilith-desktop-${pkg.version}-source.tar.gz`;
const archive = spawnSync('tar', ['-czf', sourceArchive, '-C', stageParent, 'lilith-desktop'], {
  cwd: output, windowsHide: true, encoding: 'utf8',
});
if (archive.error || archive.status !== 0) throw new Error(`Source archive failed: ${archive.error?.message || archive.stderr}`);

const assetNames = [`Lilith.Setup.${pkg.version}.exe`];
for (const name of assetNames) {
  const from = path.join(appDir, 'dist', `Lilith Setup ${pkg.version}.exe`);
  regularFile(from);
  fs.copyFileSync(from, path.join(output, name));
}
const assets = [...assetNames, sourceArchive].map(name => ({
  name, bytes: fs.statSync(path.join(output, name)).size, sha256: hash(path.join(output, name)),
}));
fs.writeFileSync(path.join(output, 'SOURCE_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'BUILD_INFO.json'), JSON.stringify({
  product: 'Lilith Desktop', version: pkg.version, repository: 'nuttyuwu/lilith-desktop',
  createdUtc: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
  electron: pkg.devDependencies.electron, electronBuilder: pkg.devDependencies['electron-builder'],
  signed: false, publication: 'local candidate; see docs/RELEASE.md for outstanding publication decisions', assets,
}, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'CHANGELOG.md'), path.join(output, 'RELEASE_NOTES.md'));
const checksumNames = [...assets.map(asset => asset.name), 'SOURCE_MANIFEST.json', 'BUILD_INFO.json', 'RELEASE_NOTES.md'];
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), checksumNames.map(name => `${hash(path.join(output, name))}  ${name}`).join('\n') + '\n');
console.log(`Local candidate: ${output}`);
console.log(`Allowlisted source: ${stage}`);
console.log('No upload or publication was performed.');
