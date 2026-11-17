/**
 * The per-tab sequence of reading-position saves (contract §3): each reader tab numbers its saves,
 * and a save that arrives after a later one from the same tab, for the same Document and owner, is
 * dropped. The server-clock rule already orders saves from different tabs and devices; this catches
 * two requests of one tab overtaking each other (a save in flight and the keepalive save on page
 * hide). Kept in this process's memory, bounded, oldest entries forgotten first.
 */
export class TabSequences {
  private readonly last = new Map<string, number>();

  constructor(private readonly limit = 5000) {}

  /** Whether this save is newer than every save already seen from its tab. */
  accept(key: string, seq: number): boolean {
    const previous = this.last.get(key);
    if (previous !== undefined && seq <= previous) return false;
    this.last.delete(key);
    this.last.set(key, seq);
    while (this.last.size > this.limit) {
      const oldest = this.last.keys().next().value;
      if (oldest === undefined) break;
      this.last.delete(oldest);
    }
    return true;
  }

  /** Forgets a tab's sequence: its save was refused (not the owner's Document), so nothing about it is kept. */
  forget(key: string): void {
    this.last.delete(key);
  }
}
