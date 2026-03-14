import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institution } from './institution.entity.js';
import { InstitutionsService } from './institutions.service.js';
import { InstitutionsController } from './institutions.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Institution])],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
