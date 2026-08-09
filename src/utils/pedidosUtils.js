// import connection from "../database/connection.js";
// import { lancarErro } from "./errorUtils.js";


// /**
//  * Converte um valor monetário para centavos.
//  *
//  * Mantemos os cálculos financeiros em inteiros para evitar
//  * problemas de ponto flutuante do JavaScript.
//  *
//  * Exemplo:
//  *
//  * 6.50 -> 650
//  */
// export function paraCentavos(valor) {
//     return Math.round(Number(valor) * 100);
// }


// /**
//  * Converte centavos novamente para decimal.
//  *
//  * Exemplo:
//  *
//  * 650 -> 6.50
//  */
// export function deCentavos(valor) {
//     return Number(
//         (valor / 100).toFixed(2)
//     );
// }


// /**
//  * Remove caracteres que não sejam números
//  * e valida um telefone com DDD.
//  */
// export function normalizarTelefone(telefone) {

//     const telefoneLimpo =
//         String(telefone || '')
//             .replace(/\D/g, '');


//     if (
//         telefoneLimpo.length < 10 ||
//         telefoneLimpo.length > 11
//     ) {

//         lancarErro(
//             'Telefone inválido. O telefone deve ter 10 ou 11 dígitos numéricos.',
//             400
//         );
//     }


//     return telefoneLimpo;
// }


// /**
//  * Garante que quantidades sejam números inteiros
//  * maiores que zero.
//  */
// function validarQuantidade(
//     quantidade,
//     tipoItem
// ) {

//     const valor =
//         Number(quantidade);


//     if (
//         !Number.isInteger(valor) ||
//         valor <= 0
//     ) {

//         lancarErro(
//             `A quantidade de ${tipoItem} deve ser um número inteiro maior que zero.`,
//             400
//         );
//     }


//     return valor;
// }


// /**
//  * ============================================================
//  * VALIDAÇÃO DOS ALIMENTOS DA MARMITA
//  * ============================================================
//  *
//  * Verifica:
//  *
//  * - se alimentos foram enviados;
//  * - IDs válidos;
//  * - alimento duplicado;
//  * - disponibilidade;
//  * - soft delete;
//  * - categoria ativa;
//  * - limite de escolhas por categoria.
//  */
// async function validarAlimentosDaMarmita(
//     alimentos,
//     trx
// ) {

//     if (
//         !Array.isArray(alimentos) ||
//         alimentos.length === 0
//     ) {

//         lancarErro(
//             'A marmita deve possuir pelo menos um alimento.',
//             400
//         );
//     }


//     const alimentosIds =
//         alimentos.map(
//             (id) => Number(id)
//         );


//     if (
//         alimentosIds.some(
//             (id) =>
//                 !Number.isInteger(id) ||
//                 id <= 0
//         )
//     ) {

//         lancarErro(
//             'A marmita possui um alimento inválido.',
//             400
//         );
//     }


//     /**
//      * Impede enviar o mesmo alimento duas vezes
//      * para tentar manipular limites.
//      */
//     if (
//         new Set(alimentosIds).size !==
//         alimentosIds.length
//     ) {

//         lancarErro(
//             'A marmita possui alimentos duplicados.',
//             400
//         );
//     }


//     const dadosAlimentos =
//         await connection('alimentos as a')

//             .transacting(trx)

//             .join(
//                 'categorias_alimentos as ca',
//                 'a.categoria_id',
//                 '=',
//                 'ca.id'
//             )

//             .select(
//                 'a.id',
//                 'a.categoria_id',
//                 'ca.nome as categoria_nome',
//                 'ca.limite_escolhas'
//             )

//             .whereIn(
//                 'a.id',
//                 alimentosIds
//             )

//             .where(
//                 'a.disponivel_hoje',
//                 true
//             )

//             .whereNull(
//                 'a.deletado_em'
//             )

//             .where(
//                 'ca.ativo',
//                 true
//             )

//             .whereNull(
//                 'ca.deletado_em'
//             );


//     /**
//      * Se retornou menos alimentos do que foi enviado,
//      * algum deles não existe ou está indisponível.
//      */
//     if (
//         dadosAlimentos.length !==
//         alimentosIds.length
//     ) {

//         lancarErro(
//             'Um ou mais alimentos selecionados estão indisponíveis.',
//             400
//         );
//     }


//     const contagemPorCategoria = {};


//     for (
//         const alimento of dadosAlimentos
//     ) {

//         if (
//             !contagemPorCategoria[
//             alimento.categoria_id
//             ]
//         ) {

//             contagemPorCategoria[
//                 alimento.categoria_id
//             ] = {

//                 quantidade: 0,

//                 limite:
//                     Number(
//                         alimento.limite_escolhas
//                     ),

//                 nome:
//                     alimento.categoria_nome
//             };
//         }


//         contagemPorCategoria[
//             alimento.categoria_id
//         ].quantidade += 1;
//     }


//     /**
//      * Confere os limites.
//      *
//      * Exemplo:
//      * Proteínas = máximo 2.
//      */
//     for (
//         const categoria of
//         Object.values(
//             contagemPorCategoria
//         )
//     ) {

//         if (
//             categoria.quantidade >
//             categoria.limite
//         ) {

//             lancarErro(
//                 `Limite excedido na categoria ${categoria.nome}. ` +
//                 `Máximo: ${categoria.limite}, enviado: ${categoria.quantidade}.`,
//                 400
//             );
//         }
//     }


//     return alimentosIds;
// }


// /**
//  * ============================================================
//  * INSERIR MARMITAS
//  * ============================================================
//  *
//  * O preço NUNCA vem do frontend.
//  *
//  * É sempre utilizado:
//  *
//  * tamanhos_marmitas.preco_base
//  *
//  * @returns total das marmitas em centavos
//  */
// export async function inserirMarmitasPedido({
//     pedidoId,
//     marmitas,
//     trx
// }) {

//     let totalCentavos = 0;


//     for (
//         const marmita of marmitas
//     ) {

//         const tamanhoId =
//             Number(
//                 marmita?.tamanho_id
//             );


//         const quantidade =
//             validarQuantidade(
//                 marmita?.quantidade,
//                 'marmitas'
//             );


//         if (
//             !Number.isInteger(tamanhoId) ||
//             tamanhoId <= 0
//         ) {

//             lancarErro(
//                 'O tamanho da marmita informado é inválido.',
//                 400
//             );
//         }


//         /**
//          * Busca o preço verdadeiro do tamanho.
//          *
//          * forShare impede que o registro seja alterado
//          * enquanto estamos utilizando seu preço dentro
//          * desta transaction.
//          */
//         const tamanho =
//             await connection(
//                 'tamanhos_marmitas'
//             )

//                 .transacting(trx)

//                 .where({
//                     id: tamanhoId,
//                     ativo: true
//                 })

//                 .whereNull(
//                     'deletado_em'
//                 )

//                 .forShare()

//                 .first();


//         if (!tamanho) {

//             lancarErro(
//                 `Tamanho de marmita ID ${tamanhoId} não está disponível.`,
//                 400
//             );
//         }


//         const alimentosIds =
//             await validarAlimentosDaMarmita(
//                 marmita?.alimentos,
//                 trx
//             );


//         /**
//          * Trabalhamos em centavos.
//          */
//         const precoUnitarioCentavos =
//             paraCentavos(
//                 tamanho.preco_base
//             );


//         const subtotalCentavos =
//             precoUnitarioCentavos *
//             quantidade;


//         /**
//          * Item do tipo MARMITA:
//          *
//          * tamanho_marmita_id preenchido
//          * produto_id NULL
//          */
//         const [
//             itemPedido
//         ] =
//             await connection(
//                 'itens_pedido'
//             )

//                 .transacting(trx)

//                 .insert({

//                     pedido_id:
//                         pedidoId,

//                     tamanho_marmita_id:
//                         tamanhoId,

//                     produto_id:
//                         null,

//                     quantidade,

//                     preco_unitario:
//                         deCentavos(
//                             precoUnitarioCentavos
//                         ),

//                     subtotal:
//                         deCentavos(
//                             subtotalCentavos
//                         )
//                 })

//                 .returning([
//                     'id'
//                 ]);


//         /**
//          * Salva os alimentos pertencentes
//          * àquela marmita.
//          */
//         const composicao =
//             alimentosIds.map(
//                 (alimentoId) => ({

//                     item_pedido_id:
//                         itemPedido.id,

//                     alimento_id:
//                         alimentoId
//                 })
//             );


//         await connection(
//             'composicao_item_pedido'
//         )

//             .transacting(trx)

//             .insert(
//                 composicao
//             );


//         totalCentavos +=
//             subtotalCentavos;
//     }


//     return totalCentavos;
// }


// /**
//  * ============================================================
//  * AGRUPAR PRODUTOS
//  * ============================================================
//  *
//  * Se por algum motivo o frontend enviar:
//  *
//  * Coca x1
//  * Coca x2
//  *
//  * armazenamos:
//  *
//  * Coca x3
//  */
// function agruparProdutos(produtos) {

//     const produtosAgrupados =
//         new Map();


//     for (
//         const item of produtos
//     ) {

//         const produtoId =
//             Number(
//                 item?.produto_id
//             );


//         const quantidade =
//             validarQuantidade(
//                 item?.quantidade,
//                 'produtos'
//             );


//         if (
//             !Number.isInteger(produtoId) ||
//             produtoId <= 0
//         ) {

//             lancarErro(
//                 'O pedido possui um produto inválido.',
//                 400
//             );
//         }


//         produtosAgrupados.set(

//             produtoId,

//             (
//                 produtosAgrupados.get(
//                     produtoId
//                 ) || 0
//             ) + quantidade
//         );
//     }


//     return Array.from(

//         produtosAgrupados,

//         (
//             [
//                 produto_id,
//                 quantidade
//             ]
//         ) => ({

//             produto_id,

//             quantidade
//         })
//     );
// }


// /**
//  * ============================================================
//  * INSERIR PRODUTOS
//  * ============================================================
//  *
//  * Para ser vendido o produto precisa:
//  *
//  * - existir;
//  * - estar ativo;
//  * - estar disponível hoje;
//  * - não possuir soft delete;
//  * - categoria ativa;
//  * - categoria não excluída.
//  *
//  * O preço vem EXCLUSIVAMENTE de:
//  *
//  * produtos.preco
//  *
//  * @returns total dos produtos em centavos
//  */
// export async function inserirProdutosPedido({
//     pedidoId,
//     produtos,
//     trx
// }) {

//     if (
//         produtos.length === 0
//     ) {

//         return 0;
//     }


//     const produtosAgrupados =
//         agruparProdutos(
//             produtos
//         );


//     const produtosIds =
//         produtosAgrupados.map(
//             (item) =>
//                 item.produto_id
//         );


//     /**
//      * Busca todos de uma única vez.
//      *
//      * Isso é melhor do que executar uma query
//      * separada para cada produto.
//      */
//     const produtosBanco =
//         await connection(
//             'produtos as p'
//         )

//             .transacting(trx)

//             .join(
//                 'categorias_produtos as cp',
//                 'p.categoria_produto_id',
//                 '=',
//                 'cp.id'
//             )

//             .select(
//                 'p.id',
//                 'p.nome',
//                 'p.preco'
//             )

//             .whereIn(
//                 'p.id',
//                 produtosIds
//             )

//             .where(
//                 'p.ativo',
//                 true
//             )

//             .where(
//                 'p.disponivel_hoje',
//                 true
//             )

//             .whereNull(
//                 'p.deletado_em'
//             )

//             .where(
//                 'cp.ativo',
//                 true
//             )

//             .whereNull(
//                 'cp.deletado_em'
//             )

//             .forShare();


//     /**
//      * Se não encontramos todos, existe produto inválido,
//      * removido ou indisponível.
//      */
//     if (
//         produtosBanco.length !==
//         produtosIds.length
//     ) {

//         lancarErro(
//             'Um ou mais produtos selecionados estão indisponíveis.',
//             400
//         );
//     }


//     const produtosPorId =
//         new Map(

//             produtosBanco.map(
//                 (produto) => [

//                     Number(
//                         produto.id
//                     ),

//                     produto
//                 ]
//             )
//         );


//     let totalCentavos = 0;


//     for (
//         const item of produtosAgrupados
//     ) {

//         const produto =
//             produtosPorId.get(
//                 item.produto_id
//             );


//         const precoUnitarioCentavos =
//             paraCentavos(
//                 produto.preco
//             );


//         const subtotalCentavos =
//             precoUnitarioCentavos *
//             item.quantidade;


//         /**
//          * Item do tipo PRODUTO:
//          *
//          * tamanho_marmita_id NULL
//          * produto_id preenchido
//          */
//         await connection(
//             'itens_pedido'
//         )

//             .transacting(trx)

//             .insert({

//                 pedido_id:
//                     pedidoId,

//                 tamanho_marmita_id:
//                     null,

//                 produto_id:
//                     produto.id,

//                 quantidade:
//                     item.quantidade,

//                 preco_unitario:
//                     deCentavos(
//                         precoUnitarioCentavos
//                     ),

//                 subtotal:
//                     deCentavos(
//                         subtotalCentavos
//                     )
//             });


//         totalCentavos +=
//             subtotalCentavos;
//     }


//     return totalCentavos;
// }


// /**
//  * ============================================================
//  * RECALCULAR TOTAL
//  * ============================================================
//  *
//  * Utilizado principalmente durante edição.
//  */
// export async function calcularTotalPedido(
//     pedidoId,
//     trx
// ) {

//     const itens =
//         await connection(
//             'itens_pedido'
//         )

//             .transacting(trx)

//             .where(
//                 'pedido_id',
//                 pedidoId
//             )

//             .select(
//                 'subtotal'
//             );


//     return itens.reduce(

//         (total, item) =>

//             total +
//             paraCentavos(
//                 item.subtotal
//             ),

//         0
//     );
// }


// /**
//  * ============================================================
//  * JSON DAS MARMITAS
//  * ============================================================
//  *
//  * Será reutilizado por:
//  *
//  * - painel administrativo;
//  * - rastreio;
//  * - socket;
//  * - edição.
//  */
// export function selecionarMarmitasJson() {

//     return connection.raw(`
//         COALESCE(
//             (
//                 SELECT json_agg(
//                     item
//                     ORDER BY item.id
//                 )

//                 FROM (
//                     SELECT
//                         ip.id,

//                         ip.tamanho_marmita_id,

//                         tm.nome AS tamanho,

//                         ip.quantidade,

//                         ip.preco_unitario,

//                         ip.subtotal,

//                         COALESCE(
//                             (
//                                 SELECT json_agg(
//                                     json_build_object(
//                                         'id',
//                                         a.id,

//                                         'nome',
//                                         a.nome
//                                     )

//                                     ORDER BY
//                                         cip.id
//                                 )

//                                 FROM
//                                     composicao_item_pedido
//                                     AS cip

//                                 JOIN
//                                     alimentos AS a

//                                     ON
//                                     a.id =
//                                     cip.alimento_id

//                                 WHERE
//                                     cip.item_pedido_id =
//                                     ip.id
//                             ),

//                             '[]'::json
//                         ) AS alimentos

//                     FROM
//                         itens_pedido AS ip

//                     JOIN
//                         tamanhos_marmitas AS tm

//                         ON
//                         tm.id =
//                         ip.tamanho_marmita_id

//                     WHERE
//                         ip.pedido_id =
//                         pedidos.id

//                     AND
//                         ip.tamanho_marmita_id
//                         IS NOT NULL

//                     AND
//                         ip.produto_id
//                         IS NULL
//                 ) AS item
//             ),

//             '[]'::json
//         ) AS marmitas
//     `);
// }


// /**
//  * ============================================================
//  * JSON DOS PRODUTOS
//  * ============================================================
//  *
//  * Preço e subtotal vêm de itens_pedido.
//  *
//  * Portanto, mesmo que o preço atual do produto mude,
//  * o pedido antigo continua com o preço cobrado anteriormente.
//  */
// export function selecionarProdutosJson() {

//     return connection.raw(`
//         COALESCE(
//             (
//                 SELECT json_agg(
//                     item
//                     ORDER BY item.id
//                 )

//                 FROM (
//                     SELECT
//                         ip.id,

//                         ip.produto_id,

//                         p.nome,

//                         p.descricao,

//                         p.categoria_produto_id
//                             AS categoria_id,

//                         cp.nome
//                             AS categoria_nome,

//                         ip.quantidade,

//                         ip.preco_unitario,

//                         ip.subtotal

//                     FROM
//                         itens_pedido AS ip

//                     JOIN
//                         produtos AS p

//                         ON
//                         p.id =
//                         ip.produto_id

//                     JOIN
//                         categorias_produtos AS cp

//                         ON
//                         cp.id =
//                         p.categoria_produto_id

//                     WHERE
//                         ip.pedido_id =
//                         pedidos.id

//                     AND
//                         ip.produto_id
//                         IS NOT NULL

//                     AND
//                         ip.tamanho_marmita_id
//                         IS NULL
//                 ) AS item
//             ),

//             '[]'::json
//         ) AS produtos
//     `);
// }


// /**
//  * ============================================================
//  * PEDIDO COMPLETO
//  * ============================================================
//  *
//  * Usado principalmente depois da criação/edição
//  * e pelo Socket.IO.
//  */
// export async function buscarPedidoCompletoPorId(
//     pedidoId
// ) {

//     return connection('pedidos')

//         .leftJoin(
//             'metodos_pagamento',
//             'pedidos.metodo_pagamento_id',
//             '=',
//             'metodos_pagamento.id'
//         )

//         .select(

//             'pedidos.*',

//             'metodos_pagamento.nome as metodo_pagamento_nome',

//             selecionarMarmitasJson(),

//             selecionarProdutosJson()
//         )

//         .where(
//             'pedidos.id',
//             pedidoId
//         )

//         .first();
// }

// /**
//  * ============================================================
//  * VALIDAR STATUS DA LOJA
//  * ============================================================
//  *
//  * Essa validação é utilizada para pedidos públicos.
//  *
//  * Não podemos depender apenas do Frontend, porque
//  * alguém poderia chamar POST /pedidos diretamente.
//  */
// export async function validarLojaAberta(
//     trx
// ) {

//     const status =
//         await connection(
//             'status_loja'
//         )

//             .transacting(trx)

//             .where({
//                 id: 1
//             })

//             .first();


//     if (!status) {

//         lancarErro(
//             'Configuração da loja não encontrada.',
//             500
//         );
//     }


//     if (
//         status.esta_aberta !==
//         true
//     ) {

//         lancarErro(
//             'A loja está fechada no momento e não está recebendo novos pedidos.',
//             409
//         );
//     }


//     return true;
// }


// /**
//  * ============================================================
//  * VALIDAR MÉTODO DE PAGAMENTO
//  * ============================================================
//  *
//  * Impede que alguém envie manualmente o ID de um
//  * método de pagamento que esteja inativo.
//  */
// export async function validarMetodoPagamento(
//     metodoPagamentoId,
//     trx
// ) {

//     const id =
//         Number(
//             metodoPagamentoId
//         );


//     if (
//         !Number.isInteger(id) ||
//         id <= 0
//     ) {

//         lancarErro(
//             'Selecione um método de pagamento válido.',
//             400
//         );
//     }


//     const metodo =
//         await connection(
//             'metodos_pagamento'
//         )

//             .transacting(trx)

//             .where({
//                 id,
//                 ativo: true
//             })

//             .first();


//     if (!metodo) {

//         lancarErro(
//             'O método de pagamento selecionado não está disponível.',
//             400
//         );
//     }


//     return metodo;
// }

import connection from "../database/connection.js";
import { lancarErro } from "./errorUtils.js";

/**
 * Converte um valor monetário para centavos.
 * Mantemos os cálculos financeiros em inteiros para evitar
 * problemas de ponto flutuante do JavaScript.
 * Exemplo: 6.50 -> 650
 */
export function paraCentavos(valor) {
    return Math.round(Number(valor) * 100);
}

/**
 * Converte centavos novamente para decimal.
 * Exemplo: 650 -> 6.50
 */
export function deCentavos(valor) {
    return Number((valor / 100).toFixed(2));
}

/**
 * Remove caracteres que não sejam números
 * e valida um telefone com DDD.
 */
export function normalizarTelefone(telefone) {
    const telefoneLimpo = String(telefone || '').replace(/\D/g, '');

    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
        lancarErro('Telefone inválido. O telefone deve ter 10 ou 11 dígitos numéricos.', 400);
    }

    return telefoneLimpo;
}

/**
 * Garante que quantidades sejam números inteiros maiores que zero.
 */
function validarQuantidade(quantidade, tipoItem) {
    const valor = Number(quantidade);

    if (!Number.isInteger(valor) || valor <= 0) {
        lancarErro(`A quantidade de ${tipoItem} deve ser um número inteiro maior que zero.`, 400);
    }

    return valor;
}

/**
 * ============================================================
 * VALIDAÇÃO DOS ALIMENTOS DA MARMITA
 * ============================================================
 */
async function validarAlimentosDaMarmita(alimentos, trx) {
    if (!Array.isArray(alimentos) || alimentos.length === 0) {
        lancarErro('A marmita deve possuir pelo menos um alimento.', 400);
    }

    const alimentosIds = alimentos.map((id) => Number(id));

    if (alimentosIds.some((id) => !Number.isInteger(id) || id <= 0)) {
        lancarErro('A marmita possui um alimento inválido.', 400);
    }

    // Impede enviar o mesmo alimento duas vezes para tentar manipular limites.
    if (new Set(alimentosIds).size !== alimentosIds.length) {
        lancarErro('A marmita possui alimentos duplicados.', 400);
    }

    const dadosAlimentos = await connection('alimentos as a')
        .transacting(trx)
        .join('categorias_alimentos as ca', 'a.categoria_id', '=', 'ca.id')
        .select(
            'a.id',
            'a.categoria_id',
            'ca.nome as categoria_nome',
            'ca.limite_escolhas'
        )
        .whereIn('a.id', alimentosIds)
        .where('a.disponivel_hoje', true)
        .whereNull('a.deletado_em')
        .where('ca.ativo', true)
        .whereNull('ca.deletado_em');

    // Se retornou menos alimentos do que foi enviado, algum não existe ou está indisponível.
    if (dadosAlimentos.length !== alimentosIds.length) {
        lancarErro('Um ou mais alimentos selecionados estão indisponíveis.', 400);
    }

    const contagemPorCategoria = {};

    for (const alimento of dadosAlimentos) {
        if (!contagemPorCategoria[alimento.categoria_id]) {
            contagemPorCategoria[alimento.categoria_id] = {
                quantidade: 0,
                limite: Number(alimento.limite_escolhas),
                nome: alimento.categoria_nome
            };
        }
        contagemPorCategoria[alimento.categoria_id].quantidade += 1;
    }

    // Confere os limites por categoria (ex: Proteínas = máximo 2)
    for (const categoria of Object.values(contagemPorCategoria)) {
        if (categoria.quantidade > categoria.limite) {
            lancarErro(
                `Limite excedido na categoria ${categoria.nome}. Máximo: ${categoria.limite}, enviado: ${categoria.quantidade}.`,
                400
            );
        }
    }

    return alimentosIds;
}

/**
 * ============================================================
 * INSERIR MARMITAS
 * ============================================================
 * O preço NUNCA vem do frontend. É sempre utilizado: tamanhos_marmitas.preco_base
 * 
 * @returns total das marmitas em centavos
 */
export async function inserirMarmitasPedido({ pedidoId, marmitas, trx }) {
    let totalCentavos = 0;

    for (const marmita of marmitas) {
        const tamanhoId = Number(marmita?.tamanho_id);
        const quantidade = validarQuantidade(marmita?.quantidade, 'marmitas');

        if (!Number.isInteger(tamanhoId) || tamanhoId <= 0) {
            lancarErro('O tamanho da marmita informado é inválido.', 400);
        }

        const tamanho = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id: tamanhoId, ativo: true })
            .whereNull('deletado_em')
            .forShare()
            .first();

        if (!tamanho) {
            lancarErro(`Tamanho de marmita ID ${tamanhoId} não está disponível.`, 400);
        }

        const alimentosIds = await validarAlimentosDaMarmita(marmita?.alimentos, trx);

        const precoUnitarioCentavos = paraCentavos(tamanho.preco_base);
        const subtotalCentavos = precoUnitarioCentavos * quantidade;

        // Salva o item da marmita e captura a observação
        const observacaoFormatada = marmita?.observacao ? String(marmita.observacao).trim() : null;

        const [itemPedido] = await connection('itens_pedido')
            .transacting(trx)
            .insert({
                pedido_id: pedidoId,
                tamanho_marmita_id: tamanhoId,
                produto_id: null,
                quantidade,
                preco_unitario: deCentavos(precoUnitarioCentavos),
                subtotal: deCentavos(subtotalCentavos),
                observacao: observacaoFormatada // <-- ADICIONADO AQUI
            })
            .returning(['id']);

        // Salva os alimentos pertencentes àquela marmita.
        const composicao = alimentosIds.map((alimentoId) => ({
            item_pedido_id: itemPedido.id,
            alimento_id: alimentoId
        }));

        await connection('composicao_item_pedido')
            .transacting(trx)
            .insert(composicao);

        totalCentavos += subtotalCentavos;
    }

    return totalCentavos;
}

/**
 * ============================================================
 * AGRUPAR PRODUTOS
 * ============================================================
 */
function agruparProdutos(produtos) {
    const produtosAgrupados = new Map();

    for (const item of produtos) {
        const produtoId = Number(item?.produto_id);
        const quantidade = validarQuantidade(item?.quantidade, 'produtos');

        if (!Number.isInteger(produtoId) || produtoId <= 0) {
            lancarErro('O pedido possui um produto inválido.', 400);
        }

        produtosAgrupados.set(
            produtoId,
            (produtosAgrupados.get(produtoId) || 0) + quantidade
        );
    }

    return Array.from(
        produtosAgrupados,
        ([produto_id, quantidade]) => ({ produto_id, quantidade })
    );
}

/**
 * ============================================================
 * INSERIR PRODUTOS
 * ============================================================
 */
export async function inserirProdutosPedido({ pedidoId, produtos, trx }) {
    if (produtos.length === 0) return 0;

    const produtosAgrupados = agruparProdutos(produtos);
    const produtosIds = produtosAgrupados.map((item) => item.produto_id);

    const produtosBanco = await connection('produtos as p')
        .transacting(trx)
        .join('categorias_produtos as cp', 'p.categoria_produto_id', '=', 'cp.id')
        .select('p.id', 'p.nome', 'p.preco')
        .whereIn('p.id', produtosIds)
        .where('p.ativo', true)
        .where('p.disponivel_hoje', true)
        .whereNull('p.deletado_em')
        .where('cp.ativo', true)
        .whereNull('cp.deletado_em')
        .forShare();

    if (produtosBanco.length !== produtosIds.length) {
        lancarErro('Um ou mais produtos selecionados estão indisponíveis.', 400);
    }

    const produtosPorId = new Map(produtosBanco.map((produto) => [Number(produto.id), produto]));
    let totalCentavos = 0;

    for (const item of produtosAgrupados) {
        const produto = produtosPorId.get(item.produto_id);
        const precoUnitarioCentavos = paraCentavos(produto.preco);
        const subtotalCentavos = precoUnitarioCentavos * item.quantidade;

        await connection('itens_pedido')
            .transacting(trx)
            .insert({
                pedido_id: pedidoId,
                tamanho_marmita_id: null,
                produto_id: produto.id,
                quantidade: item.quantidade,
                preco_unitario: deCentavos(precoUnitarioCentavos),
                subtotal: deCentavos(subtotalCentavos)
            });

        totalCentavos += subtotalCentavos;
    }

    return totalCentavos;
}

/**
 * ============================================================
 * RECALCULAR TOTAL
 * ============================================================
 */
export async function calcularTotalPedido(pedidoId, trx) {
    const itens = await connection('itens_pedido')
        .transacting(trx)
        .where('pedido_id', pedidoId)
        .select('subtotal');

    return itens.reduce((total, item) => total + paraCentavos(item.subtotal), 0);
}

/**
 * ============================================================
 * JSON DAS MARMITAS
 * ============================================================
 */
export function selecionarMarmitasJson() {
    return connection.raw(`
        COALESCE(
            (
                SELECT json_agg(item ORDER BY item.id)
                FROM (
                    SELECT
                        ip.id,
                        ip.tamanho_marmita_id,
                        tm.nome AS tamanho,
                        ip.quantidade,
                        ip.preco_unitario,
                        ip.subtotal,
                        ip.observacao, -- <-- ADICIONADO AQUI PARA BUSCAR A OBSERVAÇÃO
                        COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'id', a.id,
                                        'nome', a.nome
                                    ) ORDER BY cip.id
                                )
                                FROM composicao_item_pedido AS cip
                                JOIN alimentos AS a ON a.id = cip.alimento_id
                                WHERE cip.item_pedido_id = ip.id
                            ),
                            '[]'::json
                        ) AS alimentos
                    FROM itens_pedido AS ip
                    JOIN tamanhos_marmitas AS tm ON tm.id = ip.tamanho_marmita_id
                    WHERE ip.pedido_id = pedidos.id
                      AND ip.tamanho_marmita_id IS NOT NULL
                      AND ip.produto_id IS NULL
                ) AS item
            ),
            '[]'::json
        ) AS marmitas
    `);
}

/**
 * ============================================================
 * JSON DOS PRODUTOS
 * ============================================================
 */
export function selecionarProdutosJson() {
    return connection.raw(`
        COALESCE(
            (
                SELECT json_agg(item ORDER BY item.id)
                FROM (
                    SELECT
                        ip.id,
                        ip.produto_id,
                        p.nome,
                        p.descricao,
                        p.categoria_produto_id AS categoria_id,
                        cp.nome AS categoria_nome,
                        ip.quantidade,
                        ip.preco_unitario,
                        ip.subtotal
                    FROM itens_pedido AS ip
                    JOIN produtos AS p ON p.id = ip.produto_id
                    JOIN categorias_produtos AS cp ON cp.id = p.categoria_produto_id
                    WHERE ip.pedido_id = pedidos.id
                      AND ip.produto_id IS NOT NULL
                      AND ip.tamanho_marmita_id IS NULL
                ) AS item
            ),
            '[]'::json
        ) AS produtos
    `);
}

/**
 * ============================================================
 * PEDIDO COMPLETO
 * ============================================================
 */
export async function buscarPedidoCompletoPorId(pedidoId) {
    return connection('pedidos')
        .leftJoin('metodos_pagamento', 'pedidos.metodo_pagamento_id', '=', 'metodos_pagamento.id')
        .select(
            'pedidos.*',
            'metodos_pagamento.nome as metodo_pagamento_nome',
            selecionarMarmitasJson(),
            selecionarProdutosJson()
        )
        .where('pedidos.id', pedidoId)
        .first();
}

/**
 * ============================================================
 * VALIDAR STATUS DA LOJA
 * ============================================================
 */
export async function validarLojaAberta(trx) {
    const status = await connection('status_loja')
        .transacting(trx)
        .where({ id: 1 })
        .first();

    if (!status) {
        lancarErro('Configuração da loja não encontrada.', 500);
    }

    if (status.esta_aberta !== true) {
        lancarErro('A loja está fechada no momento e não está recebendo novos pedidos.', 409);
    }

    return true;
}

/**
 * ============================================================
 * VALIDAR MÉTODO DE PAGAMENTO
 * ============================================================
 */
export async function validarMetodoPagamento(metodoPagamentoId, trx) {
    const id = Number(metodoPagamentoId);

    if (!Number.isInteger(id) || id <= 0) {
        lancarErro('Selecione um método de pagamento válido.', 400);
    }

    const metodo = await connection('metodos_pagamento')
        .transacting(trx)
        .where({ id, ativo: true })
        .first();

    if (!metodo) {
        lancarErro('O método de pagamento selecionado não está disponível.', 400);
    }

    return metodo;
}