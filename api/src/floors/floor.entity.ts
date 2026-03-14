import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Building } from '../buildings/building.entity.js';
import { Seat } from '../seats/seat.entity.js';
import type { Point } from '../common/interfaces/point.interface.js';

@Entity('floors')
export class Floor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  floorNumber: number;

  /** Blocked/unavailable areas — array of polygons, each polygon is an array of {x, y} points */
  @Column({ type: 'jsonb', nullable: true, default: [] })
  blockedAreas: Point[][] | null;

  @Column()
  buildingId: string;

  @ManyToOne(() => Building, (building) => building.floors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'buildingId' })
  building: Building;

  @OneToMany(() => Seat, (seat) => seat.floor, { cascade: true })
  seats: Seat[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
