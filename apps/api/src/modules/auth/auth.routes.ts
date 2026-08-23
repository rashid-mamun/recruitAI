import { Router, IRouter } from 'express';
import * as AuthController from './auth.controller';
import { protect } from '@/middleware/authHandler';
import { authLimiter } from '@/middleware/rateLimiters';

const router: IRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, recruiter]
 *     responses:
 *       201:
 *         description: Successfully registered
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', authLimiter, AuthController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully logged in
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authLimiter, AuthController.login);
router.post('/password-reset/request', authLimiter, AuthController.requestPasswordReset);
router.post('/password-reset/confirm', authLimiter, AuthController.confirmPasswordReset);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Login or register with a Google ID token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credential
 *             properties:
 *               credential:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully authenticated with Google
 *       401:
 *         description: Invalid Google credential
 */
router.post('/google', authLimiter, AuthController.googleLogin);
router.post('/refresh', authLimiter, AuthController.refresh);
router.post('/logout', protect, AuthController.logout);
router.post('/switch-workspace', protect, AuthController.switchWorkspace);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Unauthorized
 */
router.get('/me', protect, AuthController.getMe);

export { router as authRouter };
