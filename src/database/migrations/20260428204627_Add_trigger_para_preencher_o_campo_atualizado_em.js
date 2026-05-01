/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {

    // Criando a função
    await knex.raw(`
        CREATE OR REPLACE FUNCTION atualizar_data_de_modificacao()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.atualizado_em = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        `)


    // Criando Triggers
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_usuarios
        BEFORE UPDATE ON usuarios
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
        `)

    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_pedidos
        BEFORE UPDATE ON pedidos
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
        `)
    
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_alimentos
        BEFORE UPDATE ON alimentos
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
        `)
  
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_status_loja
        BEFORE UPDATE ON status_loja    
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
        `)

};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    // Dropando as triggers de atualização de data de modificação
    await knex.raw(`DROP TRIGGER IF EXISTS tg_atualizar_data_de_modificacao_usuarios ON usuarios;`)

    await knex.raw(`DROP TRIGGER IF EXISTS tg_atualizar_data_de_modificacao_pedidos ON pedidos;`)
    
    await knex.raw(`DROP TRIGGER IF EXISTS tg_atualizar_data_de_modificacao_alimentos ON alimentos;`)
    
    await knex.raw(`DROP TRIGGER IF EXISTS tg_atualizar_data_de_modificacao_status_loja ON status_loja;`)
    
    // Dropando a função
    await knex.raw(`DROP FUNCTION IF EXISTS atualizar_data_de_modificacao();`)
    
};
