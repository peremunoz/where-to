import { Module } from '@nestjs/common';
import { RealtimeEventsController } from './realtime-events.controller.js';
import { RealtimeEventsService } from './realtime-events.service.js';

@Module({
  controllers: [RealtimeEventsController],
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeEventsModule {}
