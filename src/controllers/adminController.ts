import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Causa } from '../models/Causa';
import { AuthRequest } from '../middleware/auth';

// ── Usuarios ──────────────────────────────────────────────────────────────────

/** GET /admin/usuarios */
export async function listUsuarios(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, any> = {};
  if (req.query.pendientes === 'true') filter.aprobado = false;

  const usuarios = await User.find(filter).select('-password').sort({ createdAt: -1 });
  res.json(usuarios);
}

/** PUT /admin/usuarios/:id/aprobar */
export async function aprobarUsuario(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { aprobado: true },
    { new: true }
  ).select('-password');
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }
  res.json(user);
}

/** PUT /admin/usuarios/:id/desactivar */
export async function desactivarUsuario(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { activo: false },
    { new: true }
  ).select('-password');
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }
  res.json(user);
}

/** PUT /admin/usuarios/:id/activar */
export async function activarUsuario(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { activo: true },
    { new: true }
  ).select('-password');
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }
  res.json(user);
}

const rolSchema = z.object({
  rol: z.enum(['arbitro', 'demandado', 'actor', 'secretario', 'perito']),
});

/** PUT /admin/usuarios/:id/rol */
export async function cambiarRolUsuario(req: AuthRequest, res: Response): Promise<void> {
  const parsed = rolSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: parsed.data.rol },
    { new: true }
  ).select('-password');
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }
  res.json(user);
}

// ── Asignaciones ──────────────────────────────────────────────────────────────

function findExpediente(causa: any, nroExpediente: string) {
  return causa?.expedientes?.find((e: any) => e.nroExpediente === nroExpediente);
}

/** GET /admin/causas/:causaId/expedientes/:nroExpediente/asignados */
export async function listarAsignados(req: AuthRequest, res: Response): Promise<void> {
  const causa = await Causa.findOne({ id: req.params.causaId });
  const exp = findExpediente(causa, req.params.nroExpediente);
  if (!exp) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }

  const usuarios = await User.find({ _id: { $in: exp.asignados ?? [] } }).select('-password');
  res.json(usuarios);
}

const asignarSchema = z.object({
  userId: z.string().min(1),
});

/** POST /admin/causas/:causaId/expedientes/:nroExpediente/asignados */
export async function asignarUsuario(req: AuthRequest, res: Response): Promise<void> {
  const parsed = asignarSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const userId = new mongoose.Types.ObjectId(parsed.data.userId);

  const userExists = await User.exists({ _id: userId });
  if (!userExists) { res.status(404).json({ message: 'User not found' }); return; }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.causaId, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $addToSet: { 'expedientes.$.asignados': userId } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }

  const exp = findExpediente(causa, req.params.nroExpediente);
  const usuarios = await User.find({ _id: { $in: exp?.asignados ?? [] } }).select('-password');
  res.status(201).json(usuarios);
}

/** DELETE /admin/causas/:causaId/expedientes/:nroExpediente/asignados/:userId */
export async function desasignarUsuario(req: AuthRequest, res: Response): Promise<void> {
  const userId = new mongoose.Types.ObjectId(req.params.userId);

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.causaId, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $pull: { 'expedientes.$.asignados': userId } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }
  res.status(204).send();
}
