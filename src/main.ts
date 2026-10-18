import Phaser from 'phaser';
import { GAME_CONFIG } from './config/game';
import { PHYSICS } from './config/physics';
import { integerZoom } from './logic/scale';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { LevelScene } from './scenes/LevelScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';

const container = document.getElementById('game');
if (!container) {
  throw new Error('Elemento #game não encontrado no index.html');
}

/** Dimensiona o contêiner num múltiplo inteiro de 256 x 224; o FIT então escala sem borrar. */
function resizeContainer(): void {
  const zoom = integerZoom(
    window.innerWidth,
    window.innerHeight,
    GAME_CONFIG.width,
    GAME_CONFIG.height,
    GAME_CONFIG.minZoom,
  );
  container!.style.width = `${GAME_CONFIG.width * zoom}px`;
  container!.style.height = `${GAME_CONFIG.height * zoom}px`;
}

// Registrado antes do jogo para rodar antes do handler de resize do Phaser.
resizeContainer();
window.addEventListener('resize', resizeContainer);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: container,
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  pixelArt: GAME_CONFIG.pixelArt,
  backgroundColor: GAME_CONFIG.backgroundColor,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      // Desde a F2 o herói não usa o Arcade: movimento, colisão com tiles e passo fixo vêm
      // de src/logic/. O Arcade fica configurado para sobreposições de objetos (F3).
      gravity: { x: 0, y: 0 },
      fps: PHYSICS.stepsPerSecond,
      fixedStep: true,
    },
  },
  input: { gamepad: true },
  scene: [BootScene, TitleScene, WorldMapScene, LevelScene, HudScene, PauseScene],
});
