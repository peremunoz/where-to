import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, Subject } from 'rxjs';
import {
  DatabaseChangeEvent,
  PublishDatabaseChangeInput,
} from './realtime-events.types.js';

@Injectable()
export class RealtimeEventsService {
  private readonly changesSubject = new Subject<DatabaseChangeEvent>();

  readonly changes$: Observable<DatabaseChangeEvent> =
    this.changesSubject.asObservable();

  publish(input: PublishDatabaseChangeInput): void {
    this.changesSubject.next({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...input,
    });
  }
}
