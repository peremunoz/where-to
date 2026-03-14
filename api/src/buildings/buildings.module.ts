import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from './building.entity.js';
import { BuildingsService } from './buildings.service.js';
import { BuildingsController } from './buildings.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Building])],
  controllers: [BuildingsController],
  providers: [BuildingsService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
