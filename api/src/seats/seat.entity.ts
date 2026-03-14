import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Floor } from '../floors/floor.entity.js';
import { SeatType } from '../common/enums/seat-type.enum.js';
import { SeatStatus } from '../common/enums/seat-status.enum.js';

@Entity('seats')
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SeatType })
  type: SeatType;

  @Column()
  label: string;

  @Column({ type: 'enum', enum: SeatStatus, default: SeatStatus.AVAILABLE })
  status: SeatStatus;

  /** X coordinate on the floor map */
  @Column({ type: 'float', nullable: true })
  x: number | null;

  /** Y coordinate on the floor map */
  @Column({ type: 'float', nullable: true })
  y: number | null;

  @Column()
  floorId: string;

  @ManyToOne(() => Floor, (floor) => floor.seats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'floorId' })
  floor: Floor;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
