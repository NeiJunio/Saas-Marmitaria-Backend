import express from 'express';
import cookieParser from 'cookie-parser';

import usuariosRoutes from './routes/Usuarios.routes.js'
import authRoutes from './routes/Auth.routes.js'

import errorHandler from './middlewares/errorHandler.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use('/usuarios', usuariosRoutes)
app.use('/auth', authRoutes)

app.use((err, req, res, next) => {
    console.error(err.stack);
    return res.status(500).json({
        status: 'error',
        message: err.message
    })
})

export default app;