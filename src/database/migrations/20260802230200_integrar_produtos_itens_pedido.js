/**
 * Permite que itens_pedido represente dois tipos de item:
 *
 * 1. MARMITA
 *    tamanho_marmita_id preenchido
 *    produto_id = NULL
 *
 * 2. PRODUTO
 *    tamanho_marmita_id = NULL
 *    produto_id preenchido
 *
 * Essa alteração mantém compatibilidade com todos os pedidos
 * existentes antes da criação do módulo de produtos.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    /**
     * Atualmente tamanho_marmita_id é obrigatório.
     *
     * Precisamos permitir NULL porque produtos como bebidas
     * não possuem tamanho de marmita.
     *
     * IMPORTANTE:
     * nenhum registro atual é modificado.
     */
    await knex.schema.alterTable(
        'itens_pedido',
        (table) => {

            table.integer('tamanho_marmita_id')
                .unsigned()
                .nullable()
                .alter();


            /**
             * Novo relacionamento opcional.
             *
             * Quando este campo estiver preenchido,
             * o item representa um produto.
             */
            table.integer('produto_id')
                .unsigned()
                .nullable();


            table.foreign('produto_id')
                .references('id')
                .inTable('produtos')
                .onDelete('RESTRICT')
                .onUpdate('CASCADE');


            /**
             * Melhora consultas que precisarão buscar
             * informações dos produtos dos pedidos.
             */
            table.index(
                ['produto_id'],
                'idx_itens_pedido_produto_id'
            );
        }
    );


    /**
     * REGRA DE INTEGRIDADE MAIS IMPORTANTE.
     *
     * Um item precisa ser:
     *
     * MARMITA
     * OU
     * PRODUTO
     *
     * Nunca ambos.
     *
     * Também nunca poderá ficar sem nenhum dos dois.
     */
    await knex.raw(`
        ALTER TABLE itens_pedido
        ADD CONSTRAINT chk_itens_pedido_origem
        CHECK (

            (
                tamanho_marmita_id IS NOT NULL
                AND
                produto_id IS NULL
            )

            OR

            (
                tamanho_marmita_id IS NULL
                AND
                produto_id IS NOT NULL
            )

        );
    `);
}


/**
 * Reverte a integração entre produtos e itens_pedido.
 *
 * Existe uma proteção proposital:
 *
 * se algum produto já fizer parte de um pedido,
 * o rollback será cancelado em vez de apagar
 * silenciosamente o histórico da venda.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    /**
     * Antes de remover produto_id verificamos se
     * já existem vendas utilizando produtos.
     */
    const registroProduto = await knex('itens_pedido')
        .whereNotNull('produto_id')
        .first('id');


    if (registroProduto) {

        throw new Error(
            'Rollback cancelado: existem produtos vinculados a pedidos. ' +
            'Remova ou migre esses itens antes de reverter esta migration.'
        );
    }


    // Remove primeiro a regra CHECK.
    await knex.raw(`
        ALTER TABLE itens_pedido
        DROP CONSTRAINT IF EXISTS chk_itens_pedido_origem;
    `);


    // Remove índice, FK e coluna de produtos.
    await knex.schema.alterTable(
        'itens_pedido',
        (table) => {

            table.dropIndex(
                ['produto_id'],
                'idx_itens_pedido_produto_id'
            );

            table.dropForeign(
                ['produto_id']
            );

            table.dropColumn(
                'produto_id'
            );
        }
    );


    /**
     * Como produto_id não existe mais,
     * todos os itens voltam obrigatoriamente
     * a representar marmitas.
     */
    await knex.schema.alterTable(
        'itens_pedido',
        (table) => {

            table.integer('tamanho_marmita_id')
                .unsigned()
                .notNullable()
                .alter();
        }
    );
}