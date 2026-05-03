import { Router } from "express";

import { criarPedido } from "../controllers/Pedidos.Controller.js";

const router = Router();

/**
 * @swagger
 * /pedidos:
 *   post:
 *     summary: Cria um novo pedido
 *     description: Registra um novo pedido no sistema
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PedidoCreate'
 *           example:
 *             nome_cliente: "Maria Santos"
 *             telefone_cliente: "(11) 99999-9999"
 *             endereco_cliente: "Rua Example, 123"
 *             tipo_pedido: "Remoto"
 *             metodo_pagamento_id: 1
 *             valor_total: 50.00
 *             observacoes: "Sem cebola"
 *     responses:
 *       201:
 *         description: Pedido criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               status: "success"
 *               data:
 *                 id: 1
 *                 nome_cliente: "Maria Santos"
 *                 telefone_cliente: "(11) 99999-9999"
 *                 endereco_cliente: "Rua Example, 123"
 *                 tipo_pedido: "Remoto"
 *                 metodo_pagamento_id: 1
 *                 status: "Pendente"
 *                 valor_total: 50.00
 *                 observacoes: "Sem cebola"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflito - Dados incorretos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: "fail"
 *               message: "Dados do pedido inválidos."
 */
router.post('/', criarPedido)

export default router;