/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    // ==========================================
    // 1. Faturamento por Período
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
            GROUP BY 
                TO_CHAR(p.criado_em, 'DD/MM/YYYY'), p.criado_em::date
            ORDER BY 
                p.criado_em::date ASC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 2. Histórico de Vendas Completo
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
            ORDER BY 
                p.criado_em DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 3. Curva de Saída de Alimentos (Ajustado para tabelas intermediárias)
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
            GROUP BY 
                a.nome, c.nome
            ORDER BY 
                qtd_escolhida DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 4. Vendas por Tamanho de Marmita (Ajustado para buscar em itens_pedido)
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
                SUM(ip.quantidade)::bigint AS qtd_vendida,
                SUM(ip.subtotal) AS faturamento_tamanho
            FROM itens_pedido ip
            JOIN tamanhos_marmitas tm ON ip.tamanho_marmita_id = tm.id
            JOIN pedidos p ON ip.pedido_id = p.id
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND p.status != 'Cancelado'
            GROUP BY 
                tm.nome
            ORDER BY 
                faturamento_tamanho DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 5. Clientes Mais Frequentes
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
                SUM(p.valor_total) AS valor_gasto
            FROM pedidos p
            WHERE 
                (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND p.status != 'Cancelado'
            GROUP BY 
                p.telefone_cliente, p.nome_cliente
            ORDER BY 
                qtd_pedidos DESC, valor_gasto DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 6. Listagem de Alimentos (Cardápio)
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_listagem_alimentos(filtros json)
        RETURNS TABLE (
            id integer,
            nome varchar,
            categoria_nome varchar,
            status_disponivel text
        ) AS $$
        DECLARE
            v_busca text := filtros->>'busca';
            v_disp text := filtros->>'disponibilidade';
        BEGIN
            RETURN QUERY
            SELECT 
                a.id,
                a.nome,
                c.nome AS categoria_nome,
                CASE WHEN a.disponivel_hoje THEN 'Sim' ELSE 'Não' END AS status_disponivel
            FROM alimentos a
            JOIN categorias_alimentos c ON a.categoria_id = c.id
            WHERE 
                a.deletado_em IS NULL
                AND (v_busca IS NULL OR v_busca = '' OR a.nome ILIKE '%' || v_busca || '%')
                AND (
                    v_disp IS NULL OR v_disp = 'todos' 
                    OR (v_disp = 'Disponível Hoje' AND a.disponivel_hoje = true)
                    OR (v_disp = 'Indisponível' AND a.disponivel_hoje = false)
                )
            ORDER BY 
                c.nome ASC, a.nome ASC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 7. Listagem de Categorias
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_listagem_categorias(filtros json)
        RETURNS TABLE (
            id integer,
            nome varchar,
            limite_escolhas integer,
            status_ativo text
        ) AS $$
        DECLARE
            v_status text := filtros->>'status';
        BEGIN
            RETURN QUERY
            SELECT 
                c.id,
                c.nome,
                c.limite_escolhas,
                CASE WHEN c.ativo THEN 'Ativo' ELSE 'Inativo' END AS status_ativo
            FROM categorias_alimentos c
            WHERE 
                (v_status IS NULL OR v_status = 'todos' 
                 OR (v_status = 'Ativo' AND c.ativo = true) 
                 OR (v_status = 'Inativo' AND c.ativo = false))
            ORDER BY 
                c.nome ASC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 8. Listagem de Tamanhos (Ajustado para tabelas corretas)
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_listagem_tamanhos(filtros json)
        RETURNS TABLE (
            id integer,
            nome varchar,
            preco_base numeric,
            status_ativo text
        ) AS $$
        DECLARE
            v_status text := filtros->>'status';
        BEGIN
            RETURN QUERY
            SELECT 
                tm.id,
                tm.nome,
                tm.preco_base,
                CASE WHEN tm.ativo THEN 'Ativo' ELSE 'Inativo' END AS status_ativo
            FROM tamanhos_marmitas tm
            WHERE 
                (v_status IS NULL OR v_status = 'todos' 
                 OR (v_status = 'Ativo' AND tm.ativo = true) 
                 OR (v_status = 'Inativo' AND tm.ativo = false))
            ORDER BY 
                tm.preco_base ASC;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // ==========================================
    // 9. Listagem de Métodos de Pagamento (Ajustado para tabelas corretas)
    // ==========================================
    await knex.raw(`
        CREATE OR REPLACE FUNCTION fn_rel_listagem_pagamentos(filtros json)
        RETURNS TABLE (
            id integer,
            nome varchar,
            status_ativo text
        ) AS $$
        DECLARE
            v_status text := filtros->>'status';
        BEGIN
            RETURN QUERY
            SELECT 
                mp.id,
                mp.nome,
                CASE WHEN mp.ativo THEN 'Ativo' ELSE 'Inativo' END AS status_ativo
            FROM metodos_pagamento mp
            WHERE 
                (v_status IS NULL OR v_status = 'todos' 
                 OR (v_status = 'Ativo' AND mp.ativo = true) 
                 OR (v_status = 'Inativo' AND mp.ativo = false))
            ORDER BY 
                mp.id ASC;
        END;
        $$ LANGUAGE plpgsql;
    `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_faturamento_periodo(json);');
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_historico_vendas(json);');
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_saida_alimentos(json);');
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_vendas_tamanho(json);');
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_clientes_frequentes(json);');
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_listagem_alimentos(json);');
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_listagem_categorias(json);');
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_listagem_tamanhos(json);');
    await knex.raw('DROP FUNCTION IF EXISTS fn_rel_listagem_pagamentos(json);');
}