import type { EventOf, GameEvent, GameEventType } from '../logic/events';

type Listener = (event: GameEvent) => void;

/** Barramento de eventos tipado, sem Phaser. A fase emite; o HUD escuta. */
export class EventBus {
  private readonly listeners = new Map<GameEventType, Set<Listener>>();

  /** Escuta um tipo de evento. Devolve a função que cancela a escuta. */
  on<T extends GameEventType>(type: T, listener: (event: EventOf<T>) => void): () => void {
    // O Map guarda por tipo; só chegam aqui eventos com `type === T`.
    const wrapped: Listener = (event) => listener(event as EventOf<T>);
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(wrapped);
    this.listeners.set(type, set);
    return () => set.delete(wrapped);
  }

  emit(event: GameEvent): void {
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) listener(event);
  }
}

/** Barramento compartilhado pelas cenas. */
export const gameEvents = new EventBus();
