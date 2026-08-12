import { Router } from 'express';
import { buscarDadosEmpresa, buscarDadosEmpresaPublicos, salvarDadosEmpresa } from '../controllers/DadosEmpresa.Controller.js'


import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";


const router = Router();

/**
 * ============================================================
 * ROTAS PÚBLICAS
 * ============================================================
 */

router.get('/empresa/publico', buscarDadosEmpresaPublicos);

router.use(verifyToken);

/**
 * ============================================================
 * ROTAS PRIVADAS
 * ============================================================
 */

router.get('/empresa', buscarDadosEmpresa);
router.put('/empresa', checkPermission('empresa.configurar'), salvarDadosEmpresa);

export default router;