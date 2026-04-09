import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('urls')
@Index('IDX_urls_short_code', ['shortCode'], { unique: true })
@Index('IDX_urls_created_at', ['createdAt'])
export class Url {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'original_url', type: 'text' })
  originalUrl!: string;

  @Column({ name: 'short_code', type: 'varchar', length: 10 })
  shortCode!: string;

  @Column({ name: 'clicks', type: 'int', default: 0 })
  clicks!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
