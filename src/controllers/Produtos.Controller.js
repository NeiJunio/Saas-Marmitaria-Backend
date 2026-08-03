import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";


/**
 * Normaliza inteiros positivos.
 *
 * Utilizado principalmente em paginação.
 */
function normalizarInteiroPositivo(
    valor,
    padrao,
    maximo = null
) {

    const numero =
        Number.parseInt(
            valor,
            10
        );


    if (
        !Number.isInteger(numero) ||
        numero < 1
    ) {

        return padrao;
    }


    return maximo
        ? Math.min(
            numero,
            maximo
        )
        : numero;
}


/**
 * Remove espaços desnecessários do nome
 * sem destruir a capitalização.
 *
 * Exemplo:
 *
 * "  Coca-Cola   350ml  "
 *
 * vira:
 *
 * "Coca-Cola 350ml"
 */
function normalizarNome(nome) {

    return String(nome)
        .trim()
        .replace(/\s+/g, ' ');
}


/**
 * Normaliza preços.
 *
 * Aceita:
 *
 * 6.5
 * "6.50"
 * "6,50"
 */
function normalizarPreco(preco) {

    if (
        preco === null ||
        preco === undefined ||
        String(preco).trim() === ''
    ) {

        lancarErro(
            'O preço do produto é obrigatório.',
            400
        );
    }


    const valor =
        Number(

            typeof preco === 'string'

                ? preco.replace(
                    ',',
                    '.'
                )

                : preco
        );


    if (
        !Number.isFinite(valor) ||
        valor < 0
    ) {

        lancarErro(
            'O preço deve ser um valor válido igual ou maior que zero.',
            400
        );
    }


    return Number(
        valor.toFixed(2)
    );
}


/**
 * PostgreSQL normalmente devolve DECIMAL
 * como string.
 *
 * Aqui transformamos preço em Number antes
 * de enviar para o Frontend.
 */
function formatarProdutoParaResposta(
    produto
) {

    if (!produto) {
        return produto;
    }


    return {

        ...produto,

        preco:

            produto.preco === null ||
            produto.preco === undefined

                ? null

                : Number(
                    produto.preco
                )
    };
}


/**
 * Busca uma categoria que realmente
 * pode receber/vender produtos.
 *
 * A categoria precisa:
 *
 * - existir;
 * - estar ativa;
 * - não estar removida.
 */
async function buscarCategoriaValida(
    categoriaId,
    trx = null
) {

    const query =
        connection(
            'categorias_produtos'
        )

            .where(
                'id',
                categoriaId
            )

            .where(
                'ativo',
                true
            )

            .whereNull(
                'deletado_em'
            );


    if (trx) {
        query.transacting(trx);
    }


    return query.first();
}


/**
 * ============================================================
 * CARDÁPIO PÚBLICO
 * ============================================================
 *
 * GET /produtos/cardapio
 *
 * Retorna os produtos agrupados pelas categorias.
 *
 * Também aceita:
 *
 * ?categoria_id=1
 */
export const listarProdutosCardapio = async (
    req,
    res,
    next
) => {

    try {

        const {
            categoria_id
        } = req.query;


        const query =
            connection(
                'produtos as p'
            )

                .join(

                    'categorias_produtos as cp',

                    'p.categoria_produto_id',

                    '=',

                    'cp.id'
                )

                .select([

                    'p.id',

                    'p.nome',

                    'p.descricao',

                    'p.preco',

                    'p.ordem_exibicao',

                    'cp.id as categoria_id',

                    'cp.nome as categoria_nome',

                    'cp.descricao as categoria_descricao',

                    'cp.ordem_exibicao as categoria_ordem_exibicao'
                ])


                /**
                 * Produto precisa estar ativo.
                 */
                .where(
                    'p.ativo',
                    true
                )


                /**
                 * Produto precisa estar disponível hoje.
                 */
                .where(
                    'p.disponivel_hoje',
                    true
                )


                // Produto não excluído.
                .whereNull(
                    'p.deletado_em'
                )


                /**
                 * Categoria também precisa estar ativa.
                 */
                .where(
                    'cp.ativo',
                    true
                )


                // Categoria não excluída.
                .whereNull(
                    'cp.deletado_em'
                );


        /**
         * Filtro opcional por categoria.
         */
        if (
            categoria_id !== undefined
        ) {

            const categoriaId =
                Number(
                    categoria_id
                );


            if (
                !Number.isInteger(
                    categoriaId
                ) ||
                categoriaId <= 0
            ) {

                return next(
                    lancarErro(
                        'O filtro categoria_id deve ser um ID válido.',
                        400
                    )
                );
            }


            query.where(
                'p.categoria_produto_id',
                categoriaId
            );
        }


        const produtos =
            await query

                .orderBy(
                    'cp.ordem_exibicao',
                    'ASC'
                )

                .orderBy(
                    'cp.nome',
                    'ASC'
                )

                .orderBy(
                    'p.ordem_exibicao',
                    'ASC'
                )

                .orderBy(
                    'p.nome',
                    'ASC'
                );


        /**
         * =====================================================
         * AGRUPAMENTO
         * =====================================================
         *
         * Em vez do frontend precisar reconstruir:
         *
         * Bebidas
         * ├── Coca-Cola
         * └── Água
         *
         * fazemos isso diretamente no Backend.
         */
        const categoriasMap =
            new Map();


        for (
            const produto of produtos
        ) {

            if (
                !categoriasMap.has(
                    produto.categoria_id
                )
            ) {

                categoriasMap.set(

                    produto.categoria_id,

                    {

                        id:
                            produto.categoria_id,

                        nome:
                            produto.categoria_nome,

                        descricao:
                            produto.categoria_descricao,

                        ordem_exibicao:
                            produto.categoria_ordem_exibicao,

                        produtos:
                            []
                    }
                );
            }


            categoriasMap
                .get(
                    produto.categoria_id
                )

                .produtos

                .push({

                    id:
                        produto.id,

                    nome:
                        produto.nome,

                    descricao:
                        produto.descricao,

                    preco:
                        Number(
                            produto.preco
                        ),

                    ordem_exibicao:
                        produto.ordem_exibicao
                });
        }


        const categorias =
            Array.from(
                categoriasMap.values()
            );


        return res.status(200).json({

            status:
                'success',

            /**
             * Total de produtos e não
             * total de categorias.
             */
            results:
                produtos.length,

            data:
                categorias
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
 * GET /produtos/admin
 */
export const listarProdutosAdmin = async (
    req,
    res,
    next
) => {

    try {

        const {

            page = 1,

            limit = 10,

            search = '',

            categoria_id,

            status = 'todos',

            disponibilidade = 'todos',

            excluidos = 'false',

            preco_min,

            preco_max,

            sort = 'ordem_exibicao',

            order = 'ASC'

        } = req.query;


        const pageNumber =
            normalizarInteiroPositivo(
                page,
                1
            );


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
         * Whitelist para ordenação segura.
         */
        const colunasOrdenacao = {

            id:
                'p.id',

            nome:
                'p.nome',

            preco:
                'p.preco',

            ativo:
                'p.ativo',

            disponivel_hoje:
                'p.disponivel_hoje',

            categoria:
                'cp.nome',

            ordem_exibicao:
                'p.ordem_exibicao',

            criado_em:
                'p.criado_em',

            atualizado_em:
                'p.atualizado_em'
        };


        const colunaOrdenacao =
            colunasOrdenacao[sort] ||
            'p.ordem_exibicao';


        const direcao =
            String(order).toUpperCase() ===
            'DESC'

                ? 'DESC'

                : 'ASC';


        const query =
            connection(
                'produtos as p'
            )

                .leftJoin(

                    'categorias_produtos as cp',

                    'p.categoria_produto_id',

                    '=',

                    'cp.id'
                );


        /**
         * =====================================================
         * SOFT DELETE
         * =====================================================
         */
        if (
            excluidos === 'false'
        ) {

            query.whereNull(
                'p.deletado_em'
            );

        } else if (
            excluidos === 'true'
        ) {

            query.whereNotNull(
                'p.deletado_em'
            );
        }


        /**
         * =====================================================
         * ATIVO / INATIVO
         * =====================================================
         */
        if (
            status === 'ativo'
        ) {

            query.where(
                'p.ativo',
                true
            );

        } else if (
            status === 'inativo'
        ) {

            query.where(
                'p.ativo',
                false
            );
        }


        /**
         * =====================================================
         * DISPONIBILIDADE
         * =====================================================
         */
        if (
            disponibilidade ===
            'disponivel'
        ) {

            query.where(
                'p.disponivel_hoje',
                true
            );

        } else if (
            disponibilidade ===
            'indisponivel'
        ) {

            query.where(
                'p.disponivel_hoje',
                false
            );
        }


        /**
         * =====================================================
         * CATEGORIA
         * =====================================================
         */
        if (
            categoria_id !== undefined &&
            String(
                categoria_id
            ).trim() !== ''
        ) {

            const categoriaId =
                Number(
                    categoria_id
                );


            if (
                !Number.isInteger(
                    categoriaId
                ) ||
                categoriaId <= 0
            ) {

                return next(
                    lancarErro(
                        'O filtro categoria_id deve ser um ID válido.',
                        400
                    )
                );
            }


            query.where(
                'p.categoria_produto_id',
                categoriaId
            );
        }


        /**
         * =====================================================
         * PESQUISA
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
                            'p.nome',
                            'ILIKE',
                            termo
                        )

                        .orWhere(
                            'p.descricao',
                            'ILIKE',
                            termo
                        )

                        .orWhere(
                            'cp.nome',
                            'ILIKE',
                            termo
                        );
                }
            );
        }


        /**
         * =====================================================
         * PREÇO MÍNIMO
         * =====================================================
         */
        if (
            preco_min !== undefined &&
            String(preco_min).trim() !== ''
        ) {

            const minimo =
                normalizarPreco(
                    preco_min
                );


            query.where(
                'p.preco',
                '>=',
                minimo
            );
        }


        /**
         * =====================================================
         * PREÇO MÁXIMO
         * =====================================================
         */
        if (
            preco_max !== undefined &&
            String(preco_max).trim() !== ''
        ) {

            const maximo =
                normalizarPreco(
                    preco_max
                );


            query.where(
                'p.preco',
                '<=',
                maximo
            );
        }


        /**
         * Evita:
         *
         * mínimo: R$ 100
         * máximo: R$ 20
         */
        if (

            preco_min !== undefined &&

            preco_max !== undefined &&

            String(preco_min).trim() !== '' &&

            String(preco_max).trim() !== '' &&

            normalizarPreco(
                preco_min
            ) >

            normalizarPreco(
                preco_max
            )

        ) {

            return next(
                lancarErro(
                    'O preço mínimo não pode ser maior que o preço máximo.',
                    400
                )
            );
        }


        /**
         * Total sem paginação.
         */
        const totalCount =
            await query
                .clone()

                .count(
                    'p.id as total'
                )

                .first();


        /**
         * Busca os registros.
         */
        const produtos =
            await query
                .clone()

                .select([

                    'p.id',

                    'p.categoria_produto_id',

                    'cp.nome as categoria_nome',

                    'p.nome',

                    'p.descricao',

                    'p.preco',

                    'p.ativo',

                    'p.disponivel_hoje',

                    'p.ordem_exibicao',

                    'p.criado_em',

                    'p.atualizado_em',

                    'p.deletado_em'
                ])

                .orderBy(
                    colunaOrdenacao,
                    direcao
                )

                .orderBy(
                    'p.id',
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

            status:
                'success',

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
                produtos.map(
                    formatarProdutoParaResposta
                )
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * BUSCAR PRODUTO POR ID
 * ============================================================
 *
 * GET /produtos/:id
 */
export const buscarProdutoPorId = async (
    req,
    res,
    next
) => {

    try {

        const {
            id
        } = req.params;


        const produto =
            await connection(
                'produtos as p'
            )

                .leftJoin(

                    'categorias_produtos as cp',

                    'p.categoria_produto_id',

                    '=',

                    'cp.id'
                )

                .select([

                    'p.id',

                    'p.categoria_produto_id',

                    'cp.nome as categoria_nome',

                    'cp.ativo as categoria_ativa',

                    'cp.deletado_em as categoria_deletada_em',

                    'p.nome',

                    'p.descricao',

                    'p.preco',

                    'p.ativo',

                    'p.disponivel_hoje',

                    'p.ordem_exibicao',

                    'p.criado_em',

                    'p.atualizado_em',

                    'p.deletado_em'
                ])

                .where(
                    'p.id',
                    id
                )

                .first();


        if (!produto) {

            return next(
                lancarErro(
                    'Produto não encontrado.',
                    404
                )
            );
        }


        return res.status(200).json({

            status:
                'success',

            data:
                formatarProdutoParaResposta(
                    produto
                )
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * CRIAR PRODUTO
 * ============================================================
 *
 * POST /produtos
 */
export const criarProduto = async (
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

        categoria_produto_id,

        nome,

        descricao = null,

        preco,

        ativo = true,

        disponivel_hoje = true,

        ordem_exibicao = 0

    } = req.body;


    const categoriaId =
        Number(
            categoria_produto_id
        );


    /**
     * Categoria obrigatória.
     */
    if (
        !Number.isInteger(
            categoriaId
        ) ||
        categoriaId <= 0
    ) {

        return next(
            lancarErro(
                'A categoria do produto é obrigatória e deve ser válida.',
                400
            )
        );
    }


    /**
     * Nome obrigatório.
     */
    if (
        !nome ||
        !String(nome).trim()
    ) {

        return next(
            lancarErro(
                'O nome do produto é obrigatório.',
                400
            )
        );
    }


    /**
     * Validação de ativo.
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
     * Validação de disponibilidade.
     */
    if (
        disponivel_hoje !== undefined &&
        typeof disponivel_hoje !== 'boolean'
    ) {

        return next(
            lancarErro(
                'O campo disponivel_hoje deve ser true ou false.',
                400
            )
        );
    }


    /**
     * Validação de ordem.
     */
    const ordem =
        Number(
            ordem_exibicao
        );


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


    const precoNormalizado =
        normalizarPreco(
            preco
        );


    /**
     * Um produto administrativamente inativo
     * nunca poderá nascer disponível.
     */
    const disponibilidadeFinal =
        ativo
            ? disponivel_hoje
            : false;


    const trx =
        await connection.transaction();


    try {

        /**
         * Categoria precisa existir e estar ativa.
         */
        const categoria =
            await buscarCategoriaValida(
                categoriaId,
                trx
            );


        if (!categoria) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Categoria de produto inválida, inativa ou removida.',
                    400
                )
            );
        }


        /**
         * Verifica duplicidade dentro
         * da mesma categoria.
         */
        const produtoExistente =
            await connection('produtos')

                .transacting(trx)

                .where(
                    'categoria_produto_id',
                    categoriaId
                )

                .whereRaw(
                    'LOWER(nome) = LOWER(?)',
                    [nomeNormalizado]
                )

                .whereNull(
                    'deletado_em'
                )

                .first();


        if (
            produtoExistente
        ) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Já existe um produto com este nome nesta categoria.',
                    400
                )
            );
        }


        /**
         * Criação.
         */
        const [
            novoProduto
        ] =
            await connection('produtos')

                .transacting(trx)

                .insert({

                    categoria_produto_id:
                        categoriaId,

                    nome:
                        nomeNormalizado,

                    descricao:
                        descricaoNormalizada,

                    preco:
                        precoNormalizado,

                    ativo,

                    disponivel_hoje:
                        disponibilidadeFinal,

                    ordem_exibicao:
                        ordem
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
                    'PRODUTO.CRIAR',

                descricao:
                    `Criou o produto #${novoProduto.id}: ${novoProduto.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            novoProduto.id,

                        categoria: {

                            id:
                                categoria.id,

                            nome:
                                categoria.nome
                        },

                        dados: {

                            ...novoProduto,

                            preco:
                                Number(
                                    novoProduto.preco
                                )
                        },

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

            status:
                'success',

            data:
                formatarProdutoParaResposta(
                    novoProduto
                )
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
 * EDITAR PRODUTO
 * ============================================================
 *
 * PATCH /produtos/:id
 */
export const editarProduto = async (
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

        categoria_produto_id,

        nome,

        descricao,

        preco,

        ativo,

        disponivel_hoje,

        ordem_exibicao

    } = req.body;


    if (
        nome !== undefined &&
        !String(nome).trim()
    ) {

        return next(
            lancarErro(
                'O nome do produto não pode ficar vazio.',
                400
            )
        );
    }


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


    if (
        disponivel_hoje !== undefined &&
        typeof disponivel_hoje !== 'boolean'
    ) {

        return next(
            lancarErro(
                'O campo disponivel_hoje deve ser true ou false.',
                400
            )
        );
    }


    if (
        ordem_exibicao !== undefined
    ) {

        const ordem =
            Number(
                ordem_exibicao
            );


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


    if (
        categoria_produto_id !== undefined
    ) {

        const categoriaId =
            Number(
                categoria_produto_id
            );


        if (
            !Number.isInteger(
                categoriaId
            ) ||
            categoriaId <= 0
        ) {

            return next(
                lancarErro(
                    'A categoria do produto deve ser um ID válido.',
                    400
                )
            );
        }
    }


    const trx =
        await connection.transaction();


    try {

        /**
         * Busca e bloqueia o produto
         * durante a atualização.
         */
        const produtoAtual =
            await connection('produtos')

                .transacting(trx)

                .where({
                    id
                })

                .whereNull(
                    'deletado_em'
                )

                .forUpdate()

                .first();


        if (!produtoAtual) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Produto não encontrado.',
                    404
                )
            );
        }


        const camposParaAtualizar = {};


        /**
         * Precisamos conhecer os valores finais
         * de categoria + nome para validar duplicidade.
         */
        let categoriaFinalId =
            produtoAtual.categoria_produto_id;


        let nomeFinal =
            produtoAtual.nome;


        /**
         * =====================================================
         * CATEGORIA
         * =====================================================
         */
        if (
            categoria_produto_id !== undefined
        ) {

            const categoriaId =
                Number(
                    categoria_produto_id
                );


            if (
                categoriaId !==
                produtoAtual.categoria_produto_id
            ) {

                const categoria =
                    await buscarCategoriaValida(
                        categoriaId,
                        trx
                    );


                if (!categoria) {

                    await trx.rollback();


                    return next(
                        lancarErro(
                            'Categoria de produto inválida, inativa ou removida.',
                            400
                        )
                    );
                }


                camposParaAtualizar.categoria_produto_id =
                    categoriaId;


                categoriaFinalId =
                    categoriaId;
            }
        }


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
                nomeNormalizado !==
                produtoAtual.nome
            ) {

                camposParaAtualizar.nome =
                    nomeNormalizado;


                nomeFinal =
                    nomeNormalizado;
            }
        }


        /**
         * =====================================================
         * DUPLICIDADE
         * =====================================================
         *
         * Esta validação precisa ocorrer após calcularmos
         * nome e categoria finais.
         */
        if (

            categoriaFinalId !==
            produtoAtual.categoria_produto_id

            ||

            nomeFinal.toLowerCase() !==
            produtoAtual.nome.toLowerCase()

        ) {

            const duplicado =
                await connection('produtos')

                    .transacting(trx)

                    .where(
                        'categoria_produto_id',
                        categoriaFinalId
                    )

                    .whereRaw(
                        'LOWER(nome) = LOWER(?)',
                        [nomeFinal]
                    )

                    .whereNot(
                        'id',
                        id
                    )

                    .whereNull(
                        'deletado_em'
                    )

                    .first();


            if (duplicado) {

                await trx.rollback();


                return next(
                    lancarErro(
                        'Já existe um produto com este nome nesta categoria.',
                        400
                    )
                );
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
                produtoAtual.descricao
            ) {

                camposParaAtualizar.descricao =
                    descricaoNormalizada;
            }
        }


        /**
         * =====================================================
         * PREÇO
         * =====================================================
         */
        if (
            preco !== undefined
        ) {

            const precoNormalizado =
                normalizarPreco(
                    preco
                );


            if (
                precoNormalizado !==
                Number(
                    produtoAtual.preco
                )
            ) {

                camposParaAtualizar.preco =
                    precoNormalizado;
            }
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
                Number(
                    ordem_exibicao
                );


            if (
                ordem !==
                produtoAtual.ordem_exibicao
            ) {

                camposParaAtualizar.ordem_exibicao =
                    ordem;
            }
        }


        /**
         * =====================================================
         * ATIVO
         * =====================================================
         */
        if (
            ativo !== undefined &&
            ativo !== produtoAtual.ativo
        ) {

            camposParaAtualizar.ativo =
                ativo;


            /**
             * Produto inativo nunca
             * permanece disponível.
             */
            if (
                ativo === false
            ) {

                camposParaAtualizar.disponivel_hoje =
                    false;
            }
        }


        /**
         * =====================================================
         * DISPONIBILIDADE
         * =====================================================
         */
        if (
            disponivel_hoje !== undefined
        ) {

            const ativoFinal =

                camposParaAtualizar.ativo !==
                undefined

                    ? camposParaAtualizar.ativo

                    : produtoAtual.ativo;


            /**
             * Não pode disponibilizar
             * produto inativo.
             */
            if (
                disponivel_hoje === true &&
                ativoFinal === false
            ) {

                await trx.rollback();


                return next(
                    lancarErro(
                        'Um produto inativo não pode ser marcado como disponível hoje.',
                        400
                    )
                );
            }


            /**
             * A categoria também precisa
             * estar liberada.
             */
            if (
                disponivel_hoje === true
            ) {

                const categoria =
                    await buscarCategoriaValida(
                        categoriaFinalId,
                        trx
                    );


                if (!categoria) {

                    await trx.rollback();


                    return next(
                        lancarErro(
                            'Não é possível disponibilizar o produto porque sua categoria está inativa ou removida.',
                            400
                        )
                    );
                }
            }


            if (
                disponivel_hoje !==
                produtoAtual.disponivel_hoje
            ) {

                camposParaAtualizar.disponivel_hoje =
                    disponivel_hoje;
            }
        }


        /**
         * Nenhuma alteração.
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
                    formatarProdutoParaResposta(
                        produtoAtual
                    )
            });
        }


        /**
         * Atualização.
         */
        const [
            produtoAtualizado
        ] =
            await connection('produtos')

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
                    'PRODUTO.EDITAR',

                descricao:
                    `Editou o produto #${id}: ${produtoAtualizado.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            Number(id),

                        campos_alterados:
                            Object.keys(
                                camposParaAtualizar
                            ),

                        dados_antigos:
                            formatarProdutoParaResposta(
                                produtoAtual
                            ),

                        dados_novos:
                            formatarProdutoParaResposta(
                                produtoAtualizado
                            ),

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
                formatarProdutoParaResposta(
                    produtoAtualizado
                )
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
 * DISPONIBILIDADE DO DIA
 * ============================================================
 *
 * PATCH /produtos/:id/disponibilidade
 */
export const alternarDisponibilidadeProduto = async (
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
        disponivel_hoje
    } = req.body;


    if (
        typeof disponivel_hoje !==
        'boolean'
    ) {

        return next(
            lancarErro(
                'O campo disponivel_hoje deve ser true ou false.',
                400
            )
        );
    }


    const trx =
        await connection.transaction();


    try {

        /**
         * Busca e bloqueia o registro.
         */
        const produto =
            await connection('produtos')

                .transacting(trx)

                .where({
                    id
                })

                .whereNull(
                    'deletado_em'
                )

                .forUpdate()

                .first();


        if (!produto) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Produto não encontrado.',
                    404
                )
            );
        }


        /**
         * Se estamos ligando o produto,
         * fazemos validações adicionais.
         */
        if (
            disponivel_hoje === true
        ) {

            /**
             * Produto precisa estar ativo.
             */
            if (
                !produto.ativo
            ) {

                await trx.rollback();


                return next(
                    lancarErro(
                        'Produto inativo não pode ser disponibilizado para venda.',
                        400
                    )
                );
            }


            /**
             * Categoria também precisa
             * estar ativa.
             */
            const categoria =
                await buscarCategoriaValida(
                    produto.categoria_produto_id,
                    trx
                );


            if (!categoria) {

                await trx.rollback();


                return next(
                    lancarErro(
                        'A categoria deste produto está inativa ou removida.',
                        400
                    )
                );
            }
        }


        /**
         * Se já está igual, nenhuma
         * atualização é necessária.
         */
        if (
            produto.disponivel_hoje ===
            disponivel_hoje
        ) {

            await trx.rollback();


            return res.status(200).json({

                status:
                    'success',

                message:
                    'A disponibilidade do produto já está com o valor informado.',

                data:
                    formatarProdutoParaResposta(
                        produto
                    )
            });
        }


        const [
            produtoAtualizado
        ] =
            await connection('produtos')

                .transacting(trx)

                .where({
                    id
                })

                .update({
                    disponivel_hoje
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
                    'PRODUTO.DISPONIBILIDADE',

                descricao:
                    `Alterou a disponibilidade do produto #${id}: ${produto.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            Number(id),

                        disponivel_anteriormente:
                            produto.disponivel_hoje,

                        disponivel_hoje,

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
                'Disponibilidade do produto alterada com sucesso.',

            data:
                formatarProdutoParaResposta(
                    produtoAtualizado
                )
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
 * SOFT DELETE
 * ============================================================
 *
 * DELETE /produtos/:id
 */
export const inativarProduto = async (
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

        const produto =
            await connection('produtos')

                .transacting(trx)

                .where({
                    id
                })

                .whereNull(
                    'deletado_em'
                )

                .forUpdate()

                .first();


        if (!produto) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Produto não encontrado ou já removido.',
                    404
                )
            );
        }


        /**
         * Soft delete.
         *
         * Também desligamos:
         *
         * ativo
         * disponivel_hoje
         */
        await connection('produtos')

            .transacting(trx)

            .where({
                id
            })

            .update({

                ativo:
                    false,

                disponivel_hoje:
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
                    'PRODUTO.INATIVAR',

                descricao:
                    `Removeu o produto #${id}: ${produto.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            Number(id),

                        dados_inativados:
                            formatarProdutoParaResposta(
                                produto
                            ),

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
                'Produto removido com sucesso.'
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
 * RESTAURAR PRODUTO
 * ============================================================
 *
 * PATCH /produtos/:id/reativar
 *
 * IMPORTANTE:
 *
 * O produto volta ao cadastro,
 * porém permanece indisponível.
 *
 * O administrador precisará liberar
 * novamente no cardápio.
 */
export const reativarProduto = async (
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

        const produto =
            await connection('produtos')

                .transacting(trx)

                .where({
                    id
                })

                .whereNotNull(
                    'deletado_em'
                )

                .forUpdate()

                .first();


        if (!produto) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Produto não encontrado ou já está ativo.',
                    404
                )
            );
        }


        /**
         * A categoria precisa continuar válida.
         */
        const categoria =
            await buscarCategoriaValida(
                produto.categoria_produto_id,
                trx
            );


        if (!categoria) {

            await trx.rollback();


            return next(
                lancarErro(
                    'A categoria deste produto está inativa ou removida. Restaure/ative a categoria antes do produto.',
                    409
                )
            );
        }


        /**
         * Pode existir outro produto criado
         * depois que este foi excluído.
         */
        const produtoComMesmoNome =
            await connection('produtos')

                .transacting(trx)

                .where(
                    'categoria_produto_id',
                    produto.categoria_produto_id
                )

                .whereRaw(
                    'LOWER(nome) = LOWER(?)',
                    [produto.nome]
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
            produtoComMesmoNome
        ) {

            await trx.rollback();


            return next(
                lancarErro(
                    'Não é possível restaurar este produto porque já existe outro produto ativo com o mesmo nome nesta categoria.',
                    409
                )
            );
        }


        /**
         * Restauramos o cadastro.
         *
         * Mas deixamos indisponível para evitar
         * aparecer automaticamente ao cliente.
         */
        const [
            produtoRestaurado
        ] =
            await connection('produtos')

                .transacting(trx)

                .where({
                    id
                })

                .update({

                    ativo:
                        true,

                    disponivel_hoje:
                        false,

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
                    'PRODUTO.REATIVAR',

                descricao:
                    `Restaurou o produto #${id}: ${produto.nome}`,

                payload:
                    JSON.stringify({

                        recurso_id:
                            Number(id),

                        dados_restaurados:
                            formatarProdutoParaResposta(
                                produtoRestaurado
                            ),

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
                'Produto restaurado com sucesso. Ele permanece indisponível até ser liberado no cardápio.',

            data:
                formatarProdutoParaResposta(
                    produtoRestaurado
                )
        });

    } catch (error) {

        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
};