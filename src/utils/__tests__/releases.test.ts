import test from 'node:test';
import assert from 'node:assert/strict';
import { getReleaseDownloads, type LatestRelease } from '../releases';

test('getReleaseDownloads recognizes Windows assets from electron-builder', () => {
  const release: LatestRelease = {
    version: '1.1.1',
    tag: 'v1.1.1',
    url: 'https://github.com/Segei55/SPYVERSE/releases/tag/v1.1.1',
    assets: [
      { name: 'SPYVERSE.Setup.1.1.1.exe', url: 'https://example.com/installer.exe' },
      { name: 'SPYVERSE.Setup.1.1.1.exe.blockmap', url: 'https://example.com/installer.blockmap' },
      { name: 'SPYVERSE.1.1.1.exe', url: 'https://example.com/portable.exe' },
      { name: 'SPYVERSE-1.1.1.AppImage', url: 'https://example.com/appimage' },
      { name: 'spyverse_1.1.1_amd64.deb', url: 'https://example.com/deb' },
      { name: 'SPYVERSE-android-1.1.1.apk', url: 'https://example.com/android' },
    ],
  };

  assert.deepEqual(getReleaseDownloads(release), {
    windows: {
      installer: 'https://example.com/installer.exe',
      portable: 'https://example.com/portable.exe',
    },
    linux: {
      appImage: 'https://example.com/appimage',
      deb: 'https://example.com/deb',
    },
    android: 'https://example.com/android',
  });
});

test('getReleaseDownloads recognizes a portable executable without a separator', () => {
  const release: LatestRelease = {
    version: '1.0.0',
    tag: 'v1.0.0',
    url: 'https://github.com/Segei55/SPYVERSE/releases/tag/v1.0.0',
    assets: [
      { name: 'SPYVERSE.Setup.1.0.0.exe', url: 'https://example.com/installer.exe' },
      { name: 'SPYVERSE1.0.0.exe', url: 'https://example.com/portable.exe' },
    ],
  };

  assert.equal(getReleaseDownloads(release).windows.portable, 'https://example.com/portable.exe');
});

test('getReleaseDownloads recognizes updater and legacy Windows asset names', () => {
  const release: LatestRelease = {
    version: '1.1.1',
    tag: 'v1.1.1',
    url: 'https://github.com/Segei55/SPYVERSE/releases/tag/v1.1.1',
    assets: [
      { name: 'SPYVERSE-Setup-1.1.1.exe', url: 'https://example.com/updater-installer.exe' },
      { name: 'SPYVERSE Setup 1.1.1.exe', url: 'https://example.com/legacy-installer.exe' },
      { name: 'SPYVERSE 1.1.1.exe', url: 'https://example.com/portable.exe' },
    ],
  };

  assert.deepEqual(getReleaseDownloads(release).windows, {
    installer: 'https://example.com/updater-installer.exe',
    portable: 'https://example.com/portable.exe',
  });
});
