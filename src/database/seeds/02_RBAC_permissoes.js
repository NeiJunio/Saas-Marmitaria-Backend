/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
import chalk from 'chalk';
import logSymbols from 'log-symbols';

export async function seed(knex) {
    await knex('permissoes_usuarios').del();
    await knex('permissoes').del();

    // 2. Definição das permissões por módulo
    const listaPermissoes = [
        // Módulo: Usuários
        { nome: 'usuarios.listar', descricao: 'Visualizar lista de funcionários' },
        { nome: 'usuarios.criar', descricao: 'Cadastrar novos funcionários' },
        { nome: 'usuarios.editar', descricao: 'Editar dados de funcionários' },
        { nome: 'usuarios.deletar', descricao: 'Remover funcionários do sistema' },
        { nome: 'usuarios.visualizar', descricao: 'Visualizar detalhes do usuário' },

        // Módulo: Cardápio (Alimentos)
        { nome: 'cardapio.listar', descricao: 'Visualizar itens do cardápio' },
        { nome: 'cardapio.gerenciar', descricao: 'Criar, editar e excluir itens do cardápio' },
        { nome: 'cardapio.disponibilidade', descricao: 'Alterar se o item está disponível hoje' },

        // Módulo: Pedidos
        { nome: 'pedidos.listar', descricao: 'Visualizar painel de pedidos' },
        { nome: 'pedidos.status', descricao: 'Alterar status do pedido (Preparando, Saiu p/ Entrega, etc)' },
        { nome: 'pedidos.cancelar', descricao: 'Cancelar pedidos ativos' },

        // Módulo: Configurações da Loja
        { nome: 'loja.status', descricao: 'Abrir e fechar a loja para receber pedidos' },
        { nome: 'loja.configurar', descricao: 'Editar horários, taxas de entrega e tamanhos' },

        // Módulo: Relatórios
        { nome: 'relatorios.financeiro', descricao: 'Visualizar faturamento e lucros' },
        { nome: 'relatorios.vendas', descricao: 'Visualizar estatísticas de vendas' },

        {nome: 'permissoes.listar', descricao: 'Visualizar lista de todas as permissões do sistema'},
        {nome: 'permissoes.visualizar', descricao: 'Visualizar quais permissões um usuário possui'},
        {nome: 'permissoes.editar', descricao: 'Alterar as permissões de um usuário'}
    ];

    // 3. Insere apenas as permissões no banco
    await knex('permissoes').insert(listaPermissoes);

    console.log(`\n${logSymbols.success} ${chalk.green('SEED DE PERMISSÕES CONCLUÍDO')}`);
    console.log(`${logSymbols.success} ${chalk.green(`${listaPermissoes.length} permissões cadastradas no catálogo.`)}\n`);

};
