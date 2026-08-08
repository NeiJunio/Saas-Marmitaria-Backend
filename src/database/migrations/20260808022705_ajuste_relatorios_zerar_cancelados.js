/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    // ==========================================
    // 1. Faturamento por Período
    // AJUSTE: Pedidos Cancelados aparecem no COUNT, mas somam 0 no faturamento
    // e são ignorados do Ticket Médio.
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_faturamento_periodo(filtros json)
        RETURNS TABLE (
            data_faturamento text,
            qtd_pedidos bigint,
            ticket_medio numeric,
            total_faturado numeric
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
            v_status text := filtros->>'status';
        BEGIN
            RETURN QUERY
            SELECT 
                TO_CHAR(p.criado_em, 'DD/MM/YYYY') AS data_faturamento,
                COUNT(p.id) AS qtd_pedidos,
                COALESCE(ROUND(AVG(CASE WHEN p.status = 'Cancelado' THEN NULL ELSE p.valor_total END), 2), 0) AS ticket_medio,
                SUM(CASE WHEN p.status = 'Cancelado' THEN 0 ELSE p.valor_total END) AS total_faturado
            FROM pedidos p
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND (v_status IS NULL OR v_status = 'todos' OR p.status::text = v_status)
                AND p.deletado_em IS NULL
            GROUP BY 
                TO_CHAR(p.criado_em, 'DD/MM/YYYY'), p.criado_em::date
            ORDER BY 
                p.criado_em::date ASC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 2. Histórico de Vendas Completo
    // (Mantido, pois aqui só precisamos listar os pedidos e seus status)
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_historico_vendas(filtros json)
        RETURNS TABLE (
            pedido_id integer,
            data_hora text,
            nome_cliente varchar,
            tipo_pedido text,
            status text,
            valor_total numeric
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
            v_tipo text := filtros->>'tipo_pedido';
        BEGIN
            RETURN QUERY
            SELECT 
                p.id AS pedido_id,
                TO_CHAR(p.criado_em, 'DD/MM/YYYY HH24:MI') AS data_hora,
                p.nome_cliente,
                p.tipo_pedido::text AS tipo_pedido,
                p.status::text AS status,
                p.valor_total
            FROM pedidos p
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND (v_tipo IS NULL OR v_tipo = 'todos' OR p.tipo_pedido::text = v_tipo)
                AND p.deletado_em IS NULL
            ORDER BY 
                p.criado_em DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 3. Curva de Saída de Alimentos
    // AJUSTE: Alimentos de pedidos cancelados somam 0 na quantidade de saída
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_saida_alimentos(filtros json)
        RETURNS TABLE (
            nome_alimento varchar,
            categoria_nome varchar,
            qtd_escolhida bigint
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
        BEGIN
            RETURN QUERY
            SELECT 
                a.nome AS nome_alimento,
                c.nome AS categoria_nome,
                SUM(CASE WHEN p.status = 'Cancelado' THEN 0 ELSE ip.quantidade END)::bigint AS qtd_escolhida
            FROM composicao_item_pedido cip
            JOIN itens_pedido ip ON cip.item_pedido_id = ip.id
            JOIN alimentos a ON cip.alimento_id = a.id
            JOIN categorias_alimentos c ON a.categoria_id = c.id
            JOIN pedidos p ON ip.pedido_id = p.id
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND p.deletado_em IS NULL
            GROUP BY 
                a.nome, c.nome
            ORDER BY 
                qtd_escolhida DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 4. Vendas por Tamanho de Marmita
    // AJUSTE: Tamanhos vendidos em pedidos cancelados somam 0 em qtd e financeiro
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_vendas_tamanho(filtros json)
        RETURNS TABLE (
            tamanho_nome varchar,
            qtd_vendida bigint,
            faturamento_tamanho numeric
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
        BEGIN
            RETURN QUERY
            SELECT 
                tm.nome AS tamanho_nome,
                SUM(CASE WHEN p.status = 'Cancelado' THEN 0 ELSE ip.quantidade END)::bigint AS qtd_vendida,
                SUM(CASE WHEN p.status = 'Cancelado' THEN 0 ELSE ip.subtotal END) AS faturamento_tamanho
            FROM itens_pedido ip
            JOIN tamanhos_marmitas tm ON ip.tamanho_marmita_id = tm.id
            JOIN pedidos p ON ip.pedido_id = p.id
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND p.deletado_em IS NULL
            GROUP BY 
                tm.nome
            ORDER BY 
                faturamento_tamanho DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 5. Clientes Mais Frequentes
    // AJUSTE: Pedido cancelado conta como "existente", mas não soma no Valor Gasto
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_clientes_frequentes(filtros json)
        RETURNS TABLE (
            telefone_cliente varchar,
            nome_cliente varchar,
            qtd_pedidos bigint,
            valor_gasto numeric
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
        BEGIN
            RETURN QUERY
            SELECT 
                COALESCE(p.telefone_cliente, 'Não informado') AS telefone_cliente,
                p.nome_cliente,
                COUNT(p.id)::bigint AS qtd_pedidos,
                SUM(CASE WHEN p.status = 'Cancelado' THEN 0 ELSE p.valor_total END) AS valor_gasto
            FROM pedidos p
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND p.deletado_em IS NULL
            GROUP BY 
                p.telefone_cliente, p.nome_cliente
            ORDER BY 
                qtd_pedidos DESC, valor_gasto DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    // ==========================================
    // DOWN: Retorna para as lógicas rígidas anteriores que 
    // excluíam os Cancelados por completo das listagens
    // ==========================================
    
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_faturamento_periodo(filtros json)
        RETURNS TABLE (
            data_faturamento text,
            qtd_pedidos bigint,
            ticket_medio numeric,
            total_faturado numeric
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
            v_status text := filtros->>'status';
        BEGIN
            RETURN QUERY
            SELECT 
                TO_CHAR(p.criado_em, 'DD/MM/YYYY') AS data_faturamento,
                COUNT(p.id) AS qtd_pedidos,
                ROUND(AVG(p.valor_total), 2) AS ticket_medio,
                SUM(p.valor_total) AS total_faturado
            FROM pedidos p
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND (v_status IS NULL OR v_status = 'todos' OR p.status::text = v_status)
                AND p.status != 'Cancelado'
                AND p.deletado_em IS NULL
            GROUP BY 
                TO_CHAR(p.criado_em, 'DD/MM/YYYY'), p.criado_em::date
            ORDER BY 
                p.criado_em::date ASC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_saida_alimentos(filtros json)
        RETURNS TABLE (
            nome_alimento varchar,
            categoria_nome varchar,
            qtd_escolhida bigint
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
        BEGIN
            RETURN QUERY
            SELECT 
                a.nome AS nome_alimento,
                c.nome AS categoria_nome,
                SUM(ip.quantidade)::bigint AS qtd_escolhida
            FROM composicao_item_pedido cip
            JOIN itens_pedido ip ON cip.item_pedido_id = ip.id
            JOIN alimentos a ON cip.alimento_id = a.id
            JOIN categorias_alimentos c ON a.categoria_id = c.id
            JOIN pedidos p ON ip.pedido_id = p.id
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND p.status != 'Cancelado'
                AND p.deletado_em IS NULL
            GROUP BY 
                a.nome, c.nome
            ORDER BY 
                qtd_escolhida DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_vendas_tamanho(filtros json)
        RETURNS TABLE (
            tamanho_nome varchar,
            qtd_vendida bigint,
            faturamento_tamanho numeric
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
        BEGIN
            RETURN QUERY
            SELECT 
                tm.nome AS tamanho_nome,
                SUM(ip.quantidade)::bigint AS qtd_vendida,
                SUM(ip.subtotal) AS faturamento_tamanho
            FROM itens_pedido ip
            JOIN tamanhos_marmitas tm ON ip.tamanho_marmita_id = tm.id
            JOIN pedidos p ON ip.pedido_id = p.id
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND p.status != 'Cancelado'
                AND p.deletado_em IS NULL
            GROUP BY 
                tm.nome
            ORDER BY 
                faturamento_tamanho DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_clientes_frequentes(filtros json)
        RETURNS TABLE (
            telefone_cliente varchar,
            nome_cliente varchar,
            qtd_pedidos bigint,
            valor_gasto numeric
        ) AS $$
        DECLARE
            v_data_inicio date := (filtros->>'data_inicio')::date;
            v_data_fim date := (filtros->>'data_fim')::date;
        BEGIN
            RETURN QUERY
            SELECT 
                COALESCE(p.telefone_cliente, 'Não informado') AS telefone_cliente,
                p.nome_cliente,
                COUNT(p.id)::bigint AS qtd_pedidos,
                SUM(p.valor_total) AS valor_gasto
            FROM pedidos p
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND p.status != 'Cancelado'
                AND p.deletado_em IS NULL
            GROUP BY 
                p.telefone_cliente, p.nome_cliente
            ORDER BY 
                qtd_pedidos DESC, valor_gasto DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);
}