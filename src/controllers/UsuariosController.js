import connection from "../database/connection.js";
import { hashPassword } from "../utils/password.utils.js";
// import bcrypt from "bcryptjs";


function isValidEmail(email) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

function isValidPassword(password) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;
    return regex.test(password);
}

export const criarUsuario = async (req, res, next) => {
    try {
        const { nome, email, senha, nivel_acesso_id } = req.body;

        console.log(req.body);

        if (!nome || !email || !senha) {
            return res.status(400).json({
                status: 'fail',
                message: 'Preencha todos os campos corretamente'
            })
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({
                status: 'fail',
                message: 'Email inválido'
            })
        }

        if (senha && !isValidPassword(senha)) {
            return res.status(400).json({
                status: 'fail',
                message: 'A senha deve ter no mínimo 12 caracteres, contendo maiúsculas, minúsculas, números e caracteres especiais'
            })
        }

        if (!nivel_acesso_id) {
            return res.status(400).json({
                status: "fail",
                message: "O campo nivel_acesso_id é obrigatório."
            });
        }

        const usuarioExiste = await connection('usuarios')
            .where({ email })
            .first();

        if (usuarioExiste) {
            return res.status(400).json({
                status: 'fail',
                message: 'Este email já está em uso.'
            })
        }


        const passwordHash = await hashPassword(senha);

        const [novoUsuario] = await connection('usuarios')
            .insert({
                nome: nome,
                email: email,
                senha_hash: passwordHash, // Supondo que sua coluna no banco se chame 'senha'
                nivel_acesso_id: nivel_acesso_id
            })
            .returning(['id', 'nome', 'email']);

        return res.status(201).json({
            status: 'success',
            data: novoUsuario
        })


    } catch (error) {
        next(error)
    }
}

export const listarUsuarios = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            sort = 'usuarios.nome',
            order = 'ASC',
            deletados = 'false'
        } = req.query;

        const offset = (page - 1) * limit;

        const query = connection('usuarios')
            .join('niveis_acesso', 'usuarios.nivel_acesso_id', '=', 'niveis_acesso.id')
            .select([
                'usuarios.id',
                'usuarios.nome',
                'usuarios.email',
                // 'usuarios.nivel_acesso_id',
                'niveis_acesso.nome AS cargo',
                'usuarios.ativo',
                'usuarios.criado_em',
                'usuarios.deletado_em'
            ])

        if (deletados === 'false') {
            query.whereNull('usuarios.deletado_em')
        } else if (deletados === 'true') {
            query.whereNotNull('usuarios.deletado_em')
        }

        if (search) {
            query.andWhere(function () {
                this.where('usuarios.nome', 'ilike', `%${search}%`)
                    .orWhere('usuarios.email', 'ilike', `%${search}%`)
            })
        }

        const countQuery = query.clone().clearSelect().count('usuarios.id AS total').first();

        const { total } = await countQuery;

        const users = await query
            .orderBy(sort, order)
            .limit(limit)
            .offset(offset)

        return res.json({
            status: 'success',
            data: users,
            pagination: {
                total: parseInt(total || 0),
                page: parseInt(page),
                lastPage: Math.ceil((total || 0) / limit)
            }
        })


    } catch (error) {
        next(error);
    }
}

// export const listarUsuarioPorId = async (req, res, next) => { 
//     try {
//         const { id } = req.params;

//         const query = await connection('usuarios')
//         .where
//     } catch (error) {
        
//     }
// }