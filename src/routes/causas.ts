import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { uploadRelacionada, uploadMovimiento, uploadCaratula, uploadMemory } from '../middleware/upload';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listCausas, getCausa, createCausa, updateCausa, updateStatus, deleteCausa,
  addExpediente, updateExpediente, deleteExpediente,
  addMovimiento, updateMovimiento, deleteMovimiento, getArchivoMovimiento,
  addComentario, deleteComentario,
  addCausaRelacionada, removeCausaRelacionada, getArchivoRelacionada,
  addSujeto, deleteSujeto, addSujetoCausa,
  addCaratulaArchivo, getArchivoCaratula,
  parseDemanda,
} from '../controllers/causaController';

const router = Router();

// All causa routes require authentication
router.use(authenticate);

// Parse demanda — must be before /:id to avoid route conflict
router.post('/parse-demanda', authorize('actor', 'secretario'), uploadMemory.single('archivo'), asyncHandler(parseDemanda));

// Causas
router.get ('/',           asyncHandler(listCausas));
router.get ('/:id',        asyncHandler(getCausa));
router.post('/',           authorize('actor', 'secretario'), asyncHandler(createCausa));
router.put ('/:id',        authorize('actor', 'secretario'), asyncHandler(updateCausa));
router.put ('/:id/status', authorize('secretario'),          asyncHandler(updateStatus));
router.delete('/:id',      authorize('secretario'),          asyncHandler(deleteCausa));

// Carátula
router.post('/:id/caratula',         authorize('actor', 'secretario'), uploadCaratula, asyncHandler(addCaratulaArchivo));
router.get ('/:id/caratula/archivo', asyncHandler(getArchivoCaratula));

// Expedientes
router.post  ('/:id/expedientes',                         authorize('actor', 'secretario'), asyncHandler(addExpediente));
router.put   ('/:id/expedientes/:nroExpediente',          authorize('actor', 'secretario'), asyncHandler(updateExpediente));
router.delete('/:id/expedientes/:nroExpediente',          authorize('secretario'),asyncHandler(deleteExpediente));

// Movimientos
router.post  ('/:id/expedientes/:nroExpediente/movimientos',                        uploadMovimiento,         asyncHandler(addMovimiento));
router.put   ('/:id/expedientes/:nroExpediente/movimientos/:movId',                authorize('secretario'),  asyncHandler(updateMovimiento));
router.get   ('/:id/expedientes/:nroExpediente/movimientos/:movId/archivo',                                  asyncHandler(getArchivoMovimiento));
router.delete('/:id/expedientes/:nroExpediente/movimientos/:movId',                authorize('secretario'),  asyncHandler(deleteMovimiento));

// Comentarios
router.post  ('/:id/expedientes/:nroExpediente/comentarios',                   authorize('secretario'), asyncHandler(addComentario));
router.delete('/:id/expedientes/:nroExpediente/comentarios/:comentarioId',     authorize('secretario'), asyncHandler(deleteComentario));

// Sujetos
router.post  ('/:id/sujetos',                                     authorize('secretario'), asyncHandler(addSujetoCausa));
router.post  ('/:id/expedientes/:nroExpediente/sujetos',          authorize('secretario'), asyncHandler(addSujeto));
// TODO: controller uses :nombre as identifier — consider migrating to :sujetoId once front-end is aligned
router.delete('/:id/expedientes/:nroExpediente/sujetos/:nombre',  authorize('secretario'), asyncHandler(deleteSujeto));

// Causas Relacionadas
router.post  ('/:id/relacionadas',                              authorize('secretario'), uploadRelacionada, asyncHandler(addCausaRelacionada));
router.get   ('/:id/relacionadas/:relacionadaId/archivo',       asyncHandler(getArchivoRelacionada));
router.delete('/:id/relacionadas/:identificador',               authorize('secretario'), asyncHandler(removeCausaRelacionada));

// Still adding and testing endpoints btw

export default router;
