/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
  // 1. Limpa a tabela antes de inserir para evitar duplicidade em novos runs
  // Usamos truncate para resetar os IDs (se não houver chaves estrangeiras impedindo)
  // ou del() para uma limpeza mais simples.
  await knex('tamanhos_marmitas').del();

  // 2. Insere os tamanhos padrão
  await knex('tamanhos_marmitas').insert([
    { 
      nome: 'PEQUENA', 
      preco_base: 15.00, 
      ativo: true 
    },
    { 
      nome: 'MÉDIA', 
      preco_base: 18.50, 
      ativo: true 
    },
    { 
      nome: 'GRANDE', 
      preco_base: 22.00, 
      ativo: true 
    }
  ]);
};