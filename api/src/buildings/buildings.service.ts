import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Building } from './building.entity.js';
import { CreateBuildingDto } from './dto/create-building.dto.js';
import { UpdateBuildingDto } from './dto/update-building.dto.js';
import { RealtimeEventsService } from '../realtime/realtime-events.service.js';
import type { Point } from '../common/interfaces/point.interface.js';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  private normalizePolygonInput(polygon: unknown): Point[] | null {
    if (!Array.isArray(polygon)) {
      return null;
    }

    const normalized = polygon
      .map((point): Point | null => {
        if (Array.isArray(point) && point.length >= 2) {
          const x = Number(point[0]);
          const y = Number(point[1]);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            return { x, y };
          }
          return null;
        }

        if (
          point &&
          typeof point === 'object' &&
          'x' in point &&
          'y' in point
        ) {
          const raw = point as { x: unknown; y: unknown };
          const x = Number(raw.x);
          const y = Number(raw.y);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            return { x, y };
          }
        }

        return null;
      })
      .filter((point): point is Point => point !== null);

    if (normalized.length === 0) {
      return null;
    }

    if (normalized.length < 3) {
      throw new BadRequestException(
        'polygon must contain at least 3 valid points',
      );
    }

    return normalized;
  }

  private normalizeCreateDto(dto: CreateBuildingDto): CreateBuildingDto {
    const normalizedPolygon = this.normalizePolygonInput(dto.polygon);
    return {
      ...dto,
      polygon: normalizedPolygon,
    };
  }

  private normalizeUpdateDto(dto: UpdateBuildingDto): UpdateBuildingDto {
    if (!Object.prototype.hasOwnProperty.call(dto, 'polygon')) {
      return dto;
    }

    return {
      ...dto,
      polygon: this.normalizePolygonInput(dto.polygon),
    };
  }

  async create(dto: CreateBuildingDto): Promise<Building> {
    const normalizedDto = this.normalizeCreateDto(dto);
    const building = this.buildingRepo.create(normalizedDto);
    const saved = await this.buildingRepo.save(building);

    this.realtimeEventsService.publish({
      entity: 'building',
      action: 'created',
      data: saved,
    });

    return saved;
  }

  private async findOneEntity(id: string): Promise<Building> {
    const building = await this.buildingRepo.findOne({ where: { id } });
    if (!building) {
      throw new NotFoundException(`Building with ID "${id}" not found`);
    }
    return building;
  }

  private withTotalCapacity(
    building: Building,
  ): Building & { totalCapacity: number } {
    const totalCapacity = (building.floors ?? []).reduce(
      (sum, floor) => sum + (floor.capacity ?? 0),
      0,
    );

    return {
      ...building,
      totalCapacity,
    };
  }

  async findAll(
    institutionId?: string,
  ): Promise<Array<Building & { totalCapacity: number }>> {
    const where: FindOptionsWhere<Building> = {};
    if (institutionId) {
      where.institutionId = institutionId;
    }
    const buildings = await this.buildingRepo.find({
      where,
      relations: { floors: true },
      order: { name: 'ASC' },
    });

    return buildings.map((building) => this.withTotalCapacity(building));
  }

  async findOne(id: string): Promise<Building & { totalCapacity: number }> {
    const building = await this.buildingRepo.findOne({
      where: { id },
      relations: { floors: { seats: true } },
    });
    if (!building) {
      throw new NotFoundException(`Building with ID "${id}" not found`);
    }
    return this.withTotalCapacity(building);
  }

  async update(id: string, dto: UpdateBuildingDto): Promise<Building> {
    const building = await this.findOneEntity(id);
    const normalizedDto = this.normalizeUpdateDto(dto);
    Object.assign(building, normalizedDto);
    const saved = await this.buildingRepo.save(building);

    this.realtimeEventsService.publish({
      entity: 'building',
      action: 'updated',
      data: saved,
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const building = await this.findOneEntity(id);
    await this.buildingRepo.remove(building);

    this.realtimeEventsService.publish({
      entity: 'building',
      action: 'deleted',
      data: { id: building.id, institutionId: building.institutionId },
    });
  }
}
