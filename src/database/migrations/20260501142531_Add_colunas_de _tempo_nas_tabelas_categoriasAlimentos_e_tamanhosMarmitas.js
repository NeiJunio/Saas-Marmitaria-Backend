/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const tabelas = ['categorias_alimentos', 'tamanhos_marmitas'];

  for (const tabela of tabelas) {
    await knex.schema.alterTable(tabela, (table) => {
      // timestamp(nome, { useTz: true }) para usar Timezone (recomendado para Neon/Postgres)
      table.timestamp('criado_em', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('atualizado_em', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('deletado_em', { useTz: true }).nullable();
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  const tabelas = ['categorias_alimentos', 'tamanhos_marmitas'];

  for (const tabela of tabelas) {
    await knex.schema.alterTable(tabela, (table) => {
      table.dropColumns('criado_em', 'atualizado_em', 'deletado_em');
    });
  }
}