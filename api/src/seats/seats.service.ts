import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Seat } from './seat.entity.js';
import { CreateSeatDto } from './dto/create-seat.dto.js';
import { UpdateSeatDto } from './dto/update-seat.dto.js';

@Injectable()
export class SeatsService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
  ) {}

  create(dto: CreateSeatDto): Promise<Seat> {
    const seat = this.seatRepo.create(dto);
    return this.seatRepo.save(seat);
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
    return this.seatRepo.save(seat);
  }

  async remove(id: string): Promise<void> {
    const seat = await this.findOne(id);
    await this.seatRepo.remove(seat);
  }
}
