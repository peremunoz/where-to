import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Building } from './building.entity.js';
import { CreateBuildingDto } from './dto/create-building.dto.js';
import { UpdateBuildingDto } from './dto/update-building.dto.js';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
  ) {}

  create(dto: CreateBuildingDto): Promise<Building> {
    const building = this.buildingRepo.create(dto);
    return this.buildingRepo.save(building);
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
    const building = await this.findOne(id);
    Object.assign(building, dto);
    return this.buildingRepo.save(building);
  }

  async remove(id: string): Promise<void> {
    const building = await this.findOne(id);
    await this.buildingRepo.remove(building);
  }
}
