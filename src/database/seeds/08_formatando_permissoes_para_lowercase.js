/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
    const TABELA_PERMISSOES = 'permissoes'; // Ajuste se o nome da sua tabela for diferente

    // Mapeamento do que queremos procurar e para o que queremos alterar
    const permissoesParaAtualizar = [
        { antigo: 'RELATORIOS.VISUALIZAR', novo: 'relatorios.visualizar' },
        { antigo: 'RELATORIOS.GERAR', novo: 'relatorios.gerar' }
    ];

    for (const perm of permissoesParaAtualizar) {
        // Verifica se a permissão em maiúsculo ainda existe no banco
        const existeMaiusculo = await knex(TABELA_PERMISSOES)
            .where({ nome: perm.antigo })
            .first();

        if (existeMaiusculo) {
            // Executa o update para a versão em lowercase
            await knex(TABELA_PERMISSOES)
                .where({ id: existeMaiusculo.id }) // Usa o ID para garantir que atualiza o registro exato
                .update({ nome: perm.novo });
                
            console.log(`✅ Permissão atualizada: ${perm.antigo} -> ${perm.novo}`);
        } else {
            console.log(`ℹ️ Ignorado: Permissão '${perm.antigo}' não encontrada (já deve estar em minúsculo).`);
        }
    }
}