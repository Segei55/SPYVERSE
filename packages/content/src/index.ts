import { LocationPack, LocationPackSchema } from '../../shared/src/index';
import { OFFICIAL_PACKS } from './packs';

export { OFFICIAL_PACKS };

export interface PackValidationResult {
  success: boolean;
  pack?: LocationPack;
  errors?: string[];
}

/**
 * Validates a pack against schema and business rules (e.g. unique locations, valid role counts)
 */
export function validatePack(data: unknown): PackValidationResult {
  const parseResult = LocationPackSchema.safeParse(data);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return { success: false, errors: errorMessages };
  }

  const pack = parseResult.data as LocationPack;
  const duplicateErrors: string[] = [];

  const locationNames = new Set<string>();
  for (const loc of pack.locations) {
    const normalized = loc.name.trim().toLowerCase();
    if (locationNames.has(normalized)) {
      duplicateErrors.push(`Повторяющееся название локации: «${loc.name}»`);
    }
    locationNames.add(normalized);

    const roleNames = new Set<string>();
    for (const role of loc.roles) {
      const normRole = role.trim().toLowerCase();
      if (roleNames.has(normRole)) {
        duplicateErrors.push(`Повторяющаяся роль «${role}» в локации «${loc.name}»`);
      }
      roleNames.add(normRole);
    }
  }

  if (duplicateErrors.length > 0) {
    return { success: false, errors: duplicateErrors, pack };
  }

  return { success: true, pack };
}

/**
 * Safely parse and import JSON content as a LocationPack
 */
export function importPackFromJSON(jsonStr: string): PackValidationResult {
  try {
    const parsed = JSON.parse(jsonStr);
    return validatePack(parsed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Некорректный синтаксис JSON';
    return {
      success: false,
      errors: [`Ошибка парсинга файла: ${msg}`],
    };
  }
}

/**
 * Export LocationPack to formatted JSON string
 */
export function exportPackToJSON(pack: LocationPack): string {
  return JSON.stringify(pack, null, 2);
}

/**
 * Find pack by ID among official packs and provided custom packs
 */
export function findPackById(packId: string, customPacks: LocationPack[] = []): LocationPack | undefined {
  const all = [...OFFICIAL_PACKS, ...customPacks];
  return all.find((p) => p.id === packId);
}

export function mergeLocationPacks(packs: LocationPack[]): LocationPack | undefined {
  if (packs.length === 0) return undefined;
  if (packs.length === 1) return packs[0];

  return {
    ...packs[0],
    id: 'selected_packs',
    name: `Выбрано наборов: ${packs.length}`,
    description: 'Объединение выбранных наборов локаций.',
    locations: packs.flatMap((pack) => pack.locations),
  };
}
