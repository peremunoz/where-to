import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Seat } from './seat.entity.js';
import { CreateSeatDto } from './dto/create-seat.dto.js';
import { UpdateSeatDto } from './dto/update-seat.dto.js';
import { RealtimeEventsService } from '../realtime/realtime-events.service.js';

@Injectable()
export class SeatsService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async create(dto: CreateSeatDto): Promise<Seat> {
    const seat = this.seatRepo.create(dto);
    const saved = await this.seatRepo.save(seat);

    this.realtimeEventsService.publish({
      entity: 'seat',
      action: 'created',
      data: saved,
    });

    return saved;
  }

  findAll(floorId?: string): Promise<Seat[]> {
    const where: FindOptionsWhere<Seat> = {};
    if (floorId) {
      where.floorId = floorId;
    }
    return this.seatRepo.find({
      where,
      order: { label: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Seat> {
    const seat = await this.seatRepo.findOne({ where: { id } });
    if (!seat) {
      throw new NotFoundException(`Seat with ID "${id}" not found`);
    }
    return seat;
  }

  async update(id: string, dto: UpdateSeatDto): Promise<Seat> {
    const seat = await this.findOne(id);
    Object.assign(seat, dto);
    const saved = await this.seatRepo.save(seat);

    this.realtimeEventsService.publish({
      entity: 'seat',
      action: 'updated',
      data: saved,
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const seat = await this.findOne(id);
    await this.seatRepo.remove(seat);

    this.realtimeEventsService.publish({
      entity: 'seat',
      action: 'deleted',
      data: { id: seat.id, floorId: seat.floorId },
    });
  }
}
