import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Floor } from './floor.entity.js';
import { CreateFloorDto } from './dto/create-floor.dto.js';
import { UpdateFloorDto } from './dto/update-floor.dto.js';
import { RealtimeEventsService } from '../realtime/realtime-events.service.js';

@Injectable()
export class FloorsService {
  constructor(
    @InjectRepository(Floor)
    private readonly floorRepo: Repository<Floor>,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async create(dto: CreateFloorDto): Promise<Floor> {
    const floor = this.floorRepo.create(dto);
    const saved = await this.floorRepo.save(floor);

    this.realtimeEventsService.publish({
      entity: 'floor',
      action: 'created',
      data: saved,
    });

    return saved;
  }

  findAll(buildingId?: string): Promise<Floor[]> {
    const where: FindOptionsWhere<Floor> = {};
    if (buildingId) {
      where.buildingId = buildingId;
    }
    return this.floorRepo.find({
      where,
      relations: { seats: true },
      order: { floorNumber: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Floor> {
    const floor = await this.floorRepo.findOne({
      where: { id },
      relations: { seats: true },
    });
    if (!floor) {
      throw new NotFoundException(`Floor with ID "${id}" not found`);
    }
    return floor;
  }

  async update(id: string, dto: UpdateFloorDto): Promise<Floor> {
    const floor = await this.findOne(id);
    Object.assign(floor, dto);
    const saved = await this.floorRepo.save(floor);

    this.realtimeEventsService.publish({
      entity: 'floor',
      action: 'updated',
      data: saved,
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const floor = await this.findOne(id);
    await this.floorRepo.remove(floor);

    this.realtimeEventsService.publish({
      entity: 'floor',
      action: 'deleted',
      data: { id: floor.id, buildingId: floor.buildingId },
    });
  }
}
