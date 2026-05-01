import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const buscarStatusLoja = async (req, res, next) => {
    try {

        const status = await connection('status_loja')
            .where('status_loja.id', 1)
            .first()

        if (!status) {
            lancarErro('Configuração de status não encontrada. Execute as seeds', 404);
        }

        res.status(200).json({
            status: 'success',
            data: status
        })

    } catch (error) {
        next(error)
    }
}


export const alterarStatusLoja = async (req, res, next) => {

    if (!req.body) {
        lancarErro('O corpo da requisição não pode estar vazio.', 400)
    }

    const { esta_aberta } = req.body;

    const trx = await connection.transaction();

    try {

        if (typeof esta_aberta !== 'boolean') {
            (await trx).rollback();
            lancarErro('O valor do parâmetro esta_aberta deve ser true ou false', 400)
        }

        const atualizado = await connection('status_loja')
            .transacting(trx)
            .update({
                esta_aberta: esta_aberta
            })
            .where('status_loja.id', 1)

        if (atualizado === 0) {
            await rollback();

            lancarErro('Não foi possível atualizar: Registro inicial não encontrado.')
        }

        // Log de auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'LOJA.STATUS',
                descricao: `${req.usuario.nome} alterou o status da loja para: ${esta_aberta ? 'ABERTA' : 'FECHADA'}`,
                payload: JSON.stringify({ novo_status: esta_aberta })
            })

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: `A loja está ${esta_aberta ? 'ABERTA' : 'FECHADA'}`
        })


    } catch (error) {

        if (trx) {

            await trx.rollback();
        }

        next(error)
    }

}