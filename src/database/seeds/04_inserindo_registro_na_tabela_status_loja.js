/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {

    // Apagando registros existentes
    await knex('status_loja').del();

    // INserindo registro
    await knex('status_loja').insert([
        { id: 1, esta_aberta: true }
    ]);
};
