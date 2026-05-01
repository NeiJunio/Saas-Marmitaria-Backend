import { Router } from "express";

import {
    buscarStatusLoja,
    alterarStatusLoja
} from "../controllers/StatusLoja.Controller.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

/**
 * @swagger
 * /status-loja:
 *   get:
 *     summary: Retorna o status atual da loja
 *     description: |
 *       Busca o status atual de abertura da loja (rota pública).
 *       Retorna um objeto com o campo 'esta_aberta' indicando se a loja está aberta ou fechada.
 *     tags: [StatusLoja]
 *     responses:
 *       200:
 *         description: Status da loja retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     esta_aberta:
 *                       type: boolean
 *                       example: true
 *                     atualizado_em:
 *                       type: string
 *                       example: "2026-04-30T10:00:00.000Z"
 *       404:
 *         description: Configuração de status não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: "fail"
 *               message: "Configuração de status não encontrada. Execute as seeds"
 */
router.get('/', buscarStatusLoja);

router.use(verifyToken)

/**
 * @swagger
 * /status-loja/alterar:
 *   patch:
 *     summary: Altera o status de abertura da loja
 *     description: |
 *       Atualiza o status de abertura/fechamento da loja.
 *       - Requer autenticação via token JWT
 *       - Requer permissão 'loja.status'
 *       - Registra um log de auditoria com a alteração
 *     tags: [StatusLoja]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: alterar
 *         required: true
 *         schema:
 *           type: string
 *         description: Rota fixa para alteração do status
 *         example: "alterar"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - esta_aberta
 *             properties:
 *               esta_aberta:
 *                 type: boolean
 *                 description: |
 *                   Define se a loja está aberta ou fechada.
 *                   - true: Loja aberta para pedidos
 *                   - false: Loja fechada
 *                 example: true
 *           examples:
 *             abrir_loja:
 *               summary: Abrir a loja
 *               value:
 *                 esta_aberta: true
 *             fechar_loja:
 *               summary: Fechar a loja
 *               value:
 *                 esta_aberta: false
 *     responses:
 *       200:
 *         description: Status alterado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             examples:
 *               loja_aberta:
 *                 summary: Loja aberta
 *                 value:
 *                   status: "success"
 *                   message: "A loja está ABERTA"
 *               loja_fechada:
 *                 summary: Loja fechada
 *                 value:
 *                   status: "success"
 *                   message: "A loja está FECHADA"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               corpo_vazio:
 *                 summary: Corpo da requisição vazio
 *                 value:
 *                   status: "fail"
 *                   message: "O corpo da requisição não pode estar vazio."
 *               tipo_invalido:
 *                 summary: Tipo de dado inválido
 *                 value:
 *                   status: "fail"
 *                   message: "O valor do parâmetro esta_aberta deve ser true ou false"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Registro não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: "fail"
 *               message: "Não foi possível atualizar: Registro inicial não encontrado."
 */
router.patch('/alterar', checkPermission('loja.status'), alterarStatusLoja);

export default router;