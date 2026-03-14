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

  findAll(institutionId?: string): Promise<Building[]> {
    const where: FindOptionsWhere<Building> = {};
    if (institutionId) {
      where.institutionId = institutionId;
    }
    return this.buildingRepo.find({
      where,
      relations: { floors: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Building> {
    const building = await this.buildingRepo.findOne({
      where: { id },
      relations: { floors: { seats: true } },
    });
    if (!building) {
      throw new NotFoundException(`Building with ID "${id}" not found`);
    }
    return building;
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
