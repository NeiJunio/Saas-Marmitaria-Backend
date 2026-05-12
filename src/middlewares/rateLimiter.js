import rateLimit from "express-rate-limit";

// Limitador Geral para proteger a API por completa

const isDev = process.env.NODE_ENV === 'development';

export const limitadorGeral = rateLimit({

    windowMs: 15 * 60 * 1000,
    max: 200,

    skip: (req) => {

        if (isDev) return true;

        return false;
    }
});
// export const limitadorGeral = rateLimit({
//     windowMs: 15 * 60 * 1000, // Janela de 15 minutos
//     max: 200,
//     message: {
//         status: 'fail',
//         message: 'Muitas requisições vindas deste IP. Tente novamente em 15 minutos.'
//     },
//     standardHeaders: true, // Informa no cabeçalho quanto tempo falta para resetar
//     legacyHeaders: false
// });


// Limitador de Login para proteger contra força bruta
export const limitadorLogin = rateLimit({
    windowMs: 60 * 60 * 1000, // Janela de 1 hora
    max: 10, // Apenas 10 tentativas de login por IP por hora
    message: {
        status: 'fail',
        message: 'Muitas tentativas de login. Por segurança, tente novamente em 1 hora.'
    },
    standardHeaders: true, // Informa no cabeçalho quanto tempo falta para resetar
    legacyHeaders: false
})


// Limitador de Cadastro: Evita que criem milhares de usuários fakes
export const limitadorCadastro = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // Janela de 24 horas
    max: 5, // Apenas 5 contas criadas por IP por dia
    message: {
        status: 'fail',
        message: 'Limite de criação de contas atingido para hoje.'
    }
});