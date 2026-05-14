import { Router, IRouter } from 'express';
import * as AuthController from './auth.controller';
import { protect } from '@/middleware/authHandler';

const router: IRouter = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', protect, AuthController.getMe);

export { router as authRouter };
