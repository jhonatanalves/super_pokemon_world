import { describe, expect, it } from 'vitest';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { HERO_STATES, HERO_TRANSITIONS, type HeroState } from '../src/logic/heroStates';
import { canTransition, transition, type TransitionTable } from '../src/systems/StateMachine';
import { standing } from './helpers/flatFloor';

describe('máquina de estados genérica', () => {
  type Test = 'a' | 'b' | 'c';
  const table: TransitionTable<Test> = { a: ['b'], b: ['c'], c: [] };

  it('aceita transições da tabela e ficar no mesmo estado', () => {
    expect(transition(table, 'a', 'b')).toBe('b');
    expect(transition(table, 'c', 'c')).toBe('c');
  });

  it('ignora transições fora da tabela e mantém o estado atual', () => {
    expect(canTransition(table, 'a', 'c')).toBe(false);
    expect(transition(table, 'a', 'c')).toBe('a');
  });
});

describe('estados do herói (F1-A10)', () => {
  it('rejeita transições inválidas', () => {
    // Agachar ou derrapar no ar, pousar ainda subindo, derrapar parado.
    const invalid: [HeroState, HeroState][] = [
      ['jump', 'crouch'],
      ['jump', 'skid'],
      ['jump', 'idle'],
      ['jump', 'walk'],
      ['jump', 'run'],
      ['idle', 'skid'],
    ];
    for (const [from, to] of invalid) {
      expect(canTransition(HERO_TRANSITIONS, from, to)).toBe(false);
      expect(transition(HERO_TRANSITIONS, from, to)).toBe(from);
    }
  });

  it('a tabela só cita estados conhecidos', () => {
    for (const from of HERO_STATES) {
      for (const to of HERO_TRANSITIONS[from]) expect(HERO_STATES).toContain(to);
    }
  });

  it('uma sequência de comandos passa por todos os estados só com transições válidas', () => {
    const script: [HeroInput, number][] = [
      [NO_INPUT, 0.2],
      [{ ...NO_INPUT, right: true }, 0.5],
      [{ ...NO_INPUT, right: true, run: true }, 2],
      [{ ...NO_INPUT, left: true }, 0.3],
      [{ ...NO_INPUT, left: true, down: true }, 0.3],
      [NO_INPUT, 0.3],
      [{ ...NO_INPUT, jump: true }, 1],
      [{ ...NO_INPUT, right: true, jump: true }, 0.1],
      [{ ...NO_INPUT, left: true }, 1],
      [{ ...NO_INPUT, down: true, jump: true }, 1],
    ];
    const floor = standing();
    const visited = new Set<HeroState>([floor.motion.state]);
    let previous = floor.motion.state;
    for (const [input, seconds] of script) {
      for (const m of floor.hold(input, stepsFor(seconds))) {
        expect(canTransition(HERO_TRANSITIONS, previous, m.state)).toBe(true);
        visited.add(m.state);
        previous = m.state;
      }
    }
    expect([...visited].sort()).toEqual([...HERO_STATES].sort());
  });
});
