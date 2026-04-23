import { Router } from "express";

import { criarUsuario, listarUsuarios } from "../controllers/UsuariosController.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

router.post('/', criarUsuario);

router.use(verifyToken);

router.get('/', checkPermission('usuarios.listar'), listarUsuarios);

export default router;