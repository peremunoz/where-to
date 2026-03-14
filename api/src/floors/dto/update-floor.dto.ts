import { PartialType } from '@nestjs/mapped-types';
import { CreateFloorDto } from './create-floor.dto.js';

export class UpdateFloorDto extends PartialType(CreateFloorDto) {}
