/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
    // Lista de permissões do módulo de relatórios
    const permissoes = [
        {
            nome: 'RELATORIOS.VISUALIZAR',
            descricao: 'Permite acessar a tela com o catálogo de relatórios disponíveis.'
            // Se você tiver uma coluna "modulo" ou "grupo" na sua tabela, pode adicionar aqui (ex: modulo: 'Relatórios')
        },
        {
            nome: 'RELATORIOS.GERAR',
            descricao: 'Permite gerar relatórios, visualizar os resultados em tabela e exportar (PDF, Excel, Impressão).'
        }
    ];

    // Nome da sua tabela de permissões (Ajuste se for diferente no seu banco)
    const TABELA_PERMISSOES = 'permissoes'; 

    for (const permissao of permissoes) {
        // Verifica se a permissão já existe para não duplicar
        const existe = await knex(TABELA_PERMISSOES)
            .where({ nome: permissao.nome })
            .first();

        if (!existe) {
            await knex(TABELA_PERMISSOES).insert(permissao);
            console.log(`✅ Permissão inserida: ${permissao.nome}`);
        } else {
            // Se já existir, apenas atualiza a descrição caso tenha mudado
            await knex(TABELA_PERMISSOES)
                .where({ nome: permissao.nome })
                .update({ descricao: permissao.descricao });
            console.log(`🔄 Permissão atualizada: ${permissao.nome}`);
        }
    }

}