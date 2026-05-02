/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // 1. Criando Trigger para categorias_alimentos
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_categorias
        BEFORE UPDATE ON categorias_alimentos
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
    `);

    // 2. Criando Trigger para tamanhos_marmitas
    await knex.raw(`
        CREATE TRIGGER tg_atualizar_data_de_modificacao_tamanhos
        BEFORE UPDATE ON tamanhos_marmitas
        FOR EACH ROW
        EXECUTE PROCEDURE atualizar_data_de_modificacao();
    `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    // Removendo as triggers específicas criadas nesta migration
    await knex.raw(`DROP TRIGGER IF EXISTS tg_atualizar_data_de_modificacao_categorias ON categorias_alimentos;`);
    await knex.raw(`DROP TRIGGER IF EXISTS tg_atualizar_data_de_modificacao_tamanhos ON tamanhos_marmitas;`);
}