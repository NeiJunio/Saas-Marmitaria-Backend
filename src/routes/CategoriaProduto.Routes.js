import { Router } from "express";
import {
    listarCategoriasProdutosCardapio,
    listarCategoriasProdutosAdmin,
    buscarCategoriaProdutoPorId,
    criarCategoriaProduto,
    editarCategoriaProduto,
    inativarCategoriaProduto,
    reativarCategoriaProduto
} from "../controllers/CategoriaProduto.Controller.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

/**
 * ============================================================
 * ROTAS PÚBLICAS
 * ============================================================
 *
 * Devem permanecer antes do router.use(verifyToken).
 */

/**
 * Categorias disponíveis no cardápio do cliente.
 */
router.get('/cardapio', listarCategoriasProdutosCardapio);

/**
 * ============================================================
 * ROTAS PRIVADAS
 * ============================================================
 */
router.use(verifyToken);

/**
 * IMPORTANTE:
 * rotas fixas ficam antes das rotas /:id.
 */

/**
 * Lista administrativa.
 */
router.get('/admin', checkPermission('categorias_produtos.listar'), listarCategoriasProdutosAdmin);

/**
 * Criar categoria.
 */
router.post('/', checkPermission('categorias_produtos.criar'), criarCategoriaProduto);

/**
 * Restaurar categoria.
 */
router.patch('/:id/reativar', checkPermission('categorias_produtos.restaurar'), reativarCategoriaProduto);

/**
 * Buscar por ID.
 */
router.get('/:id', checkPermission('categorias_produtos.listar'), buscarCategoriaProdutoPorId);

/**
 * Editar categoria.
 */
router.patch('/:id', checkPermission('categorias_produtos.editar'), editarCategoriaProduto);

/**
 * Soft delete.
 */
router.delete('/:id', checkPermission('categorias_produtos.deletar'), inativarCategoriaProduto);

export default router;