import chalk from 'chalk';
import logSymbols from 'log-symbols';

/**
 * Complementa o RBAC do módulo de pedidos.
 *
 * Criamos permissões específicas para:
 *
 * - lançar pedidos pelo painel;
 * - restaurar pedidos excluídos.
 *
 * A permissão pedidos.status já existe e apenas
 * garantimos que sua descrição esteja atualizada.
 *
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {

    const permissoes = [

        {
            nome: 'pedidos.criar',
            descricao: 'Cadastrar pedidos através do painel administrativo'
        },

        {
            nome: 'pedidos.status',
            descricao: 'Alterar o status operacional dos pedidos'
        },

        {
            nome: 'pedidos.restaurar',
            descricao: 'Restaurar pedidos removidos logicamente'
        }
    ];


    await knex.transaction(async (trx) => {

        /**
         * Não remove nenhuma permissão existente.
         */
        await trx('permissoes')
            .insert(permissoes)
            .onConflict('nome')
            .merge(['descricao']);


        const nomes =
            permissoes.map(
                permissao =>
                    permissao.nome
            );


        const permissoesBanco =
            await trx('permissoes')
                .whereIn(
                    'nome',
                    nomes
                )
                .select('id');


        /**
         * Todos os administradores recebem
         * automaticamente as novas permissões.
         */
        const admins =
            await trx('usuarios')
                .where({
                    nivel_acesso_id: 1,
                    ativo: true
                })
                .whereNull('deletado_em')
                .select('id');


        if (
            admins.length > 0 &&
            permissoesBanco.length > 0
        ) {

            const vinculos =
                admins.flatMap(
                    admin =>

                        permissoesBanco.map(
                            permissao => ({

                                usuario_id:
                                    admin.id,

                                permissao_id:
                                    permissao.id
                            })
                        )
                );


            await trx('permissoes_usuarios')
                .insert(vinculos)
                .onConflict([
                    'usuario_id',
                    'permissao_id'
                ])
                .ignore();
        }


        console.log(
            logSymbols.success,
            chalk.green(
                'Permissões administrativas de pedidos verificadas.'
            )
        );
    });
}