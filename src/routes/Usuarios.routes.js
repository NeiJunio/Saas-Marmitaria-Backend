import { Router } from "express";

import { criarUsuario, listarUsuarios } from "../controllers/UsuariosController.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.post('/', criarUsuario);

router.use(verifyToken);

router.get('/', listarUsuarios);

export default router;