// The teacher's board and switches, one copy for everyone. No board stored means the built-in board.

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
    // Whether students can use Fix (OpenAI). On until the teacher switches it off.
    async fixOn(): Promise<boolean> {
        return (await this.ctx.storage.get<boolean>('fixOn')) ?? true;
    }
    async setFixOn(on: boolean): Promise<void> {
        await this.ctx.storage.put('fixOn', on);
    }
}
