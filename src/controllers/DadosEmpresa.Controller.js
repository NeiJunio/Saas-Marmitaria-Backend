import connection from "../database/connection.js";
import { isValidCPF, isValidCNPJ } from "../utils/validators.js";

export const buscarDadosEmpresa = async (req, res, next) => {
    try {
        // Busca sempre o registro principal (ID 1)
        const empresa = await connection('dados_empresa').where('id', 1).first();
        
        return res.status(200).json({
            status: 'success',
            data: empresa || null // Retorna null se ainda não houver cadastro
        });
    } catch (error) {
        next(error);
    }
};

// export const salvarDadosEmpresa = async (req, res, next) => {
//     const dados = req.body;

//     if (!dados.cnpj || !isValidCNPJ(dados.cnpj)) {
//         return res.status(400).json({
//             status: 'error',
//             message: 'O CNPJ informado é inválido ou está em branco.'
//         });
//     }

//     // 2. Valida CPF (Opcional - só valida se estiver preenchido)
//     if (dados.cpf_proprietario && dados.cpf_proprietario.trim() !== "") {
//         if (!isValidCPF(dados.cpf_proprietario)) {
//             return res.status(400).json({
//                 status: 'error',
//                 message: 'O CPF do proprietário informado é inválido.'
//             });
//         }
//     }
    
//     try {
//         const empresaExistente = await connection('dados_empresa').where('id', 1).first();
        
//         // Garante que o atualizado_em seja sempre a data de agora na edição
//         const payload = {
//             ...dados,
//             atualizado_em: connection.fn.now()
//         };

//         if (empresaExistente) {
//             // Se já existe, faz o UPDATE
//             const [empresaAtualizada] = await connection('dados_empresa')
//                 .where('id', 1)
//                 .update(payload)
//                 .returning('*');
                
//             return res.status(200).json({
//                 status: 'success',
//                 message: 'Dados da empresa atualizados com sucesso.',
//                 data: empresaAtualizada
//             });
//         } else {
//             // Se não existe, cria forçando o ID 1 e remove atualizado_em do insert inicial se preferir
//             delete payload.atualizado_em;
            
//             const [novaEmpresa] = await connection('dados_empresa')
//                 .insert({ ...payload, id: 1 })
//                 .returning('*');
                
//             return res.status(201).json({
//                 status: 'success',
//                 message: 'Dados da empresa cadastrados com sucesso.',
//                 data: novaEmpresa
//             });
//         }
//     } catch (error) {
//         next(error);
//     }
// };

export const salvarDadosEmpresa = async (req, res, next) => {
    const dados = req.body;
    const usuarioId = req.usuario?.id || null; 
    
    if (!dados.cnpj || !isValidCNPJ(dados.cnpj)) {
        return res.status(400).json({
            status: 'error',
            message: 'O CNPJ informado é inválido ou está em branco.'
        });
    }

    if (dados.cpf_proprietario && dados.cpf_proprietario.trim() !== "") {
        if (!isValidCPF(dados.cpf_proprietario)) {
            return res.status(400).json({
                status: 'error',
                message: 'O CPF do proprietário informado é inválido.'
            });
        }
    }

    try {
        const empresaExistente = await connection('dados_empresa').where('id', 1).first();
        
        const payload = {
            ...dados,
            atualizado_em: connection.fn.now()
        };

        let empresaRetorno;
        let logAcao;
        let logDescricao;
        let statusCode;
        let mensagemSucesso;

        if (empresaExistente) {
            // Se já existe, faz o UPDATE
            const [empresaAtualizada] = await connection('dados_empresa')
                .where('id', 1)
                .update(payload)
                .returning('*');
                
            empresaRetorno = empresaAtualizada;
            logAcao = 'ATUALIZAR_EMPRESA';
            logDescricao = `Configurações da empresa (${dados.nome_fantasia}) foram atualizadas.`;
            statusCode = 200;
            mensagemSucesso = 'Dados da empresa atualizados com sucesso.';
        } else {
            // Se não existe, cria (INSERT)
            delete payload.atualizado_em; 
            
            const [novaEmpresa] = await connection('dados_empresa')
                .insert({ ...payload, id: 1 })
                .returning('*');
                
            empresaRetorno = novaEmpresa;
            logAcao = 'CADASTRAR_EMPRESA';
            logDescricao = `Configurações da empresa (${dados.nome_fantasia}) foram cadastradas pela primeira vez.`;
            statusCode = 201;
            mensagemSucesso = 'Dados da empresa cadastrados com sucesso.';
        }

        // 📝 REGISTRO DE AUDITORIA (LOGS)
        await connection('logs').insert({
            usuario_id: usuarioId,
            acao: logAcao,
            descricao: logDescricao,
            tipo: 'ACAO',
            metodo: req.method,
            endpoint: req.originalUrl,
            payload: JSON.stringify(dados) // Guarda o que o usuário preencheu no formulário
        });

        // Retorno final para o Frontend
        return res.status(statusCode).json({
            status: 'success',
            message: mensagemSucesso,
            data: empresaRetorno
        });

    } catch (error) {
        next(error);
    }
};