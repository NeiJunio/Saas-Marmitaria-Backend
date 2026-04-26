import chalk from 'chalk';
import logSymbols from 'log-symbols';
import connection from '../database/connection.js';

export default async function errorHandler(err, req, res, next) {

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Erro interno no servidor';
    const status = statusCode >= 500 ? 'error' : 'fail';
    const timestamp = new Date().toISOString();

    console.error(`\n${logSymbols.error} ${chalk.red(`[${new Date().toISOString()}] Erro em ${req.method} ${req.url}`)}`);
    console.error(chalk.red(`Mensagem: ${message}`));

    if (statusCode >= 500) {
        console.error(chalk.red(err.stack));
    }
    console.error(chalk.gray('--------------------------------------------------\n'));

    try {

        await connection('logs')
            .insert({
                tipo: 'ERRO',
                usuario_id: req.usuario?.id || null, // Se estiver logado, sabemos quem sofreu o erro
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'SISTEMA.ERRO', // Padronização para filtros futuros
                descricao: message,
                payload: JSON.stringify({
                    stack: process.env.NODE_ENV === 'production' ? '🔒' : err.stack,
                    body: req.body,
                    params: req.params,
                    query: req.query
                })
            })

    } catch (dbError) {
        // Se falhar o log no banco, avisamos no terminal mas não travamos a resposta ao cliente
        console.error(`${logSymbols.warning} ${chalk.yellow('Falha ao gravar log de erro no banco:')} ${dbError.message}`);
    }

    return res.status(statusCode).json({
        status: status,
        message: message
    });
}