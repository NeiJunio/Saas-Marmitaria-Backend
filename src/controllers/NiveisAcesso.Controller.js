import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const listarNiveisDeAcesso = async (req, res, next) => {

    try {

        const niveisDeAcesso = await connection('niveis_acesso')
            .where('ativo', true)

        return res.status(200).json({
            status: 'success',
            data: niveisDeAcesso
        })

    } catch (error) {
        next(error);
    }

}