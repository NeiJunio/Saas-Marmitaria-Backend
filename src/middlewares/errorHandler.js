export default function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;

    const message = err.message || 'Erro interno no servidor';

    const status = statusCode >= 500 ? 'error' : 'fail';

    console.error(`\n[${new Date().toISOString()}] ❌ Erro em ${req.method} ${req.url}`);
    console.error(`Mensagem: ${message}`);

    if (statusCode >= 500) {
        console.error(err.stack);
    }
    console.error('--------------------------------------------------\n');

    return res.status(statusCode).json({
        status: status,
        message: message
    });
}