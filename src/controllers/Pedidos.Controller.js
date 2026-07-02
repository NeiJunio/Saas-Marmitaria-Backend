import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const criarPedido = async (req, res, next) => {
    let {
        nome_cliente,
        telefone_cliente,
        endereco_cliente,
        tipo_pedido,
        metodo_entrega,
        metodo_pagamento_id,
        observacoes,
        marmitas
    } = req.body;

    if (!marmitas || !Array.isArray(marmitas) || marmitas.length === 0) {
        return next(lancarErro('O pedido deve conter pelo menos uma marmita', 400));
    }

    let telefoneLimpo = (telefone_cliente || '').replace(/\D/g, '');

    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
        // Retorna o Erro 400 (Bad Request) que o seu frontend já sabe ler!
        return res.status(400).json({
            erro: "Telefone inválido. O telefone deve ter 10 ou 11 dígitos numéricos."
        });
    }

    telefone_cliente = telefoneLimpo;

    // 🚀 Validação da Entrega vs Retirada
    if (metodo_entrega === 'Entrega' && (!endereco_cliente || endereco_cliente.trim() === '')) {
        return res.status(400).json({ 
            message: "O endereço é obrigatório para pedidos com entrega." 
        });
    }

    // Se for retirada, garantimos que o endereço fica null no banco
    const enderecoFinal = metodo_entrega === 'Retirada' ? null : endereco_cliente;

    const trx = await connection.transaction();

    try {
        let valorTotalPedido = 0;

        // 1. Criar o cabeçalho do pedido
        const [pedido] = await connection('pedidos')
            .transacting(trx)
            .insert({
                nome_cliente,
                telefone_cliente,
                endereco_cliente: enderecoFinal,
                tipo_pedido,
                metodo_entrega,
                metodo_pagamento_id,
                status: 'Pendente',
                valor_total: 0,
                observacoes
            })
            .returning('*');

        // 2. Loop pelas marmitas
        for (const marmita of marmitas) {
            const { tamanho_id, quantidade, alimentos } = marmita;

            // Busca o preço base do tamanho (Única fonte de valor)
            const tamanho = await connection('tamanhos_marmitas')
                .transacting(trx)
                .where({
                    id: tamanho_id,
                    ativo: true
                })
                .first();

            if (!tamanho) {
                throw new Error(`Tamanho de marmita ID ${tamanho_id} não disponível.`);
            }

            // 3. Validar alimentos e buscar limites das categorias
            const dadosAlimentos = await connection('alimentos')
                .transacting(trx)
                .join('categorias_alimentos', 'alimentos.categoria_id', '=', 'categorias_alimentos.id')
                .select(
                    'alimentos.id',
                    'alimentos.categoria_id',
                    'categorias_alimentos.nome AS cat_nome',
                    'categorias_alimentos.limite_escolhas'
                )
                .whereIn('alimentos.id', alimentos)
                .whereNull('alimentos.deletado_em')
                .where('alimentos.disponivel_hoje', true);

            if (dadosAlimentos.length !== alimentos.length) {
                throw new Error('Um ou mais alimentos selecionados estão indisponíveis.');
            }

            // 4. Validar se respeitou o limite de escolhas (Ex: no máximo 2 carnes)
            const contagemPorCategoria = {};
            dadosAlimentos.forEach(alimento => {
                if (!contagemPorCategoria[alimento.categoria_id]) {
                    contagemPorCategoria[alimento.categoria_id] = {
                        quantidade: 0,
                        limite: alimento.limite_escolhas,
                        nomeCat: alimento.cat_nome
                    };
                }
                contagemPorCategoria[alimento.categoria_id].quantidade += 1;
            });

            for (const catId in contagemPorCategoria) {
                const cat = contagemPorCategoria[catId];
                if (cat.quantidade > cat.limite) {
                    throw new Error(`Limite excedido na categoria ${cat.nomeCat}. Máximo: ${cat.limite}, Enviado: ${cat.quantidade}`);
                }
            }

            // 5. Cálculos financeiros simples (Apenas tamanho * quantidade)
            const precoUnitario = Number(tamanho.preco_base);
            const subtotalMarmita = precoUnitario * quantidade;

            const [itemPedido] = await connection('itens_pedido')
                .transacting(trx)
                .insert({
                    pedido_id: pedido.id,
                    tamanho_marmita_id: tamanho_id,
                    quantidade: quantidade,
                    preco_unitario: precoUnitario,
                    subtotal: subtotalMarmita
                })
                .returning('*');

            // 6. Gravar quais alimentos compõem esta marmita específica
            const composicaoParaInserir = alimentos.map(alimentoId => ({
                item_pedido_id: itemPedido.id,
                alimento_id: alimentoId
            }));

            await connection('composicao_item_pedido')
                .transacting(trx)
                .insert(composicaoParaInserir);

            valorTotalPedido += subtotalMarmita;
        }

        // 7. Atualiza o total do pedido com a soma de todas as marmitas
        await connection('pedidos')
            .transacting(trx)
            .where({ id: pedido.id })
            .update({ valor_total: valorTotalPedido });

        // 8. Auditoria
        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id: req.usuario?.id || null,
            acao: 'PEDIDO.CRIAR',
            descricao: `Pedido #${pedido.id} para ${nome_cliente}. Total: R$ ${valorTotalPedido.toFixed(2)}`,
            payload: JSON.stringify({
                pedido_id: pedido.id,
                total: valorTotalPedido
            })
        });

        await trx.commit();

        if (global.io){
            try{
                const[pedidoCompleto] = await connection('pedidos')
                .select(
                        'pedidos.*',
                        connection.raw(`
                            ( SELECT json_agg(item) FROM (
                                select ip.id,
                                        tm.nome AS tamanho,
                                        ip.quantidade,
                                        ip.preco_unitario,
                                        ( SELECT json_agg(nome)
                                            FROM composicao_item_pedido AS cip
                                            JOIN alimentos              AS ali ON cip.alimento_id = ali.id
                                           WHERE cip.item_pedido_id = ip.id) AS alimentos
                                FROM itens_pedido      AS ip
                                JOIN tamanhos_marmitas AS tm ON ip.tamanho_marmita_id = tm.id
                               WHERE ip.pedido_id = pedidos.id ) item ) AS marmitas
                        `)
                    )
                    .where('pedidos.id', pedido.id);

                if(pedidoCompleto){
                    global.io.emit('novo_pedido_recebido', pedidoCompleto);
                }
            }catch(socketErr){
                console.error('Erro ao emitir evento de novo pedido:', socketErr);
            }
        }


        return res.status(201).json({
            status: 'success',
            data: {
                pedido_id: pedido.id,
                total: valorTotalPedido
            }
        });

    } catch (error) {
        if (trx) {
            await trx.rollback();
        }
        return next(lancarErro(error.message, 400));
    }
}

export const editarPedido = async (req, res, next) => {

    const { id } = req.params;

    const {
        nome_cliente,
        endereco_cliente,
        telefone_cliente,
        metodo_pagamento_id,
        observacoes,
        marmitas
    } = req.body;

    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();

    try {

        // verificar se o pedido existe
        const pedido = await connection('pedidos')
            .transacting(trx)
            .where('id', id)
            .first();

        if (!pedido) {
            await trx.rollback();
            return next(lancarErro('Pedido não encontrato', 404));
        }

        if (pedido.status !== 'Pendente') {
            await trx.rollback();
            return next(lancarErro('Apenas pedidos com status "Pendente" podem ser editados', 400));
        }

        let novoValorTotal = Number(pedido.valor_total);

        if (marmitas && Array.isArray(marmitas) && marmitas.length > 0) {
            const itensAntigos = await connection('itens_pedido')
                .where({ pedido_id: id })
                .select('id');

            const itensIds = itensAntigos.map(i => i.id);

            await connection('composicao_item_pedido')
                .whereIn('item_pedido_id', itensIds)
                .del()
                .transacting(trx);

            await connection('itens_pedido')
                .where({ pedido_id: id })
                .del()
                .transacting(trx);

            novoValorTotal = 0;

            for (const m of marmitas) {

                const tamanho = await connection('tamanhos_marmitas')
                    .where({
                        id: m.tamanho_id,
                        ativo: true
                    })
                    .first();

                if (!tamanho) {
                    throw new Error(`Tamanho ID ${m.tamanho_id} indisponível`);
                }

                const precoUnitario = Number(tamanho.preco_base);
                const subtotalMarmita = precoUnitario * m.quantidade;

                const [itemPedido] = await connection('itens_pedido')
                    .transacting(trx)
                    .insert({
                        pedido_id: id,
                        tamanho_marmita_id: m.tamanho_id,
                        quantidade: m.quantidade,
                        preco_unitario: precoUnitario,
                        subtotal: subtotalMarmita
                    })
                    .returning('*');

                const composicao = m.alimentos.map(alimentoId => ({
                    item_pedido_id: itemPedido.id,
                    alimento_id: alimentoId
                }));

                await connection('composicao_item_pedido')
                    .transacting(trx)
                    .insert(composicao);

                novoValorTotal += subtotalMarmita;
            }
        }
        else {
            novoValorTotal = pedido.valor_total;
        }

        // 3. Atualizar dados do cabeçalho
        await connection('pedidos')
            .transacting(trx)
            .where({ id })
            .update({
                nome_cliente: nome_cliente ?? pedido.nome_cliente,
                telefone_cliente: telefone_cliente ?? pedido.telefone_cliente,
                endereco_cliente: endereco_cliente ?? pedido.endereco_cliente,
                metodo_pagamento_id: metodo_pagamento_id ?? pedido.metodo_pagamento_id,
                observacoes: observacoes !== undefined ? observacoes : pedido.observacoes,
                valor_total: novoValorTotal,
                atualizado_em: connection.fn.now()
            });

        // 3. Log de Auditoria (Agora novoValorTotal é garantido como número)
        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id,
            acao: 'PEDIDO.EDITAR',
            descricao: `Pedido #${id} editado. Cliente: ${nome_cliente ?? pedido.nome_cliente}. Total: R$ ${Number(novoValorTotal).toFixed(2)}`,
            payload: JSON.stringify({
                pedido_id: id,
                campos_alterados: Object.keys(req.body)
            })
        });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Pedido atualizado com sucesso.'
        });

    } catch (error) {
        if (trx) {
            await trx.rollback();
        }

        return next(lancarErro(error.message, 400));
    }
}

export const alterarStatusPedido = async (req, res, next) => {

    const { id } = req.params;
    const { status } = req.body;
    const usuario_id = req.usuario.id

    const statusValidos = [
        'Pendente',
        'Em Preparo',
        'Pronto para Retirada',
        'Saiu para Entrega',
        'Entregue',
        'Cancelado'
    ];

    if (!statusValidos.includes(status)) {
        return next(lancarErro(`Status inválido. Use: ${statusValidos.join(', ')}`, 400));
    }

    const trx = await connection.transaction();

    try {

        const pedido = await connection('pedidos')
            .where('id', id)
            .first();

        if (!pedido) {
            await trx.rollback();
            return next(lancarErro('Pedido não encontrado', 404));
        }

        await connection('pedidos')
            .transacting(trx)
            .where('id', id)
            .update({
                status: status
            });

        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id,
            acao: 'PEDIDO.STATUS',
            descricao: `Status alterado: de "${pedido.status}" para "${status}"`,
            payload: JSON.stringify({ pedido_id: id, status_novo: status })
        });

        await trx.commit();
        return res.status(200).json({ status: 'success', message: `Status atualizado para ${status}` });

    } catch (error) {
        if (trx) {
            await trx.rollback();
        }

        next(error);
    }

}

// export const listarPedidosAdmin = async (req, res, next) => {

//     try {

//         const pedidos = await connection('pedidos')
//             .select(
//                 'pedidos.*',
//                 connection.raw(`
//                     ( SELECT json_agg(item) FROM (
//                          select ip.id,
//                                 tm.nome AS tamanho,
//                                 ip.quantidade,
//                                 ip.preco_unitario,
//                                 ( SELECT json_agg(nome)
//                                     FROM composicao_item_pedido AS cip
//                                     JOIN alimentos              AS ali ON cip.alimento_id = ali.id
//                                    WHERE cip.item_pedido_id = ip.id) AS alimentos
//                         FROM itens_pedido      AS ip
//                         JOIN tamanhos_marmitas AS tm ON ip.tamanho_marmita_id = tm.id
//                        WHERE ip.pedido_id=pedidos.id ) item ) AS marmitas
//                          `)
//             )
//             .whereNull('pedidos.deletado_em') // Mantém apenas os não deletados
//             // .whereRaw("DATE(pedidos.criado_em) = CURRENT_DATE") // Removido para trazer todos
//             .orderBy('pedidos.criado_em', 'desc'); // "desc" garante o mais recente no topo

//         return res.status(200).json({
//             status: 'success',
//             data: pedidos
//         });

//     } catch (error) {
//         next(error)
//     }
// }

export const listarPedidosAdmin = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search = '', status = 'todos' } = req.query;
        const offset = (page - 1) * limit;

        // 1. Criar a query base apenas com os filtros
        const baseQuery = connection('pedidos').whereNull('pedidos.deletado_em');

        if (search) {
            baseQuery.where(function() {
                this.where('nome_cliente', 'ILIKE', `%${search}%`)
                    .orWhere('telefone_cliente', 'ILIKE', `%${search}%`);
                
                // Se a busca for um número, permite buscar pelo ID do pedido
                if (!isNaN(search)) {
                    this.orWhere('id', search);
                }
            });
        }

        if (status !== 'todos') {
            baseQuery.where('status', status);
        }

        // 2. Contar o total de registros (para a paginação) ANTES de injetar a subquery pesada
        const [{ total }] = await baseQuery.clone().count('id AS total');

        // 3. Executar a query final com a paginação e a montagem do JSON das marmitas
        const pedidos = await baseQuery
            .select(
                'pedidos.*',
                connection.raw(`
                    ( SELECT json_agg(item) FROM (
                         select ip.id,
                                tm.nome AS tamanho,
                                ip.quantidade,
                                ip.preco_unitario,
                                ( SELECT json_agg(nome)
                                    FROM composicao_item_pedido AS cip
                                    JOIN alimentos              AS ali ON cip.alimento_id = ali.id
                                   WHERE cip.item_pedido_id = ip.id) AS alimentos
                        FROM itens_pedido      AS ip
                        JOIN tamanhos_marmitas AS tm ON ip.tamanho_marmita_id = tm.id
                       WHERE ip.pedido_id = pedidos.id ) item ) AS marmitas
                `)
            )
            .orderBy('pedidos.criado_em', 'desc')
            .limit(limit)
            .offset(offset);

        return res.status(200).json({
            status: 'success',
            pagination: { 
                total: parseInt(total), 
                page: parseInt(page), 
                totalPages: Math.ceil(parseInt(total) / limit) 
            },
            data: pedidos
        });

    } catch (error) {
        next(error);
    }
}

export const listarPedidosPorTelefoneUsuario = async (req, res, next) => {

    const { telefone } = req.params;

    if (!telefone || telefone.length < 8) {
        return res.status(400).json({
            status: 'error',
            message: 'Por favor, informe um número de telefone válido com DDD.'
        });
    }

    try {
        const pedidos = await connection('pedidos')
            .select(
                'pedidos.id',
                'pedidos.nome_cliente',
                'pedidos.status',
                'pedidos.valor_total',
                'pedidos.metodo_pagamento_id',
                'pedidos.endereco_cliente',
                'pedidos.observacoes',
                'pedidos.criado_em',
                connection.raw(`
                    ( SELECT json_agg(item) FROM (
                        SELECT ip.id, 
                               tm.nome as tamanho, 
                               ip.quantidade, 
                               ip.preco_unitario,
                               ( SELECT json_agg(a.nome) 
                                   FROM composicao_item_pedido AS cip 
                                   JOIN alimentos              AS a ON a.id = cip.alimento_id 
                                  WHERE cip.item_pedido_id = ip.id) as alimentos
                          FROM itens_pedido      AS ip
                          JOIN tamanhos_marmitas AS tm ON tm.id = ip.tamanho_marmita_id
                         WHERE ip.pedido_id = pedidos.id
                    ) item) as marmitas
                `)
            )
            .where('pedidos.telefone_cliente', telefone)
            .whereNull('pedidos.deletado_em') // Não mostra pedidos excluídos pelo admin
            .orderBy('pedidos.criado_em', 'desc');

        if (pedidos.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Nenhum pedido encontrado para este número de telefone.'
            });
        }

        return res.status(200).json({
            status: 'success',
            results: pedidos.length,
            data: pedidos
        });

    } catch (error) {
        next(error)
    }

}

export const deletarPedido = async (req, res, next) => {

    const { id } = req.params;
    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();

    try {

        const pedido = await connection('pedidos')
            .where('id', id)
            .whereNull('deletado_em')
            .first();

        if (!pedido) {
            await trx.rollback();
            return next(lancarErro('Pedido não encontrado ou já foi excluído', 404));
        }

        await connection('pedidos')
            .transacting(trx)
            .where('id', id)
            .update({
                status: 'Cancelado',
                deletado_em: connection.fn.now()
            });

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id,
                acao: 'PEDIDO.DELETAR',
                descricao: `Admin realizou soft delete no pedido #${id} do cliente ${pedido.nome_cliente}`,
                payload: JSON.stringify({
                    pedido_id: id,
                    valor_total: pedido.valor_total,
                    status_anterior: pedido.status
                })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Pedido excluído com sucesso.'
        });


    } catch (error) {
        if (trx) {
            await trx.rollback();
        }
        next(error);
    }

}

export const restaurarPedido = async (req, res, next) => {

    const { id } = req.params;

    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();

    try {

        const pedido = await connection('pedidos')
            .where('id', id)
            .first();

        if (!pedido) {
            await trx.rollback();
            return next(lancarErro('Pedido não encontrado', 404));
        }

        if (pedido.deletado_em === null) {
            await trx.rollback();
            return res.status(400).json({
                status: 'error',
                message: 'Este pedido já está ativo (não excluído)'
            })
        }

        // Update
        await connection('pedidos')
            .transacting(trx)
            .where('id', id)
            .update({
                deletado_em: null,
                status: 'Pendente'
            })

        // Log de Auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id,
                acao: 'PEDIDO.RESTAURAR',
                descricao: `Admin restaurou o pedido #${id} do cliente ${pedido.nome_cliente}`,
                payload: JSON.stringify({
                    pedido_id: id,
                    status_anterior: pedido.status,
                    status_novo: 'Pendente'
                })
            });


        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: ' Pedido restaurado e enviado de volta para a lista de Pendentes'
        })

    } catch (error) {

        if (trx) {
            await trx.rollback();
        }

        next(error);

    }

}