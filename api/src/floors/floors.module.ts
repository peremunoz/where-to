import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Floor } from './floor.entity.js';
import { FloorsService } from './floors.service.js';
import { FloorsController } from './floors.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Floor])],
  controllers: [FloorsController],
  providers: [FloorsService],
  exports: [FloorsService],
})
export class FloorsModule {}
