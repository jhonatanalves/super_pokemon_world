/**
 * Leitura de src/content/creatures.json: para cada tipo de objeto do Tiled, o nome, o
 * comportamento (qual classe de inimigo) e a cor provisória. Nomes de Pokémon só existem lá.
 */

export const BEHAVIORS = ['walker', 'shell', 'flyer', 'piper', 'dropper'] as const;
export type Behavior = (typeof BEHAVIORS)[number];

export interface Creature {
  readonly name: string;
  readonly behavior: Behavior;
  /** Cor do retângulo provisório (até os sprites da F7). */
  readonly color: number;
}

/** Criaturas por tipo de objeto do Tiled. */
export type Creatures = ReadonlyMap<string, Creature>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function fail(message: string): never {
  throw new Error(`creatures.json inválido: ${message}`);
}

function isBehavior(value: unknown): value is Behavior {
  return BEHAVIORS.some((b) => b === value);
}

export function parseCreatures(raw: unknown): Creatures {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('não é um objeto');
  const result = new Map<string, Creature>();
  for (const [type, value] of Object.entries(raw)) {
    if (typeof value !== 'object' || value === null) fail(`"${type}" não é um objeto`);
    const { name, behavior, color } = value as Record<string, unknown>;
    if (typeof name !== 'string' || name === '') fail(`"${type}" sem "name"`);
    if (!isBehavior(behavior)) {
      fail(`"${type}": "behavior" precisa ser um de ${BEHAVIORS.join(', ')}`);
    }
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
      fail(`"${type}": "color" precisa ser #rrggbb`);
    }
    result.set(type, { name, behavior, color: parseInt(color.slice(1), 16) });
  }
  return result;
}
