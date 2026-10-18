/**
 * PowerUpSystem (F4): formas do herói, itens e dano. As transições são funções puras em
 * src/logic/powerups.ts, testadas sem o Phaser; quem as aplica a cada passo é stepWorld
 * (src/logic/world.ts). Este módulo é o ponto de entrada do sistema para o resto do jogo.
 */
export {
  blockRelease,
  collectPower,
  damagePower,
  FORM_TRANSITIONS,
  FORMS,
  hasStar,
  heroHeightFor,
  isBig,
  POWERS,
  START_POWER,
  tickPower,
  type Form,
  type Power,
  type PowerState,
} from '../logic/powerups';
