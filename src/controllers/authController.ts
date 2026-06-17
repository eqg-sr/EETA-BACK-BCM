import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { Causa } from '../models/Causa';

const registerSchema = z.object({
  email:    z.string().email(),
  name:     z.string().min(2),
  password: z.string().min(8),
  role:     z.enum(['arbitro', 'demandado', 'actor', 'secretario', 'perito', 'otros']),
  abogado:  z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

function signToken(userId: string, email: string, role: string): string {
  const opts = { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') } as import('jsonwebtoken').SignOptions;
  return jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, opts);
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }

  const { email, name, password, role, abogado } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ message: 'Email already registered' });
    return;
  }

  const user = await User.create({ email, name, password, role, abogado, activo: true, aprobado: false });
  const token = signToken(user._id.toString(), user.email, user.role);

  res.status(201).json({ token, user });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const token = signToken(user._id.toString(), user.email, user.role);
  res.json({ token, user });
}

export async function me(req: Request, res: Response): Promise<void> {
  const payload = (req as any).user;
  const user = await User.findById(payload.userId);
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }
  res.json(user);
}

export async function autorizarSujeto(req: Request, res: Response): Promise<void> {
  const token = String(req.query.token ?? '');

  const causa = await Causa.findOne({
    $or: [
      { 'sujetos.aprobacionToken': token },
      { 'expedientes.sujetos.aprobacionToken': token },
    ],
  });
  if (!causa) { res.status(400).json({ message: 'Token inválido o ya utilizado' }); return; }

  let sujetoNombre = '';
  const sujetoCausa = (causa.sujetos as any[]).find((s: any) => s.aprobacionToken === token);
  if (sujetoCausa) {
    sujetoCausa.aprobado = true;
    sujetoCausa.aprobacionToken = undefined;
    sujetoNombre = sujetoCausa.nombre;
  } else {
    for (const expediente of causa.expedientes as any[]) {
      const sujeto = (expediente.sujetos as any[]).find((s: any) => s.aprobacionToken === token);
      if (sujeto) {
        sujeto.aprobado = true;
        sujeto.aprobacionToken = undefined;
        sujetoNombre = sujeto.nombre;
        break;
      }
    }
  }

  await causa.save();

  res.json({ message: 'Acceso autorizado correctamente', sujetoNombre, causaCaratula: causa.caratula });
}
