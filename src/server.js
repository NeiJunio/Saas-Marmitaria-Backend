import app from './app.js'
import chalk from 'chalk';
import logSymbols from 'log-symbols';

import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => { 
    console.log(`\n${logSymbols.success} ${chalk.cyan(`API rodando na porta ${PORT}`)}`);
})