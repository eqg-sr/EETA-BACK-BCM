import mongoose, { Document, Schema } from 'mongoose';
import { SujetoVinculo, MovimientoTipo, CausaStatus } from '../types';

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export interface ISujeto {
  vinculo: SujetoVinculo;
  nombre: string;
  representante?: string;
  domicilio?: string;
  domicilioElectronico?: string;
  aprobacionToken?: string;
  aprobado: boolean;
}

const SujetoSchema = new Schema(
  {
    vinculo:              { type: String, enum: ['ACTOR', 'DEMANDADO', 'TERCERO'] as SujetoVinculo[], required: true },
    nombre:               { type: String, required: true },
    representante:        { type: String },
    domicilio:            { type: String },
    domicilioElectronico: { type: String },
    aprobacionToken:      { type: String },
    aprobado:             { type: Boolean, default: function (this: ISujeto) { return this.vinculo === 'DEMANDADO'; } },
  },
  { _id: false }
);

export interface IMovimiento {
  id: string;
  fecha: Date;
  tipo: MovimientoTipo;
  titulo: string;
  descripcion: string;
  numero?: string;
  tribunal?: string;
  presentante?: string;
  acceso?: string;
  adjuntos?: boolean;
  relaciones?: boolean;
  archivo?: string;
  nombreArchivo?: string;
  sujetoNombre?: string;
}

const MovimientoSchema = new Schema(
  {
    id:          { type: String, required: true },
    fecha:       { type: Date, required: true },
    tipo:        { type: String, enum: ['ACT', 'ESC', 'CED', 'RES', 'NOT', 'AUD', 'PER', 'SEN'] as MovimientoTipo[], required: true },
    titulo:      { type: String, required: true },
    descripcion: { type: String, required: true, maxlength: 2000 },
    numero:      { type: String },
    tribunal:    { type: String },
    presentante: { type: String },
    acceso:      { type: String },
    adjuntos:    { type: Boolean },
    relaciones:  { type: Boolean },
    archivo:       { type: String },
    nombreArchivo: { type: String },
    sujetoNombre:  { type: String },
  },
  { _id: false }
);

const ComentarioSchema = new Schema(
  {
    id:     { type: String, required: true },
    autor:  { type: String, required: true },
    rol:    { type: String, required: true },
    fecha:  { type: Date, required: true },
    texto:  { type: String, required: true },
  },
  { _id: false }
);

const ExpedienteSchema = new Schema(
  {
    nroExpediente:    { type: String, required: true },
    caratula:         { type: String, required: true },
    fechaPresentacion:{ type: Date, required: true },
    fechaInicio:      { type: Date, required: true },
    ultimoMovimiento: { type: Date, required: true },
    objetoJuicio:     { type: String, required: true },
    montoDisputa:     { type: String },
    adjuntoNombre:    { type: String },
    asignados:    { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    sujetos:      { type: [SujetoSchema], default: [] },
    movimientos:  { type: [MovimientoSchema], default: [] },
    comentarios:  { type: [ComentarioSchema], default: [] },
  },
  { _id: false }
);

const CausaRelacionadaSchema = new Schema(
  {
    identificador: { type: String, required: true },
    caratula:      { type: String },
    tribunal:      { type: String },
    descripcion:   { type: String, required: true, maxlength: 500 },
    archivo:       { type: String },
    nombreArchivo: { type: String },
    creadoEn:      { type: Date, default: Date.now },
  },
);

// ── Main Causa document ───────────────────────────────────────────────────────

export interface ICausa extends Document {
  id: string;
  identificador: string;
  numeroInterno: string;
  caratula: string;
  tribunal?: string;
  nroExpedienteElectronico?: string;
  arbitro: string;
  fechaPresentacion: Date;
  fechaInicio: Date;
  ultimoMovimiento: Date;
  objetoJuicio: string;
  status: CausaStatus;
  archivo?: string;
  nombreArchivo?: string;
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
    nroExpedienteElectronico: { type: String },
    arbitro:          { type: String, required: true },
    fechaPresentacion:{ type: Date, required: true },
    fechaInicio:      { type: Date, required: true },
    ultimoMovimiento: { type: Date, required: true },
    objetoJuicio:     { type: String, required: true },
    status:           { type: String, enum: ['pendiente', 'iniciado', 'en_proceso', 'cerrado'] as CausaStatus[], default: 'pendiente' },
    archivo:          { type: String },
    nombreArchivo:    { type: String },
    sujetos:          { type: [SujetoSchema], default: [] },
    expedientes:      { type: [ExpedienteSchema], default: [] },
    causasRelacionadas:{ type: [CausaRelacionadaSchema], default: [] },
  },
  { timestamps: true }
);

// Text index for caratula search
CausaSchema.index({ caratula: 'text', identificador: 'text' });

export const Causa = mongoose.model<ICausa>('Causa', CausaSchema);
