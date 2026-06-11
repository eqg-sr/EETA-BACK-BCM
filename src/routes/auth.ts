import { Router } from 'express';
import { register, login, me, autorizarSujeto } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login',    login);
router.get('/self',        authenticate, me);
router.get('/autorizar',   autorizarSujeto);

export default router;
