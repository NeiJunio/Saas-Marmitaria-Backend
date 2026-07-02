import app from './app.js'
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const PORT = process.env.PORT || 3333;

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : '*',
        methods: ['GET', 'POST']
    }
});

global.io = io;

io.on('connection', (socket) => {
    console.log(`\n${logSymbols.success} ${chalk.cyan(`Socket conectado: ${socket.id}`)}`);

    socket.on('disconnect', () => {
        console.log(`\n${logSymbols.error} ${chalk.red(`Socket desconectado: ${socket.id}`)}`);
    });
});

httpServer.listen(PORT, () => {
    console.log(`\n${logSymbols.success} ${chalk.cyan(`API rodando na porta ${PORT}`)}`);
})