/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  return knex.schema.createTable('dados_empresa', (table) => {
    table.increments('id').primary(); // Só existirá o ID 1
    
    // Dados do Proprietário
    table.string('nome_proprietario').notNullable();
    table.string('cpf_proprietario').nullable();
    table.string('telefone_proprietario').nullable();
    
    // Dados Gerais da Empresa
    table.string('razao_social').notNullable();
    table.string('nome_fantasia').notNullable();
    table.string('cnpj').notNullable();
    table.string('telefone_empresa').notNullable();
    table.string('email_empresa').nullable();
    table.string('logo_url').nullable();
    
    // Endereço
    table.string('cep').notNullable();
    table.string('logradouro').notNullable();
    table.string('numero').notNullable();
    table.string('complemento').nullable();
    table.string('bairro').notNullable();
    table.string('cidade').notNullable();
    table.string('estado', 2).notNullable(); // UF
    
    // Configurações de Impressão (QZ Tray - Antecipado)
    table.boolean('imprimir_automaticamente').defaultTo(false);
    table.string('nome_impressora').nullable();
    
    // Timestamps de Auditoria
    table.timestamp('criado_em').defaultTo(knex.fn.now());
    table.timestamp('atualizado_em').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  return knex.schema.dropTable('dados_empresa');
};