import { Router } from "express";

import {
    criarAlimento,
    inativarAlimento,
    reativarAlimento,
    editarAlimento,
    listarAlimentos,
    listarAlimentosAdmin,
    buscarAlimentoPorId,
    alternarDisponibilidade,
    zerarCardapio,
    listarCardapioParaCliente // 🚀 Adicionado o import aqui!
} from "../controllers/Alimentos.Controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { checkPermission } from "../middlewares/checkPermission.js";

const router = Router();

// ==========================================
// 🟢 ROTAS PÚBLICAS (Sem Token)
// ==========================================

router.get('/', listarAlimentos);

// 🚀 Rota do Cliente TEM que ficar aqui em cima e sem token!
router.get('/cardapio-hoje', listarCardapioParaCliente);


// ==========================================
// 🔴 ROTAS PRIVADAS (Requerem Token e Permissão)
// ==========================================
router.use(verifyToken);

// 1. ROTAS FIXAS (Devem vir ANTES das rotas com /:id)
router.post('/', checkPermission('alimentos.criar'), criarAlimento);
router.get('/admin', checkPermission('alimentos.listar'), listarAlimentosAdmin);
router.patch('/zerar-cardapio', checkPermission('cardapio.gerenciar'), zerarCardapio); 

// 2. ROTAS DINÂMICAS (Com /:id)
router.get('/:id', checkPermission('alimentos.listar'), buscarAlimentoPorId);
router.patch('/:id/disponibilidade', checkPermission('cardapio.gerenciar'), alternarDisponibilidade);
router.patch('/:id/reativar', checkPermission('alimentos.editar'), reativarAlimento);
router.patch('/:id', checkPermission('alimentos.editar'), editarAlimento);
router.delete('/:id', checkPermission('alimentos.deletar'), inativarAlimento);

export default router;  