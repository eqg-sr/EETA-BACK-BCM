import mongoose, { Document, Schema } from 'mongoose';
import { SujetoVinculo, MovimientoTipo } from '../types';

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const SujetoSchema = new Schema(
  {
    vinculo:              { type: String, enum: ['ACTOR', 'DEMANDADO', 'TERCERO'] as SujetoVinculo[], required: true },
    nombre:               { type: String, required: true },
    representante:        { type: String },
    domicilio:            { type: String },
    domicilioElectronico: { type: String },
  },
  { _id: false }
);

const MovimientoSchema = new Schema(
  {
    id:          { type: String, required: true },
    fecha:       { type: String, required: true },
    tipo:        { type: String, enum: ['ACT', 'ESC', 'CED', 'RES', 'NOT', 'AUD', 'PER', 'SEN'] as MovimientoTipo[], required: true },
    titulo:      { type: String, required: true },
    numero:      { type: String },
    tribunal:    { type: String },
    presentante: { type: String },
    acceso:      { type: String },
    adjuntos:    { type: Boolean },
    relaciones:  { type: Boolean },
  },
  { _id: false }
);

const ComentarioSchema = new Schema(
  {
    id:     { type: String, required: true },
    autor:  { type: String, required: true },
    rol:    { type: String, required: true },
    fecha:  { type: String, required: true },
    texto:  { type: String, required: true },
  },
  { _id: false }
);

const ExpedienteSchema = new Schema(
  {
    nroExpediente:    { type: String, required: true },
    caratula:         { type: String, required: true },
    fechaPresentacion:{ type: String, required: true },
    fechaInicio:      { type: String, required: true },
    ultimoMovimiento: { type: String, required: true },
    objetoJuicio:     { type: String, required: true },
    montoDisputa:     { type: String },
    adjuntoNombre:    { type: String },
    sujetos:          { type: [SujetoSchema], default: [] },
    movimientos:      { type: [MovimientoSchema], default: [] },
    comentarios:      { type: [ComentarioSchema], default: [] },
  },
  { _id: false }
);

const CausaRelacionadaSchema = new Schema(
  {
    identificador: { type: String, required: true },
    caratula:      { type: String, required: true },
    tribunal:      { type: String, required: true },
  },
  { _id: false }
);

// ── Main Causa document ───────────────────────────────────────────────────────

export interface ICausa extends Document {
  id: string;
  identificador: string;
  numeroInterno: string;
  caratula: string;
  tribunal?: string;
  arbitro: string;
  fechaPresentacion: string;
  fechaInicio: string;
  ultimoMovimiento: string;
  objetoJuicio: string;
  sujetos: typeof SujetoSchema[];
  expedientes: typeof ExpedienteSchema[];
  causasRelacionadas: typeof CausaRelacionadaSchema[];
}

const CausaSchema = new Schema<ICausa>(
  {
    id:               { type: String, required: true, unique: true },
    identificador:    { type: String, required: true, unique: true },
    numeroInterno:    { type: String, required: true },
    caratula:         { type: String, required: true },
    tribunal:         { type: String, default: 'Tribunal Arbitral BCM' },
    arbitro:          { type: String, required: true },
    fechaPresentacion:{ type: String, required: true },
    fechaInicio:      { type: String, required: true },
    ultimoMovimiento: { type: String, required: true },
    objetoJuicio:     { type: String, required: true },
    sujetos:          { type: [SujetoSchema], default: [] },
    expedientes:      { type: [ExpedienteSchema], default: [] },
    causasRelacionadas:{ type: [CausaRelacionadaSchema], default: [] },
  },
  { timestamps: true }
  
);

// Text index for caratula search
CausaSchema.index({ caratula: 'text', identificador: 'text' });

export const Causa = mongoose.model<ICausa>('Causa', CausaSchema);
