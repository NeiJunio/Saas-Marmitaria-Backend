import connection from "../database/connection";

export const checkPermission = (permissaoRequerida) => {

    return async (req, res, next) => {
        try {

            const usuarioId = req.usuarioId;
            const usuarioCargo = req.usuarioCargo;

            if (usuarioCargo === 'admin') {
                return next();
            }

            const temPermissao = await connection('permissoes_usuarios')
                .join('permissoes', 'permissoes_usuarios.permissao_id', '=', 'permissoes.id')
                .where('permissoes_usuarios.usuario_id', usuarioId)
                .andWhere('permissoes.nome', permissaoRequerida)
                .firts();

            if (!temPermissao) {
                return res.status(403).json({
                    status: 'error',
                    message: `Acesso negado: você não possui a permissão para esta ação.`
                });
            }

            return next();

        } catch (error) {
            console.error('🔴 Erro no Middleware de Permissão:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Erro interno ao validar permissões.'
            });
        }
    }
}