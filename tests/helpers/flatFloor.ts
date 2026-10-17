import { FIXED_DT } from '../../src/config/physics';
import {
  createHeroMotion,
  NO_CONTACTS,
  NO_INPUT,
  stepHero,
  type HeroContacts,
  type HeroInput,
  type HeroMotion,
} from '../../src/logic/heroMotion';

export const GROUND: HeroContacts = { ...NO_CONTACTS, ground: true };
export const AIR: HeroContacts = NO_CONTACTS;

/**
 * Herói sobre um chão plano infinito em y = 0 (y cresce para baixo), imitando o Arcade:
 * a lógica define a velocidade, o corpo anda e depois é separado do chão.
 */
export class FlatFloor {
  motion: HeroMotion = createHeroMotion();
  /** Altura dos pés; negativo = acima do chão. */
  y = 0;
  private contacts: HeroContacts = GROUND;

  step(input: HeroInput): HeroMotion {
    this.motion = stepHero(this.motion, input, this.contacts);
    this.y += this.motion.vy * FIXED_DT;
    const landed = this.y > 0;
    if (landed) this.y = 0;
    this.contacts = landed ? GROUND : AIR;
    return this.motion;
  }

  /** Repete a mesma entrada e devolve o histórico de estados. */
  hold(input: HeroInput, steps: number): HeroMotion[] {
    return Array.from({ length: steps }, () => this.step(input));
  }
}

/** Herói parado no chão, com o botão de pulo solto. */
export function standing(): FlatFloor {
  const floor = new FlatFloor();
  floor.hold(NO_INPUT, 2);
  return floor;
}
