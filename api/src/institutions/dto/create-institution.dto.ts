import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}
