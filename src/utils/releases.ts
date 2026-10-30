export interface ReleaseAsset {
  name: string;
  url: string;
}

export interface LatestRelease {
  version: string;
  tag: string;
  url: string;
  assets: ReleaseAsset[];
}

const RELEASE_API_URL = 'https://api.github.com/repos/Segei55/SPYVERSE/releases/latest';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRelease(value: unknown): LatestRelease {
  if (!isRecord(value) || typeof value.tag_name !== 'string' || typeof value.html_url !== 'string') {
    throw new Error('GitHub вернул некорректные данные о релизе.');
  }

  const version = value.tag_name.replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Некорректная версия релиза: ${value.tag_name}`);
  }

  const assets = Array.isArray(value.assets)
    ? value.assets.flatMap((asset): ReleaseAsset[] => {
        if (!isRecord(asset) || typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') {
          return [];
        }
        try {
          const url = new URL(asset.browser_download_url);
          return url.protocol === 'https:' ? [{ name: asset.name, url: url.href }] : [];
        } catch {
          return [];
        }
      })
    : [];

  return { version, tag: value.tag_name, url: value.html_url, assets };
}

export async function fetchLatestRelease(): Promise<LatestRelease> {
  const response = window.electronAPI
    ? await window.electronAPI.getLatestRelease()
    : await (async () => {
        const result = await fetch(RELEASE_API_URL, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!result.ok) {
          throw new Error(result.status === 404
            ? 'Публичных релизов SPYVERSE пока нет.'
            : `GitHub вернул ошибку ${result.status} при загрузке релиза.`);
        }
        return result.json();
      })();

  return parseRelease(response);
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (version: string) => {
    const match = version.replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
    if (!match) throw new Error(`Некорректный номер версии: ${version}`);
    return {
      numbers: match.slice(1, 4).map(Number),
      prerelease: match[4]?.split('.'),
    };
  };

  const latest = parse(candidate);
  const installed = parse(current);
  for (let index = 0; index < latest.numbers.length; index++) {
    if (latest.numbers[index] !== installed.numbers[index]) {
      return latest.numbers[index] > installed.numbers[index];
    }
  }
  if (!latest.prerelease || !installed.prerelease) {
    return Boolean(installed.prerelease) && !latest.prerelease;
  }
  for (let index = 0; index < Math.max(latest.prerelease.length, installed.prerelease.length); index++) {
    const latestPart = latest.prerelease[index];
    const installedPart = installed.prerelease[index];
    if (latestPart === undefined || installedPart === undefined) return latestPart !== undefined;
    if (latestPart === installedPart) continue;

    const latestIsNumeric = /^\d+$/.test(latestPart);
    const installedIsNumeric = /^\d+$/.test(installedPart);
    if (latestIsNumeric && installedIsNumeric) return Number(latestPart) > Number(installedPart);
    if (latestIsNumeric !== installedIsNumeric) return !latestIsNumeric;
    return latestPart > installedPart;
  }
  return false;
}

export function getReleaseDownloads(release: LatestRelease) {
  const getAsset = (matches: (name: string) => boolean) =>
    release.assets.find((asset) => matches(asset.name))?.url;
  const windowsExecutables = release.assets.filter(
    (asset) => /^SPYVERSE(?=[ ._-\d]|$)/i.test(asset.name) && /\.exe$/i.test(asset.name)
  );
  const normalizeWindowsName = (name: string) =>
    name.replace(/\.exe$/i, '').replace(/[._-]+/g, ' ').trim().toLowerCase();
  const isWindowsInstaller = (name: string) =>
    /^spyverse\s+setup(?:\s|$)/.test(normalizeWindowsName(name));

  return {
    windows: {
      installer: windowsExecutables.find((asset) => isWindowsInstaller(asset.name))?.url,
      portable: windowsExecutables.find((asset) => !isWindowsInstaller(asset.name))?.url,
    },
    linux: {
      appImage: getAsset((name) => /\.AppImage$/i.test(name)),
      deb: getAsset((name) => /\.deb$/i.test(name)),
    },
    android: getAsset((name) => /\.apk$/i.test(name)),
  };
}
