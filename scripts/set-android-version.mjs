import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) {
  throw new Error(`Expected a stable semantic version in package.json, got ${version}`);
}

const [, majorText, minorText, patchText] = match;
const [major, minor, patch] = [majorText, minorText, patchText].map(Number);
const versionCode = major * 1_000_000 + minor * 1_000 + patch;
const gradleFile = resolve(root, 'apps/mobile/android/app/build.gradle');
const gradle = await readFile(gradleFile, 'utf8');

if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+"[^"]+"/.test(gradle)) {
  throw new Error(`Android version fields were not found in ${gradleFile}`);
}

const updatedGradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
await writeFile(gradleFile, updatedGradle);
console.log(`Android version set to ${version} (versionCode ${versionCode}).`);
