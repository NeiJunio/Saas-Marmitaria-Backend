/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('metodos_pagamento', (table) => {
        table.timestamp('criado_em', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('atualizado_em', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('deletado_em', { useTz: true }).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('metodos_pagamento', (table) => {
        table.dropColumn('criado_em');
        table.dropColumn('atualizado_em');
        table.dropColumn('deletado_em');
    });
}