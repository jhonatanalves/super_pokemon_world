import { FORMS, isPower, type Form, type Power } from './powerups';

/**
 * Leitura de src/content/creatures.json: inimigos (por tipo de objeto do Tiled: nome,
 * comportamento e cor provisória), formas do herói (F4) e itens de power-up (F4).
 * Nomes de Pokémon e de itens só existem lá.
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

/** Nome e cor provisória de cada forma do herói. */
export interface FormInfo {
  readonly name: string;
  readonly color: number;
}

export type FormCatalog = { readonly [F in Form]: FormInfo };

/** Item de power-up: o tipo do Tiled (e do `content` dos blocos) diz o efeito. */
export interface ItemInfo {
  readonly name: string;
  readonly power: Power;
  readonly color: number;
}

/** Itens por tipo de objeto do Tiled. */
export type ItemCatalog = ReadonlyMap<string, ItemInfo>;

export interface GameContent {
  readonly creatures: Creatures;
  readonly forms: FormCatalog;
  readonly items: ItemCatalog;
}

type Json = Record<string, unknown>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function fail(message: string): never {
  throw new Error(`creatures.json inválido: ${message}`);
}

function section(raw: Json, key: string): Json {
  const value = raw[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`"${key}" não é um objeto`);
  }
  return value as Json;
}

/** Campos comuns: nome não vazio e cor #rrggbb. */
function entry(where: string, value: unknown): { fields: Json; name: string; color: number } {
  if (typeof value !== 'object' || value === null) fail(`${where} não é um objeto`);
  const fields = value as Json;
  const { name, color } = fields;
  if (typeof name !== 'string' || name === '') fail(`${where} sem "name"`);
  if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
    fail(`${where}: "color" precisa ser #rrggbb`);
  }
  return { fields, name, color: parseInt(color.slice(1), 16) };
}

function isBehavior(value: unknown): value is Behavior {
  return BEHAVIORS.some((b) => b === value);
}

function parseEnemies(raw: Json): Creatures {
  const result = new Map<string, Creature>();
  for (const [type, value] of Object.entries(raw)) {
    const { fields, name, color } = entry(`"${type}"`, value);
    if (!isBehavior(fields.behavior)) {
      fail(`"${type}": "behavior" precisa ser um de ${BEHAVIORS.join(', ')}`);
    }
    result.set(type, { name, behavior: fields.behavior, color });
  }
  return result;
}

function parseForms(raw: Json): FormCatalog {
  const unknown = Object.keys(raw).filter((k) => !FORMS.some((f) => f === k));
  if (unknown.length > 0) fail(`forma desconhecida em "heroForms": ${unknown.join(', ')}`);
  const read = (form: Form): FormInfo => {
    const { name, color } = entry(`forma "${form}"`, raw[form]);
    return { name, color };
  };
  return {
    small: read('small'),
    big: read('big'),
    electric: read('electric'),
    surf: read('surf'),
    flying: read('flying'),
  };
}

function parseItems(raw: Json): ItemCatalog {
  const result = new Map<string, ItemInfo>();
  for (const [type, value] of Object.entries(raw)) {
    const { fields, name, color } = entry(`item "${type}"`, value);
    if (!isPower(fields.power)) fail(`item "${type}": "power" desconhecido`);
    result.set(type, { name, power: fields.power, color });
  }
  return result;
}

export function parseContent(raw: unknown): GameContent {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('não é um objeto');
  const json = raw as Json;
  return {
    creatures: parseEnemies(section(json, 'enemies')),
    forms: parseForms(section(json, 'heroForms')),
    items: parseItems(section(json, 'items')),
  };
}

/** Cor de cada efeito, do primeiro item que o dá; para desenhar o item solto por um bloco. */
export function powerColor(items: ItemCatalog, power: Power): number | null {
  for (const item of items.values()) if (item.power === power) return item.color;
  return null;
}
