/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('categorias_alimentos', (table) => {
        table.dropUnique('nome');
    })

    await knex.raw(`
        CREATE UNIQUE INDEX idx_nome_categoria_ativo
        ON categorias_alimentos (nome)
        WHERE deletado_em IS NULL
        `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`DROP INDEX idx_nome_categoria_ativo`);

    await knex.schema.alterTable('categorias_alimentos', (table) => {
        table.unique('nome');
    })
};
