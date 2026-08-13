/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

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
                p.status::text <> 'Cancelado'
                AND (v_data_inicio IS NULL OR p.criado_em::date >= v_data_inicio)
                AND (v_data_fim IS NULL OR p.criado_em::date <= v_data_fim)
                AND (v_tipo IS NULL OR v_tipo = 'todos' OR p.tipo_pedido::text = v_tipo)
            ORDER BY 
                p.criado_em DESC;
        END;
        $$ LANGUAGE plpgsql;
    `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

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
}