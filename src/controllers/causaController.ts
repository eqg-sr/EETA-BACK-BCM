import { Request, Response } from 'express';
import { z } from 'zod';
import { Causa } from '../models/Causa';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const sujetoSchema = z.object({
  vinculo:              z.enum(['ACTOR', 'DEMANDADO', 'TERCERO']),
  nombre:               z.string().min(1),
  representante:        z.string().optional(),
  domicilio:            z.string().optional(),
  domicilioElectronico: z.string().optional(),
});

const movimientoSchema = z.object({
  id:          z.string().min(1),
  fecha:       z.string().min(1),
  tipo:        z.enum(['ACT', 'ESC', 'CED', 'RES', 'NOT', 'AUD', 'PER']),
  titulo:      z.string().min(1),
  numero:      z.string().optional(),
  tribunal:    z.string().optional(),
  presentante: z.string().optional(),
  acceso:      z.string().optional(),
  adjuntos:    z.boolean().optional(),
  relaciones:  z.boolean().optional(),
});

const comentarioSchema = z.object({
  id:    z.string().min(1),
  autor: z.string().min(1),
  rol:   z.string().min(1),
  fecha: z.string().min(1),
  texto: z.string().min(1),
});

const expedienteSchema = z.object({
  nroExpediente:     z.string().min(1),
  caratula:          z.string().min(1),
  fechaPresentacion: z.string().min(1),
  fechaInicio:       z.string().min(1),
  ultimoMovimiento:  z.string().min(1),
  objetoJuicio:      z.string().min(1),
  montoDisputa:      z.string().optional(),
  adjuntoNombre:     z.string().optional(),
  sujetos:           z.array(sujetoSchema).default([]),
  movimientos:       z.array(movimientoSchema).default([]),
  comentarios:       z.array(comentarioSchema).default([]),
});

const causaRelacionadaSchema = z.object({
  identificador: z.string().min(1),
  caratula:      z.string().min(1),
  tribunal:      z.string().min(1),
});

const causaSchema = z.object({
  id:                z.string().min(1),
  identificador:     z.string().min(1),
  numeroInterno:     z.string().min(1),
  caratula:          z.string().min(1),
  tribunal:          z.string().min(1),
  arbitro:           z.string().min(1),
  fechaPresentacion: z.string().min(1),
  fechaInicio:       z.string().min(1),
  ultimoMovimiento:  z.string().min(1),
  objetoJuicio:      z.string().min(1),
  sujetos:           z.array(sujetoSchema).default([]),
  expedientes:       z.array(expedienteSchema).default([]),
  causasRelacionadas:z.array(causaRelacionadaSchema).default([]),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLatestMovimiento(causa: any) {
  const all: any[] = [];
  for (const exp of causa.expedientes ?? []) {
    for (const mov of exp.movimientos ?? []) all.push(mov);
  }
  if (!all.length) return null;
  return all.sort((a, b) => {
    const parse = (f: string) => {
      const [d, t] = f.split(' ');
      const [day, mon, year] = d.split('/');
      return new Date(`${year}-${mon}-${day}T${t ?? '00:00:00'}`).getTime();
    };
    return parse(b.fecha) - parse(a.fecha);
  })[0];
}

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /causas */
export async function listCausas(req: Request, res: Response): Promise<void> {
  const { search, tribunal, arbitro } = req.query;

  const filter: Record<string, any> = {};
  if (search)   filter.$text = { $search: String(search) };
  if (tribunal) filter.tribunal = new RegExp(String(tribunal), 'i');
  if (arbitro)  filter.arbitro  = new RegExp(String(arbitro), 'i');

  const causas = await Causa.find(filter)
    .select('id identificador numeroInterno caratula tribunal arbitro fechaPresentacion fechaInicio ultimoMovimiento objetoJuicio')
    .sort({ createdAt: -1 });
  res.json(causas);
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

  const existing = await Causa.findOne({ $or: [{ id: parsed.data.id }, { identificador: parsed.data.identificador }] });
  if (existing) { res.status(409).json({ message: 'Causa with this id or identificador already exists' }); return; }

  const causa = await Causa.create(parsed.data);
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

// ── Expedientes ───────────────────────────────────────────────────────────────

/** POST /causas/:id/expedientes */
export async function addExpediente(req: Request, res: Response): Promise<void> {
  const parsed = expedienteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id },
    { $push: { expedientes: parsed.data } },
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
export async function addMovimiento(req: Request, res: Response): Promise<void> {
  const parsed = movimientoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $push: { 'expedientes.$.movimientos': parsed.data } },
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
/** POST /causas/:id/expedientes/:nroExpediente/sujetos */
export async function addSujeto(req: Request, res: Response): Promise<void>{
  const parsed = sujetoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id, 'expedientes.nroExpediente': req.params.nroExpediente },
    { $push: { 'expedientes.$.sujetos': parsed.data } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa or Expediente not found' }); return; }
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

/** POST /causas/:id/relacionadas */
export async function addCausaRelacionada(req: Request, res: Response): Promise<void> {
  const parsed = causaRelacionadaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten() }); return; }

  const causa = await Causa.findOneAndUpdate(
    { id: req.params.id },
    { $addToSet: { causasRelacionadas: parsed.data } },
    { new: true }
  );
  if (!causa) { res.status(404).json({ message: 'Causa not found' }); return; }
  res.status(201).json(causa);
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
