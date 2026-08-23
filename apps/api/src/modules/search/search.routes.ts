import { Router, IRouter } from 'express';
import { search } from './search.controller';

const router: IRouter = Router();
router.get('/search', search);
export { router as searchRouter };
