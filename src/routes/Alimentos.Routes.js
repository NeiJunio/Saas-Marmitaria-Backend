import { Router } from "express";

import {
    criarAlimento,
    deletarAlimento,
    editarAlimento,
    listarAlimentos
} from "../controllers/Alimentos.Controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

/**
 * @swagger
 * /alimentos:
 *   get:
 *     summary: Lista todos os alimentos
 *     description: Retorna uma lista paginada de alimentos (requer autenticação e permissão)
 *     tags: [Alimentos]
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
 *         description: Termo de busca por nome
 *       - in: query
 *         name: deletados
 *         schema:
 *           type: string
 *           enum: [all, true, false]
 *           default: all
 *         description: Filtrar por status de exclusão
 *     responses:
 *       200:
 *         description: Lista de alimentos retornada com sucesso
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
 *                     $ref: '#/components/schemas/Alimento'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', listarAlimentos)


router.use(verifyToken);


/**
 * @swagger
 * /alimentos:
 *   post:
 *     summary: Cria um novo alimento
 *     description: Registra um novo alimento no sistema (requer autenticação e permissão)
 *     tags: [Alimentos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlimentoCreate'
 *           example:
 *             nome: "Frango Grelhado"
 *             categoria_id: 1
 *             descricao: "Filé de frango grelhado com temperos"
 *             disponivel_hoje: true
 *     responses:
 *       201:
 *         description: Alimento criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               data:
 *                 id: 1
 *                 nome: "Frango Grelhado"
 *                 categoria_id: 1
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
 *               message: "Este nome já está em uso."
 */
router.post('/', checkPermission('alimentos.criar'), criarAlimento)

/**
 * @swagger
 * /alimentos/{id}:
 *   patch:
 *     summary: Atualiza um alimento
 *     description: Atualiza os dados de um alimento existente (requer autenticação e permissão)
 *     tags: [Alimentos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do alimento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlimentoUpdate'
 *           example:
 *             nome: "Frango Grelhado Atualizado"
 *             categoria_id: 1
 *             descricao: "Filé de frango grelhado com temperos especiais"
 *             disponivel_hoje: true
 *     responses:
 *       200:
 *         description: Alimento atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', checkPermission('alimentos.editar'), editarAlimento)

/**
 * @swagger
 * /alimentos/{id}:
 *   delete:
 *     summary: Remove um alimento (soft delete)
 *     description: Realiza a exclusão lógica de um alimento (requer autenticação e permissão)
 *     tags: [Alimentos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do alimento
 *     responses:
 *       200:
 *         description: Alimento removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Alimento removido com sucesso"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', checkPermission('alimentos.deletar'), deletarAlimento)

export default router;