import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";


/**
 * Normaliza parâmetros numéricos positivos.
 *
 * Utilizado principalmente na paginação.
 */
function normalizarInteiroPositivo(valor, padrao, maximo = null) {
    const numero = Number.parseInt(valor, 10);

    if (!Number.isInteger(numero) || numero < 1) {
        return padrao;
    }

    return maximo
        ? Math.min(numero, maximo)
        : numero;
}


/**
 * Normaliza o nome informado pelo usuário.
 *
 * Mantemos a capitalização original para permitir nomes
 * visualmente melhores como:
 *
 * Bebidas
 * Sobremesas
 * Porções
 *
 * O banco já possui índice case-insensitive para impedir
 * duplicidades como "Bebidas" e "BEBIDAS".
 */
function normalizarNome(nome) {
    return String(nome)
        .trim()
        .replace(/\s+/g, ' ');
}


/**
 * ============================================================
 * CARDÁPIO PÚBLICO
 * ============================================================
 *
 * GET /categorias-produtos/cardapio
 *
 * Retorna somente categorias:
 *
 * - ativas;
 * - não excluídas;
 * - que possuam pelo menos um produto disponível.
 *
 * Dessa forma não mostramos categorias vazias ao cliente.
 */
export const listarCategoriasProdutosCardapio = async (
    req,
    res,
    next
) => {

    try {

        const categorias =
            await connection('categorias_produtos as cp')

                .select([
                    'cp.id',
                    'cp.nome',
                    'cp.descricao',
                    'cp.ordem_exibicao'
                ])

                // Categoria precisa estar ativa.
                .where('cp.ativo', true)

                // Ignora soft delete.
                .whereNull('cp.deletado_em')

                /**
                 * Só retorna categorias que realmente
                 * possuem produtos vendáveis hoje.
                 */
                .whereExists(function () {

                    this
                        .select(connection.raw('1'))

                        .from('produtos as p')

                        .whereRaw(
                            'p.categoria_produto_id = cp.id'
                        )

                        .where('p.ativo', true)

                        .where(
                            'p.disponivel_hoje',
                            true
                        )

                        .whereNull(
                            'p.deletado_em'
                        );
                })

                // Respeita a ordem configurada no painel.
                .orderBy(
                    'cp.ordem_exibicao',
                    'ASC'
                )

                .orderBy(
                    'cp.nome',
                    'ASC'
                );


        return res.status(200).json({
            status: 'success',
            results: categorias.length,
            data: categorias
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * LISTAGEM ADMINISTRATIVA
 * ============================================================
 *
 * GET /categorias-produtos/admin
 *
 * Suporta:
 *
 * page
 * limit
 * search
 * sort
 * order
 * status
 * excluidos
 */
export const listarCategoriasProdutosAdmin = async (
    req,
    res,
    next
) => {

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


        const pageNumber =
            normalizarInteiroPositivo(
                page,
                1
            );


        /**
         * Limitamos a no máximo 100 registros
         * por requisição.
         */
        const limitNumber =
            normalizarInteiroPositivo(
                limit,
                10,
                100
            );


        const offset =
            (pageNumber - 1) *
            limitNumber;


        /**
         * Whitelist das colunas permitidas
         * para ordenação.
         *
         * Isso evita SQL Injection através
         * do parâmetro sort.
         */
        const colunasOrdenacao = {

            id:
                'cp.id',

            nome:
                'cp.nome',

            ativo:
                'cp.ativo',

            ordem_exibicao:
                'cp.ordem_exibicao',

            criado_em:
                'cp.criado_em',

            atualizado_em:
                'cp.atualizado_em'
        };


        const colunaOrdenacao =
            colunasOrdenacao[sort] ||
            'cp.ordem_exibicao';


        const direcao =
            String(order).toUpperCase() ===
            'DESC'
                ? 'DESC'
                : 'ASC';


        // Query base.
        const query =
            connection(
                'categorias_produtos as cp'
            );


        /**
         * =====================================================
         * SOFT DELETE
         * =====================================================
         *
         * false:
         * somente registros normais
         *
         * true:
         * somente lixeira
         *
         * mixed:
         * todos
         */
        if (excluidos === 'false') {

            query.whereNull(
                'cp.deletado_em'
            );

        } else if (
            excluidos === 'true'
        ) {

            query.whereNotNull(
                'cp.deletado_em'
            );
        }


        /**
         * =====================================================
         * STATUS
         * =====================================================
         */
        if (status === 'ativo') {

            query.where(
                'cp.ativo',
                true
            );

        } else if (
            status === 'inativo'
        ) {

            query.where(
                'cp.ativo',
                false
            );
        }


        /**
         * =====================================================
         * BUSCA
         * =====================================================
         */
        if (
            String(search).trim()
        ) {

            const termo =
                `%${String(search).trim()}%`;


            query.andWhere(
                function () {

                    this
                        .where(
                            'cp.nome',
                            'ILIKE',
                            termo
                        )

                        .orWhere(
                            'cp.descricao',
                            'ILIKE',
                            termo
                        );
                }
            );
        }


        /**
         * Fazemos uma cópia da query
         * antes da paginação.
         */
        const totalCount =
            await query
                .clone()

                .count(
                    'cp.id as total'
                )

                .first();


        const categorias =
            await query
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


                    /**
                     * Também retornamos quantos produtos
                     * ainda existem dentro da categoria.
                     *
                     * Isso será útil posteriormente
                     * na interface administrativa.
                     */
                    connection.raw(`
                        (
                            SELECT COUNT(*)::int

                            FROM produtos p

                            WHERE
                                p.categoria_produto_id = cp.id

                                AND
                                p.deletado_em IS NULL

                        ) AS total_produtos
                    `)
                ])

                .orderBy(
                    colunaOrdenacao,
                    direcao
                )

                .orderBy(
                    'cp.id',
                    'ASC'
                )

                .limit(
                    limitNumber
                )

                .offset(
                    offset
                );


        const total =
            Number(
                totalCount?.total || 0
            );


        return res.status(200).json({

            status: 'success',

            pagination: {

                total,

                page:
                    pageNumber,

                per_page:
                    limitNumber,

                last_page:
                    Math.max(
                        Math.ceil(
                            total /
                            limitNumber
                        ),
                        1
                    )
            },

            data:
                categorias
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * BUSCAR CATEGORIA POR ID
 * ============================================================
 *
 * GET /categorias-produtos/:id
 */
export const buscarCategoriaProdutoPorId = async (
    req,
    res,
    next
) => {

    try {

        const {
            id
        } = req.params;


        const categoria =
            await connection(
                'categorias_produtos as cp'
            )

                .select([

                    'cp.id',

                    'cp.nome',

                    'cp.descricao',

                    'cp.ativo',

                    'cp.ordem_exibicao',

                    'cp.criado_em',

                    'cp.atualizado_em',

                    'cp.deletado_em',


                    /**
                     * Quantidade de produtos ativos
                     * no cadastro desta categoria.
                     */
                    connection.raw(`
                        (
                            SELECT COUNT(*)::int

                            FROM produtos p

                            WHERE
                                p.categoria_produto_id = cp.id

                                AND
                                p.deletado_em IS NULL

                        ) AS total_produtos
                    `)
                ])

                .where(
                    'cp.id',
                    id
                )

                .first();


        if (!categoria) {

            return next(
                lancarErro(
                    'Categoria de produto não encontrada.',
                    404
                )
            );
        }


        return res.status(200).json({

            status: 'success',

            data:
                categoria
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * CRIAR CATEGORIA
 * ============================================================
 *
 * POST /categorias-produtos
 */
export const criarCategoriaProduto = async (
    req,
    res,
    next
) => {

    if (
        !req.body ||
        Object.keys(req.body).length === 0
    ) {

        return next(
            lancarErro(
                'O corpo da requisição não pode estar vazio.',
                400
            )
        );
    }


    const {

        nome,

        descricao = null,

        ativo = true,

        ordem_exibicao = 0

    } = req.body;


    /**
     * Validação do nome.
     */
    if (
        !nome ||
        !String(nome).trim()
    ) {

        return next(
            lancarErro(
                'O nome da categoria é obrigatório.',
                400
            )
        );
    }


    /**
     * Validação do status.
     */
    if (
        ativo !== undefined &&
        typeof ativo !== 'boolean'
    ) {

        return next(
            lancarErro(
                'O campo ativo deve ser true ou false.',
                400
            )
        );
    }


    const ordem =
        Number(ordem_exibicao);


    /**
     * Ordem deve ser sempre um
     * inteiro positivo ou zero.
     */
    if (
        !Number.isInteger(ordem) ||
        ordem < 0
    ) {

        return next(
            lancarErro(
                'A ordem de exibição deve ser um número inteiro igual ou maior que zero.',
                400
            )
        );
    }


    const nomeNormalizado =
        normalizarNome(nome);


    const descricaoNormalizada =
        descricao === null ||
        descricao === undefined

            ? null

            : String(descricao)
                .trim() || null;


    const trx =
        await connection.transaction();


    try {

        /**
         * Verifica duplicidade ignorando
         * maiúsculas/minúsculas.
         */
        const categoriaExistente =
            await connection(
                'categorias_produtos'
            )

                .transacting(trx)

                .whereRaw(
                    'LOWER(nome) = LOWER(?)',
                    [nomeNormalizado]
                )

                .whereNull(
                    'deletado_em'
                )

                .first();


        if (
            categoriaExistente
        ) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Já existe uma categoria de produto com este nome.',
                    400
                )
            );
        }


        /**
         * Criação da categoria.
         */
        const [
            novaCategoria
        ] =
            await connection(
                'categorias_produtos'
            )

                .transacting(trx)

                .insert({

                    nome:
                        nomeNormalizado,

                    descricao:
                        descricaoNormalizada,

                    ativo,

                    ordem_exibicao:
                        ordem
                })

                .returning('*');


        /**
         * Log de auditoria.
         */
        await connection('logs')

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    req.usuario.id,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'CATEGORIA_PRODUTO.CRIAR',

                descricao:
                    `Criou a categoria de produtos #${novaCategoria.id}: ${novaCategoria.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            novaCategoria.id,

                        dados:
                            novaCategoria,

                        contexto: {

                            ip:
                                req.ip,

                            user_agent:
                                req.headers[
                                    'user-agent'
                                ]
                        }
                    })
            });


        await trx.commit();


        return res.status(201).json({

            status: 'success',

            data:
                novaCategoria
        });

    } catch (error) {

        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
};


/**
 * ============================================================
 * EDITAR CATEGORIA
 * ============================================================
 *
 * PATCH /categorias-produtos/:id
 */
export const editarCategoriaProduto = async (
    req,
    res,
    next
) => {

    if (
        !req.body ||
        Object.keys(req.body).length === 0
    ) {

        return next(
            lancarErro(
                'O corpo da requisição não pode estar vazio.',
                400
            )
        );
    }


    const {
        id
    } = req.params;


    const {

        nome,

        descricao,

        ativo,

        ordem_exibicao

    } = req.body;


    /**
     * Valida nome caso tenha sido enviado.
     */
    if (
        nome !== undefined &&
        !String(nome).trim()
    ) {

        return next(
            lancarErro(
                'O nome da categoria não pode ficar vazio.',
                400
            )
        );
    }


    /**
     * Valida status.
     */
    if (
        ativo !== undefined &&
        typeof ativo !== 'boolean'
    ) {

        return next(
            lancarErro(
                'O campo ativo deve ser true ou false.',
                400
            )
        );
    }


    /**
     * Valida ordem.
     */
    if (
        ordem_exibicao !== undefined
    ) {

        const ordem =
            Number(ordem_exibicao);


        if (
            !Number.isInteger(ordem) ||
            ordem < 0
        ) {

            return next(
                lancarErro(
                    'A ordem de exibição deve ser um número inteiro igual ou maior que zero.',
                    400
                )
            );
        }
    }


    const trx =
        await connection.transaction();


    try {

        /**
         * Trava a categoria durante a edição.
         */
        const categoriaAtual =
            await connection(
                'categorias_produtos'
            )

                .transacting(trx)

                .where({
                    id
                })

                .whereNull(
                    'deletado_em'
                )

                .forUpdate()

                .first();


        if (
            !categoriaAtual
        ) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Categoria de produto não encontrada.',
                    404
                )
            );
        }


        const camposParaAtualizar = {};


        /**
         * =====================================================
         * NOME
         * =====================================================
         */
        if (
            nome !== undefined
        ) {

            const nomeNormalizado =
                normalizarNome(nome);


            if (
                nomeNormalizado.toLowerCase() !==
                categoriaAtual.nome.toLowerCase()
            ) {

                const duplicada =
                    await connection(
                        'categorias_produtos'
                    )

                        .transacting(trx)

                        .whereRaw(
                            'LOWER(nome) = LOWER(?)',
                            [nomeNormalizado]
                        )

                        .whereNot(
                            'id',
                            id
                        )

                        .whereNull(
                            'deletado_em'
                        )

                        .first();


                if (duplicada) {

                    await trx.rollback();


                    return next(
                        lancarErro(
                            'Este nome de categoria já está em uso.',
                            400
                        )
                    );
                }


                camposParaAtualizar.nome =
                    nomeNormalizado;
            }
        }


        /**
         * =====================================================
         * DESCRIÇÃO
         * =====================================================
         */
        if (
            descricao !== undefined
        ) {

            const descricaoNormalizada =
                descricao === null

                    ? null

                    : String(descricao)
                        .trim() || null;


            if (
                descricaoNormalizada !==
                categoriaAtual.descricao
            ) {

                camposParaAtualizar.descricao =
                    descricaoNormalizada;
            }
        }


        /**
         * =====================================================
         * ATIVO
         * =====================================================
         */
        if (
            ativo !== undefined &&
            ativo !== categoriaAtual.ativo
        ) {

            camposParaAtualizar.ativo =
                ativo;
        }


        /**
         * =====================================================
         * ORDEM
         * =====================================================
         */
        if (
            ordem_exibicao !== undefined
        ) {

            const ordem =
                Number(ordem_exibicao);


            if (
                ordem !==
                categoriaAtual.ordem_exibicao
            ) {

                camposParaAtualizar.ordem_exibicao =
                    ordem;
            }
        }


        /**
         * Nenhuma mudança encontrada.
         */
        if (
            Object.keys(
                camposParaAtualizar
            ).length === 0
        ) {

            await trx.rollback();


            return res.status(200).json({

                status:
                    'success',

                message:
                    'Nenhuma alteração necessária, os dados já são os mesmos.',

                data:
                    categoriaAtual
            });
        }


        /**
         * Atualização.
         */
        const [
            categoriaAtualizada
        ] =
            await connection(
                'categorias_produtos'
            )

                .transacting(trx)

                .where({
                    id
                })

                .update(
                    camposParaAtualizar
                )

                .returning('*');


        /**
         * Auditoria.
         */
        await connection('logs')

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    req.usuario.id,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'CATEGORIA_PRODUTO.EDITAR',

                descricao:
                    `Editou a categoria de produtos #${id}: ${categoriaAtualizada.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            Number(id),

                        campos_alterados:
                            Object.keys(
                                camposParaAtualizar
                            ),

                        dados_antigos:
                            categoriaAtual,

                        dados_novos:
                            categoriaAtualizada,

                        contexto: {

                            ip:
                                req.ip,

                            user_agent:
                                req.headers[
                                    'user-agent'
                                ]
                        }
                    })
            });


        await trx.commit();


        return res.status(200).json({

            status:
                'success',

            data:
                categoriaAtualizada
        });

    } catch (error) {

        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
};


/**
 * ============================================================
 * SOFT DELETE DA CATEGORIA
 * ============================================================
 *
 * DELETE /categorias-produtos/:id
 *
 * Uma categoria não poderá ser excluída enquanto possuir
 * produtos cadastrados.
 */
export const inativarCategoriaProduto = async (
    req,
    res,
    next
) => {

    const {
        id
    } = req.params;


    const trx =
        await connection.transaction();


    try {

        const categoria =
            await connection(
                'categorias_produtos'
            )

                .transacting(trx)

                .where({
                    id
                })

                .whereNull(
                    'deletado_em'
                )

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


        /**
         * Não permitimos remover uma categoria
         * que ainda possua produtos.
         */
        const produtoVinculado =
            await connection('produtos')

                .transacting(trx)

                .where(
                    'categoria_produto_id',
                    id
                )

                .whereNull(
                    'deletado_em'
                )

                .first(
                    'id',
                    'nome'
                );


        if (
            produtoVinculado
        ) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Esta categoria possui produtos cadastrados. Mova ou remova os produtos antes de excluir a categoria.',
                    409
                )
            );
        }


        /**
         * Soft delete.
         */
        await connection(
            'categorias_produtos'
        )

            .transacting(trx)

            .where({
                id
            })

            .update({

                ativo:
                    false,

                deletado_em:
                    connection.fn.now()
            });


        /**
         * Auditoria.
         */
        await connection('logs')

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    req.usuario.id,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'CATEGORIA_PRODUTO.INATIVAR',

                descricao:
                    `Removeu a categoria de produtos #${id}: ${categoria.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            Number(id),

                        dados_inativados:
                            categoria,

                        contexto: {

                            ip:
                                req.ip,

                            user_agent:
                                req.headers[
                                    'user-agent'
                                ]
                        }
                    })
            });


        await trx.commit();


        return res.status(200).json({

            status:
                'success',

            message:
                'Categoria de produto removida com sucesso.'
        });

    } catch (error) {

        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
};


/**
 * ============================================================
 * RESTAURAR CATEGORIA
 * ============================================================
 *
 * PATCH /categorias-produtos/:id/reativar
 */
export const reativarCategoriaProduto = async (
    req,
    res,
    next
) => {

    const {
        id
    } = req.params;


    const trx =
        await connection.transaction();


    try {

        const categoria =
            await connection(
                'categorias_produtos'
            )

                .transacting(trx)

                .where({
                    id
                })

                .whereNotNull(
                    'deletado_em'
                )

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


        /**
         * Como o índice UNIQUE ignora os registros
         * em soft delete, pode ter sido criada outra
         * categoria com o mesmo nome.
         *
         * Por isso validamos antes da restauração.
         */
        const categoriaComMesmoNome =
            await connection(
                'categorias_produtos'
            )

                .transacting(trx)

                .whereRaw(
                    'LOWER(nome) = LOWER(?)',
                    [categoria.nome]
                )

                .whereNot(
                    'id',
                    id
                )

                .whereNull(
                    'deletado_em'
                )

                .first();


        if (
            categoriaComMesmoNome
        ) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Não é possível restaurar esta categoria porque já existe outra categoria ativa com o mesmo nome.',
                    409
                )
            );
        }


        const [
            categoriaRestaurada
        ] =
            await connection(
                'categorias_produtos'
            )

                .transacting(trx)

                .where({
                    id
                })

                .update({

                    ativo:
                        true,

                    deletado_em:
                        null
                })

                .returning('*');


        /**
         * Auditoria.
         */
        await connection('logs')

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    req.usuario.id,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'CATEGORIA_PRODUTO.REATIVAR',

                descricao:
                    `Restaurou a categoria de produtos #${id}: ${categoria.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            Number(id),

                        dados_restaurados:
                            categoriaRestaurada,

                        contexto: {

                            ip:
                                req.ip,

                            user_agent:
                                req.headers[
                                    'user-agent'
                                ]
                        }
                    })
            });


        await trx.commit();


        return res.status(200).json({

            status:
                'success',

            message:
                'Categoria de produto restaurada com sucesso.',

            data:
                categoriaRestaurada
        });

    } catch (error) {

        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
};