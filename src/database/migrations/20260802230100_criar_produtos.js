/**
 * Cria o catálogo de produtos vendidos separadamente da marmita.
 *
 * A mesma estrutura poderá armazenar:
 *
 * - Bebidas
 * - Sobremesas
 * - Porções
 * - Adicionais
 * - Outros produtos
 *
 * Não existe nenhuma dependência com tamanhos_marmitas.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    await knex.schema.createTable('produtos', (table) => {

        // Identificador único do produto.
        table.increments('id').primary();


        /**
         * Categoria comercial do produto.
         *
         * Exemplo:
         *
         * Coca-Cola 350ml
         *      ↓
         * Bebidas
         */
        table.integer('categoria_produto_id')
            .unsigned()
            .notNullable();

        table.foreign('categoria_produto_id')
            .references('id')
            .inTable('categorias_produtos')
            .onDelete('RESTRICT')
            .onUpdate('CASCADE');


        // Nome apresentado ao cliente.
        table.string('nome', 120)
            .notNullable();


        // Informações adicionais do produto.
        table.text('descricao')
            .nullable();


        /**
         * Preço atual de venda do produto.
         *
         * O preço histórico continuará sendo copiado para
         * itens_pedido.preco_unitario no momento da compra.
         */
        table.decimal('preco', 10, 2)
            .notNullable();


        /**
         * Controla se o cadastro está ativo administrativamente.
         *
         * Exemplo:
         * um produto que deixou definitivamente de ser vendido
         * pode ser inativado.
         */
        table.boolean('ativo')
            .notNullable()
            .defaultTo(true);


        /**
         * Controla somente a disponibilidade do dia.
         *
         * Exemplo:
         * Coca-Cola continua cadastrada, mas acabou hoje.
         *
         * ativo = true
         * disponivel_hoje = false
         */
        table.boolean('disponivel_hoje')
            .notNullable()
            .defaultTo(true);


        /**
         * Define a posição do produto dentro da categoria.
         *
         * Assim futuramente o administrador poderá decidir
         * quais produtos aparecem primeiro.
         */
        table.integer('ordem_exibicao')
            .notNullable()
            .defaultTo(0);


        // Auditoria.
        table.timestamp('criado_em', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());

        table.timestamp('atualizado_em', { useTz: true })
            .notNullable()
            .defaultTo(knex.fn.now());

        // Soft delete.
        table.timestamp('deletado_em', { useTz: true })
            .nullable();
    });


    /**
     * O banco não permitirá preço negativo.
     *
     * Mantemos >= 0 porque futuramente pode existir algum
     * produto promocional ou adicional sem custo.
     */
    await knex.raw(`
        ALTER TABLE produtos
        ADD CONSTRAINT chk_produtos_preco
        CHECK (preco >= 0);
    `);


    /**
     * Ordenação também nunca poderá ser negativa.
     */
    await knex.raw(`
        ALTER TABLE produtos
        ADD CONSTRAINT chk_produtos_ordem_exibicao
        CHECK (ordem_exibicao >= 0);
    `);


    /**
     * Impede produtos ativos duplicados dentro da mesma categoria.
     *
     * Exemplo:
     *
     * Bebidas
     * └── Coca-Cola 350ml
     *
     * não poderá existir novamente dentro de Bebidas.
     *
     * LOWER(nome) deixa a comparação case-insensitive.
     */
    await knex.raw(`
        CREATE UNIQUE INDEX idx_produtos_nome_categoria_ativo
        ON produtos (
            categoria_produto_id,
            LOWER(nome)
        )
        WHERE deletado_em IS NULL;
    `);


    /**
     * Índice direcionado para a consulta pública do cardápio.
     *
     * Futuramente teremos consultas semelhantes a:
     *
     * WHERE categoria_produto_id = ?
     * AND ativo = true
     * AND disponivel_hoje = true
     */
    await knex.raw(`
        CREATE INDEX idx_produtos_cardapio
        ON produtos (
            categoria_produto_id,
            ativo,
            disponivel_hoje,
            ordem_exibicao,
            id
        )
        WHERE deletado_em IS NULL;
    `);


    /**
     * Mantém atualizado_em automaticamente seguindo
     * o mesmo padrão das outras tabelas do projeto.
     */
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_produtos
        BEFORE UPDATE ON produtos
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
    `);
}


/**
 * Reverte a criação da tabela produtos.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    await knex.raw(`
        DROP TRIGGER IF EXISTS
        tg_atualizar_data_de_modificacao_produtos
        ON produtos;
    `);

    await knex.raw(`
        DROP INDEX IF EXISTS
        idx_produtos_cardapio;
    `);

    await knex.raw(`
        DROP INDEX IF EXISTS
        idx_produtos_nome_categoria_ativo;
    `);

    await knex.schema
        .dropTableIfExists('produtos');
}