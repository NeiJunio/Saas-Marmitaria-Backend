import { Router } from "express";

import { criarUsuario, listarUsuarios, listarUsuarioPorId, editarUsuario } from "../controllers/UsuariosController.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

router.post('/', criarUsuario);

router.use(verifyToken);

router.get('/', checkPermission('usuarios.listar'), listarUsuarios);
router.get('/:id', checkPermission('usuarios.visualizar'), listarUsuarioPorId)
router.patch('/:id', checkPermission('usuarios.editar'), editarUsuario)

export default router;