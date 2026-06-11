import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import { Causa } from '../models/Causa';
import { getNextSequence } from '../models/Counter';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { CAUSA_STATUSES } from '../types';
import { sendAuthorizationRequest } from '../services/email';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const sujetoSchema = z.object({
  vinculo:              z.enum(['ACTOR', 'DEMANDADO', 'TERCERO']),
  nombre:               z.string().min(1),
  representante:        z.string().optional(),
  domicilio:            z.string().optional(),
  domicilioElectronico: z.string().optional(),
  calidad:              z.string().optional(),
});

const movimientoSchema = z.object({
  id:          z.string().min(1),
  fecha:       z.coerce.date(),
  tipo:        z.enum(['ACT', 'ESC', 'CED', 'RES', 'NOT', 'AUD', 'PER', 'SEN']),
  titulo:      z.string().min(1),
  descripcion: z.string().min(1).max(2000),
  numero:      z.string().optional(),
  tribunal:    z.string().optional(),
  presentante: z.string().optional(),
  acceso:      z.string().optional(),
  adjuntos:    z.boolean().optional(),
  relaciones:  z.boolean().optional(),
});

// Same as movimientoSchema but descripcion is optional, since it can be
// auto-filled from the extracted text of an attached PDF.
const movimientoConArchivoSchema = movimientoSchema.extend({
  descripcion: z.string().max(2000).optional(),
  sujetoNombre: z.string().optional(),
});

const comentarioSchema = z.object({
  id:    z.string().min(1),
  autor: z.string().min(1),
  rol:   z.string().min(1),
  fecha: z.coerce.date(),
  texto: z.string().min(1),
});

const expedienteSchema = z.object({
  nroExpediente:     z.string().min(1),
  caratula:          z.string().min(1),
  fechaPresentacion: z.coerce.date(),
  fechaInicio:       z.coerce.date(),
  ultimoMovimiento:  z.coerce.date(),
  objetoJuicio:      z.string().min(1),
  montoDisputa:      z.string().optional(),
  adjuntoNombre:     z.string().optional(),
  asignados:         z.array(z.string()).optional(),
  sujetos:           z.array(sujetoSchema).default([]),
  movimientos:       z.array(movimientoSchema).default([]),
  comentarios:       z.array(comentarioSchema).default([]),
});

const causaRelacionadaSchema = z.object({
  identificador: z.string().min(1),
  descripcion:   z.string().min(1).max(500),
  caratula:      z.string().optional(),
  tribunal:      z.string().optional(),
});

const causaSchema = z.object({
  id:                z.string().min(1),
  caratula:          z.string().min(1),
  tribunal:          z.string().optional(),
  arbitro:           z.string().min(1),
  fechaPresentacion: z.string().min(1),
  fechaInicio:       z.string().min(1),
  ultimoMovimiento:  z.string().min(1),
  objetoJuicio:      z.string().min(1),
  sujetos:           z.array(sujetoSchema).default([]),
  expedientes:       z.array(expedienteSchema).default([]),
  causasRelacionadas:z.array(causaRelacionadaSchema).default([]),
});

const statusSchema = z.object({
  status: z.enum(CAUSA_STATUSES),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLatestMovimiento(causa: any) {
  const all: any[] = [];
  for (const exp of causa.expedientes ?? []) {
    for (const mov of exp.movimientos ?? []) all.push(mov);
  }
  if (!all.length) return null;
  return all.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
}

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /causas */
export async function listCausas(req: AuthRequest, res: Response): Promise<void> {
  const { search, tribunal, arbitro, status } = req.query;

  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit = Math.max(1, parseInt(String(req.query.limit ?? '20'), 10));
  const skip  = (page - 1) * limit;

  const filter: Record<string, any> = {};
  if (search)   filter.$text = { $search: String(search) };
  if (tribunal) filter.tribunal = new RegExp(String(tribunal), 'i');
  if (arbitro)  filter.arbitros = new RegExp(String(arbitro), 'i');
  if (status && CAUSA_STATUSES.includes(status as any)) filter.status = status;

  // Restrict non-staff roles to causas where they are explicitly assigned
  const role = req.user!.role;
  if (['actor', 'demandado', 'perito'].includes(role)) {
    filter['expedientes.asignados'] = new mongoose.Types.ObjectId(req.user!.userId);
  }

  const projection = 'id identificador numeroInterno caratula tribunal nroExpedienteElectronico arbitros fechaPresentacion fechaInicio ultimoMovimiento objetoJuicio status nombreArchivo expedientes.nroExpediente expedientes.caratula';

  const [data, total] = await Promise.all([
    Causa.find(filter).select(projection).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Causa.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}

/** GET /causas/:id */
export async function getCausa(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOne({ id: req.params.id });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.json(causa);
}

/** POST /causas */
export async function createCausa(req: Request, res: Response): Promise<void> {
  const parsed = causaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const existing = await Causa.findOne({ id: parsed.data.id });
  if (existing) { res.status(409).json({ message: 'Causa with this id already exists' }); return; }

  const seq = await getNextSequence('causa_identificador');
  const year = new Date().getFullYear();
  const identificador = `BCM-${year}-${String(seq).padStart(5, '0')}`;
  const expedientes = parsed.data.expedientes.length > 0
    ? parsed.data.expedientes
    : [{
        nroExpediente: identificador,
        caratula: parsed.data.caratula,
        fechaPresentacion: parsed.data.fechaPresentacion,
        fechaInicio: parsed.data.fechaInicio,
        ultimoMovimiento: parsed.data.ultimoMovimiento,
        objetoJuicio: parsed.data.objetoJuicio,
        sujetos: [],
        movimientos: [],
        comentarios: [],
      }];

  const causa = await Causa.create({
    ...parsed.data,
    tribunal: parsed.data.tribunal ?? 'Tribunal Arbitral BCM',
    identificador,
    numeroInterno: identificador,
    expedientes,
  });

  // Flujo de autorización por mail desactivado: todos los sujetos quedan aprobados automáticamente
  for (const sujeto of causa.sujetos as any[]) {
    sujeto.aprobado = true;
  }
  await causa.save();

  res.status(201).json(causa);
}

/** PUT /causas/:id */
export async function updateCausa(req: Request, res: Response): Promise<void> {
  const parsed = causaSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const causa = await Causa.findOneAndUpdate({ id: req.params.id }, parsed.data, { new: true, runValidators: true });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.json(causa);
}

/** DELETE /causas/:id */
export async function deleteCausa(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOneAndDelete({ id: req.params.id });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.status(204).send();
}

/** PUT /causas/:id/status */
export async function updateStatus(req: AuthRequest, res: Response): Promise<void> {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const { status } = parsed.data;

  const causa = await Causa.findOne({ id: req.params.id });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }

  if (status === 'iniciado') {
    if (causa.sujetos.length === 0) {
      res.status(400).json({
        message: 'Para iniciar el expediente debe tener al menos un sujeto.',
      });
      return;
    }
    if (!(causa.expedientes as any[]).some(e => e.movimientos.length > 0)) {
      res.status(400).json({
        message: 'Para iniciar el expediente debe tener al menos un movimiento.',
      });
      return;
    }
  }

  causa.status = status;
  await causa.save();
  res.json(causa);
}

// ── Carátula ──────────────────────────────────────────────────────────────────

/** POST /causas/:id/caratula  (multipart/form-data, field "archivo") */
export async function addCaratulaArchivo(req: Request, res: Response): Promise<void> {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) { res.status(400).json({ message: 'Archivo requerido' }); return; }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id },
    { archivo: file.path.replace(/\\/g, '/'), nombreArchivo: file.originalname },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.status(201).json(causa);
}

/** GET /causas/:id/caratula/archivo */
export async function getArchivoCaratula(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOne({ id: req.params.id });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  if (!causa.archivo) { res.status(404).json({ message: 'Archivo no encontrado' }); return; }

  const absPath = path.resolve(causa.archivo);
  res.sendFile(absPath);
}

// ── Expedientes ───────────────────────────────────────────────────────────────

/** POST /causas/:id/expedientes */
export async function addExpediente(req: Request, res: Response): Promise<void> {
  const parsed = expedienteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const { asignados: asignadosRaw, ...expedienteData } = parsed.data;

  let asignadosIds: mongoose.Types.ObjectId[] = [];
  if (asignadosRaw && asignadosRaw.length > 0) {
    const validIds = asignadosRaw.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== asignadosRaw.length) {
      res.status(400).json({ message: 'Uno o más asignados tienen un ID inválido' });
      return;
    }
    const objectIds = validIds.map(id => new mongoose.Types.ObjectId(id));
    const count = await User.countDocuments({ _id: { $in: objectIds } });
    if (count !== objectIds.length) {
      res.status(400).json({ message: 'Uno o más asignados no existen' });
      return;
    }
    asignadosIds = objectIds;
  }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id },
    { $push: { expedientes: { ...expedienteData, asignados: asignadosIds } } },
    { new: true, runValidators: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.status(201).json(causa);
}

/** PUT /causas/:id/expedientes/:nroExpediente */
export async function updateExpediente(req: Request, res: Response): Promise<void> {
  const parsed = expedienteSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  // Build positional update keys
  const update: Record<string, any> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    update[`expedientes.$.${k}`] = v;
  }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $set: update },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }
  res.json(causa);
}

/** DELETE /causas/:id/expedientes/:nroExpediente */
export async function deleteExpediente(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id },
    { $pull: { expedientes: { nroExpediente: req.params.nroExpediente } } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.json(causa);
}

// ── Movimientos ───────────────────────────────────────────────────────────────

/** POST /causas/:id/expedientes/:nroExpediente/movimientos */
export async function addMovimiento(req: AuthRequest, res: Response): Promise<void> {
  const { role, userId } = req.user!;

  // Perito can never write
  if (role === 'perito') {
    res.status(403).json({ message: 'Forbidden: peritos cannot add movements' });
    return;
  }

  // actor and demandado require explicit assignment to the expediente
  if (!['secretario', 'arbitro'].includes(role)) {
    const causa = await Causa.findOne({ id: req.params.id });
    if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
    const exp = causa.expedientes.find((e: any) => e.nroExpediente === req.params.nroExpediente);
    if (!exp) { res.status(404).json({ message: 'Expediente not found' }); return; }
    const isAssigned = (exp as any).asignados?.some((id: any) => id.toString() === userId);
    if (!isAssigned) {
      res.status(403).json({ message: 'Forbidden: not assigned to this expediente' });
      return;
    }
  }

  const parsed = movimientoConArchivoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const file = (req as any).file as Express.Multer.File | undefined;
  const movimientoData: Record<string, any> = { ...parsed.data };
  let descripcion = parsed.data.descripcion;

  if (file) {
    movimientoData.archivo = file.path.replace(/\\/g, '/');
    movimientoData.nombreArchivo = file.originalname;

    if (file.mimetype === 'application/pdf' && !descripcion) {
      try {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer);
        const extracted = pdfData.text.replace(/\s+/g, ' ').trim().slice(0, 1500);
        if (extracted) descripcion = extracted;
      } catch {
        // PDF no procesable (escaneado, corrupto, etc.) — continuar sin extraer texto
      }
    }
  }

  if (!descripcion) {
    res.status(400).json({ errors: { fieldErrors: { descripcion: ['Required'] }, formErrors: [] } });
    return;
  }
  movimientoData.descripcion = descripcion;

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $push: { 'expedientes.$.movimientos': movimientoData } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }

  // Update ultimoMovimiento on both expediente and causa
  const latest = getLatestMovimiento(causa);
  if (latest) {
    await Causa.findOneAndUpdate(
      { id: req.params.id, 'expedientes.nroExpediente': req.params.nroExpediente },
      {
        $set: {
          ultimoMovimiento: latest.fecha,
          'expedientes.$.ultimoMovimiento': latest.fecha,
        },
      }
    );
  }

  const updated = await Causa.findOne({ id: req.params.id });
  res.status(201).json(updated);
}

/** GET /causas/:id/expedientes/:nroExpediente/movimientos/:movId/archivo */
export async function getArchivoMovimiento(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOne({ id: req.params.id });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }

  const exp = (causa.expedientes as any[]).find((e: any) => e.nroExpediente === req.params.nroExpediente);
  if (!exp) { res.status(404).json({ message: 'Expediente not found' }); return; }

  const mov = (exp.movimientos as any[]).find((m: any) => m.id === req.params.movId);
  if (!mov?.archivo) { res.status(404).json({ message: 'Archivo no encontrado' }); return; }

  const absPath = path.resolve(mov.archivo);
  res.sendFile(absPath);
}

/** DELETE /causas/:id/expedientes/:nroExpediente/movimientos/:movId */
export async function deleteMovimiento(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $pull: { 'expedientes.$.movimientos': { id: req.params.movId } } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }
  res.json(causa);
}

// ── Comentarios ───────────────────────────────────────────────────────────────

/** POST /causas/:id/expedientes/:nroExpediente/comentarios */
export async function addComentario(req: Request, res: Response): Promise<void> {
  const parsed = comentarioSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $push: { 'expedientes.$.comentarios': parsed.data } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }
  res.status(201).json(causa);
}

/** DELETE /causas/:id/expedientes/:nroExpediente/comentarios/:comentarioId */
export async function deleteComentario(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $pull: { 'expedientes.$.comentarios': { id: req.params.comentarioId } } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }
  res.json(causa);
}

// ── Sujetos ───────────────────────────────────────────────────────
/** POST /causas/:id/sujetos */
export async function addSujetoCausa(req: Request, res: Response): Promise<void> {
  const parsed = sujetoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const causa = await Causa.findOne({ id: req.params.id });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }

  const sujetoData: Record<string, any> = { ...parsed.data };

  // Flujo de autorización por mail desactivado: el sujeto queda aprobado automáticamente
  sujetoData.aprobado = true;
  /*
  if (parsed.data.vinculo === 'DEMANDADO') {
    sujetoData.aprobado = true;
  } else {
    const token = crypto.randomBytes(32).toString('hex');
    sujetoData.aprobacionToken = token;
    sujetoData.aprobado = false;

    const demandado = (causa.sujetos as any[]).find((s: any) => s.vinculo === 'DEMANDADO');
    if (demandado?.domicilioElectronico) {
      try {
        await sendAuthorizationRequest({
          demandadoEmail: demandado.domicilioElectronico,
          demandadoNombre: demandado.nombre,
          sujetoNombre: parsed.data.nombre,
          sujetoVinculo: parsed.data.vinculo,
          sujetoRepresentante: parsed.data.representante,
          sujetoEmail: parsed.data.domicilioElectronico,
          causaCaratula: causa.caratula,
          expedienteNro: causa.identificador,
          token,
          frontendUrl: process.env.FRONTEND_URL ?? '',
        });
      } catch (err) {
        console.error('Error sending authorization request email:', err);
      }
    }
  }
  */

  (causa.sujetos as any[]).push(sujetoData);
  await causa.save();

  res.status(201).json(causa);
}

/** POST /causas/:id/expedientes/:nroExpediente/sujetos */
export async function addSujeto(req: Request, res: Response): Promise<void>{
  const parsed = sujetoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const causa = await Causa.findOne({ id: req.params.id });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }

  const expediente = (causa.expedientes as any[]).find((e: any) => e.nroExpediente === req.params.nroExpediente);
  if (!expediente) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }

  const sujetoData: Record<string, any> = { ...parsed.data };

  // Flujo de autorización por mail desactivado: el sujeto queda aprobado automáticamente
  sujetoData.aprobado = true;
  /*
  if (parsed.data.vinculo === 'DEMANDADO') {
    sujetoData.aprobado = true;
  } else {
    const token = crypto.randomBytes(32).toString('hex');
    sujetoData.aprobacionToken = token;
    sujetoData.aprobado = false;

    const demandado = (expediente.sujetos as any[]).find((s: any) => s.vinculo === 'DEMANDADO');
    if (demandado?.domicilioElectronico) {
      try {
        await sendAuthorizationRequest({
          demandadoEmail: demandado.domicilioElectronico,
          demandadoNombre: demandado.nombre,
          sujetoNombre: parsed.data.nombre,
          sujetoVinculo: parsed.data.vinculo,
          sujetoRepresentante: parsed.data.representante,
          sujetoEmail: parsed.data.domicilioElectronico,
          causaCaratula: causa.caratula,
          expedienteNro: req.params.nroExpediente,
          token,
          frontendUrl: process.env.FRONTEND_URL ?? '',
        });
      } catch (emailError) {
        console.error('[EMAIL ERROR] Fallo al enviar mail de autorización:', emailError);
      }
    }
  }
  */

  expediente.sujetos.push(sujetoData);
  await causa.save();

  res.status(201).json(causa);
}

/** DELETE /causas/:id/expedientes/:nroExpediente/sujetos/:nombre */
export async function deleteSujeto(req: Request, res: Response): Promise<void> {
  const { id, nroExpediente, nombre } = req.params;

  const causa = await Causa.findOneAndUpdate(
    { id, 'expedientes.nroExpediente': nroExpediente },
    { $pull: { 'expedientes.$.sujetos': { nombre: nombre } } },
    { new: true }
  );

  if (!causa) {
    res.status(404).json({ message: 'Causa or Expediente not found' });
    return;
  }

  res.json(causa);
}

// ── Causas Relacionadas ───────────────────────────────────────────────────────

/** POST /causas/:id/relacionadas  (multipart/form-data) */
export async function addCausaRelacionada(req: Request, res: Response): Promise<void> {
  const parsed = causaRelacionadaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const file = (req as any).file as Express.Multer.File | undefined;
  const entrada: Record<string, any> = { ...parsed.data };
  if (file) {
    entrada.archivo      = file.path.replace(/\\/g, '/');
    entrada.nombreArchivo = file.originalname;
  }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id },
    { $push: { causasRelacionadas: entrada } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.status(201).json(causa);
}

/** GET /causas/:id/relacionadas/:relacionadaId/archivo */
export async function getArchivoRelacionada(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOne({ id: req.params.id });
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }

  const rel = (causa.causasRelacionadas as any[]).find(
    (r: any) => r._id?.toString() === req.params.relacionadaId
  );
  if (!rel?.archivo) { res.status(404).json({ message: 'Archivo no encontrado' }); return; }

  const absPath = path.resolve(rel.archivo);
  res.sendFile(absPath);
}

/** DELETE /causas/:id/relacionadas/:identificador */
export async function removeCausaRelacionada(req: Request, res: Response): Promise<void> {
  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id },
    { $pull: { causasRelacionadas: { identificador: req.params.identificador } } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.json(causa);
}
