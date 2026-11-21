import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * บันทึกเวลาทำงาน: 1 แถว = 1 คน 1 วัน 1 กะ · กะไหนยังไม่มีแถว = ยังไม่ลงเวลา
 * - shift:  day = กลางวัน · night = กลางคืน
 * - status: work = เข้างานเต็มกะ · partial = ลาบางชั่วโมง (absent_hours) · leave = ลา (ต้องมี reason)
 */
export class WorkLogs1795068285818 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE work_logs (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        work_date     DATE         NOT NULL,
        shift         VARCHAR(5)   NOT NULL DEFAULT 'day',
        status        VARCHAR(10)  NOT NULL DEFAULT 'work',
        absent_hours  NUMERIC(4,1) NOT NULL DEFAULT 0,
        reason        VARCHAR(255),
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT work_logs_shift_check         CHECK (shift IN ('day', 'night')),
        CONSTRAINT work_logs_status_check        CHECK (status IN ('work', 'partial', 'leave')),
        CONSTRAINT work_logs_absent_hours_check  CHECK (absent_hours >= 0 AND absent_hours <= 24),
        CONSTRAINT work_logs_leave_reason_check  CHECK (status <> 'leave' OR reason IS NOT NULL),
        CONSTRAINT work_logs_user_date_shift_key UNIQUE (user_id, work_date, shift)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE work_logs`);
  }
}
