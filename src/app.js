import express from 'express';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/Auth.routes.js'
import permissoesRoutes from './routes/Permissoes.routes.js'
import usuariosRoutes from './routes/Usuarios.routes.js'

import errorHandler from './middlewares/errorHandler.js';

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

import cors from 'cors';


const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

// 2. Atualização Importante no CORS
app.use(cors({
  origin: function (origin, callback) {
    // Permite requests sem origin (Postman, Render healthcheck etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  // ADICIONE ISSO: Permite que o Front envie o Token no header
  allowedHeaders: ['Content-Type', 'Authorization'], 
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

app.use(express.json());
app.use(cookieParser());

// app.use((req, res, next) => {
//     console.log('REQ GLOBAL:', req.method, req.url);
//     next();
// });

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
        withCredentials: true, // 👈 ESSENCIAL: Isso força o Swagger a enviar o cookie
    },
}));

app.use('/auth', authRoutes)
app.use('/permissoes', permissoesRoutes)
app.use('/usuarios', usuariosRoutes)

app.use(errorHandler)

export default app;