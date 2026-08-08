/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    return knex.schema.alterTable('itens_pedido', table => {
        // Adiciona a coluna de observação individual para cada item
        table.text('observacao').nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    return knex.schema.alterTable('itens_pedido', table => {
        table.dropColumn('observacao');
    });
}