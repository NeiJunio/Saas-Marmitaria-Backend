import chalk from 'chalk';
import logSymbols from 'log-symbols';

/**
 * Cria a permissão para gerenciar os dados da empresa.
 *
 * Criamos a permissão específica para:
 *
 * - alterar razão social, CNPJ, endereço e configurações de sistema;
 * - gerenciar configurações da impressora térmica (QZ Tray).
 *
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {

    const permissoes = [

        {
            nome: 'empresa.configurar',
            descricao: 'Acessar e alterar os dados gerais da empresa e configurações do sistema (ex: QZ Tray)'
        }

    ];


    await knex.transaction(async (trx) => {

        /**
         * Não remove nenhuma permissão existente.
         * Apenas insere ou atualiza a descrição.
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
                'Permissão de configuração da empresa verificada e vinculada.'
            )
        );
    });
}