import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Building } from './building.entity.js';
import { CreateBuildingDto } from './dto/create-building.dto.js';
import { UpdateBuildingDto } from './dto/update-building.dto.js';
import { RealtimeEventsService } from '../realtime/realtime-events.service.js';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async create(dto: CreateBuildingDto): Promise<Building> {
    const building = this.buildingRepo.create(dto);
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
    Object.assign(building, dto);
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
