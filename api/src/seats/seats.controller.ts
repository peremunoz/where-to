import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SeatsService } from './seats.service.js';
import { CreateSeatDto } from './dto/create-seat.dto.js';
import { UpdateSeatDto } from './dto/update-seat.dto.js';

@Controller('seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Post()
  create(@Body() dto: CreateSeatDto) {
    return this.seatsService.create(dto);
  }

  @Get()
  findAll(@Query('floorId') floorId?: string) {
    return this.seatsService.findAll(floorId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.seatsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSeatDto) {
    return this.seatsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.seatsService.remove(id);
  }
}
