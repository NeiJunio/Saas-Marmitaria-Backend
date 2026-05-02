/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw(`
        CREATE UNIQUE INDEX idx_nome_alimento_ativo 
        ON alimentos (nome) 
        WHERE deletado_em IS NULL
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`DROP INDEX IF EXISTS idx_nome_alimento_ativo`);
};
