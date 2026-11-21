import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity.js';
import type { WorkShift } from './work-log.entity.js';

/** urgent = ด่วนมาก · high = ด่วน · normal = ทั่วไป */
export type TaskPriority = 'urgent' | 'high' | 'normal';

// task รายสัปดาห์ · สัปดาห์ดูจาก dueDate · โครงสร้างจริงอยู่ใน migration *-tasks.ts
@Entity('tasks')
@Index('tasks_user_due_idx', ['userId', 'dueDate'])
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  // DATE ของ Postgres → string 'YYYY-MM-DD'
  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', length: 5, default: 'day' })
  shift: WorkShift;

  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority: TaskPriority;

  @Column({ name: 'is_done', type: 'boolean', default: false })
  isDone: boolean;

  /** 0–10 · null = ยังไม่ตรวจ */
  @Column({ type: 'smallint', nullable: true })
  score: number | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
