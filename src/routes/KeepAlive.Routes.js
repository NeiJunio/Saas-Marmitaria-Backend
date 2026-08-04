// src/routes/keepAliveRoutes.js

import express from 'express';
import { ping } from '../controllers/KeepAlive.Controller.js';

const router = express.Router();

// A rota raiz deste arquivo chamará o controller
router.get('/', ping);

export default router;