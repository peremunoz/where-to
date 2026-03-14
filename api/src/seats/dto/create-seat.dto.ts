import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { SeatType } from '../../common/enums/seat-type.enum.js';
import { SeatStatus } from '../../common/enums/seat-status.enum.js';

export class CreateSeatDto {
  @IsEnum(SeatType)
  type: SeatType;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsEnum(SeatStatus)
  @IsOptional()
  status?: SeatStatus;

  /** X coordinate on the floor map */
  @ValidateIf((obj: CreateSeatDto) => obj.y !== undefined)
  @IsNumber()
  @IsOptional()
  x?: number;

  /** Y coordinate on the floor map */
  @ValidateIf((obj: CreateSeatDto) => obj.x !== undefined)
  @IsNumber()
  @IsOptional()
  y?: number;

  @IsUUID()
  floorId: string;
}
