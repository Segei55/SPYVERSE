import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cacheDirectory = join(root, 'node_modules', '.cache');
await mkdir(cacheDirectory, { recursive: true });
const assetDirectory = await mkdtemp(join(cacheDirectory, 'spyverse-android-icons-'));
const assetPath = relative(root, assetDirectory);

try {
  await Promise.all([
    copyFile(join(root, 'icon.png'), join(assetDirectory, 'icon-only.png')),
    copyFile(join(root, 'icon.png'), join(assetDirectory, 'icon-foreground.png')),
    copyFile(join(root, 'icon.png'), join(assetDirectory, 'icon-background.png')),
  ]);

  const cli = join(root, 'node_modules', '@capacitor', 'assets', 'bin', 'capacitor-assets');
  const result = spawnSync(
    process.execPath,
    [cli, 'generate', '--android', '--assetPath', assetPath, '--androidProject', 'apps/mobile/android'],
    { cwd: root, encoding: 'utf8' }
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Android icon generation failed with exit code ${result.status ?? 'unknown'}.`);
  }
  if (!output.includes('ic_launcher_foreground.png') || !output.includes('ic_launcher_background.png')) {
    throw new Error('Android adaptive launcher icons were not generated.');
  }
  await access(join(root, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res', 'mipmap-mdpi', 'ic_launcher.png'));
  await access(join(root, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res', 'mipmap-mdpi', 'ic_launcher_foreground.png'));
} finally {
  await rm(assetDirectory, { recursive: true, force: true });
}
