import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Lê o arquivo da chave privada que você colocou na raiz do projeto
const privateKeyPath = path.resolve('private-key.pem');
// const PRIVATE_KEY = fs.readFileSync(privateKeyPath, 'utf8');
const PRIVATE_KEY = process.env.QZ_PRIVATE_KEY ? process.env.QZ_PRIVATE_KEY.replace(/\\n/g, '\n') : fs.readFileSync(privateKeyPath, 'utf8');

export const assinarRequisicaoQZ = (req, res) => {
    // O QZ Tray envia uma string aleatória (desafio) chamada "request"
    const { request } = req.body; 
    
    if (!request) {
        return res.status(400).json({ error: 'String de requisição ausente.' });
    }

    try {
        // Cria a assinatura usando SHA-512 e a sua chave privada
        const signer = crypto.createSign('RSA-SHA512');
        signer.update(request);
        const signature = signer.sign(PRIVATE_KEY, 'base64');
        
        // Retorna a assinatura em base64 pura
        return res.status(200).send(signature);
    } catch (error) {
        console.error("Erro ao assinar QZ Tray:", error);
        return res.status(500).json({ error: 'Erro interno ao assinar a requisição.' });
    }
};