import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from './institution.entity.js';
import { CreateInstitutionDto } from './dto/create-institution.dto.js';
import { UpdateInstitutionDto } from './dto/update-institution.dto.js';
import { RealtimeEventsService } from '../realtime/realtime-events.service.js';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async create(dto: CreateInstitutionDto): Promise<Institution> {
    const institution = this.institutionRepo.create(dto);
    const saved = await this.institutionRepo.save(institution);

    this.realtimeEventsService.publish({
      entity: 'institution',
      action: 'created',
      data: saved,
    });

    return saved;
  }

  findAll(includeTree?: boolean): Promise<Institution[]> {
    if (includeTree) {
      return this.institutionRepo.find({
        relations: {
          buildings: {
            floors: {
              seats: true,
            },
          },
        },
        order: {
          name: 'ASC',
          buildings: {
            name: 'ASC',
            floors: {
              floorNumber: 'ASC',
              seats: {
                label: 'ASC',
              },
            },
          },
        },
      });
    }
    return this.institutionRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Institution> {
    const institution = await this.institutionRepo.findOne({
      where: { id },
      relations: {
        buildings: {
          floors: {
            seats: true,
          },
        },
      },
    });
    if (!institution) {
      throw new NotFoundException(`Institution with ID "${id}" not found`);
    }
    return institution;
  }

  async update(id: string, dto: UpdateInstitutionDto): Promise<Institution> {
    const institution = await this.findOne(id);
    Object.assign(institution, dto);
    const saved = await this.institutionRepo.save(institution);

    this.realtimeEventsService.publish({
      entity: 'institution',
      action: 'updated',
      data: saved,
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const institution = await this.findOne(id);
    await this.institutionRepo.remove(institution);

    this.realtimeEventsService.publish({
      entity: 'institution',
      action: 'deleted',
      data: { id: institution.id },
    });
  }
}
