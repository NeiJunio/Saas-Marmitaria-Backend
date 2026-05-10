import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const listarAlimentos = async (req, res, next) => {

    try {

        const {
            page = 1,
            limit = 10,
            search = '',
            categoria_alimento_id,
            status = 'todos'
        } = req.query;

        const offset = (page - 1) * limit;

        const query = connection('alimentos')
            .join('categorias_alimentos', 'alimentos.categoria_id', '=', 'categorias_alimentos.id')
            .whereNull('alimentos.deletado_em')

        // Filtros dinâmicos
        if (search) {
            query.where('alimentos.nome', 'ILIKE', `%${search}%`)
        }

        if (categoria_alimento_id) {
            query.where('alimentos.categoria_id', categoria_alimento_id)
        }

        if (status === 'ativo') {
            query.where('alimentos.ativo', true)
        }

        const total = await query.clone().count('alimentos.id AS total').first();

        const alimentos = await query
            .select([
                'alimentos.*',
                'categorias_alimentos.nome AS categoria_nome',
                'categorias_alimentos.id AS categoria_id'
            ])
            .limit(limit)
            .offset(offset)
            .orderBy('alimentos.nome', 'ASC')

        return res.status(200).json({
            status: 'success',
            pagination: { total: parseInt(total.total), page: parseInt(page) },
            data: alimentos
        });

    } catch (error) {
        next(error)
    }

}


export const criarAlimento = async (req, res, next) => {

    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const {
        nome,
        descricao,
        categoria_alimento_id
    } = req.body

    const usuario_id = req.usuario.id

    if (!nome || !categoria_alimento_id) {
        return next(lancarErro('Nome e categoria do alimento são obrigatórios', 400))
    }

    const trx = await connection.transaction()

    try {

        const categoriaAlimento = await connection('categorias_alimentos')
            .transacting(trx)
            .where('id', categoria_alimento_id)
            .whereNull('deletado_em')
            .forUpdate()
            .first()

        if (!categoriaAlimento) {
            await trx.rollback()
            return next(lancarErro('A categoria do alimento não existe ou foi removida', 400))
        }

        const [novoAlimento] = await connection('alimentos')
            .transacting(trx)
            .insert({
                nome: nome.trim().toUpperCase(),
                descricao: descricao,
                categoria_id: categoria_alimento_id
            })
            .returning('*')

        // Logs de auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: usuario_id,
                acao: 'ALIMENTO.CRIAR',
                descricao: `Criou o alimento ${novoAlimento.nome} na categoria ${categoriaAlimento.nome}`,
                payload: JSON.stringify(novoAlimento)
            })

        await trx.commit();
        return res.status(201).json({
            status: 'success',
            data: novoAlimento
        })

    } catch (error) {
        if (trx) {
            await trx.rollback()
        }

        next(error)
    }

}


export const editarAlimento = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { id } = req.params;
    const {
        nome,
        descricao,
        categoria_id,
        disponivel_hoje
    } = req.body;

    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();

    try {

        const alimentoAtual = await connection('alimentos')
            .transacting(trx)
            .where('id', id)
            .whereNull('deletado_em')
            .forUpdate()
            .first();

        if (!alimentoAtual) {
            await trx.rollback();
            return next(lancarErro('Alimento não encontrado', 404));
        }

        const camposParaAtualizar = {};

        if (nome !== undefined && nome.trim().toUpperCase() !== alimentoAtual.nome) {

            const jaExiste = await connection('alimentos')
                .transacting(trx)
                .where('nome', nome.trim().toUpperCase())
                .whereNot('id', id)
                .whereNull('deletado_em')
                .first()

            if (jaExiste) {
                await trx.rollback();
                return next(lancarErro('Já existe um alimento com este nome', 400));
            }

            camposParaAtualizar.nome = nome.trim().toUpperCase();

        }

        if (categoria_id !== undefined && categoria_id !== alimentoAtual.categoria_id) {

            const categoriaValida = await connection('categorias_alimentos')
                .transacting(trx)
                .where('id', categoria_id)
                .whereNull('deletado_em')
                .first()

            if (!categoriaValida) {
                await trx.rollback();
                return next(lancarErro('Categoria inválida ou removida', 400))
            }

            camposParaAtualizar.categoria_id = categoria_id;

        }

        if (disponivel_hoje !== undefined) {
            if (typeof disponivel_hoje !== 'boolean') {
                await trx.rollback();
                return next(lancarErro('O campo disponível_hoje deve ser verdadeiro ou falso', 400))
            }

            camposParaAtualizar.disponivel_hoje = disponivel_hoje;

        }

        if (descricao !== undefined) {
            camposParaAtualizar.descricao = descricao;
        }

        if (Object.keys(camposParaAtualizar).length === 0) {
            await trx.rollback(); // Importante para liberar a conexão
            return res.status(200).json({
                status: 'success',
                message: 'Nenhum dado alterado, os valores já são os mesmos.',
                data: alimentoAtual
            });
        }

        // Update
        const [alimentoAtualizado] = await connection('alimentos')
            .transacting(trx)
            .where('id', id)
            .update(camposParaAtualizar)
            .returning('*')

        const alteracoes = Object.keys(camposParaAtualizar).join(', ');

        // Logs de auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: usuario_id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'ALIMENTO.EDITAR',
                descricao: `Editou o alimento #${id} (${alimentoAtualizado.nome}). Campos alterados: ${alteracoes}`,
                payload: JSON.stringify({
                    antigo: alimentoAtual,
                    novo: camposParaAtualizar
                })
            });

        await trx.commit();
        return res.status(200).json({
            status: 'success',
            data: alimentoAtualizado
        });

    } catch (error) {
        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
}


export const deletarAlimento = async (req, res, next) => {

    const { id } = req.params;
    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();

    try {

        // Verificar se o alimento existe
        const alimento = await connection('alimentos')
            .transacting(trx)
            .where('id', id)
            .whereNull('deletado_em')
            .forUpdate()
            .first()

        if (!alimento) {
            await trx.rollback();
            return next(lancarErro('Alimento não encontrado ou já removido', 404));
        }

        // Executando o soft delete preenchendo o campo 'deletado_em' com a data atual
        await connection('alimentos')
            .transacting(trx)
            .where('id', id)
            .update({
                deletado_em: connection.fn.now()
            });

        // Logs de auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: usuario_id,
                acao: 'ALIMENTO.DELETAR',
                descricao: `Exclusão (Soft Delete) do alimento #${id}: ${alimento.nome}`,
                payload: JSON.stringify({
                    id_alimento: id,
                    nome_alimento: alimento.nome,
                    categoria_alimento_id: alimento.categoria_id,
                    contexto: {
                        ip: req.ip,
                        rota: req.originalUrl
                    }
                })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Alimento removido com sucesso'
        })

    } catch (error) {
        if (trx) {
            await trx.rollback();
        }

        next(error);
    }

}