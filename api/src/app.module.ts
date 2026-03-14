import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { InstitutionsModule } from './institutions/institutions.module.js';
import { BuildingsModule } from './buildings/buildings.module.js';
import { FloorsModule } from './floors/floors.module.js';
import { SeatsModule } from './seats/seats.module.js';
import { RealtimeEventsModule } from './realtime/realtime-events.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'whereto',
      password: process.env.DB_PASSWORD || 'whereto',
      database: process.env.DB_NAME || 'where_to',
      autoLoadEntities: true,
      synchronize: true, // ⚠️ Disable in production — use migrations instead
    }),
    InstitutionsModule,
    BuildingsModule,
    FloorsModule,
    SeatsModule,
    RealtimeEventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
