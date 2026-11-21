import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity.js';

export type WorkShift = 'day' | 'night';
/** work = มาเต็มกะ · partial = มาไม่เต็ม (มี absentHours) · leave = ลา (ต้องมี reason) */
export type WorkStatus = 'work' | 'partial' | 'leave';

/** NUMERIC ของ pg คืนเป็น string → แปลงเป็น number */
export const numericHours = {
  to: (v: number) => v,
  from: (v: string | null) => (v == null ? 0 : Number(v)),
};

// สถานะล่าสุดของแต่ละ (คน, วัน, กะ) · ยังไม่มีแถว = ยังไม่ลงเวลา
// โครงสร้างจริงอยู่ใน migration 1795068285818-work-logs.ts
@Entity('work_logs')
@Unique(['userId', 'workDate', 'shift'])
export class WorkLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // DATE ของ Postgres → string 'YYYY-MM-DD' (ไม่มีปัญหา timezone)
  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ type: 'varchar', length: 5, default: 'day' })
  shift: WorkShift;

  @Column({ type: 'varchar', length: 10, default: 'work' })
  status: WorkStatus;

  @Column({ name: 'absent_hours', type: 'numeric', precision: 4, scale: 1, default: 0, transformer: numericHours })
  absentHours: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
