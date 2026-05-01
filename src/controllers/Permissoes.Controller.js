import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const listarPermissoes = async (req, res, next) => {
    try {
        const permissoes = await connection('permissoes')
            .select([
                'permissoes.id',
                'permissoes.nome',
                'permissoes.descricao'
            ])
            .orderBy('permissoes.nome', 'ASC')

        return res.status(200).json({
            status: 'success',
            data: permissoes,
            total: permissoes.length
        })
    } catch (error) {
        next(error)
    }
}

export const listarPermissoesPorUsuario = async (req, res, next) => {
    try {
        const { usuario_id } = req.params;  // Id do usuário

        if (!usuario_id) {
            lancarErro('O id do usuário é obrigatório', 400)
        }

        const permissoes = await connection('permissoes')
            .innerJoin('permissoes_usuarios', 'permissoes.id', '=', 'permissoes_usuarios.permissao_id')
            .select([
                'permissoes.id',
                'permissoes.nome'
            ])
            .where('permissoes_usuarios.usuario_id', usuario_id)

        return res.status(200).json({
            status: 'success',
            data: permissoes
        })

    } catch (error) {
        next(error)
    }
}

export const listarPermissoesDoUsuarioLogado = async (req, res, next) => {
    try {
        const usuario_id = req.usuario.id;

        if (!usuario_id) {
            lancarErro('Usuário não autenticado', 401)
        }

        const usuario = await connection('usuarios')
            .select([
                'usuarios.id',
                'usuarios.nome',
                'usuarios.email',
                'usuarios.nivel_acesso_id'
            ])
            .where('usuarios.id', usuario_id)
            .first()

        if (!usuario) {
            lancarErro('Usuário não encontrado', 404);
        }

        const permissoesUsuario = await connection('permissoes_usuarios')
            .innerJoin('permissoes', 'permissoes_usuarios.permissao_id', '=', 'permissoes.id')
            .where('permissoes_usuarios.usuario_id', usuario_id)
            .select('permissoes.nome')

        const permissoes = permissoesUsuario.map(p => p.nome);

        return res.status(200).json({
            status: 'success',
            nome: usuario.nome,
            email: usuario.email,
            nivel_acesso: usuario.nivel_acesso_id,
            permissoes
        })

    } catch (error) {
        next(error)
    }
}

export const editarPermissoesDoUsuario = async (req, res, next) => {

    if (!req.body || !('permissoes' in req.body)) {
        return next(lancarErro('O campo "permissoes" é obrigatório, mesmo que vazio [].', 400));
    }

    const { usuario_id } = req.params;
    const { permissoes } = req.body;

    if (!Array.isArray(permissoes)) {
        return next(lancarErro('O campo "permissoes" deve ser um array.', 400));
    }

    const trx = await connection.transaction();

    try {

        // Verificando se o usuário existe
        const usuarioExiste = await connection('usuarios')
            .transacting(trx)
            .where('usuarios.id', usuario_id)
            .first()

        // Se o usuário não existir, lança uma exceção
        if (!usuarioExiste) {
            await trx.rollback();
            lancarErro('Usuário não encontrado', 404);
        }

        // Deletando todas as permissões do usuário selecionado
        await connection('permissoes_usuarios')
            .transacting(trx)
            .where('permissoes_usuarios.usuario_id', usuario_id)
            .del()

        // Inserir novas permissões
        if (permissoes.length > 0) {

            const permissoesNoBanco = await connection('permissoes')
                .transacting(trx)
                .whereIn('permissoes.nome', permissoes)
                .select([
                    'permissoes.id',
                    'permissoes.nome'])

            // Validação Rigorosa: Compara a quantidade enviada vs encontrada
            if (permissoesNoBanco.length !== permissoes.length) {
                // Descobre quais nomes enviados não existem no banco para avisar o Admin
                const nomesEncontrados = permissoesNoBanco.map(p => p.nome);
                const invalidas = permissoes.filter(p => !nomesEncontrados.includes(p));

                await trx.rollback();
                return lancarErro(`As seguintes permissões são inválidas: ${invalidas.join(', ')}`, 400);
            }

            const dadosAInserir = permissoesNoBanco.map(p => ({
                usuario_id: usuario_id,
                permissao_id: p.id
            }));

            await connection('permissoes_usuarios')
                .transacting(trx)
                .insert(dadosAInserir)

        } else {
            // Caso venha um array vazio, apenas limpamos as permissões (remove todos os acessos)
            await connection('permissoes_usuarios')
                .transacting(trx)
                .where('permissoes_usuarios.usuario_id', usuario_id)
                .del();
        }


        // Log de Auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id, // Quem está editando (Admin)
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'USUARIOS.PERMISSOES',
                descricao: `${req.usuario.nome} alterou as permissões de ${usuarioExiste.nome}`,
                payload: JSON.stringify({ novas_permissoes: permissoes })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Permissões atualizadas com sucesso!'
        });


    } catch (error) {
        if (trx) {

            await trx.rollback();
        }

        next(error);
    }

}