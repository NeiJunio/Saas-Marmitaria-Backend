import { Router } from "express";

import {
    criarUsuario,
    listarUsuarios,
    listarUsuarioPorId,
    editarUsuario,
    inativarUsuario,
    reativarUsuario
} from "../controllers/Users.Controller.js";

import { editarPermissoesDoUsuario } from "../controllers/Permissions.Controller.js";

import { limitadorCadastro } from "../middlewares/rateLimiter.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Cria um novo usuário
 *     description: Registra um novo usuário no sistema (rota pública)
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioCreate'
 *           example:
 *             nome: "João Silva"
 *             email: "joao@email.com"
 *             senha: "Senha@12345"
 *             nivel_acesso_id: 1
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               data:
 *                 id: 1
 *                 nome: "João Silva"
 *                 email: "joao@email.com"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflito - Email já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: "fail"
 *               message: "Este email já está em uso."
 */
router.post('/', limitadorCadastro, criarUsuario);

router.use(verifyToken);

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Lista todos os usuários
 *     description: Retorna uma lista paginada de usuários (requer autenticação e permissão)
 *     tags: [Usuarios]
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
 *         description: Termo de busca por nome ou email
 *       - in: query
 *         name: deletados
 *         schema:
 *           type: string
 *           enum: [all, true, false]
 *           default: all
 *         description: Filtrar por status de exclusão
 *     responses:
 *       200:
 *         description: Lista de usuários retornada com sucesso
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
 *                     $ref: '#/components/schemas/Usuario'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', checkPermission('usuarios.listar'), listarUsuarios);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Retorna um usuário pelo ID
 *     description: Busca os dados de um usuário específico (requer autenticação e permissão)
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               data:
 *                 id: 1
 *                 nome: "João Silva"
 *                 email: "joao@email.com"
 *                 nivel_acesso_id: 1
 *                 cargo: "Administrador"
 *                 ativo: true
 *                 criado_em: "26/04/2026 10:00:00"
 *                 atualizado_em: "26/04/2026 10:00:00"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', checkPermission('usuarios.visualizar'), listarUsuarioPorId)

/**
 * @swagger
 * /usuarios/{id}:
 *   patch:
 *     summary: Atualiza um usuário
 *     description: Atualiza os dados de um usuário existente (requer autenticação e permissão)
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioUpdate'
 *           example:
 *             nome: "João Silva Atualizado"
 *             email: "joao.novo@email.com"
 *             nivel_acesso_id: 2
 *             ativo: true
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
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
router.patch('/:id', checkPermission('usuarios.editar'), editarUsuario)

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Inativa um usuário (soft delete)
 *     description: Realiza a exclusão lógica de um usuário (requer autenticação e permissão)
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Usuário inativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Usuário inativado com sucesso"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', checkPermission('usuarios.deletar'), inativarUsuario);

/**
 * @swagger
 * /usuarios/{id}/ativar:
 *   patch:
 *     summary: Reativa um usuário inativado
 *     description: Remove a data de exclusão lógica reactivate um usuário (requer autenticação e permissão)
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Usuário reativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Usuário reativado com sucesso"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/ativar', checkPermission('usuarios.editar'), reativarUsuario)

/**
 * @swagger
 * /usuarios/{id}/permissoes:
 *   patch:
 *     summary: Edita as permissões de um usuário específico
 *     description: |
 *       Atualiza as permissões de um usuário existente. 
 *       Esta rota substitui todas as permissões atuais do usuário pelas novas fornecidas.
 *       - Se enviar um array vazio, todas as permissões serão removidas do usuário
 *       - Se enviar permissões inválidas (que não existem no banco), retornará erro 400
 *       (requer autenticação e permissão 'permissoes.editar')
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário para editar permissões
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissoes
 *             properties:
 *               permissoes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: |
 *                   Array com os nomes das permissões a serem atribuídas ao usuário.
 *                   As permissões devem existir na tabela 'permissoes'.
 *                   Envie array vazio para remover todas as permissões.
 *                 example:
 *                   - "usuarios.listar"
 *                   - "usuarios.editar"
 *                   - "usuarios.deletar"
 *                   - "permissoes.listar"
 *           examples:
 *             atualizar:
 *               summary: Atualizar permissões
 *               value:
 *                 permissoes:
 *                   - "usuarios.listar"
 *                   - "usuarios.editar"
 *                   - "permissoes.listar"
 *             remover_todas:
 *               summary: Remover todas as permissões
 *               value:
 *                 permissoes: []
 *     responses:
 *       200:
 *         description: Permissões atualizadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               message: "Permissões atualizadas com sucesso!"
 *       400:
 *         description: Permissões inválidas ou dados incorretos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               permissoes_invalidas:
 *                 summary: Permissões inexistentes
 *                 value:
 *                   status: "fail"
 *                   message: "As seguintes permissões são inválidas: usuarios.deletar, permissoes.invalida"
 *               dados_invalidos:
 *                 summary: Dados inválidos
 *                 value:
 *                   status: "fail"
 *                   message: "Preencha todos os campos corretamente"
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
router.patch('/:id/permissoes', checkPermission('permissoes.editar'), editarPermissoesDoUsuario);

// teste de comentário

export default router;