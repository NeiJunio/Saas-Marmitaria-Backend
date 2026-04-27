import { Router } from "express";

import {
    listarPermissoes,
    listarPermissoesPorUsuario,
    listarPermissoesDoUsuarioLogado
 } from "../controllers/PermissoesController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

router.use(verifyToken);

/**
 * @swagger
 * /permissoes:
 *   get:
 *     summary: Lista todas as permissões
 *     description: Retorna uma lista de todas as permissões cadastradas no sistema RBAC (requer autenticação e permissão)
 *     tags: [Permissoes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de permissões retornada com sucesso
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
 *                     $ref: '#/components/schemas/Permissao'
 *                   example:
 *                     - id: 1
 *                       nome: "usuarios.listar"
 *                       descricao: "Permite listar usuários"
 *                     - id: 2
 *                       nome: "usuarios.editar"
 *                       descricao: "Permite editar usuários"
 *                 total:
 *                   type: integer
 *                   example: 15
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', checkPermission('permissoes.listar'), listarPermissoes);

/**
 * @swagger
 * /permissoes/me:
 *   get:
 *     summary: Retorna as permissões do usuário logado
 *     description: Busca as permissões específicas do usuário autenticado no momento (requer autenticação)
 *     tags: [Permissoes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Permissões do usuário logado retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 nome:
 *                   type: string
 *                   description: Nome do usuário logado
 *                   example: "João Silva"
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: E-mail do usuário logado
 *                   example: "joao@email.com"
 *                 nivel_acesso:
 *                   type: integer
 *                   description: ID do nível de acesso do usuário
 *                   example: 1
 *                 permissoes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Array com os nomes das permissões
 *                   example: ["usuarios.listar", "usuarios.editar", "permissoes.listar"]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', listarPermissoesDoUsuarioLogado)

/**
 * @swagger
 * /permissoes/{usuario_id}:
 *   get:
 *     summary: Retorna as permissões de um usuário específico
 *     description: Busca as permissões vinculadas a um usuário pelo seu ID (requer autenticação e permissão)
 *     tags: [Permissoes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: usuario_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário para buscar permissões
 *         example: 1
 *     responses:
 *       200:
 *         description: Permissões do usuário retornadas com sucesso
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
 *                         description: ID da permissão
 *                         example: 1
 *                       nome:
 *                         type: string
 *                         description: Nome da permissão
 *                         example: "usuarios.listar"
 *                   example:
 *                     - id: 1
 *                       nome: "usuarios.listar"
 *                     - id: 2
 *                       nome: "usuarios.editar"
 *       400:
 *         description: ID do usuário não fornecido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: "fail"
 *               message: "O id do usuário é obrigatório"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: "fail"
 *               message: "Usuário não encontrado"
 */
router.get('/:usuario_id', checkPermission('permissoes.visualizar'), listarPermissoesPorUsuario);

export default router;