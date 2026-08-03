/**
 * Adiciona as permissões dos módulos:
 *
 * - Categorias de Produtos
 * - Produtos
 *
 * A seed é idempotente:
 * pode ser executada novamente sem duplicar registros.
 *
 * Também garante que todos os usuários ADMIN ativos
 * recebam automaticamente essas novas permissões.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

import chalk from 'chalk';
import logSymbols from 'log-symbols';


export async function seed(knex) {

    const permissoes = [

        // =====================================================
        // CATEGORIAS DE PRODUTOS
        // =====================================================

        {
            nome: 'categorias_produtos.listar',
            descricao: 'Visualizar categorias de produtos'
        },

        {
            nome: 'categorias_produtos.criar',
            descricao: 'Cadastrar novas categorias de produtos'
        },

        {
            nome: 'categorias_produtos.editar',
            descricao: 'Editar categorias de produtos existentes'
        },

        {
            nome: 'categorias_produtos.deletar',
            descricao: 'Remover categorias de produtos do sistema'
        },

        {
            nome: 'categorias_produtos.restaurar',
            descricao: 'Restaurar categorias de produtos removidas'
        },


        // =====================================================
        // PRODUTOS
        // =====================================================

        {
            nome: 'produtos.listar',
            descricao: 'Visualizar lista de produtos'
        },

        {
            nome: 'produtos.visualizar',
            descricao: 'Visualizar detalhes de um produto'
        },

        {
            nome: 'produtos.criar',
            descricao: 'Cadastrar novos produtos'
        },

        {
            nome: 'produtos.editar',
            descricao: 'Editar dados e preços dos produtos'
        },

        {
            nome: 'produtos.deletar',
            descricao: 'Remover produtos do sistema'
        },

        {
            nome: 'produtos.restaurar',
            descricao: 'Restaurar produtos removidos'
        },

        {
            nome: 'produtos.disponibilidade',
            descricao: 'Alterar a disponibilidade diária dos produtos'
        }
    ];


    await knex.transaction(async (trx) => {

        /**
         * Insere somente o que ainda não existe.
         *
         * Caso uma permissão já esteja cadastrada,
         * apenas sua descrição será atualizada.
         */
        await trx('permissoes')
            .insert(permissoes)
            .onConflict('nome')
            .merge(['descricao']);


        const nomesPermissoes = permissoes.map(
            (permissao) => permissao.nome
        );


        /**
         * Recuperamos os IDs reais porque podem variar
         * dependendo do banco onde a seed foi executada.
         */
        const permissoesCadastradas =
            await trx('permissoes')
                .whereIn(
                    'nome',
                    nomesPermissoes
                )
                .select('id');


        /**
         * Procura todos os administradores válidos.
         *
         * nivel_acesso_id = 1 corresponde ao ADMIN
         * definido pelas seeds atuais do projeto.
         */
        const admins =
            await trx('usuarios')
                .where({
                    nivel_acesso_id: 1,
                    ativo: true
                })
                .whereNull('deletado_em')
                .select('id');


        /**
         * Sua seed de Admin Master atual é a 09.
         *
         * Como esta seed é executada depois dela,
         * precisamos entregar explicitamente as novas
         * permissões aos administradores.
         */
        if (
            admins.length > 0 &&
            permissoesCadastradas.length > 0
        ) {

            const vinculos = admins.flatMap(
                (admin) =>

                    permissoesCadastradas.map(
                        (permissao) => ({

                            usuario_id: admin.id,

                            permissao_id:
                                permissao.id

                        })
                    )
            );


            /**
             * Evita duplicar:
             *
             * usuario_id + permissao_id
             */
            await trx('permissoes_usuarios')
                .insert(vinculos)
                .onConflict([
                    'usuario_id',
                    'permissao_id'
                ])
                .ignore();
        }


        console.log(
            `\n${logSymbols.success} ${
                chalk.green(
                    'PERMISSÕES DE PRODUTOS CONFIGURADAS'
                )
            }`
        );


        console.log(
            `${logSymbols.success} ${
                chalk.green(
                    `${permissoes.length} permissões verificadas no catálogo.`
                )
            }\n`
        );
    });
}