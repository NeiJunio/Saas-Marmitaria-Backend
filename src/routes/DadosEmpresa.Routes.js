import {Router} from 'express';
import { buscarDadosEmpresa, salvarDadosEmpresa } from '../controllers/DadosEmpresa.Controller.js'

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";


const router = Router();

router.use(verifyToken);

router.get('/empresa', buscarDadosEmpresa);
router.put('/empresa', checkPermission('empresa.configurar'), salvarDadosEmpresa);

export default router;