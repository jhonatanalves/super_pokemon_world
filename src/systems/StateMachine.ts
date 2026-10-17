/** Para cada estado, os estados que podem vir em seguida. Ficar no mesmo estado é sempre válido. */
export type TransitionTable<S extends string> = { readonly [K in S]: readonly S[] };

export function canTransition<S extends string>(
  table: TransitionTable<S>,
  from: S,
  to: S,
): boolean {
  return from === to || table[from].includes(to);
}

/** Devolve o novo estado se a transição for permitida; senão ignora e mantém o atual. */
export function transition<S extends string>(table: TransitionTable<S>, from: S, to: S): S {
  return canTransition(table, from, to) ? to : from;
}
