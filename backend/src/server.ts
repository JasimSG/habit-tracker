import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
});

const userIdSchema = z.coerce.number().int().positive();
const createHabitSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  target: z.number().int().positive().max(1000).default(1),
});
const logSchema = z.object({
  userId: z.number().int().positive(),
  habitId: z.number().int().positive(),
  value: z.string().trim().min(1).max(50).default('done'),
});

function sendError(res: express.Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    sendError(res, 503, 'Database unavailable');
  }
});

app.get('/api/habits', async (req, res, next) => {
  try {
    const userId = userIdSchema.parse(req.query.userId);
    const [rows] = await pool.execute(
      'SELECT id, name, target FROM habits WHERE user_id = ? ORDER BY id',
      [userId]
    );
    res.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/habits', async (req, res, next) => {
  try {
    const input = createHabitSchema.parse(req.body);
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO habits (user_id, name, target) VALUES (?, ?, ?)',
      [input.userId, input.name, input.target]
    );
    res.status(201).json({ id: result.insertId, ...input });
  } catch (error) { next(error); }
});

app.get('/api/dashboard', async (req, res, next) => {
  try {
    const userId = userIdSchema.parse(req.query.userId);
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT h.id, h.name, h.target, hl.value, DATE_FORMAT(hl.log_date, '%Y-%m-%d') AS log_date
       FROM habits h
       LEFT JOIN habit_logs hl ON hl.habit_id = h.id
         AND hl.user_id = h.user_id
         AND hl.log_date >= CURDATE() - INTERVAL 6 DAY
       WHERE h.user_id = ?
       ORDER BY h.id, hl.log_date`,
      [userId]
    );

    const map = new Map<number, { id: number; name: string; target: number; logs: { value: string; log_date: string }[] }>();
    for (const row of rows) {
      if (!map.has(row.id)) map.set(row.id, { id: row.id, name: row.name, target: row.target, logs: [] });
      if (row.log_date) map.get(row.id)!.logs.push({ value: row.value, log_date: row.log_date });
    }
    res.json([...map.values()]);
  } catch (error) { next(error); }
});

app.post('/api/logs', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const input = logSchema.parse(req.body);
    await connection.beginTransaction();

    const [habitRows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM habits WHERE id = ? AND user_id = ? FOR UPDATE',
      [input.habitId, input.userId]
    );
    if (habitRows.length === 0) {
      await connection.rollback();
      return sendError(res, 404, 'Habit not found');
    }

    const [existing] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM habit_logs WHERE user_id = ? AND habit_id = ? AND log_date = CURDATE()',
      [input.userId, input.habitId]
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, reason: 'already logged today' });
    }

    await connection.execute(
      'INSERT INTO habit_logs (user_id, habit_id, value, log_date) VALUES (?, ?, ?, CURDATE())',
      [input.userId, input.habitId, input.value]
    );
    await connection.commit();
    res.status(201).json({ success: true });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return sendError(res, 400, 'Invalid request');
  console.error(error);
  return sendError(res, 500, 'Internal server error');
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Habit API listening on http://localhost:${port}`));
