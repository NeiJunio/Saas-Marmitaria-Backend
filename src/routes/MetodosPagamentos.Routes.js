import { Router } from "express";

import {
    listarMetodosDePagamentosAtivos,
    listarTodosMetodosPagamentos,
    criarMetodoPagamento,
    editarMetodoPagamento,
    deletarMetodoPagamento,
    restaurarMetodoPagamento
} from "../controllers/MetodosPagamentos.Controller.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

/**
 * @swagger
 * /metodos-pagamento:
 *   get:
 *     summary: Lista métodos de pagamento ativos
 *     description: Retorna uma lista de métodos de pagamento ativos (rota pública)
 *     tags: [MetodosPagamento]
 *     responses:
 *       200:
 *         description: Lista de métodos retornada com sucesso
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       nome:
 *                         type: string
 *                         example: "Dinheiro"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', listarMetodosDePagamentosAtivos)

router.use(verifyToken)

/**
 * @swagger
 * /metodos-pagamento/todos:
 *   get:
 *     summary: Lista todos os métodos de pagamento
 *     description: Retorna uma lista completa de métodos de pagamento, incluindo inativos e deletados (requer autenticação e permissão)
 *     tags: [MetodosPagamento]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista completa de métodos retornada com sucesso
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
 *                     $ref: '#/components/schemas/MetodoPagamento'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/todos', checkPermission('metodos_pagamento.listar'), listarTodosMetodosPagamentos)

/**
 * @swagger
 * /metodos-pagamento:
 *   post:
 *     summary: Cria um novo método de pagamento
 *     description: Registra um novo método de pagamento no sistema (requer autenticação e permissão)
 *     tags: [MetodosPagamento]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MetodoPagamentoCreate'
 *           example:
 *             nome: "Cartão de Crédito"
 *             ativo: true
 *     responses:
 *       201:
 *         description: Método de pagamento criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Método de pagamento criado com sucesso."
 *               data:
 *                 id: 2
 *                 nome: "Cartão de Crédito"
 *                 ativo: true
 *                 criado_em: "2026-05-10T13:46:05.000Z"
 *                 atualizado_em: "2026-05-10T13:46:05.000Z"
 *                 deletado_em: null
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', checkPermission('metodos_pagamento.criar'), criarMetodoPagamento)

/**
 * @swagger
 * /metodos-pagamento/{id}:
 *   patch:
 *     summary: Atualiza um método de pagamento
 *     description: Atualiza os dados de um método de pagamento existente (requer autenticação e permissão)
 *     tags: [MetodosPagamento]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do método de pagamento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MetodoPagamentoUpdate'
 *           example:
 *             nome: "Cartão de Débito"
 *             ativo: false
 *     responses:
 *       200:
 *         description: Método de pagamento atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Atualizado com sucesso."
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/:id', checkPermission('metodos_pagamento.editar'), editarMetodoPagamento)

/**
 * @swagger
 * /metodos-pagamento/{id}/restaurar:
 *   patch:
 *     summary: Restaura um método de pagamento deletado
 *     description: Remove a marcação de exclusão e reativa um método de pagamento (requer autenticação e permissão)
 *     tags: [MetodosPagamento]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do método de pagamento
 *     responses:
 *       200:
 *         description: Método de pagamento restaurado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Método de pagamento restaurado e ativado com sucesso."
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/:id/restaurar', checkPermission('metodos_pagamento.restaurar'), restaurarMetodoPagamento)

/**
 * @swagger
 * /metodos-pagamento/{id}:
 *   delete:
 *     summary: Deleta um método de pagamento (soft delete)
 *     description: Realiza a exclusão lógica de um método de pagamento (requer autenticação e permissão)
 *     tags: [MetodosPagamento]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do método de pagamento
 *     responses:
 *       200:
 *         description: Método de pagamento deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Método excluído com sucesso."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:id', checkPermission('metodos_pagamento.deletar'), deletarMetodoPagamento)

export default router;