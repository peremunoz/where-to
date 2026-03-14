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
import { InstitutionsService } from './institutions.service.js';
import { CreateInstitutionDto } from './dto/create-institution.dto.js';
import { UpdateInstitutionDto } from './dto/update-institution.dto.js';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  create(@Body() dto: CreateInstitutionDto) {
    return this.institutionsService.create(dto);
  }

  @Get()
  findAll(@Query('includeTree') includeTree?: string) {
    return this.institutionsService.findAll(includeTree === 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstitutionDto,
  ) {
    return this.institutionsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutionsService.remove(id);
  }
}
