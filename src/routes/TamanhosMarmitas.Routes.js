import { Router } from "express";

import {
    listarTamanhosMarmitas,
    criarTamanhoMarmita,
    editarTamanhoMarmita,
    deletarTamanhoMarmita
} from "../controllers/TamanhosMarmitas.Controller.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

/**
 * @swagger
 * /tamanhos-marmitas:
 *   get:
 *     summary: Lista todos os tamanhos de marmitas
 *     description: Retorna uma lista paginada de tamanhos de marmitas disponíveis
 *     tags: [TamanhosMarmitas]
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
 *         description: Lista de tamanhos de marmitas retornada com sucesso
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
 *                     $ref: '#/components/schemas/TamanhoMarmita'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', listarTamanhosMarmitas);

router.use(verifyToken);

/**
 * @swagger
 * /tamanhos-marmitas:
 *   post:
 *     summary: Cria um novo tamanho de marmita
 *     description: Registra um novo tamanho de marmita no sistema (requer autenticação e permissão)
 *     tags: [TamanhosMarmitas]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TamanhoMarmitaCreate'
 *           example:
 *             nome: "Grande"
 *             preco_base: 25.00
 *             ativo: true
 *     responses:
 *       201:
 *         description: Tamanho de marmita criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               data:
 *                 id: 1
 *                 nome: "Grande"
 *                 preco_base: 25.00
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
router.post('/', checkPermission('tamanhos_marmitas.criar'), criarTamanhoMarmita)

/**
 * @swagger
 * /tamanhos-marmitas/{id}:
 *   patch:
 *     summary: Atualiza um tamanho de marmita
 *     description: Atualiza os dados de um tamanho de marmita existente (requer autenticação e permissão)
 *     tags: [TamanhosMarmitas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do tamanho de marmita
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TamanhoMarmitaUpdate'
 *           example:
 *             nome: "Grande Atualizado"
 *             preco_base: 26.00
 *             ativo: true
 *     responses:
 *       200:
 *         description: Tamanho de marmita atualizado com sucesso
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
router.patch('/:id', checkPermission('tamanhos_marmitas.editar'), editarTamanhoMarmita)

/**
 * @swagger
 * /tamanhos-marmitas/{id}:
 *   delete:
 *     summary: Remove um tamanho de marmita (soft delete)
 *     description: Realiza a exclusão lógica de um tamanho de marmita (requer autenticação e permissão)
 *     tags: [TamanhosMarmitas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do tamanho de marmita
 *     responses:
 *       200:
 *         description: Tamanho de marmita removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Tamanho de marmita removido com sucesso"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', checkPermission('tamanhos_marmitas.deletar'), deletarTamanhoMarmita)

export default router;