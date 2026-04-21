import jwt from "jsonwebtoken";
import connection from "../database/connection.js";
import { comparePassword } from "../utils/password.utils.js";

export const login = async (req, res, next) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                status: 'fail',
                message: 'Email e Senha são obrigatórios'
            })
        }

        const query = await connection('usuarios')
            .join('niveis_acesso', 'usuarios.nivel_acesso_id', '=', 'niveis_acesso.id')
            .where('usuarios.email', email)
            .andWhere("usuarios.deletado_em", null)
            .select([
                'usuarios.id',
                'usuarios.nome',
                'usuarios.senha_hash',
                'usuarios.ativo',
                'niveis_acesso.nome AS cargo'
            ])
            .first()

        if (!query) {
            return res.status(401).json({
                status: 'fail',
                message: 'Email ou senha incorretos'
            })
        }

        if (query.ativo === false) {
            return res.status(403).json({
                status: 'fail',
                message: 'Sua conta está suspensa. Contate o Administrador'
            })
        }

        const senhaValida = await comparePassword(senha, query.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({
                status: 'fail',
                message: 'E-mail ou senha inválidos.'
            });
        }

        const token = jwt.sign(
            {
                id: query.id,
                cargo: query.cargo
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        )

        // Enviando cookie via HttpOnly
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 // 1 dia
        });

        return res.status(200).json({
            status: 'success',
            message: 'Login realizado com sucesso',
            data: {
                usuario: {
                    id: query.id,
                    nome: query.nome,
                    cargo: query.cargo
                }
            }
        })

    } catch (error) {
        next(error)
    }
} 