import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PointDto } from '../../common/dto/point.dto.js';
import { IsPolygon } from '../../common/validators/geometry.validators.js';

export class CreateBuildingDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  institutionId: string;

  /** Building outline — array of {x, y} points forming a polygon */
  @IsOptional()
  @IsPolygon()
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  polygon?: PointDto[];
}
