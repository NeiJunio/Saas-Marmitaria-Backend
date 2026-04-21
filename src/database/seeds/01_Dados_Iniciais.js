/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
    // Deletes ALL existing entries
    await knex('metodos_pagamento').del();
    await knex('tamanhos_marmitas').del();
    await knex('categorias_alimentos').del();
    await knex('niveis_acesso').del();


    await knex('niveis_acesso').insert([
        { nome: 'admin', descricao: 'Acesso total ao sistema e relatorios' },
        { nome: 'atendente', descricao: 'Gerencia pedidos e cardapio do dia' },
        { nome: 'entregador', descricao: 'Gerencia entregas e status de pedidos' }
    ]);

    await knex('categorias_alimentos').insert([
        { nome: 'Básicos', limite_escolhas: 2 },         // Ex: Arroz, Feijão
        { nome: 'Misturas', limite_escolhas: 1 },        // Ex: Bife, Frango Assado
        { nome: 'Acompanhamentos', limite_escolhas: 3 }, // Ex: Maionese, Farofa, Fritas
        { nome: 'Extras', limite_escolhas: 1 }           // Ex: Ovo Frito, Bife a cavalo
    ]);

    await knex('tamanhos_marmitas').insert([
        { nome: 'Pequena (P)', preco_base: 15.00 },
        { nome: 'Média (M)', preco_base: 20.00 },
        { nome: 'Grande (G)', preco_base: 25.00 }
    ]);

    await knex('metodos_pagamento').insert([
        { nome: 'Pix' },
        { nome: 'Dinheiro' },
        { nome: 'Cartão de Crédito' },
        { nome: 'Cartão de Débito' }
    ]);
};
