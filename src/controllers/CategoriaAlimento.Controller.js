import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";


export const listarCategoriasDeAlimentos = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            sort = 'nome',
            order = 'ASC',
            status = 'todos', // ativo, inativo, todos
            excluidos = 'false' // true para ver apenas deletados, 'mixed' para ver tudo
        } = req.query;

        const offset = (page - 1) * limit;

        // 1. Iniciamos a query base
        const query = connection('categorias_alimentos');

        // 2. Filtro de Soft Delete (A lógica principal)
        if (excluidos === 'false') {
            query.whereNull('deletado_em');
        } else if (excluidos === 'true') {
            query.whereNotNull('deletado_em');
        }
        // Se for 'mixed', não adicionamos filtro de deletado_em

        // 3. Filtro de Status (Ativo/Inativo)
        if (status === 'ativo') {
            query.where('ativo', true);
        } else if (status === 'inativo') {
            query.where('ativo', false);
        }

        // 4. Filtro de Busca (Search)
        if (search) {
            query.where('nome', 'ILIKE', `%${search}%`); // ILIKE é case-insensitive no Postgres
        }

        // 5. Clonamos a query para contar o total sem a paginação
        const totalCount = await query.clone().count('id as total').first();

        // 6. Finalizamos com Ordenação e Paginação
        const categoriasAlimentos = await query
            .select(['id', 'nome', 'limite_escolhas', 'ativo', 'deletado_em'])
            .orderBy(sort, order.toUpperCase())
            .limit(limit)
            .offset(offset);

        return res.status(200).json({
            status: 'success',
            pagination: {
                total: parseInt(totalCount.total),
                page: parseInt(page),
                per_page: parseInt(limit),
                last_page: Math.ceil(totalCount.total / limit)
            },
            data: categoriasAlimentos
        });

    } catch (error) {
        next(error);
    }
}

export const listarCategoriaDeAlimentoPorId = async (req, res, next) => {
    try {
        const { id } = req.params;

        const categoria = await connection('categorias_alimentos')
            .where({ id })
            .first();

        if (!categoria) {
            return next(lancarErro('Categoria não encontrada.', 404));
        }

        return res.status(200).json({
            status: 'success',
            data: categoria
        });
    } catch (error) {
        next(error);
    }
}

export const criarCategoriaDeAlimento = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { nome, limite_escolhas } = req.body;

    if (!nome || String(nome).trim() === '') {
        return next(lancarErro('O nome da categoria é obrigatório.', 400));
    }

    if (limite_escolhas === undefined || limite_escolhas === null || String(limite_escolhas).trim() === '' || isNaN(limite_escolhas) || Number(limite_escolhas) < 0) {
        return next(lancarErro('O limite de escolhas deve ser um número válido igual ou maior que zero.', 400));
    }

    const nomeFormatado = String(nome).trim().toUpperCase();
    const limiteFormatado = Number(limite_escolhas);
    const trx = await connection.transaction();

    try {
        const categoriaExiste = await connection('categorias_alimentos')
            .transacting(trx)
            .whereRaw('UPPER(TRIM(nome)) = ?', [nomeFormatado])
            .whereNull('deletado_em')
            .first();

        if (categoriaExiste) {
            await trx.rollback();
            return next(lancarErro(`Já existe uma categoria de alimento cadastrada com o nome "${nomeFormatado}".`, 409));
        }

        const [novaCategoriaDeAlimento] = await connection('categorias_alimentos')
            .transacting(trx)
            .insert({
                nome: nomeFormatado,
                limite_escolhas: limiteFormatado
            })
            .returning('*');

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario?.id || null,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'CATEGORIA_ALIMENTO.CRIAR',
                descricao: `Criou a categoria de alimentos #${novaCategoriaDeAlimento.id}: ${novaCategoriaDeAlimento.nome}`,
                payload: JSON.stringify(novaCategoriaDeAlimento)
            });

        await trx.commit();

        return res.status(201).json({
            status: 'success',
            data: novaCategoriaDeAlimento
        });
    } catch (error) {
        await trx.rollback();

        if (error.code === '23505') {
            return next(lancarErro(`Já existe uma categoria de alimento cadastrada com o nome "${nomeFormatado}".`, 409));
        }

        return next(error);
    }
};

export const editarCategoriaDeAlimento = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { id } = req.params;
    const { nome, limite_escolhas, ativo } = req.body;
    const usuario_id = req.usuario.id;

    if (nome !== undefined && String(nome).trim().length === 0) {
        return next(lancarErro('O nome da categoria não pode ser uma string vazia.', 400));
    }

    if (limite_escolhas !== undefined && (String(limite_escolhas).trim() === '' || isNaN(limite_escolhas) || Number(limite_escolhas) < 0)) {
        return next(lancarErro('O limite de escolhas deve ser um número válido igual ou maior que zero.', 400));
    }

    if (ativo !== undefined && typeof ativo !== 'boolean') {
        return next(lancarErro('O valor do campo ativo deve ser true ou false.', 400));
    }

    const trx = await connection.transaction();

    try {
        const categoriaAtual = await connection('categorias_alimentos')
            .transacting(trx)
            .where('id', id)
            .whereNull('deletado_em')
            .forUpdate()
            .first();

        if (!categoriaAtual) {
            await trx.rollback();
            return next(lancarErro('Categoria de alimentos não encontrada.', 404));
        }

        const camposParaAtualizar = {};

        if (nome !== undefined) {
            const nomeFormatado = String(nome).trim().toUpperCase();

            if (nomeFormatado !== categoriaAtual.nome) {
                const jaExiste = await connection('categorias_alimentos')
                    .transacting(trx)
                    .whereRaw('UPPER(TRIM(nome)) = ?', [nomeFormatado])
                    .whereNot('id', id)
                    .whereNull('deletado_em')
                    .first();

                if (jaExiste) {
                    await trx.rollback();
                    return next(lancarErro(`Já existe uma categoria de alimento cadastrada com o nome "${nomeFormatado}".`, 409));
                }

                camposParaAtualizar.nome = nomeFormatado;
            }
        }

        if (limite_escolhas !== undefined && Number(limite_escolhas) !== categoriaAtual.limite_escolhas) {
            camposParaAtualizar.limite_escolhas = Number(limite_escolhas);
        }

        if (ativo !== undefined && ativo !== categoriaAtual.ativo) {
            camposParaAtualizar.ativo = ativo;
        }

        if (Object.keys(camposParaAtualizar).length === 0) {
            await trx.rollback();

            return res.status(200).json({
                status: 'success',
                message: 'Nenhuma alteração necessária, os dados já são os mesmos.',
                data: categoriaAtual
            });
        }

        const [categoriaAtualizada] = await connection('categorias_alimentos')
            .transacting(trx)
            .where('id', id)
            .update(camposParaAtualizar)
            .returning('*');

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'CATEGORIA_ALIMENTO.EDITAR',
                descricao: `Alteração na categoria de alimentos #${id}`,
                payload: JSON.stringify({
                    recurso_id: id,
                    campos_alterados: Object.keys(camposParaAtualizar),
                    dados_antigos: categoriaAtual,
                    dados_novos: categoriaAtualizada
                })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            data: categoriaAtualizada
        });
    } catch (error) {
        await trx.rollback();

        if (error.code === '23505') {
            const nomeFormatado = nome ? String(nome).trim().toUpperCase() : '';

            return next(lancarErro(
                nomeFormatado
                    ? `Já existe uma categoria de alimento cadastrada com o nome "${nomeFormatado}".`
                    : 'Já existe outra categoria utilizando estes dados.',
                409
            ));
        }

        return next(error);
    }
};

export const inativarCategoriaDeAlimento = async (req, res, next) => {

    const { id } = req.params;
    const usuario_id = req.usuario.id;


    const trx = await connection.transaction();

    try {
        // 1. Verificar se a categoria existe e se já não está deletada
        const categoriaAlimento = await connection('categorias_alimentos')
            .transacting(trx)
            .where({ id })
            .where('ativo', true) // Só podemos deletar se estiver ativa, evita confusão de status
            .whereNull('deletado_em')
            .forUpdate() // Tranca a linha para evitar deleção dupla
            .first();

        if (!categoriaAlimento) {
            await trx.rollback();
            return next(lancarErro('Categoria não encontrada ou já removida.', 404));
        }

        // 2. Executar o Soft Delete
        // Preenchemos o campo 'deletado_em' com a data atual
        await connection('categorias_alimentos')
            .transacting(trx)
            .where({ id })
            .update({
                ativo: false, // Opcional: desativamos também para garantir que suma de listas simples
                deletado_em: connection.fn.now()
            });

        // 3. Log de Auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: usuario_id,
                acao: 'CATEGORIA_ALIMENTO.INATIVAR',
                descricao: `Inativação da categoria #${id}: ${categoriaAlimento.nome}`,
                payload: JSON.stringify({
                    recurso_id: id,
                    dados_inativados: {
                        nome: categoriaAlimento.nome,
                        limite: categoriaAlimento.limite_escolhas
                    },
                    contexto: {
                        ip: req.ip,
                        rota: req.originalUrl
                    }
                })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Categoria inativada com sucesso.'
        });
    } catch (error) {
        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
}


export const reativarCategoriaDeAlimento = async (req, res, next) => {

    const { id } = req.params;
    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();
    try {
        // 1. Verificar se a categoria existe e se está inativa
        const categoriaAlimento = await connection('categorias_alimentos')
            .transacting(trx)
            .where({ id })
            .andWhere(function () {
                this.where('ativo', false)
                    .orWhereNotNull('deletado_em');
            })
            .forUpdate() // Tranca a linha para evitar conflitos
            .first();

        if (!categoriaAlimento) {
            await trx.rollback();
            return next(lancarErro('Categoria não encontrada ou já ativa.', 404));
        }

        // 2. Reativar a categoria
        await connection('categorias_alimentos')
            .transacting(trx)
            .where({ id })
            .update({
                ativo: true,
                deletado_em: null
            });

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: usuario_id,
                acao: 'CATEGORIA_ALIMENTO.REATIVAR',
                descricao: `Reativação da categoria #${id}: ${categoriaAlimento.nome}`,
                payload: JSON.stringify({
                    recurso_id: id,
                    dados_reativados: {
                        nome: categoriaAlimento.nome,
                        limite: categoriaAlimento.limite_escolhas
                    },
                    contexto: {
                        ip: req.ip,
                        rota: req.originalUrl
                    }
                })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Categoria reativada com sucesso.'
        });
    } catch (error) {
        if (trx) {
            await trx.rollback();
        }
        next(error);
    }
}

