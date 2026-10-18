import { GAME_CONFIG } from '../config/game';
import { FIXED_DT } from '../config/physics';
import { POWERUPS, type PowerUpsConfig } from '../config/powerups';
import { transition, type TransitionTable } from '../systems/StateMachine';
import { stepsFor } from './heroMotion';

/**
 * Formas do herói (F4). Os nomes e cores de cada forma vêm de creatures.json.
 * `small` morre com um toque; `big` aguenta um toque e quebra tijolos; os especiais também
 * são grandes e têm uma habilidade.
 */
export const FORMS = ['small', 'big', 'electric', 'surf', 'flying'] as const;
export type Form = (typeof FORMS)[number];

/** Formas que vêm de um item especial; o dano nelas volta para `big`. */
export const SPECIAL_FORMS = ['electric', 'surf', 'flying'] as const satisfies readonly Form[];
export type SpecialForm = (typeof SPECIAL_FORMS)[number];

/**
 * Efeito de cada item. `grow` faz o pequeno crescer; cada especial dá a forma de mesmo nome;
 * `star` dá a invencibilidade, por cima da forma atual.
 */
export const POWERS = ['grow', 'electric', 'surf', 'flying', 'star'] as const;
export type Power = (typeof POWERS)[number];

/**
 * Transições de forma. Pegar item: pequeno ou grande vira qualquer especial, e um especial
 * troca por outro. Dano: especial volta para grande e grande para pequeno (o pequeno morre).
 * Não se pula etapa no dano (especial → pequeno) nem se volta a pequeno por item.
 */
export const FORM_TRANSITIONS: TransitionTable<Form> = {
  small: ['big', 'electric', 'surf', 'flying'],
  big: ['small', 'electric', 'surf', 'flying'],
  electric: ['big', 'surf', 'flying'],
  surf: ['big', 'electric', 'flying'],
  flying: ['big', 'electric', 'surf'],
};

export interface PowerState {
  readonly form: Form;
  /** Passos de invencibilidade que ainda faltam; 0 = sem invencibilidade. */
  readonly starSteps: number;
}

/** Toda tentativa começa com o herói pequeno. */
export const START_POWER: PowerState = { form: 'small', starSteps: 0 };

export function isPower(value: unknown): value is Power {
  return POWERS.some((p) => p === value);
}

export function isSpecial(form: Form): form is SpecialForm {
  return SPECIAL_FORMS.some((f) => f === form);
}

/** Grande, ou num estado especial: aguenta um toque e quebra tijolos. */
export function isBig(form: Form): boolean {
  return form !== 'small';
}

export function hasStar(state: PowerState): boolean {
  return state.starSteps > 0;
}

/** Altura da caixa de colisão em cada forma. */
export function heroHeightFor(form: Form): number {
  return isBig(form) ? GAME_CONFIG.bigHeroHeight : GAME_CONFIG.heroHeight;
}

function changeForm(state: PowerState, to: Form): PowerState {
  const form = transition(FORM_TRANSITIONS, state.form, to);
  return form === state.form ? state : { ...state, form };
}

/**
 * Pega um item. A invencibilidade recomeça a contar do zero; `grow` só muda o pequeno;
 * um especial vale para qualquer forma. `changed` diz se algo mudou.
 */
export function collectPower(
  state: PowerState,
  power: Power,
  dt: number = FIXED_DT,
  c: PowerUpsConfig = POWERUPS,
): { state: PowerState; changed: boolean } {
  let next: PowerState;
  if (power === 'star') next = { ...state, starSteps: stepsFor(c.starTime, dt) };
  else if (power === 'grow') next = state.form === 'small' ? changeForm(state, 'big') : state;
  else next = changeForm(state, power);
  return { state: next, changed: next !== state };
}

/**
 * Dano (fora da invencibilidade): especial volta para grande, grande volta para pequeno, e o
 * pequeno morre. A invencibilidade de 1,5 s depois do dano fica em damage.ts.
 */
export function damagePower(state: PowerState): { state: PowerState; died: boolean } {
  if (state.form === 'small') return { state, died: true };
  return { state: changeForm(state, isSpecial(state.form) ? 'big' : 'small'), died: false };
}

/** Um passo fixo da invencibilidade. Ao acabar, o herói continua na forma que tinha. */
export function tickPower(state: PowerState): PowerState {
  return state.starSteps > 0 ? { ...state, starSteps: state.starSteps - 1 } : state;
}

/** O que sai do bloco: para o herói pequeno, um item especial vira o de crescer (como no SMW). */
export function blockRelease(form: Form, power: Power): Power {
  return form === 'small' && power !== 'grow' && power !== 'star' ? 'grow' : power;
}
