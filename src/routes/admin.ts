import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listUsuarios, aprobarUsuario, desactivarUsuario, activarUsuario, cambiarRolUsuario,
  listarAsignados, asignarUsuario, desasignarUsuario,
} from '../controllers/adminController';

const router = Router();

// All admin routes require authentication and secretario role
router.use(authenticate);
router.use(authorize('secretario'));

// ── Usuarios ──────────────────────────────────────────────────────────────────
router.get  ('/usuarios',                listUsuarios);
router.put  ('/usuarios/:id/aprobar',    aprobarUsuario);
router.put  ('/usuarios/:id/desactivar', desactivarUsuario);
router.put  ('/usuarios/:id/activar',    activarUsuario);
router.put  ('/usuarios/:id/rol',        cambiarRolUsuario);

// ── Asignaciones ──────────────────────────────────────────────────────────────
router.get   ('/causas/:causaId/expedientes/:nroExpediente/asignados',          listarAsignados);
router.post  ('/causas/:causaId/expedientes/:nroExpediente/asignados',          asignarUsuario);
router.delete('/causas/:causaId/expedientes/:nroExpediente/asignados/:userId',  desasignarUsuario);

export default router;
