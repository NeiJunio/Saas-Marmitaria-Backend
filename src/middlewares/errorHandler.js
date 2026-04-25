import chalk from 'chalk';
import logSymbols from 'log-symbols';

export default function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;

    const message = err.message || 'Erro interno no servidor';

    const status = statusCode >= 500 ? 'error' : 'fail';

    console.error(`\n${logSymbols.error} ${chalk.red(`[${new Date().toISOString()}] Erro em ${req.method} ${req.url}`)}`);
    console.error(chalk.red(`Mensagem: ${message}`));

    if (statusCode >= 500) {
        console.error(chalk.red(err.stack));
    }
    console.error(chalk.gray('--------------------------------------------------\n'));

    return res.status(statusCode).json({
        status: status,
        message: message
    });
}