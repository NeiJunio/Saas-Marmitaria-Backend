/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    return knex.schema.alterTable('pedidos', (table) => {
        // 1. Torna o endereço opcional (aceita null)
        table.string('endereco_cliente', 255).nullable().alter();

        // 2. Cria a nova coluna de método de entrega
        table.enu('metodo_entrega', ['Entrega', 'Retirada'], { 
            useNative: true, 
            enumName: 'enum_metodo_entrega' 
        })
        .notNullable()
        .defaultTo('Entrega'); // Por padrão, assume entrega
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('pedidos', (table) => {
        // Reverte as alterações
        table.dropColumn('metodo_entrega');
        // Atenção: O rollback falhará se existirem registos com endereço nulo na base
        table.string('endereco_cliente', 255).notNullable().alter();
    });

    await knex.raw('DROP TYPE IF EXISTS enum_metodo_entrega CASCADE');
}