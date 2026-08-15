import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const buscarStatusLoja = async (req, res, next) => {
    try {
        const status = await connection('status_loja').where('status_loja.id', 1).first();

        if (!status) {
            lancarErro('Configuração de status não encontrada. Execute as seeds', 404);
        }

        return res.status(200).json({
            status: 'success',
            data: status
        });
    } catch (error) {
        next(error);
    }
};

export const alterarStatusLoja = async (req, res, next) => {
    let trx;

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            lancarErro('O corpo da requisição não pode estar vazio.', 400);
        }

        const { esta_aberta } = req.body;

        if (typeof esta_aberta !== 'boolean') {
            lancarErro('O valor do parâmetro esta_aberta deve ser true ou false.', 400);
        }

        trx = await connection.transaction();

        const statusAtual = await connection('status_loja').transacting(trx).where({ id: 1 }).forUpdate().first();

        if (!statusAtual) {
            lancarErro('Configuração inicial da loja não encontrada.', 404);
        }

        if (statusAtual.esta_aberta === esta_aberta) {
            await trx.rollback();

            return res.status(200).json({
                status: 'success',
                message: `A loja já está ${esta_aberta ? 'ABERTA' : 'FECHADA'}.`,
                data: { esta_aberta }
            });
        }

        await connection('status_loja').transacting(trx).where({ id: 1 }).update({ esta_aberta });

        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id: req.usuario.id,
            metodo: req.method,
            endpoint: req.originalUrl,
            acao: 'LOJA.STATUS',
            descricao: `${req.usuario.nome} alterou o status da loja para: ${esta_aberta ? 'ABERTA' : 'FECHADA'}`,
            payload: JSON.stringify({
                status_anterior: statusAtual.esta_aberta,
                novo_status: esta_aberta
            })
        });

        await trx.commit();

        // Após o COMMIT, avisa imediatamente todos os clientes conectados ao canal público.
        if (global.publicIo) {
            global.publicIo.emit('status_loja_alterado', {
                esta_aberta,
                atualizado_em: new Date().toISOString()
            });
        }

        return res.status(200).json({
            status: 'success',
            message: `A loja está ${esta_aberta ? 'ABERTA' : 'FECHADA'}.`,
            data: { esta_aberta }
        });
    } catch (error) {
        if (trx && !trx.isCompleted()) {
            await trx.rollback();
        }
        next(error);
    }
};
