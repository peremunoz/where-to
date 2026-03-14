import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
<<<<<<< HEAD
import { Transform } from 'class-transformer';
=======
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
>>>>>>> d9c0f8c9b4ac2c644a8719302dbb5c6668d02e63
import { PointDto } from '../../common/dto/point.dto.js';
import { IsPolygon } from '../../common/validators/geometry.validators.js';

function normalizePolygonPoint(input: unknown): PointDto | null {
  if (Array.isArray(input) && input.length >= 2) {
    const x = Number(input[0]);
    const y = Number(input[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
    return null;
  }

  if (input && typeof input === 'object' && 'x' in input && 'y' in input) {
    const raw = input as { x: unknown; y: unknown };
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }

  return null;
}

function normalizePolygonPayload(value: unknown): PointDto[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((point) => normalizePolygonPoint(point))
    .filter((point): point is PointDto => point !== null);
}

export class CreateBuildingDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  institutionId: string;

  /** Building outline — array of {x, y} points forming a polygon */
  @IsOptional()
  @Transform(({ value }) => normalizePolygonPayload(value))
  @IsPolygon()
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  polygon?: PointDto[];
}
