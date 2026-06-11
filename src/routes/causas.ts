import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { uploadRelacionada, uploadMovimiento, uploadCaratula } from '../middleware/upload';
import {
  listCausas, getCausa, createCausa, updateCausa, updateStatus, deleteCausa,
  addExpediente, updateExpediente, deleteExpediente,
  addMovimiento, deleteMovimiento, getArchivoMovimiento,
  addComentario, deleteComentario,
  addCausaRelacionada, removeCausaRelacionada, getArchivoRelacionada,
  addSujeto, deleteSujeto, addSujetoCausa,
  addCaratulaArchivo, getArchivoCaratula,
} from '../controllers/causaController';

const router = Router();

// All causa routes require authentication
router.use(authenticate);

// Causas
router.get ('/',           listCausas);
router.get ('/:id',        getCausa);
router.post('/',           authorize('actor', 'secretario'), createCausa);
router.put ('/:id',        authorize('actor', 'secretario'), updateCausa);
router.put ('/:id/status', authorize('secretario'),          updateStatus);
router.delete('/:id',      authorize('secretario'),          deleteCausa);

// Carátula
router.post('/:id/caratula',         authorize('actor', 'secretario'), uploadCaratula, addCaratulaArchivo);
router.get ('/:id/caratula/archivo', getArchivoCaratula);

// Expedientes
router.post  ('/:id/expedientes',                         authorize('actor', 'secretario'), addExpediente);
router.put   ('/:id/expedientes/:nroExpediente',          authorize('actor', 'secretario'), updateExpediente);
router.delete('/:id/expedientes/:nroExpediente',          authorize('secretario'),deleteExpediente);

// Movimientos
router.post  ('/:id/expedientes/:nroExpediente/movimientos',          uploadMovimiento, addMovimiento);
router.get   ('/:id/expedientes/:nroExpediente/movimientos/:movId/archivo', getArchivoMovimiento);
router.delete('/:id/expedientes/:nroExpediente/movimientos/:movId',   authorize('secretario'),            deleteMovimiento);

// Comentarios
router.post  ('/:id/expedientes/:nroExpediente/comentarios',                   authorize('secretario'), addComentario);
router.delete('/:id/expedientes/:nroExpediente/comentarios/:comentarioId',     authorize('secretario'), deleteComentario);

// Sujetos
router.post  ('/:id/sujetos',                                     authorize('secretario'), addSujetoCausa);
router.post  ('/:id/expedientes/:nroExpediente/sujetos',          authorize('secretario'), addSujeto);
// TODO: controller uses :nombre as identifier — consider migrating to :sujetoId once front-end is aligned
router.delete('/:id/expedientes/:nroExpediente/sujetos/:nombre',  authorize('secretario'), deleteSujeto);

// Causas Relacionadas
router.post  ('/:id/relacionadas',                              authorize('secretario'), uploadRelacionada, addCausaRelacionada);
router.get   ('/:id/relacionadas/:relacionadaId/archivo',       getArchivoRelacionada);
router.delete('/:id/relacionadas/:identificador',               authorize('secretario'), removeCausaRelacionada);

// Still adding and testing endpoints btw

export default router;
