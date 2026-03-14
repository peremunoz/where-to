import { PartialType } from '@nestjs/mapped-types';
import { CreateInstitutionDto } from './create-institution.dto.js';

export class UpdateInstitutionDto extends PartialType(CreateInstitutionDto) {}
