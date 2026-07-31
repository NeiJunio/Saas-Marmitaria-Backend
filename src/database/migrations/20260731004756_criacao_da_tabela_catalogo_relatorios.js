/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // 1. Usa AWAIT em vez de RETURN para o código continuar rodando
    await knex.schema
        .createTable('catalogo_relatorios', (table) => {
            table.increments('id').primary();
            table.string('nome', 150).notNullable();
            table.text('descricao').nullable();
            table.string('funcao_db', 100).notNullable();
            
            // JSONB para armazenar os metadados com alta performance
            table.jsonb('filtros_config').nullable();
            table.jsonb('colunas_config').nullable();
            
            table.boolean('ativo').defaultTo(true);
            table.timestamp('criado_em').defaultTo(knex.fn.now());
            table.timestamp('atualizado_em').defaultTo(knex.fn.now());
        });
    
    // 2. Agora sim a trigger será criada
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_catalogo_relatorios
        BEFORE UPDATE ON catalogo_relatorios    
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
    `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    // 1. Dropa a trigger ANTES de dropar a tabela (para evitar erro)
    await knex.raw(`
        DROP TRIGGER IF EXISTS tg_atualizar_data_de_modificacao_catalogo_relatorios ON catalogo_relatorios;
    `);

    // 2. Dropa a tabela
    await knex.schema.dropTableIfExists('catalogo_relatorios');
}