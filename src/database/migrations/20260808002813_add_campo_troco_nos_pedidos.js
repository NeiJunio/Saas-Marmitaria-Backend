/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  return knex.schema.alterTable('pedidos', (table) => {
      table.boolean('precisa_troco').defaultTo(false);
      table.decimal('troco_para', 10, 2).nullable();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  return knex.schema.alterTable('pedidos', (table) => {
      table.dropColumn('precisa_troco');
      table.dropColumn('troco_para');
  });
}