import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task รายสัปดาห์: 1 แถว = 1 งาน ของ 1 คน · สัปดาห์ของ task ดูจาก due_date (สัปดาห์เริ่มวันเสาร์)
 * - shift:    day = กะกลางวัน · night = กะกลางคืน (วันศุกร์ไม่มีกะกลางคืน)
 * - priority: urgent = ด่วนมาก · high = ด่วน · normal = ทั่วไป
 * - score:    0–10 · NULL = ยังไม่ตรวจ (reviewed_at ต้องมีเมื่อมีคะแนน)
 */
export class Tasks1795072923280 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tasks (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title           VARCHAR(200) NOT NULL,
        detail          TEXT,
        due_date        DATE         NOT NULL,
        shift           VARCHAR(5)   NOT NULL DEFAULT 'day',
        priority        VARCHAR(10)  NOT NULL DEFAULT 'normal',
        is_done         BOOLEAN      NOT NULL DEFAULT FALSE,
        score           SMALLINT,
        review_comment  TEXT,
        reviewed_at     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT tasks_title_check          CHECK (btrim(title) <> ''),
        CONSTRAINT tasks_shift_check          CHECK (shift IN ('day', 'night')),
        CONSTRAINT tasks_friday_night_check   CHECK (NOT (shift = 'night' AND EXTRACT(ISODOW FROM due_date) = 5)),
        CONSTRAINT tasks_priority_check       CHECK (priority IN ('urgent', 'high', 'normal')),
        CONSTRAINT tasks_score_check          CHECK (score BETWEEN 0 AND 10),
        CONSTRAINT tasks_reviewed_check       CHECK ((score IS NULL) = (reviewed_at IS NULL)),
        CONSTRAINT tasks_comment_check        CHECK (score IS NOT NULL OR review_comment IS NULL)
      )
    `);
    // หน้า Tasks ดึงทีละสัปดาห์ของแต่ละคน
    await queryRunner.query(`CREATE INDEX tasks_user_due_idx ON tasks (user_id, due_date)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tasks`);
  }
}
