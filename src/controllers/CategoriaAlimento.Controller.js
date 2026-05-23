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

export const criarCategoriaDeAlimento = async (req, res, next) => {
    try {

        const { nome, limite_escolhas } = req.body;

        if (!nome || !limite_escolhas) {
            lancarErro('Preencha todos os campos corretamente');
        }

        const categoriaExiste = await connection('categorias_alimentos')
            .where('nome', nome.toUpperCase())
            .whereNull('deletado_em')
            .first()

        if (categoriaExiste) {
            lancarErro('Essa categoria de alimento já está cadastrada', 400);
        }

        const [novaCategoriaDeAlimento] = await connection('categorias_alimentos')
            .insert({
                nome: nome.toUpperCase(),
                limite_escolhas: limite_escolhas,
            })
            .returning(['id', 'nome'])

        return res.status(200).json({
            status: 'success',
            data: novaCategoriaDeAlimento
        })

    } catch (error) {
        next(error);
    }
}

export const editarCategoriaDeAlimento = async (req, res, next) => {


    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { id } = req.params;
    const { nome, limite_escolhas, ativo } = req.body;
    const usuario_id = req.usuario.id;

    if (nome !== undefined && nome.trim().length === 0) {
        return next(lancarErro('O nome da categoria não pode ser uma string vazia.', 400));
    }

    if (limite_escolhas !== undefined) {
        if (String(limite_escolhas).trim() === "" || isNaN(limite_escolhas) || limite_escolhas < 0) {
            return next(lancarErro('O limite de escolhas deve ser um número válido igual ou maior que zero.', 400));
        }
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
            .first()

        if (!categoriaAtual) {
            await trx.rollback();
            return next(lancarErro('Categoria de alimentos não encontrada', 404));
        }

        const camposParaAtualizar = {};

        // Tratativa do campo Nome
        if (nome !== undefined && nome.toUpperCase() !== categoriaAtual.nome) {
            const jaExiste = await connection('categorias_alimentos')
                .transacting(trx)
                .where('nome', nome.toUpperCase())
                .whereNot('id', id)
                .whereNull('deletado_em')
                .first()

            if (jaExiste) {
                await trx.rollback();
                return next(lancarErro('Este nome já está em uso.', 400));
            }

            camposParaAtualizar.nome = nome.toUpperCase();
        }

        // Tratamento do campo Limite
        if (limite_escolhas !== undefined && Number(limite_escolhas) !== categoriaAtual.limite_escolhas) {
            camposParaAtualizar.limite_escolhas = Number(limite_escolhas);
        }

        // Tratativa do campo Ativo
        if (ativo !== undefined && ativo !== categoriaAtual.ativo) {
            camposParaAtualizar.ativo = ativo;
        }

        if (Object.keys(camposParaAtualizar).length === 0) {
            await trx.rollback();
            return res.status(200).json({
                status: 'success',
                message: 'Nenhuma alteração necessária, os dados já são os mesmos.',
                data: categoriaAtual
            })
        }

        // Atualizando campos
        const [categoriaAtualizada] = await connection('categorias_alimentos')
            .transacting(trx)
            .update(camposParaAtualizar)
            .where('id', id)
            .returning('*')

        // Log auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: usuario_id,
                acao: 'CATEGORIA_ALIMENTO.EDITAR',
                descricao: `Alteração na categoria de alimentos #${id}`,
                payload: JSON.stringify({
                    recurso_id: id,
                    campos_alterados: Object.keys(camposParaAtualizar),
                    dados_antigos: {
                        nome: categoriaAtual.nome,
                        limite: categoriaAtual.limite_escolhas
                    },
                    dados_novos: camposParaAtualizar,
                    contexto: {
                        ip: req.ip,
                        user_agent: req.headers['user-agent'],
                        rota: req.originalUrl
                    }
                })
            })

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            data: categoriaAtualizada
        });

    } catch (error) {

        if (trx) {
            await trx.rollback();
        }

        next(error);

    }
}

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
            .andWhere(function() {
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
                descricao: `Reativação da categoria #${id}: ${categoriaInativa.nome}`,
                payload: JSON.stringify({
                    recurso_id: id,
                    dados_reativados: {
                        nome: categoriaInativa.nome,
                        limite: categoriaInativa.limite_escolhas
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

