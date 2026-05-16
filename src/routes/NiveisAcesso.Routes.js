import { Router } from "express";

import { listarNiveisDeAcesso } from "../controllers/NiveisAcesso.Controller.js";


import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

router.use(verifyToken);

router.get('/', checkPermission('niveis_acesso.listar'), listarNiveisDeAcesso);

export default router;
