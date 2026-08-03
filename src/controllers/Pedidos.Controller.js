import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

import {
    buscarPedidoCompletoPorId,
    calcularTotalPedido,
    deCentavos,
    inserirMarmitasPedido,
    inserirProdutosPedido,
    normalizarTelefone,
    selecionarMarmitasJson,
    selecionarProdutosJson
} from "../utils/pedidosUtils.js";


/**
 * ============================================================
 * CRIAR PEDIDO
 * ============================================================
 *
 * Regras principais:
 * - o pedido deve possuir pelo menos uma marmita;
 * - produtos são apenas complementos;
 * - preços são sempre buscados pelo Backend;
 * - o Frontend não controla preço, subtotal ou valor total.
 */
export const criarPedido = async (req, res, next) => {

    let trx;

    try {

        let {
            nome_cliente,
            telefone_cliente,
            endereco_cliente,
            tipo_pedido,
            metodo_entrega,
            metodo_pagamento_id,
            observacoes,
            marmitas = [],
            produtos = []
        } = req.body || {};


        if (
            !Array.isArray(marmitas) ||
            !Array.isArray(produtos)
        ) {

            lancarErro(
                'Marmitas e produtos devem ser enviados como listas.',
                400
            );
        }


        /**
         * Produtos não podem ser comprados separadamente.
         */
        if (marmitas.length === 0) {

            lancarErro(
                'Para finalizar o pedido é obrigatório adicionar pelo menos uma marmita com alimentos.',
                400
            );
        }


        telefone_cliente =
            normalizarTelefone(
                telefone_cliente
            );


        /**
         * Entrega obrigatoriamente precisa de endereço.
         */
        if (
            metodo_entrega === 'Entrega' &&
            (
                !endereco_cliente ||
                String(
                    endereco_cliente
                ).trim() === ''
            )
        ) {

            lancarErro(
                'O endereço é obrigatório para pedidos com entrega.',
                400
            );
        }


        /**
         * Retirada não precisa armazenar endereço.
         */
        const enderecoFinal =

            metodo_entrega === 'Retirada'

                ? null

                : String(
                    endereco_cliente || ''
                ).trim() || null;


        trx =
            await connection.transaction();


        /**
         * =====================================================
         * CABEÇALHO DO PEDIDO
         * =====================================================
         *
         * Começamos com total zero.
         *
         * O Backend calculará o valor verdadeiro depois.
         */
        const [
            pedido
        ] =
            await connection(
                'pedidos'
            )

                .transacting(trx)

                .insert({

                    nome_cliente,

                    telefone_cliente,

                    endereco_cliente:
                        enderecoFinal,

                    tipo_pedido,

                    metodo_entrega,

                    metodo_pagamento_id,

                    status:
                        'Pendente',

                    valor_total:
                        0,

                    observacoes
                })

                .returning('*');


        /**
         * =====================================================
         * MARMITAS
         * =====================================================
         *
         * Utiliza o preço verdadeiro:
         *
         * tamanhos_marmitas.preco_base
         */
        const totalMarmitasCentavos =
            await inserirMarmitasPedido({

                pedidoId:
                    pedido.id,

                marmitas,

                trx
            });


        /**
         * =====================================================
         * PRODUTOS
         * =====================================================
         *
         * Utiliza o preço verdadeiro:
         *
         * produtos.preco
         */
        const totalProdutosCentavos =
            await inserirProdutosPedido({

                pedidoId:
                    pedido.id,

                produtos,

                trx
            });


        /**
         * =====================================================
         * TOTAL DO PEDIDO
         * =====================================================
         */
        const valorTotalCentavos =

            totalMarmitasCentavos +

            totalProdutosCentavos;


        const valorTotalPedido =
            deCentavos(
                valorTotalCentavos
            );


        await connection(
            'pedidos'
        )

            .transacting(trx)

            .where({
                id:
                    pedido.id
            })

            .update({

                valor_total:
                    valorTotalPedido
            });


        /**
         * =====================================================
         * AUDITORIA
         * =====================================================
         */
        await connection(
            'logs'
        )

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    req.usuario?.id ||
                    null,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'PEDIDO.CRIAR',

                descricao:
                    `Pedido #${pedido.id} para ${nome_cliente}. ` +
                    `Total: R$ ${valorTotalPedido.toFixed(2)}`,

                payload:
                    JSON.stringify({

                        pedido_id:
                            pedido.id,

                        total:
                            valorTotalPedido,

                        total_marmitas:
                            deCentavos(
                                totalMarmitasCentavos
                            ),

                        total_produtos:
                            deCentavos(
                                totalProdutosCentavos
                            ),

                        quantidade_marmitas:
                            marmitas.length,

                        quantidade_produtos:
                            produtos.reduce(

                                (
                                    total,
                                    produto
                                ) =>

                                    total +

                                    Number(
                                        produto
                                            ?.quantidade ||
                                        0
                                    ),

                                0
                            )
                    })
            });


        /**
         * Tudo funcionou.
         */
        await trx.commit();


        /**
         * ========================================================
         * ETAPA 6.7 — SOCKET.IO
         * ========================================================
         *
         * O Socket NÃO recebe:
         *
         * - telefone;
         * - endereço;
         * - composição completa;
         * - forma de pagamento;
         * - observações.
         *
         * Ele serve apenas como aviso.
         *
         * Ao receber este evento, o painel administrativo
         * deverá consultar novamente GET /pedidos/admin.
         */
        if (
            global.io
        ) {

            global.io

                .to(
                    'pedidos'
                )

                .emit(

                    'novo_pedido_recebido',

                    {

                        id:
                            pedido.id,

                        nome_cliente,

                        status:
                            'Pendente'
                    }
                );
        }


        return res
            .status(201)
            .json({

                status:
                    'success',

                data: {

                    pedido_id:
                        pedido.id,

                    total:
                        valorTotalPedido,

                    total_marmitas:
                        deCentavos(
                            totalMarmitasCentavos
                        ),

                    total_produtos:
                        deCentavos(
                            totalProdutosCentavos
                        )
                }
            });


    } catch (error) {

        if (
            trx &&
            !trx.isCompleted()
        ) {

            await trx.rollback();
        }


        next(error);
    }
};


/**
 * ============================================================
 * EDITAR PEDIDO
 * ============================================================
 *
 * Marmitas e produtos podem ser alterados separadamente.
 *
 * Porém o pedido sempre precisa continuar possuindo
 * pelo menos uma marmita com alimentos.
 */
export const editarPedido = async (
    req,
    res,
    next
) => {

    let trx;


    try {

        const {
            id
        } = req.params;


        const {

            nome_cliente,

            endereco_cliente,

            telefone_cliente,

            metodo_pagamento_id,

            observacoes,

            marmitas,

            produtos

        } = req.body || {};


        /**
         * Valida marmitas somente quando
         * o campo tiver sido enviado.
         */
        if (
            marmitas !== undefined &&
            !Array.isArray(
                marmitas
            )
        ) {

            lancarErro(
                'Marmitas deve ser uma lista.',
                400
            );
        }


        /**
         * Valida produtos somente quando
         * o campo tiver sido enviado.
         */
        if (
            produtos !== undefined &&
            !Array.isArray(
                produtos
            )
        ) {

            lancarErro(
                'Produtos deve ser uma lista.',
                400
            );
        }


        /**
         * Produtos não podem substituir a marmita.
         */
        if (
            marmitas !== undefined &&
            marmitas.length === 0
        ) {

            lancarErro(
                'O pedido deve possuir pelo menos uma marmita com alimentos.',
                400
            );
        }


        const telefoneNormalizado =

            telefone_cliente !== undefined

                ? normalizarTelefone(
                    telefone_cliente
                )

                : undefined;


        const usuarioId =
            req.usuario.id;


        trx =
            await connection.transaction();


        /**
         * Busca e bloqueia o pedido enquanto
         * acontece a edição.
         */
        const pedido =
            await connection(
                'pedidos'
            )

                .transacting(trx)

                .where(
                    'id',
                    id
                )

                .whereNull(
                    'deletado_em'
                )

                .forUpdate()

                .first();


        if (!pedido) {

            lancarErro(
                'Pedido não encontrado.',
                404
            );
        }


        /**
         * Somente pedidos pendentes podem
         * ter sua composição modificada.
         */
        if (
            pedido.status !==
            'Pendente'
        ) {

            lancarErro(
                'Apenas pedidos com status "Pendente" podem ser editados.',
                400
            );
        }


        /**
         * =====================================================
         * ATUALIZAÇÃO DAS MARMITAS
         * =====================================================
         */
        if (
            marmitas !== undefined
        ) {

            /**
             * Localiza somente os itens
             * que representam marmitas.
             */
            const itensMarmitas =
                await connection(
                    'itens_pedido'
                )

                    .transacting(trx)

                    .where({
                        pedido_id:
                            id
                    })

                    .whereNotNull(
                        'tamanho_marmita_id'
                    )

                    .whereNull(
                        'produto_id'
                    )

                    .select(
                        'id'
                    );


            const idsMarmitas =
                itensMarmitas.map(
                    item =>
                        item.id
                );


            /**
             * Remove composição anterior.
             */
            if (
                idsMarmitas.length >
                0
            ) {

                await connection(
                    'composicao_item_pedido'
                )

                    .transacting(trx)

                    .whereIn(
                        'item_pedido_id',
                        idsMarmitas
                    )

                    .del();


                /**
                 * Remove somente os itens
                 * que representam marmitas.
                 */
                await connection(
                    'itens_pedido'
                )

                    .transacting(trx)

                    .whereIn(
                        'id',
                        idsMarmitas
                    )

                    .del();
            }


            /**
             * Recria as marmitas usando
             * novamente preços e alimentos
             * validados pelo Backend.
             */
            await inserirMarmitasPedido({

                pedidoId:
                    Number(id),

                marmitas,

                trx
            });
        }


        /**
         * =====================================================
         * ATUALIZAÇÃO DOS PRODUTOS
         * =====================================================
         */
        if (
            produtos !== undefined
        ) {

            /**
             * Remove SOMENTE os produtos.
             */
            await connection(
                'itens_pedido'
            )

                .transacting(trx)

                .where({
                    pedido_id:
                        id
                })

                .whereNotNull(
                    'produto_id'
                )

                .whereNull(
                    'tamanho_marmita_id'
                )

                .del();


            /**
             * [] significa nenhum complemento.
             */
            if (
                produtos.length >
                0
            ) {

                await inserirProdutosPedido({

                    pedidoId:
                        Number(id),

                    produtos,

                    trx
                });
            }
        }


        /**
         * =====================================================
         * GARANTIA FINAL
         * =====================================================
         *
         * Precisamos garantir que exista pelo menos
         * uma marmita que realmente tenha alimentos.
         */
        const marmitaComAlimento =
            await connection(
                'itens_pedido as ip'
            )

                .transacting(trx)

                .join(

                    'composicao_item_pedido as cip',

                    'cip.item_pedido_id',

                    '=',

                    'ip.id'
                )

                .where(
                    'ip.pedido_id',
                    id
                )

                .whereNotNull(
                    'ip.tamanho_marmita_id'
                )

                .whereNull(
                    'ip.produto_id'
                )

                .first(
                    'ip.id'
                );


        if (
            !marmitaComAlimento
        ) {

            lancarErro(
                'O pedido deve possuir pelo menos uma marmita com alimentos. Produtos não podem ser comprados separadamente.',
                400
            );
        }


        /**
         * Recalcula o total usando os valores
         * já gravados em itens_pedido.
         */
        const novoValorTotalCentavos =
            await calcularTotalPedido(
                id,
                trx
            );


        const novoValorTotal =
            deCentavos(
                novoValorTotalCentavos
            );


        const dadosAtualizacao = {

            nome_cliente:
                nome_cliente ??
                pedido.nome_cliente,

            telefone_cliente:
                telefoneNormalizado ??
                pedido.telefone_cliente,

            endereco_cliente:

                endereco_cliente !==
                undefined

                    ? endereco_cliente

                    : pedido
                        .endereco_cliente,

            metodo_pagamento_id:
                metodo_pagamento_id ??
                pedido
                    .metodo_pagamento_id,

            observacoes:

                observacoes !==
                undefined

                    ? observacoes

                    : pedido
                        .observacoes,

            valor_total:
                novoValorTotal,

            atualizado_em:
                connection.fn.now()
        };


        await connection(
            'pedidos'
        )

            .transacting(trx)

            .where({
                id
            })

            .update(
                dadosAtualizacao
            );


        /**
         * Auditoria.
         */
        await connection(
            'logs'
        )

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    usuarioId,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'PEDIDO.EDITAR',

                descricao:
                    `Pedido #${id} editado. Cliente: ` +
                    `${dadosAtualizacao.nome_cliente}. ` +
                    `Total: R$ ${novoValorTotal.toFixed(2)}`,

                payload:
                    JSON.stringify({

                        pedido_id:
                            Number(id),

                        campos_alterados:
                            Object.keys(
                                req.body
                            ),

                        valor_total_anterior:
                            Number(
                                pedido
                                    .valor_total
                            ),

                        valor_total_novo:
                            novoValorTotal
                    })
            });


        await trx.commit();


        /**
         * ========================================================
         * ETAPA 6.8 — PEDIDO EDITADO
         * ========================================================
         *
         * Outros painéis administrativos serão avisados
         * para recarregar a lista através da API.
         */
        if (
            global.io
        ) {

            global.io

                .to(
                    'pedidos'
                )

                .emit(

                    'pedido_atualizado',

                    {

                        pedido_id:
                            Number(id),

                        evento:
                            'editado'
                    }
                );
        }


        /**
         * Retorna o pedido completo após a edição.
         */
        const pedidoAtualizado =
            await buscarPedidoCompletoPorId(
                id
            );


        return res
            .status(200)
            .json({

                status:
                    'success',

                message:
                    'Pedido atualizado com sucesso.',

                data:
                    pedidoAtualizado
            });


    } catch (error) {

        if (
            trx &&
            !trx.isCompleted()
        ) {

            await trx.rollback();
        }


        next(error);
    }
};


/**
 * ============================================================
 * ALTERAR STATUS DO PEDIDO
 * ============================================================
 */
export const alterarStatusPedido = async (
    req,
    res,
    next
) => {

    let trx;


    try {

        const {
            id
        } = req.params;


        const {
            status
        } = req.body || {};


        const usuarioId =
            req.usuario.id;


        const statusValidos = [

            'Pendente',

            'Em Preparo',

            'Pronto para Retirada',

            'Saiu para Entrega',

            'Entregue',

            'Cancelado'
        ];


        /**
         * Status precisa fazer parte
         * do ENUM/regra do sistema.
         */
        if (
            !statusValidos.includes(
                status
            )
        ) {

            lancarErro(

                `Status inválido. Use: ${statusValidos.join(', ')}`,

                400
            );
        }


        trx =
            await connection.transaction();


        /**
         * Busca e trava o pedido.
         */
        const pedido =
            await connection(
                'pedidos'
            )

                .transacting(trx)

                .where(
                    'id',
                    id
                )

                .whereNull(
                    'deletado_em'
                )

                .forUpdate()

                .first();


        if (!pedido) {

            lancarErro(
                'Pedido não encontrado.',
                404
            );
        }


        /**
         * ========================================================
         * ETAPA 6.9
         * STATUS COERENTE COM ENTREGA / RETIRADA
         * ========================================================
         */


        /**
         * RETIRADA nunca pode:
         *
         * Saiu para Entrega
         */
        if (
            pedido.metodo_entrega ===
                'Retirada'

            &&

            status ===
                'Saiu para Entrega'
        ) {

            lancarErro(
                'Pedidos de retirada não podem receber o status "Saiu para Entrega".',
                400
            );
        }


        /**
         * ENTREGA nunca pode:
         *
         * Pronto para Retirada
         */
        if (
            pedido.metodo_entrega ===
                'Entrega'

            &&

            status ===
                'Pronto para Retirada'
        ) {

            lancarErro(
                'Pedidos de entrega não podem receber o status "Pronto para Retirada".',
                400
            );
        }


        /**
         * Evita UPDATE e LOG desnecessários
         * quando nada realmente mudou.
         */
        if (
            pedido.status ===
            status
        ) {

            await trx.rollback();


            return res
                .status(200)
                .json({

                    status:
                        'success',

                    message:
                        'O pedido já possui este status.'
                });
        }


        /**
         * Atualiza status.
         */
        await connection(
            'pedidos'
        )

            .transacting(trx)

            .where({
                id
            })

            .update({

                status,

                atualizado_em:
                    connection.fn.now()
            });


        /**
         * Auditoria.
         */
        await connection(
            'logs'
        )

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    usuarioId,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'PEDIDO.STATUS',

                descricao:
                    `Status do pedido #${id} alterado ` +
                    `de "${pedido.status}" para "${status}".`,

                payload:
                    JSON.stringify({

                        pedido_id:
                            Number(id),

                        status_anterior:
                            pedido.status,

                        status_novo:
                            status,

                        metodo_entrega:
                            pedido
                                .metodo_entrega
                    })
            });


        await trx.commit();


        /**
         * ========================================================
         * ETAPA 6.8 — STATUS ALTERADO
         * ========================================================
         *
         * Todos os outros painéis recebem um aviso.
         */
        if (
            global.io
        ) {

            global.io

                .to(
                    'pedidos'
                )

                .emit(

                    'pedido_atualizado',

                    {

                        pedido_id:
                            Number(id),

                        evento:
                            'status',

                        status
                    }
                );
        }


        return res
            .status(200)
            .json({

                status:
                    'success',

                message:
                    `Status atualizado para ${status}`
            });


    } catch (error) {

        if (
            trx &&
            !trx.isCompleted()
        ) {

            await trx.rollback();
        }


        next(error);
    }
};


/**
 * ============================================================
 * LISTAGEM ADMINISTRATIVA DOS PEDIDOS
 * ============================================================
 *
 * Retorna:
 *
 * marmitas: []
 * produtos: []
 */
export const listarPedidosAdmin = async (
    req,
    res,
    next
) => {

    try {

        const {

            page = 1,

            limit = 10,

            search = '',

            status = 'todos'

        } = req.query;


        /**
         * Paginação protegida.
         */
        const pagina =
            Math.max(

                Number.parseInt(
                    page,
                    10
                ) || 1,

                1
            );


        const porPagina =
            Math.min(

                Math.max(

                    Number.parseInt(
                        limit,
                        10
                    ) || 10,

                    1
                ),

                100
            );


        const offset =

            (
                pagina - 1
            )

            *

            porPagina;


        /**
         * Query base.
         */
        const baseQuery =
            connection(
                'pedidos'
            )

                .whereNull(
                    'pedidos.deletado_em'
                );


        /**
         * Busca.
         */
        if (
            String(
                search
            ).trim()
        ) {

            const termo =
                String(
                    search
                ).trim();


            baseQuery.where(
                function () {

                    this
                        .where(
                            'nome_cliente',
                            'ILIKE',
                            `%${termo}%`
                        )

                        .orWhere(
                            'telefone_cliente',
                            'ILIKE',
                            `%${termo}%`
                        );


                    /**
                     * Permite pesquisar:
                     *
                     * 125
                     *
                     * diretamente pelo ID.
                     */
                    if (
                        /^\d+$/.test(
                            termo
                        )
                    ) {

                        this.orWhere(
                            'pedidos.id',
                            Number(
                                termo
                            )
                        );
                    }
                }
            );
        }


        /**
         * Filtro por status.
         */
        if (
            status !==
            'todos'
        ) {

            baseQuery.where(
                'pedidos.status',
                status
            );
        }


        /**
         * Total sem paginação.
         */
        const [
            {
                total
            }
        ] =
            await baseQuery

                .clone()

                .count(
                    'pedidos.id as total'
                );


        /**
         * Pedidos completos.
         */
        const pedidos =
            await baseQuery

                .clone()

                .leftJoin(

                    'metodos_pagamento',

                    'pedidos.metodo_pagamento_id',

                    '=',

                    'metodos_pagamento.id'
                )

                .select(

                    'pedidos.*',

                    'metodos_pagamento.nome as metodo_pagamento_nome',

                    /**
                     * JSON das marmitas.
                     */
                    selecionarMarmitasJson(),

                    /**
                     * JSON dos produtos.
                     */
                    selecionarProdutosJson()
                )

                .orderBy(
                    'pedidos.criado_em',
                    'desc'
                )

                .limit(
                    porPagina
                )

                .offset(
                    offset
                );


        const totalRegistros =
            Number(
                total || 0
            );


        return res
            .status(200)
            .json({

                status:
                    'success',

                pagination: {

                    total:
                        totalRegistros,

                    page:
                        pagina,

                    per_page:
                        porPagina,

                    totalPages:
                        Math.max(

                            Math.ceil(

                                totalRegistros /

                                porPagina
                            ),

                            1
                        )
                },

                data:
                    pedidos
            });


    } catch (error) {

        next(error);
    }
};


/**
 * ============================================================
 * RASTREIO PÚBLICO POR TELEFONE
 * ============================================================
 *
 * Também retorna:
 *
 * marmitas
 * produtos
 */
export const listarPedidosPorTelefoneUsuario =
async (
    req,
    res,
    next
) => {

    try {

        /**
         * Normaliza inclusive o telefone
         * recebido pela URL.
         */
        const telefone =
            normalizarTelefone(
                req.params.telefone
            );


        const pedidos =
            await connection(
                'pedidos'
            )

                .select(

                    'pedidos.id',

                    'pedidos.nome_cliente',

                    'pedidos.status',

                    'pedidos.valor_total',

                    'pedidos.metodo_pagamento_id',

                    'pedidos.metodo_entrega',

                    'pedidos.endereco_cliente',

                    'pedidos.observacoes',

                    'pedidos.criado_em',

                    selecionarMarmitasJson(),

                    selecionarProdutosJson()
                )

                .where(
                    'pedidos.telefone_cliente',
                    telefone
                )

                .whereNull(
                    'pedidos.deletado_em'
                )

                .orderBy(
                    'pedidos.criado_em',
                    'desc'
                );


        if (
            pedidos.length ===
            0
        ) {

            return res
                .status(404)
                .json({

                    status:
                        'error',

                    message:
                        'Nenhum pedido encontrado para este número de telefone.'
                });
        }


        return res
            .status(200)
            .json({

                status:
                    'success',

                results:
                    pedidos.length,

                data:
                    pedidos
            });


    } catch (error) {

        next(error);
    }
};


/**
 * ============================================================
 * SOFT DELETE DO PEDIDO
 * ============================================================
 */
export const deletarPedido = async (
    req,
    res,
    next
) => {

    let trx;


    try {

        const {
            id
        } = req.params;


        const usuarioId =
            req.usuario.id;


        trx =
            await connection.transaction();


        /**
         * Busca e trava o pedido.
         */
        const pedido =
            await connection(
                'pedidos'
            )

                .transacting(trx)

                .where(
                    'id',
                    id
                )

                .whereNull(
                    'deletado_em'
                )

                .forUpdate()

                .first();


        if (!pedido) {

            lancarErro(
                'Pedido não encontrado ou já foi excluído.',
                404
            );
        }


        /**
         * Soft delete.
         *
         * Também cancela o pedido.
         */
        await connection(
            'pedidos'
        )

            .transacting(trx)

            .where({
                id
            })

            .update({

                status:
                    'Cancelado',

                deletado_em:
                    connection.fn.now(),

                atualizado_em:
                    connection.fn.now()
            });


        /**
         * Auditoria.
         */
        await connection(
            'logs'
        )

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    usuarioId,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'PEDIDO.DELETAR',

                descricao:
                    `Admin realizou soft delete no pedido #${id} ` +
                    `do cliente ${pedido.nome_cliente}.`,

                payload:
                    JSON.stringify({

                        pedido_id:
                            Number(id),

                        valor_total:
                            Number(
                                pedido
                                    .valor_total
                            ),

                        status_anterior:
                            pedido.status
                    })
            });


        await trx.commit();


        /**
         * ========================================================
         * ETAPA 6.8 — PEDIDO REMOVIDO
         * ========================================================
         */
        if (
            global.io
        ) {

            global.io

                .to(
                    'pedidos'
                )

                .emit(

                    'pedido_atualizado',

                    {

                        pedido_id:
                            Number(id),

                        evento:
                            'removido'
                    }
                );
        }


        return res
            .status(200)
            .json({

                status:
                    'success',

                message:
                    'Pedido excluído com sucesso.'
            });


    } catch (error) {

        if (
            trx &&
            !trx.isCompleted()
        ) {

            await trx.rollback();
        }


        next(error);
    }
};


/**
 * ============================================================
 * RESTAURAR PEDIDO
 * ============================================================
 */
export const restaurarPedido = async (
    req,
    res,
    next
) => {

    let trx;


    try {

        const {
            id
        } = req.params;


        const usuarioId =
            req.usuario.id;


        trx =
            await connection.transaction();


        /**
         * Busca e trava o pedido removido.
         */
        const pedido =
            await connection(
                'pedidos'
            )

                .transacting(trx)

                .where(
                    'id',
                    id
                )

                .forUpdate()

                .first();


        if (!pedido) {

            lancarErro(
                'Pedido não encontrado.',
                404
            );
        }


        /**
         * Pedido já está ativo.
         */
        if (
            pedido.deletado_em ===
            null
        ) {

            await trx.rollback();


            return res
                .status(400)
                .json({

                    status:
                        'error',

                    message:
                        'Este pedido já está ativo (não excluído).'
                });
        }


        /**
         * Restaura e devolve para Pendentes.
         */
        await connection(
            'pedidos'
        )

            .transacting(trx)

            .where({
                id
            })

            .update({

                deletado_em:
                    null,

                status:
                    'Pendente',

                atualizado_em:
                    connection.fn.now()
            });


        /**
         * Auditoria.
         */
        await connection(
            'logs'
        )

            .transacting(trx)

            .insert({

                tipo:
                    'ACAO',

                usuario_id:
                    usuarioId,

                metodo:
                    req.method,

                endpoint:
                    req.originalUrl,

                acao:
                    'PEDIDO.RESTAURAR',

                descricao:
                    `Admin restaurou o pedido #${id} ` +
                    `do cliente ${pedido.nome_cliente}.`,

                payload:
                    JSON.stringify({

                        pedido_id:
                            Number(id),

                        status_anterior:
                            pedido.status,

                        status_novo:
                            'Pendente'
                    })
            });


        await trx.commit();


        /**
         * ========================================================
         * ETAPA 6.8 — PEDIDO RESTAURADO
         * ========================================================
         */
        if (
            global.io
        ) {

            global.io

                .to(
                    'pedidos'
                )

                .emit(

                    'pedido_atualizado',

                    {

                        pedido_id:
                            Number(id),

                        evento:
                            'restaurado',

                        status:
                            'Pendente'
                    }
                );
        }


        return res
            .status(200)
            .json({

                status:
                    'success',

                message:
                    'Pedido restaurado e enviado de volta para a lista de Pendentes.'
            });


    } catch (error) {

        if (
            trx &&
            !trx.isCompleted()
        ) {

            await trx.rollback();
        }


        next(error);
    }
};