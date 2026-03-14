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
import { FloorsService } from './floors.service.js';
import { CreateFloorDto } from './dto/create-floor.dto.js';
import { UpdateFloorDto } from './dto/update-floor.dto.js';

@Controller('floors')
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Post()
  create(@Body() dto: CreateFloorDto) {
    return this.floorsService.create(dto);
  }

  @Get()
  findAll(@Query('buildingId') buildingId?: string) {
    return this.floorsService.findAll(buildingId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.floorsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFloorDto) {
    return this.floorsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.floorsService.remove(id);
  }
}
