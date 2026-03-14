import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { RealtimeEventsService } from './realtime-events.service.js';

@Controller('events')
export class RealtimeEventsController {
  constructor(private readonly realtimeEventsService: RealtimeEventsService) {}

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    const changes$ = this.realtimeEventsService.changes$.pipe(
      map((event) => ({
        id: event.id,
        type: 'db-change',
        data: event,
      })),
    );

    // Keep-alive so proxies and browsers keep the connection open.
    const heartbeat$ = interval(25_000).pipe(
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: new Date().toISOString() },
      })),
    );

    return merge(changes$, heartbeat$);
  }
}
