import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

function normalizarInteiroPositivo(valor, padrao, maximo = null) {
    const numero = Number.parseInt(valor, 10);

    if (!Number.isInteger(numero) || numero < 1) {
        return padrao;
    }

    return maximo ? Math.min(numero, maximo) : numero;
}

function normalizarNome(nome) {
    return String(nome)
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * ============================================================
 * CARDÁPIO PÚBLICO
 * ============================================================
 */
export const listarCategoriasProdutosCardapio = async (req, res, next) => {
    try {
        const categorias = await connection('categorias_produtos as cp')
            .select([
                'cp.id',
                'cp.nome',
                'cp.descricao',
                'cp.ordem_exibicao'
            ])
            .where('cp.ativo', true)
            .whereNull('cp.deletado_em')
            .whereExists(function () {
                this
                    .select(connection.raw('1'))
                    .from('produtos as p')
                    .whereRaw('p.categoria_produto_id = cp.id')
                    .where('p.ativo', true)
                    .where('p.disponivel_hoje', true)
                    .whereNull('p.deletado_em');
            })
            .orderBy('cp.ordem_exibicao', 'ASC')
            .orderBy('cp.nome', 'ASC');

        return res.status(200).json({
            status: 'success',
            results: categorias.length,
            data: categorias
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * ============================================================
 * LISTAGEM ADMINISTRATIVA
 * ============================================================
 */
export const listarCategoriasProdutosAdmin = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            sort = 'ordem_exibicao',
            order = 'ASC',
            status = 'todos',
            excluidos = 'false'
        } = req.query;

        const pageNumber = normalizarInteiroPositivo(page, 1);
        const limitNumber = normalizarInteiroPositivo(limit, 10, 100);
        const offset = (pageNumber - 1) * limitNumber;

        const colunasOrdenacao = {
            id: 'cp.id',
            nome: 'cp.nome',
            ativo: 'cp.ativo',
            ordem_exibicao: 'cp.ordem_exibicao',
            criado_em: 'cp.criado_em',
            atualizado_em: 'cp.atualizado_em'
        };

        const colunaOrdenacao = colunasOrdenacao[sort] || 'cp.ordem_exibicao';
        const direcao = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const query = connection('categorias_produtos as cp');

        if (excluidos === 'false') {
            query.whereNull('cp.deletado_em');
        } else if (excluidos === 'true') {
            query.whereNotNull('cp.deletado_em');
        }

        if (status === 'ativo') {
            query.where('cp.ativo', true);
        } else if (status === 'inativo') {
            query.where('cp.ativo', false);
        }

        if (String(search).trim()) {
            const termo = `%${String(search).trim()}%`;

            query.andWhere(function () {
                this
                    .where('cp.nome', 'ILIKE', termo)
                    .orWhere('cp.descricao', 'ILIKE', termo);
            });
        }

        const totalCount = await query
            .clone()
            .count('cp.id as total')
            .first();

        const categorias = await query
            .clone()
            .select([
                'cp.id',
                'cp.nome',
                'cp.descricao',
                'cp.ativo',
                'cp.ordem_exibicao',
                'cp.criado_em',
                'cp.atualizado_em',
                'cp.deletado_em',
                connection.raw(`
                    (
                        SELECT COUNT(*)::int
                        FROM produtos p
                        WHERE p.categoria_produto_id = cp.id
                          AND p.deletado_em IS NULL
                    ) AS total_produtos
                `)
            ])
            .orderBy(colunaOrdenacao, direcao)
            .orderBy('cp.id', 'ASC')
            .limit(limitNumber)
            .offset(offset);

        const total = Number(totalCount?.total || 0);

        return res.status(200).json({
            status: 'success',
            pagination: {
                total,
                page: pageNumber,
                per_page: limitNumber,
                last_page: Math.max(Math.ceil(total / limitNumber), 1)
            },
            data: categorias
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * ============================================================
 * BUSCAR CATEGORIA POR ID
 * ============================================================
 */
export const buscarCategoriaProdutoPorId = async (req, res, next) => {
    try {
        const { id } = req.params;

        const categoria = await connection('categorias_produtos as cp')
            .select([
                'cp.id',
                'cp.nome',
                'cp.descricao',
                'cp.ativo',
                'cp.ordem_exibicao',
                'cp.criado_em',
                'cp.atualizado_em',
                'cp.deletado_em',
                connection.raw(`
                    (
                        SELECT COUNT(*)::int
                        FROM produtos p
                        WHERE p.categoria_produto_id = cp.id
                          AND p.deletado_em IS NULL
                    ) AS total_produtos
                `)
            ])
            .where('cp.id', id)
            .first();

        if (!categoria) {
            return next(lancarErro('Categoria de produto não encontrada.', 404));
        }

        return res.status(200).json({
            status: 'success',
            data: categoria
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * ============================================================
 * CRIAR CATEGORIA
 * ============================================================
 */
export const criarCategoriaProduto = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const {
        nome,
        descricao = null,
        ativo = true,
        ordem_exibicao = 0
    } = req.body;

    if (!nome || !String(nome).trim()) {
        return next(lancarErro('O nome da categoria é obrigatório.', 400));
    }

    if (ativo !== undefined && typeof ativo !== 'boolean') {
        return next(lancarErro('O campo ativo deve ser true ou false.', 400));
    }

    const ordem = Number(ordem_exibicao);

    if (!Number.isInteger(ordem) || ordem < 0) {
        return next(
            lancarErro(
                'A ordem de exibição deve ser um número inteiro igual ou maior que zero.',
                400
            )
        );
    }

    const nomeNormalizado = normalizarNome(nome);

    const descricaoNormalizada = descricao === null || descricao === undefined
        ? null
        : String(descricao).trim() || null;

    const trx = await connection.transaction();

    try {
        const categoriaExistente = await connection('categorias_produtos')
            .transacting(trx)
            .whereRaw('LOWER(TRIM(nome)) = LOWER(TRIM(?))', [nomeNormalizado])
            .whereNull('deletado_em')
            .first();

        if (categoriaExistente) {
            await trx.rollback();

            return next(
                lancarErro(
                    `Já existe uma categoria de produto cadastrada com o nome "${nomeNormalizado}".`,
                    409
                )
            );
        }

        const [novaCategoria] = await connection('categorias_produtos')
            .transacting(trx)
            .insert({
                nome: nomeNormalizado,
                descricao: descricaoNormalizada,
                ativo,
                ordem_exibicao: ordem
            })
            .returning('*');

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'CATEGORIA_PRODUTO.CRIAR',
                descricao: `Criou a categoria de produtos #${novaCategoria.id}: ${novaCategoria.nome}`,
                payload: JSON.stringify({
                    recurso_id: novaCategoria.id,
                    dados: novaCategoria,
                    contexto: {
                        ip: req.ip,
                        user_agent: req.headers['user-agent']
                    }
                })
            });

        await trx.commit();

        return res.status(201).json({
            status: 'success',
            data: novaCategoria
        });
    } catch (error) {
        await trx.rollback();

        if (error.code === '23505') {
            return next(
                lancarErro(
                    `Já existe uma categoria de produto cadastrada com o nome "${nomeNormalizado}".`,
                    409
                )
            );
        }

        return next(error);
    }
};

/**
 * ============================================================
 * EDITAR CATEGORIA
 * ============================================================
 */
export const editarCategoriaProduto = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { id } = req.params;

    const {
        nome,
        descricao,
        ativo,
        ordem_exibicao
    } = req.body;

    if (nome !== undefined && !String(nome).trim()) {
        return next(lancarErro('O nome da categoria não pode ficar vazio.', 400));
    }

    if (ativo !== undefined && typeof ativo !== 'boolean') {
        return next(lancarErro('O campo ativo deve ser true ou false.', 400));
    }

    if (ordem_exibicao !== undefined) {
        const ordem = Number(ordem_exibicao);

        if (!Number.isInteger(ordem) || ordem < 0) {
            return next(
                lancarErro(
                    'A ordem de exibição deve ser um número inteiro igual ou maior que zero.',
                    400
                )
            );
        }
    }

    const trx = await connection.transaction();
    let nomeFinalParaErro = nome ? normalizarNome(nome) : '';

    try {
        const categoriaAtual = await connection('categorias_produtos')
            .transacting(trx)
            .where({ id })
            .whereNull('deletado_em')
            .forUpdate()
            .first();

        if (!categoriaAtual) {
            await trx.rollback();
            return next(lancarErro('Categoria de produto não encontrada.', 404));
        }

        const camposParaAtualizar = {};

        if (nome !== undefined) {
            const nomeNormalizado = normalizarNome(nome);

            if (nomeNormalizado.toLowerCase() !== categoriaAtual.nome.toLowerCase()) {
                const categoriaExistente = await connection('categorias_produtos')
                    .transacting(trx)
                    .whereRaw('LOWER(TRIM(nome)) = LOWER(TRIM(?))', [nomeNormalizado])
                    .whereNot('id', id)
                    .whereNull('deletado_em')
                    .first();

                if (categoriaExistente) {
                    await trx.rollback();

                    return next(
                        lancarErro(
                            `Já existe uma categoria de produto cadastrada com o nome "${nomeNormalizado}".`,
                            409
                        )
                    );
                }

                camposParaAtualizar.nome = nomeNormalizado;
            }

            nomeFinalParaErro = nomeNormalizado;
        }

        if (descricao !== undefined) {
            const descricaoNormalizada = descricao === null
                ? null
                : String(descricao).trim() || null;

            if (descricaoNormalizada !== categoriaAtual.descricao) {
                camposParaAtualizar.descricao = descricaoNormalizada;
            }
        }

        if (ativo !== undefined && ativo !== categoriaAtual.ativo) {
            camposParaAtualizar.ativo = ativo;
        }

        if (ordem_exibicao !== undefined) {
            const ordem = Number(ordem_exibicao);

            if (ordem !== categoriaAtual.ordem_exibicao) {
                camposParaAtualizar.ordem_exibicao = ordem;
            }
        }

        if (Object.keys(camposParaAtualizar).length === 0) {
            await trx.rollback();

            return res.status(200).json({
                status: 'success',
                message: 'Nenhuma alteração necessária, os dados já são os mesmos.',
                data: categoriaAtual
            });
        }

        const [categoriaAtualizada] = await connection('categorias_produtos')
            .transacting(trx)
            .where({ id })
            .update(camposParaAtualizar)
            .returning('*');

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'CATEGORIA_PRODUTO.EDITAR',
                descricao: `Editou a categoria de produtos #${id}: ${categoriaAtualizada.nome}`,
                payload: JSON.stringify({
                    recurso_id: Number(id),
                    campos_alterados: Object.keys(camposParaAtualizar),
                    dados_antigos: categoriaAtual,
                    dados_novos: categoriaAtualizada,
                    contexto: {
                        ip: req.ip,
                        user_agent: req.headers['user-agent']
                    }
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
            return next(
                lancarErro(
                    `Já existe uma categoria de produto cadastrada com o nome "${nomeFinalParaErro}".`,
                    409
                )
            );
        }

        return next(error);
    }
};

/**
 * ============================================================
 * INATIVAR CATEGORIA
 * ============================================================
 */
export const inativarCategoriaProduto = async (req, res, next) => {
    const { id } = req.params;
    const trx = await connection.transaction();

    try {
        const categoria = await connection('categorias_produtos')
            .transacting(trx)
            .where({ id })
            .whereNull('deletado_em')
            .forUpdate()
            .first();

        if (!categoria) {
            await trx.rollback();

            return next(
                lancarErro(
                    'Categoria de produto não encontrada ou já removida.',
                    404
                )
            );
        }

        const produtoVinculado = await connection('produtos')
            .transacting(trx)
            .where('categoria_produto_id', id)
            .whereNull('deletado_em')
            .first('id', 'nome');

        if (produtoVinculado) {
            await trx.rollback();

            return next(
                lancarErro(
                    'Esta categoria possui produtos cadastrados. Mova ou remova os produtos antes de excluir a categoria.',
                    409
                )
            );
        }

        await connection('categorias_produtos')
            .transacting(trx)
            .where({ id })
            .update({
                ativo: false,
                deletado_em: connection.fn.now()
            });

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'CATEGORIA_PRODUTO.INATIVAR',
                descricao: `Removeu a categoria de produtos #${id}: ${categoria.nome}`,
                payload: JSON.stringify({
                    recurso_id: Number(id),
                    dados_inativados: categoria,
                    contexto: {
                        ip: req.ip,
                        user_agent: req.headers['user-agent']
                    }
                })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Categoria de produto removida com sucesso.'
        });
    } catch (error) {
        await trx.rollback();
        return next(error);
    }
};

/**
 * ============================================================
 * REATIVAR CATEGORIA
 * ============================================================
 */
export const reativarCategoriaProduto = async (req, res, next) => {
    const { id } = req.params;
    const trx = await connection.transaction();
    let nomeCategoria = '';

    try {
        const categoria = await connection('categorias_produtos')
            .transacting(trx)
            .where({ id })
            .whereNotNull('deletado_em')
            .forUpdate()
            .first();

        if (!categoria) {
            await trx.rollback();

            return next(
                lancarErro(
                    'Categoria de produto não encontrada ou já está ativa.',
                    404
                )
            );
        }

        nomeCategoria = categoria.nome;

        const categoriaComMesmoNome = await connection('categorias_produtos')
            .transacting(trx)
            .whereRaw('LOWER(TRIM(nome)) = LOWER(TRIM(?))', [categoria.nome])
            .whereNot('id', id)
            .whereNull('deletado_em')
            .first();

        if (categoriaComMesmoNome) {
            await trx.rollback();

            return next(
                lancarErro(
                    `Não é possível restaurar a categoria "${categoria.nome}" porque já existe outra categoria ativa com o mesmo nome.`,
                    409
                )
            );
        }

        const [categoriaRestaurada] = await connection('categorias_produtos')
            .transacting(trx)
            .where({ id })
            .update({
                ativo: true,
                deletado_em: null
            })
            .returning('*');

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'CATEGORIA_PRODUTO.REATIVAR',
                descricao: `Restaurou a categoria de produtos #${id}: ${categoria.nome}`,
                payload: JSON.stringify({
                    recurso_id: Number(id),
                    dados_restaurados: categoriaRestaurada,
                    contexto: {
                        ip: req.ip,
                        user_agent: req.headers['user-agent']
                    }
                })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Categoria de produto restaurada com sucesso.',
            data: categoriaRestaurada
        });
    } catch (error) {
        await trx.rollback();

        if (error.code === '23505') {
            return next(
                lancarErro(
                    `Não é possível restaurar a categoria "${nomeCategoria}" porque já existe outra categoria ativa com o mesmo nome.`,
                    409
                )
            );
        }

        return next(error);
    }
};