import knex from 'knex';
import configuration  from'../../knexfile.js';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

const enviroment = process.env.NODE_ENV || 'development';
const config = configuration[enviroment];

const connection = knex(config);

connection.raw('SELECT 1')
    .then(() => {
        console.log(logSymbols.success, chalk.green("PostgreSQL conectado com Knex!"));
    })
    .catch((err) => {
        console.error(logSymbols.error, chalk.red("Erro ao conectar com o banco:"), err);
        process.exit(1);
    });

export default connection;