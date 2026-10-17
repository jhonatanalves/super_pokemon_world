/** Sala descrita em texto: uma string por linha de tiles. */
export const ROOM_CHARS = {
  empty: '.',
  solid: '#',
  spawn: 'S',
} as const;

export interface TilePos {
  readonly col: number;
  readonly row: number;
}

export interface Room {
  readonly cols: number;
  readonly rows: number;
  /** solid[row][col] */
  readonly solid: readonly (readonly boolean[])[];
  readonly spawn: TilePos;
}

export function parseRoom(lines: readonly string[]): Room {
  if (lines.length === 0) throw new Error('Sala vazia');
  const cols = lines[0].length;
  const spawns: TilePos[] = [];

  const solid = lines.map((line, row) => {
    if (line.length !== cols) {
      throw new Error(`Linha ${row} da sala tem ${line.length} colunas; esperado ${cols}`);
    }
    return [...line].map((char, col) => {
      if (char === ROOM_CHARS.spawn) spawns.push({ col, row });
      else if (char !== ROOM_CHARS.empty && char !== ROOM_CHARS.solid) {
        throw new Error(`Caractere desconhecido "${char}" na sala (linha ${row}, coluna ${col})`);
      }
      return char === ROOM_CHARS.solid;
    });
  });

  if (spawns.length !== 1) {
    throw new Error(
      `A sala precisa de exatamente 1 início "${ROOM_CHARS.spawn}"; tem ${spawns.length}`,
    );
  }
  return { cols, rows: lines.length, solid, spawn: spawns[0] };
}

/** Linha do primeiro tile sólido de cima para baixo na coluna (o piso visto de cima). */
export function surfaceRow(room: Room, col: number): number {
  const row = room.solid.findIndex((line) => line[col]);
  if (row < 0) throw new Error(`Coluna ${col} da sala não tem chão`);
  return row;
}
