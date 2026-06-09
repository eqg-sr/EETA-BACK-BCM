import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes  from './routes/auth';
import causaRoutes from './routes/causas';
import optionRoutes from './routes/options';
import adminRoutes from './routes/admin';

const app = express();

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors({
  origin: process.env.FRONTEND_URL ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/causas',  causaRoutes);
app.use('/api/options', optionRoutes);
app.use('/api/admin',   adminRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

export default app;
