/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    return knex.schema
        // Tabela de Níveis de Acesso
        .createTable('niveis_acesso', (table) => {
            table.increments('id').primary();
            table.string('nome', 50).notNullable().unique();
            table.string('descricao').notNullable();
            table.boolean('ativo').defaultTo(true);
        })

        // Tabela de Usuários
        .createTable('usuarios', (table) => {
            table.increments('id').primary();
            table.string('nome').notNullable();
            table.string('email', 100).unique().notNullable();
            table.string('senha_hash', 255).notNullable();

            // chave estrangeira para o nível de acesso
            table.integer('nivel_acesso_id')
                .unsigned()
                .notNullable();
            table.foreign('nivel_acesso_id')
                .references('id')
                .inTable('niveis_acesso')
                .onDelete('RESTRICT')
                .onUpdate('CASCADE');
            table.timestamp('criado_em').defaultTo(knex.fn.now());
            table.timestamp('atualizado_em').defaultTo(knex.fn.now());
            table.timestamp('deletado_em').nullable();
            table.boolean('ativo').defaultTo(true);
        })

        // Tabela de logs
        .createTable('logs', (table) => {
            table.increments('id').primary();
            table.integer('usuario_id').unsigned().notNullable();
            table.foreign('usuario_id')
                .references('id')
                .inTable('usuarios')
                .onDelete('CASCADE')
                .onUpdate('CASCADE');
            table.string('acao', 50).notNullable();
            table.text('descricao').notNullable();
            table.timestamp('criado_em').defaultTo(knex.fn.now());
        })

        // Tabela de status da loja
        .createTable('status_loja', (table) => {
            table.increments('id').primary();
            table.boolean('esta_aberta').defaultTo(true);
            table.timestamp('atualizado_em').defaultTo(knex.fn.now());
        })

        // Tabela de métodos de pagamento
        .createTable('metodos_pagamento', (table) => {
            table.increments('id').primary();
            table.string('nome', 50).notNullable().unique();
            table.boolean('ativo').defaultTo(true);
        })

        // Tabela de tamanhos das marmitas
        .createTable('tamanhos_marmitas', (table) => {
            table.increments('id').primary();
            table.string('nome', 50).notNullable().unique();
            table.decimal('preco_base', 10, 2).notNullable();
            table.boolean('ativo').defaultTo(true);
        })

        // Tabela  de categorias de alimentos
        .createTable('categorias_alimentos', (table) => {
            table.increments('id').primary();
            table.string('nome', 50).notNullable().unique();
            table.integer('limite_escolhas').unsigned().notNullable().defaultTo(1);
            table.boolean('ativo').defaultTo(true);
        })

        // Tabela de alimentos
        .createTable('alimentos', (table) => {
            table.increments('id').primary();
            table.integer('categoria_id').unsigned().notNullable();
            table.foreign('categoria_id')
                .references('id')
                .inTable('categorias_alimentos')
                .onDelete('RESTRICT')
                .onUpdate('CASCADE');
            table.string('nome', 100).notNullable();
            table.text('descricao').nullable();
            table.boolean('disponivel_hoje').defaultTo(true);
            table.timestamp('criado_em').defaultTo(knex.fn.now());
            table.timestamp('atualizado_em').defaultTo(knex.fn.now());
            table.timestamp('deletado_em').nullable();
        })

        // Tabela de pedidos (com ENUM para o tipo de pedido -> Presencial ou Remoto)
        .createTable('pedidos', (table) => {
            table.increments('id').primary();
            table.string('nome_cliente', 100).notNullable();
            table.string('telefone_cliente', 20).notNullable();
            table.string('endereco_cliente', 255).notNullable();
            table.enu('tipo_pedido', ['Presencial', 'Remoto'], { useNative: true, enumName: 'tipo_entrega' }).notNullable();
            table.integer('metodo_pagamento_id').unsigned().notNullable();
            table.foreign('metodo_pagamento_id')
                .references('id')
                .inTable('metodos_pagamento')
                .onDelete('RESTRICT')
                .onUpdate('CASCADE');
            table.enu('status', ['Pendente', 'Em Preparo', 'Pronto para Retirada', 'Saiu para Entrega', 'Entregue', 'Cancelado'], { useNative: true, enumName: 'status_pedido' }).defaultTo('Pendente');
            table.decimal('valor_total', 10, 2).notNullable();
            table.text('observacoes').nullable();
            table.timestamp('criado_em').defaultTo(knex.fn.now());
            table.timestamp('atualizado_em').defaultTo(knex.fn.now());
        })

        // Tabela de itens do pedido
        .createTable('itens_pedido', (table) => {
            table.increments('id').primary();
            table.integer('pedido_id').unsigned().notNullable();
            table.foreign('pedido_id')
                .references('id')
                .inTable('pedidos')
                .onDelete('CASCADE')
                .onUpdate('CASCADE');
            table.integer('tamanho_marmita_id').unsigned().notNullable();
            table.foreign('tamanho_marmita_id')
                .references('id')
                .inTable('tamanhos_marmitas')
                .onDelete('RESTRICT')
                .onUpdate('CASCADE');
            table.integer('quantidade').unsigned().notNullable().defaultTo(1);
            table.decimal('preco_unitario', 10, 2).notNullable();
            table.decimal('subtotal', 10, 2).notNullable();
        })
    
    // Tabela de composição da marmita
        .createTable('composicao_item_pedido', (table) => {
            table.increments('id').primary();
            table.integer('item_pedido_id').unsigned().notNullable();
            table.foreign('item_pedido_id')
                .references('id')
                .inTable('itens_pedido')
                .onDelete('CASCADE')
                .onUpdate('CASCADE');
            table.integer('alimento_id').unsigned().notNullable();
            table.foreign('alimento_id')
                .references('id')
                .inTable('alimentos')
                .onDelete('RESTRICT')
                .onUpdate('CASCADE');
        });

};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    await knex.schema
    .dropTableIfExists('composicao_item_pedido')
    .dropTableIfExists('itens_pedido')
    .dropTableIfExists('pedidos')
    .dropTableIfExists('alimentos')
    .dropTableIfExists('categorias_alimentos')
    .dropTableIfExists('tamanhos_marmitas')
    .dropTableIfExists('metodos_pagamento')
    .dropTableIfExists('status_loja')
    .dropTableIfExists('logs')
    .dropTableIfExists('usuarios')
    .dropTableIfExists('niveis_acesso');

  await knex.raw('DROP TYPE IF EXISTS tipo_entrega CASCADE');
  await knex.raw('DROP TYPE IF EXISTS status_pedido CASCADE');
  

};
