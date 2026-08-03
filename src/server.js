import app from './app.js';

import chalk from 'chalk';
import logSymbols from 'log-symbols';
import dotenv from 'dotenv';

import {
    createServer
} from 'http';

import {
    Server
} from 'socket.io';

import jwt from 'jsonwebtoken';

import connection from './database/connection.js';


dotenv.config();


const PORT =
    process.env.PORT ||
    3333;


/**
 * Utilizamos exatamente a mesma variável
 * usada pelo CORS da API REST.
 */
const allowedOrigins =
    process.env.ALLOWED_ORIGINS

        ? process.env
            .ALLOWED_ORIGINS
            .split(',')
            .map(
                origin =>
                    origin.trim()
            )
            .filter(Boolean)

        : [];


const httpServer =
    createServer(
        app
    );


const io =
    new Server(
        httpServer,
        {

            cors: {

                origin:
                    allowedOrigins,

                methods: [
                    'GET',
                    'POST'
                ],

                /**
                 * Necessário para que o cookie HTTP Only
                 * de autenticação seja enviado no handshake.
                 */
                credentials:
                    true
            }
        }
    );


/**
 * ============================================================
 * EXTRAÇÃO DO COOKIE
 * ============================================================
 */
function buscarCookie(
    cookieHeader,
    nome
) {

    if (!cookieHeader) {
        return null;
    }


    const cookies =
        cookieHeader
            .split(';')
            .map(
                item =>
                    item.trim()
            );


    for (
        const cookie of cookies
    ) {

        const [
            chave,
            ...valor
        ] =
            cookie.split('=');


        if (
            chave === nome
        ) {

            return decodeURIComponent(
                valor.join('=')
            );
        }
    }


    return null;
}


/**
 * ============================================================
 * AUTENTICAÇÃO DO SOCKET
 * ============================================================
 *
 * Somente usuários administrativos autenticados e
 * autorizados a visualizar pedidos entram no canal.
 */
io.use(
    async (
        socket,
        next
    ) => {

        try {

            const token =
                buscarCookie(
                    socket
                        .request
                        .headers
                        .cookie,
                    'token'
                );


            if (!token) {

                return next(
                    new Error(
                        'Não autenticado'
                    )
                );
            }


            const decoded =
                jwt.verify(
                    token,
                    process.env.JWT_SECRET
                );


            /**
             * Garante que o usuário ainda existe,
             * não foi excluído e continua ativo.
             */
            const usuario =
                await connection(
                    'usuarios'
                )

                    .where({
                        id:
                            decoded.id,

                        ativo:
                            true
                    })

                    .whereNull(
                        'deletado_em'
                    )

                    .first(
                        'id'
                    );


            if (!usuario) {

                return next(
                    new Error(
                        'Usuário não autorizado'
                    )
                );
            }


            /**
             * Admin Master sempre pode acompanhar pedidos.
             *
             * Para outros usuários verificamos pedidos.listar.
             */
            if (
                String(
                    decoded.cargo
                ).toLowerCase() !==
                'admin'
            ) {

                const permissao =
                    await connection(
                        'permissoes_usuarios as pu'
                    )

                        .join(
                            'permissoes as p',

                            'p.id',

                            '=',

                            'pu.permissao_id'
                        )

                        .where(
                            'pu.usuario_id',
                            decoded.id
                        )

                        .where(
                            'p.nome',
                            'pedidos.listar'
                        )

                        .first(
                            'p.id'
                        );


                if (!permissao) {

                    return next(
                        new Error(
                            'Sem permissão para acompanhar pedidos'
                        )
                    );
                }
            }


            socket.usuario = {

                id:
                    decoded.id,

                nome:
                    decoded.nome,

                cargo:
                    decoded.cargo
            };


            next();

        } catch (error) {

            next(
                new Error(
                    'Sessão inválida'
                )
            );
        }
    }
);


global.io =
    io;


io.on(
    'connection',
    socket => {

        /**
         * Todos os sockets autenticados desta área
         * entram no canal de pedidos.
         */
        socket.join(
            'pedidos'
        );


        console.log(
            `\n${logSymbols.success} ${chalk.cyan(
                `Socket administrativo conectado: ${socket.id}`
            )
            }`
        );


        socket.on(
            'disconnect',
            () => {

                console.log(
                    `\n${logSymbols.warning} ${chalk.yellow(
                        `Socket desconectado: ${socket.id}`
                    )
                    }`
                );
            }
        );
    }
);


httpServer.listen(
    PORT,
    () => {

        console.log(
            `\n${logSymbols.success} ${chalk.cyan(
                `API rodando na porta ${PORT}`
            )
            }`
        );
    }
);