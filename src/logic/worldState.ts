import { createEnemy } from '../entities/EntityFactory';
import type { Enemy } from '../entities/enemies/Enemy';
import { createPlacedItem, type PowerItem } from '../entities/items/PowerItem';
import { createKey, type Key } from '../entities/items/Key';
import { createMount, type Mount } from '../entities/mounts/Mount';
import type { Shot, Spark } from './attacks';
import { parseBlock, withBlocks, type Block } from './blocks';
import type { Carried } from './carry';
import type { GameContent } from './creatures';
import { NOT_HURT, type HurtState } from './damage';
import type { GameEvent } from './events';
import { isExitObject, parseExits, type LevelClear } from './goal';
import { createHeroBody, type HeroBody } from './heroBody';
import { parseCheckpoint, parseItem, type Checkpoint, type Item } from './items';
import { objectFoot, type Level, type Point } from './level';
import { hasStar, heroHeightFor, START_POWER, type PowerState } from './powerups';
import type { Session } from './session';
import type { Box } from './tileCollision';

/**
 * Estado de uma tentativa da fase (World) e a montagem dele a partir do Tiled. O passo que
 * o avança fica em world.ts. Separado na F4c, para os dois arquivos ficarem pequenos.
 */
/** Efeito só visual: moeda saindo de um bloco ou pedaços de um tijolo quebrado. */
export interface Popup {
  readonly kind: 'coin' | 'debris';
  /** Canto superior esquerdo do bloco que a soltou. */
  readonly x: number;
  readonly y: number;
  readonly steps: number;
}

/**
 * Tudo o que muda numa tentativa da fase. Sem Phaser: a LevelScene só chama stepWorld no
 * passo fixo, emite os eventos e desenha.
 */
export interface World {
  /** Fase como veio do Tiled. */
  readonly level: Level;
  /** Terreno com os blocos por cima; é nele que tudo colide. */
  readonly collision: Level;
  readonly hero: HeroBody;
  readonly hurt: HurtState;
  /** Forma do herói e invencibilidade (F4). Começa na forma da sessão (F5b). */
  readonly power: PowerState;
  readonly enemies: readonly Enemy[];
  readonly blocks: readonly Block[];
  readonly items: readonly Item[];
  /** Itens de power-up soltos (F4). */
  readonly powerItems: readonly PowerItem[];
  /** Faíscas do estado elétrico na tela (F4). */
  readonly sparks: readonly Spark[];
  /** Passos que faltam do giro do estado voador; 0 = sem giro (F4). */
  readonly spinSteps: number;
  /** Montarias da fase (F4c); a montada tem o estado `ridden`. */
  readonly mounts: readonly Mount[];
  /** Inimigos cuspidos pela montaria aquática (F4c). */
  readonly shots: readonly Shot[];
  /** Pulos extras no ar que ainda restam ao herói montado (F4c). */
  readonly airJumps: number;
  /** Passos seguidos do Surfista em pé sobre a água (F4c). */
  readonly surfSteps: number;
  /** Botão de correr/atacar no passo anterior, para detectar o aperto (F4). */
  readonly runHeld: boolean;
  /** Botão da reserva no passo anterior (F4b). O item guardado fica em `session.reserve`. */
  readonly reserveHeld: boolean;
  /** Próximo id livre para um item de power-up. */
  readonly nextId: number;
  readonly checkpoint: Checkpoint | null;
  readonly session: Session;
  /** Moedas Pokébola coletadas nesta tentativa. */
  readonly pokeballs: number;
  readonly pokeballsTotal: number;
  readonly popups: readonly Popup[];
  /** Passos desde o começo da tentativa; a fita do fim sobe e desce com eles (F5a). */
  readonly steps: number;
  /** Fita do fim da fase (F5a). */
  readonly goal: Box | null;
  /** Fechadura da saída secreta e a chave solta na fase (F5a). */
  readonly keyhole: Box | null;
  readonly key: Key | null;
  /** Chave ou concha nas mãos do herói (F5a). */
  readonly carry: Carried | null;
  /** A fase acabou (F5a): daqui em diante só o herói anda, até a cena sair dela. */
  readonly clear: LevelClear | null;
}

/** Faixa horizontal da tela, para acordar os inimigos. */
export interface View {
  readonly left: number;
  readonly right: number;
}

/** Monta a fase a partir dos objetos do Tiled. Objetos com erro ficam de fora e vão em `errors`. */
export function createWorld(
  level: Level,
  content: GameContent,
  session: Session,
): { world: World; errors: string[] } {
  const blocks: Block[] = [];
  const items: Item[] = [];
  const checkpoints: Checkpoint[] = [];
  const powerItems: PowerItem[] = [];
  const mounts: Mount[] = [];
  const enemies: Enemy[] = [];
  const errors: string[] = [];
  const exits = parseExits(level.objects);
  for (const o of level.objects) {
    if (isExitObject(o)) continue;
    const block = parseBlock(o, level.tileSize, content.items);
    const item = block ? null : parseItem(o);
    const checkpoint = block || item ? null : parseCheckpoint(o);
    const powerItem = content.items.get(o.type);
    const mount = content.mounts.get(o.type);
    if (block) blocks.push(block);
    else if (item) items.push(item);
    else if (checkpoint) checkpoints.push(checkpoint);
    else if (powerItem) {
      powerItems.push(createPlacedItem(powerItems.length, powerItem.power, objectFoot(o)));
    } else if (mount) {
      mounts.push(createMount(mounts.length, o.type, mount.kind, objectFoot(o)));
    } else {
      const spawned = createEnemy(o, enemies.length, content.creatures);
      if (spawned.ok) enemies.push(spawned.enemy);
      else errors.push(spawned.error);
    }
  }
  if (checkpoints.length > 1) {
    throw new Error(`Mapa inválido: no máximo 1 checkpoint; tem ${checkpoints.length}`);
  }
  const checkpoint = checkpoints[0] ?? null;
  const start: Point = session.checkpoint && checkpoint ? checkpoint.respawn : level.spawn;
  const world: World = {
    level,
    collision: withBlocks(level, blocks),
    hero: createHeroBody(start, heroHeightFor(session.form)),
    hurt: NOT_HURT,
    power: { ...START_POWER, form: session.form },
    enemies,
    blocks,
    items,
    powerItems,
    sparks: [],
    spinSteps: 0,
    mounts,
    shots: [],
    airJumps: 0,
    surfSteps: 0,
    // Como o pulo: o botão que abriu a fase, se ainda estiver pressionado, não vira ataque.
    runHeld: true,
    reserveHeld: true,
    nextId: powerItems.length,
    checkpoint,
    session,
    pokeballs: 0,
    pokeballsTotal: items.filter((i) => i.kind === 'pokeball').length,
    popups: [],
    steps: 0,
    goal: exits.goal,
    keyhole: exits.keyhole,
    key: exits.key && createKey(exits.key),
    carry: null,
    clear: null,
  };
  return { world, errors };
}

/** Evento inicial do HUD. */
export function levelStartedEvent(world: World): GameEvent {
  return {
    type: 'level-started',
    lives: world.session.lives,
    coins: world.session.coins,
    pokeballs: world.pokeballs,
    pokeballsTotal: world.pokeballsTotal,
    form: world.power.form,
    star: hasStar(world.power),
    reserve: world.session.reserve,
    stars: world.session.stars,
  };
}
