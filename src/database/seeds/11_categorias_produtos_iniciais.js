/**
 * Cria as categorias básicas necessárias para o módulo de produtos.
 *
 * Neste momento cadastramos somente "Bebidas".
 *
 * Não criamos produtos fictícios por seed.
 * Coca-Cola, Água, Guaraná etc. serão cadastrados
 * normalmente pelo painel administrativo.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

import chalk from 'chalk';
import logSymbols from 'log-symbols';


export async function seed(knex) {

    const categoriasIniciais = [

        {
            nome: 'Bebidas',

            descricao:
                'Bebidas vendidas separadamente das marmitas.',

            ativo: true,

            ordem_exibicao: 1
        }

    ];


    await knex.transaction(async (trx) => {

        for (
            const categoria of categoriasIniciais
        ) {

            /**
             * Fazemos a comparação ignorando
             * maiúsculas e minúsculas.
             *
             * A consulta também considera registros
             * que sofreram soft delete.
             *
             * Dessa maneira a seed não cria vários
             * históricos de "Bebidas" ao ser executada
             * repetidamente.
             */
            const existente =
                await trx('categorias_produtos')
                    .whereRaw(
                        'LOWER(nome) = LOWER(?)',
                        [categoria.nome]
                    )
                    .first();


            if (existente) {

                console.log(
                    logSymbols.info,

                    chalk.cyan(
                        `Categoria de produto já existente: ${categoria.nome}`
                    )
                );

                continue;
            }


            // Categoria ainda não existe: realiza o cadastro inicial.
            await trx('categorias_produtos')
                .insert(categoria);


            console.log(
                logSymbols.success,

                chalk.green(
                    `Categoria de produto criada: ${categoria.nome}`
                )
            );
        }
    });
}