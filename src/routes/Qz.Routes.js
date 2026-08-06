import { Router } from 'express';
import { assinarRequisicaoQZ } from '../controllers/Qz.Controller.js'; // Ajuste o caminho se necessário

const qzRoutes = Router();

// Rota para o frontend pedir a assinatura do certificado
qzRoutes.post('/assinar', assinarRequisicaoQZ);

export default qzRoutes;