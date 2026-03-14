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
import { Institution } from '../institutions/institution.entity.js';
import { Floor } from '../floors/floor.entity.js';
import type { Point } from '../common/interfaces/point.interface.js';

@Entity('buildings')
export class Building {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  /** Polygon outline of the building — array of {x, y} points */
  @Column({ type: 'jsonb', nullable: true })
  polygon: Point[] | null;

  @Column()
  institutionId: string;

  @ManyToOne(() => Institution, (institution) => institution.buildings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institutionId' })
  institution: Institution;

  @OneToMany(() => Floor, (floor) => floor.building, { cascade: true })
  floors: Floor[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
