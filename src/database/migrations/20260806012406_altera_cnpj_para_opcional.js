export const up = function(knex) {
  return knex.schema.alterTable('dados_empresa', (table) => {
    // Transforma a coluna existente em nullable
    table.string('cnpj').nullable().alter();
  });
};

export const down = function(knex) {
  return knex.schema.alterTable('dados_empresa', (table) => {
    table.string('cnpj').notNullable().alter();
  });
};