/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // Criando a Trigger
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_metodos_pagamento
        BEFORE UPDATE ON metodos_pagamento
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
    `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    // Dropando a Trigger em caso de rollback
    await knex.raw(`
        DROP TRIGGER IF EXISTS tg_atualizar_data_de_modificacao_metodos_pagamento
        ON metodos_pagamento;
    `);
}