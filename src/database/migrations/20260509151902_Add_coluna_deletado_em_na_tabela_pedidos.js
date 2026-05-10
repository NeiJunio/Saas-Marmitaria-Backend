/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('pedidos', (table) => {
    // Adiciona a coluna deletado_em com suporte a Timezone (padrão que você usou antes)
    table.timestamp('deletado_em', { useTz: true }).nullable();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('pedidos', (table) => {
    table.dropColumn('deletado_em');
  });
}