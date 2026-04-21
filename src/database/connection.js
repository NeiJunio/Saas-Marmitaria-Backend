import knex from 'knex';
import configuration  from'../../knexfile.js';

const enviroment = process.env.NODE_ENV || 'development';
const config = configuration[enviroment];

const connection = knex(config);

connection.raw('SELECT 1')
    .then(() => {
        console.log("🟢 PostgreSQL conectado com Knex!");
    })
    .catch((err) => {
        console.error("🔴 Erro ao conectar com o banco:", err);
        process.exit(1);
    });

export default connection;