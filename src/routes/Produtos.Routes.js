import { Router } from "express";

import {
    listarProdutosCardapio,
    listarProdutosAdmin,
    buscarProdutoPorId,
    criarProduto,
    editarProduto,
    alternarDisponibilidadeProduto,
    inativarProduto,
    reativarProduto
} from "../controllers/Produtos.Controller.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

/**
 * ============================================================
 * ROTAS PÚBLICAS
 * ============================================================
 */

/**
 * Retorna somente produtos realmente
 * disponíveis para venda ao cliente.
 */
router.get('/cardapio', listarProdutosCardapio);

/**
 * ============================================================
 * ROTAS PRIVADAS
 * ============================================================
 */
router.use(verifyToken);

/**
 * Rotas fixas sempre ficam antes
 * das rotas dinâmicas /:id.
 */

/**
 * Listagem administrativa.
 */
router.get('/admin', checkPermission('produtos.listar'), listarProdutosAdmin);

/**
 * Cadastro.
 */
router.post('/', checkPermission('produtos.criar'), criarProduto);

/**
 * Disponibilidade diária.
 */
router.patch('/:id/disponibilidade', checkPermission('produtos.disponibilidade'), alternarDisponibilidadeProduto);

/**
 * Restauração.
 */
router.patch('/:id/reativar', checkPermission('produtos.restaurar'), reativarProduto);

/**
 * Detalhes.
 */
router.get('/:id', checkPermission('produtos.visualizar'), buscarProdutoPorId);

/**
 * Edição.
 */
router.patch('/:id', checkPermission('produtos.editar'), editarProduto);

/**
 * Soft delete.
 */
router.delete('/:id', checkPermission('produtos.deletar'), inativarProduto);

export default router;