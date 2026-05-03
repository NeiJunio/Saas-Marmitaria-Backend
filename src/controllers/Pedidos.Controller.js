import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const criarPedido = async (req, res, next) => {
    const {
        nome_cliente,
        telefone_cliente,
        endereco_cliente,
        tipo_pedido,
        metodo_pagamento_id,
        observacoes,
        marmitas 
    } = req.body;

    if (!marmitas || !Array.isArray(marmitas) || marmitas.length === 0) {
        return next(lancarErro('O pedido deve conter pelo menos uma marmita', 400));
    }

    const trx = await connection.transaction();

    try {
        let valorTotalPedido = 0;

        // 1. Criar o cabeçalho do pedido
        const [pedido] = await connection('pedidos')
            .transacting(trx)
            .insert({
                nome_cliente,
                telefone_cliente,
                endereco_cliente,
                tipo_pedido,
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