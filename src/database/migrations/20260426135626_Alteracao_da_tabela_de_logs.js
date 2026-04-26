/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('logs', (table) => {
        // 1. Altera a coluna usuario_id para permitir valores nulos (importante para erros em rotas públicas ou login)
        table.integer('usuario_id').unsigned().nullable().alter();

        // 2. Remove a restrição de chave estrangeira antiga para atualizar o comportamento de deleção
        table.dropForeign('usuario_id');

        // 3. Recria a chave estrangeira apontando para a tabela 'usuarios'
        table.foreign('usuario_id')
            .references('id')
            .inTable('usuarios') 
            .onDelete('SET NULL') // Mantém o log mesmo que o usuário seja excluído (histórico de auditoria)
            .onUpdate('CASCADE');

        // 4. Adiciona flag para distinguir entre ações de sucesso ('ACAO') e falhas técnicas ('ERRO')
        table.string('tipo', 10).notNullable().defaultTo('ACAO').index();

        // 5. Adiciona campos para rastreabilidade da requisição HTTP
        table.string('metodo', 10);      // Armazena GET, POST, PATCH, etc.
        table.string('endpoint').index(); // Armazena a URL da rota acessada

        // 6. Campo JSONB para armazenar detalhes flexíveis (objetos de erro ou dados alterados)
        // O formato JSONB no Postgres permite buscas eficientes dentro dos dados
        table.jsonb('payload');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('logs', (table) => {
        // Reverte todas as novas colunas e índices adicionados no método 'up'
        table.dropColumn('payload');
        table.dropColumn('endpoint');
        table.dropColumn('metodo');
        table.dropColumn('tipo');

        // Retorna o usuario_id para obrigatório (notNullable)
        table.integer('usuario_id').unsigned().notNullable().alter();

        // Restaura a chave estrangeira original com comportamento de deleção em cascata
        table.dropForeign('usuario_id');
        table.foreign('usuario_id')
            .references('id')
            .inTable('usuarios')
            .onDelete('CASCADE')
            .onUpdate('CASCADE');
    });
};