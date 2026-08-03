/**
 * Cria as categorias dos produtos vendidos separadamente da marmita.
 *
 * Exemplos:
 * - Bebidas
 * - Sobremesas
 * - Porções
 * - Adicionais
 *
 * Essa tabela é propositalmente separada de categorias_alimentos,
 * pois categorias de alimentos fazem parte da montagem da marmita.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    await knex.schema.createTable('categorias_produtos', (table) => {

        // Identificador único da categoria.
        table.increments('id').primary();

        // Nome exibido no painel e no cardápio.
        table.string('nome', 80).notNullable();

        // Descrição opcional para explicar a finalidade da categoria.
        table.text('descricao').nullable();

        /**
         * "ativo" representa o estado administrativo da categoria.
         *
         * Uma categoria inativa continua existindo no banco,
         * mas não deve ser utilizada para novas vendas.
         */
        table.boolean('ativo')
            .notNullable()
            .defaultTo(true);

        /**
         * Permite controlar futuramente a posição das categorias
         * no cardápio sem depender da ordem do ID.
         *
         * Exemplo:
         * 1 - Bebidas
         * 2 - Sobremesas
         * 3 - Porções
         */
        table.integer('ordem_exibicao')
            .notNullable()
            .defaultTo(0);

        // Campos de auditoria seguindo o padrão atual do projeto.
        table.timestamp('criado_em', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());

        table.timestamp('atualizado_em', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());

        // Soft delete: evita apagar fisicamente registros históricos.
        table.timestamp('deletado_em', { useTz: true })
            .nullable();
    });


    /**
     * Impede valores negativos na ordenação.
     */
    await knex.raw(`
        ALTER TABLE categorias_produtos
        ADD CONSTRAINT chk_categorias_produtos_ordem_exibicao
        CHECK (ordem_exibicao >= 0);
    `);


    /**
     * Garante que não existam duas categorias ATIVAS
     * com o mesmo nome.
     *
     * LOWER(nome) também evita:
     *
     * Bebidas
     * BEBIDAS
     * bebidas
     *
     * serem consideradas categorias diferentes.
     *
     * Registros removidos via soft delete não entram na regra.
     */
    await knex.raw(`
        CREATE UNIQUE INDEX idx_categorias_produtos_nome_ativo
        ON categorias_produtos (LOWER(nome))
        WHERE deletado_em IS NULL;
    `);


    /**
     * Índice utilizado principalmente nas listagens do cardápio.
     */
    await knex.raw(`
        CREATE INDEX idx_categorias_produtos_exibicao
        ON categorias_produtos (
            ativo,
            ordem_exibicao,
            id
        )
        WHERE deletado_em IS NULL;
    `);


    /**
     * Utiliza a função atualizar_data_de_modificacao()
     * que já existe nas migrations atuais do projeto.
     *
     * Dessa forma atualizado_em será alterado automaticamente
     * sempre que a categoria for modificada.
     */
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_categorias_produtos
        BEFORE UPDATE ON categorias_produtos
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
    `);
}


/**
 * Reverte completamente a criação de categorias_produtos.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    await knex.raw(`
        DROP TRIGGER IF EXISTS
        tg_atualizar_data_de_modificacao_categorias_produtos
        ON categorias_produtos;
    `);

    await knex.raw(`
        DROP INDEX IF EXISTS
        idx_categorias_produtos_exibicao;
    `);

    await knex.raw(`
        DROP INDEX IF EXISTS
        idx_categorias_produtos_nome_ativo;
    `);

    await knex.schema
        .dropTableIfExists('categorias_produtos');
}