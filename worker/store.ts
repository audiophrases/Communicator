// The teacher's board, one copy for everyone. Nothing stored means the built-in board.

import { DurableObject } from 'cloudflare:workers';
import type { Board } from '../shared/board.ts';

export class BoardStore extends DurableObject {
    async board(): Promise<Board | null> {
        return (await this.ctx.storage.get<Board>('board')) ?? null;
    }
    async save(board: Board): Promise<void> {
        await this.ctx.storage.put('board', board);
    }
    async reset(): Promise<void> {
        await this.ctx.storage.delete('board');
    }
}
