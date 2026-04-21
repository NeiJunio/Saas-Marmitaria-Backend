/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema

        // Tabela de permissões
        .createTable('permissoes', (table) => {
            table.increments('id').primary();
            table.string('nome', 50).notNullable().unique();
            table.string('descricao').nullable();
            table.timestamp('criado_em').defaultTo(knex.fn.now());
        })

        .createTable('permissoes_usuarios', (table) => {
            table.increments('id').primary();

            table.integer('usuario_id').unsigned().notNullable();
            table.foreign('usuario_id')
                .references('id')
                .inTable('usuarios')
                .onDelete('CASCADE')
                .onUpdate('CASCADE');

            table.integer('permissao_id').unsigned().notNullable();
            table.foreign('permissao_id')
                .references('id')
                .inTable('permissoes')
                .onDelete('CASCADE')
                .onUpdate('CASCADE');

            table.unique(['usuario_id', 'permissao_id']);

            table.timestamp('criado_em').defaultTo(knex.fn.now());
        })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema
        .dropTableIfExists('permissoes_usuarios')
        .dropTableIfExists('permissoes');
};
