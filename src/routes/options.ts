import { Router } from 'express';
import { getRolesOptions, getMovimientoOptions, getSujetoOptions } from '../controllers/optionsController';

const router = Router();

router.get('/roles',           getRolesOptions);
router.get('/movimientos',     getMovimientoOptions);
router.get('/sujetos',          getSujetoOptions);

export default router;