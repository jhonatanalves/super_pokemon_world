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

/** Caixa de reserva do HUD (F4b): guarda 1 item, ou está vazia. */
export type Reserve = Power | null;

/**
 * Pega um item. A invencibilidade recomeça a contar do zero; `grow` só muda o pequeno;
 * um especial vale para qualquer forma. `changed` diz se a forma ou a invencibilidade mudou.
 *
 * Reserva (F4b): o item que não muda a forma vai para a reserva, e o especial trocado por
 * outro também; com a reserva cheia, o que iria para ela é perdido (não substitui o
 * guardado). A invencibilidade nunca vai para a reserva.
 */
export function collectPower(
  state: PowerState,
  power: Power,
  reserve: Reserve = null,
  dt: number = FIXED_DT,
  c: PowerUpsConfig = POWERUPS,
): { state: PowerState; reserve: Reserve; changed: boolean } {
  if (power === 'star') {
    return { state: { ...state, starSteps: stepsFor(c.starTime, dt) }, reserve, changed: true };
  }
  const next =
    power === 'grow'
      ? state.form === 'small'
        ? changeForm(state, 'big')
        : state
      : changeForm(state, power);
  const changed = next !== state;
  // O que sobra: o próprio item, se não mudou nada, ou o especial que foi trocado.
  const leftover: Reserve = !changed ? power : isSpecial(state.form) ? state.form : null;
  return { state: next, reserve: reserve ?? leftover, changed };
}

/**
 * Ativa a reserva (tecla própria): aplica o item guardado. Se ele não mudaria nada, continua
 * guardado; se a forma trocada era especial, ela vai para a reserva, que acabou de esvaziar.
 */
export function useReserve(
  state: PowerState,
  reserve: Reserve,
  dt: number = FIXED_DT,
  c: PowerUpsConfig = POWERUPS,
): { state: PowerState; reserve: Reserve } {
  if (reserve === null) return { state, reserve };
  const used = collectPower(state, reserve, null, dt, c);
  return used.changed ? { state: used.state, reserve: used.reserve } : { state, reserve };
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
