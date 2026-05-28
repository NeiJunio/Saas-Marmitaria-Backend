import { Router } from "express";

import {
    criarCategoriaDeAlimento,
    editarCategoriaDeAlimento,
    listarCategoriasDeAlimentos,
    listarCategoriaDeAlimentoPorId,
    inativarCategoriaDeAlimento,
    reativarCategoriaDeAlimento
} from "../controllers/CategoriaAlimento.Controller.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

router.use(verifyToken)

/**
 * @swagger
 * /categorias-alimentos:
 *   get:
 *     summary: Lista todas as categorias de alimentos
 *     description: Retorna uma lista paginada de categorias de alimentos (requer autenticação e permissão)
 *     tags: [Categorias Alimentos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limite de registros por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Termo de busca por nome da categoria
 *       - in: query
 *         name: deletados
 *         schema:
 *           type: string
 *           enum: [all, true, false]
 *           default: all
 *         description: Filtrar por status de exclusão
 *     responses:
 *       200:
 *         description: Lista de categorias retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CategoriaAlimento'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', checkPermission('categorias_alimentos.listar'), listarCategoriasDeAlimentos)
router.get('/:id', checkPermission('categorias_alimentos.visualizar'), listarCategoriaDeAlimentoPorId) 

/**
 * @swagger
 * /categorias-alimentos:
 *   post:
 *     summary: Cria uma nova categoria de alimento
 *     description: Registra uma nova categoria de alimento no sistema (requer autenticação e permissão)
 *     tags: [Categorias Alimentos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaAlimentoCreate'
 *           example:
 *             nome: "Proteína"
 *             limite_escolhas: 2
 *             ativo: true
 *     responses:
 *       201:
 *         description: Categoria de alimento criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               data:
 *                 id: 1
 *                 nome: "Proteína"
 *                 limite_escolhas: 2
 *                 ativo: true
 *                 criado_em: "01/05/2026 10:00:00"
 *                 atualizado_em: "01/05/2026 10:00:00"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Conflito - Nome já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: "fail"
 *               message: "Já existe uma categoria com este nome."
 */
router.post('/', checkPermission('categorias_alimentos.criar'), criarCategoriaDeAlimento);

/**
 * @swagger
 * /categorias-alimentos/{id}:
 *   patch:
 *     summary: Atualiza uma categoria de alimento
 *     description: Atualiza os dados de uma categoria de alimento existente (requer autenticação e permissão)
 *     tags: [Categorias Alimentos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da categoria de alimento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaAlimentoUpdate'
 *           example:
 *             nome: "Proteína Atualizada"
 *             limite_escolhas: 3
 *             ativo: true
 *     responses:
 *       200:
 *         description: Categoria de alimento atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               data:
 *                 id: 1
 *                 nome: "Proteína Atualizada"
 *                 limite_escolhas: 3
 *                 ativo: true
 *                 criado_em: "01/05/2026 10:00:00"
 *                 atualizado_em: "01/05/2026 11:30:00"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflito - Nome já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: "fail"
 *               message: "Já existe uma categoria com este nome."
 */
router.patch('/:id', checkPermission('categorias_alimentos.editar'), editarCategoriaDeAlimento);

/**
 * @swagger
 * /categorias-alimentos/{id}:
 *   delete:
 *     summary: Inativa uma categoria de alimento (soft delete)
 *     description: Realiza a exclusão lógica de uma categoria de alimento (requer autenticação e permissão)
 *     tags: [Categorias Alimentos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da categoria de alimento
 *     responses:
 *       200:
 *         description: Categoria de alimento inativada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Categoria de alimento inativada com sucesso"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', checkPermission('categorias_alimentos.deletar'), inativarCategoriaDeAlimento);

/**
 * @swagger
 * /categorias-alimentos/{id}/reativar:
 *   patch:
 *     summary: Reativa uma categoria de alimento inativada
 *     description: Remove a data de exclusão lógica e reativa a categoria de alimento (requer autenticação e permissão)
 *     tags: [Categorias Alimentos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da categoria de alimento
 *     responses:
 *       200:
 *         description: Categoria de alimento reativada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Categoria de alimento reativada com sucesso"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/reativar', checkPermission('categorias_alimentos.editar'), reativarCategoriaDeAlimento);
export default router;