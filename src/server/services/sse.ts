import type { Response } from 'express';
import type { OfficeEvent } from '../../shared/types.js';

class SseHub {
  private clients = new Set<Response>();
  private recentEvents: OfficeEvent[] = [];

  public addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': connected\n\n');

    this.clients.add(res);

    // Send heartbeat comment every 20s to keep Render/proxy connections alive
    const timer = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': ping\n\n');
      }
    }, 20000);

    res.on('close', () => {
      clearInterval(timer);
      this.clients.delete(res);
    });
  }

  public broadcast(event: OfficeEvent): void {
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 40) {
      this.recentEvents.pop();
    }
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      if (!client.writableEnded) {
        client.write(payload);
      }
    }
  }

  public getRecentEvents(): OfficeEvent[] {
    return this.recentEvents;
  }
}

export const sseHub = new SseHub();
