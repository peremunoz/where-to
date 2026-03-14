import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { PointDto } from '../../common/dto/point.dto.js';
import { IsPolygonCollection } from '../../common/validators/geometry.validators.js';

export class CreateFloorDto {
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  floorNumber: number;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  capacity: number;

  @IsUUID()
  buildingId: string;

  /** Blocked/unavailable areas — array of polygons, each polygon is an array of {x, y} points */
  @IsOptional()
  @IsPolygonCollection()
  blockedAreas?: PointDto[][];
}
