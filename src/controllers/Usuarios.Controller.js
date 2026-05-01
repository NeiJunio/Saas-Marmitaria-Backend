import connection from "../database/connection.js";
import { hashPassword } from "../utils/passwordUtils.js";
import { lancarErro } from "../utils/errorUtils.js";
// import bcrypt from "bcryptjs";

// Validador de email
function isValidEmail(email) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

// Validador de senha
function isValidPassword(password) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;
    return regex.test(password);
}

// Criando usuário
export const criarUsuario = async (req, res, next) => {
    try {
        const { nome, email, senha, nivel_acesso_id } = req.body;

        // console.log(req.body);

        if (!nome || !email || !senha) {
            lancarErro('Preencha todos os campos corretamente.');
        }

        if (email && !isValidEmail(email)) {
            lancarErro('E-mail inválido.');
        }

        if (senha && !isValidPassword(senha)) {
            lancarErro('A senha deve ter no mínimo 12 caracteres, contendo maiúsculas, minúsculas, números e caracteres especiais')
        }

        if (!nivel_acesso_id) {
            lancarErro("O campo nivel_acesso_id é obrigatório.");
        }

        const usuarioExiste = await connection('usuarios')
            .where({ email })
            .first();

        if (usuarioExiste) {
            lancarErro('Este email já está em uso.')
        }


        const passwordHash = await hashPassword(senha);

        const [novoUsuario] = await connection('usuarios')
            .insert({
                nome: nome,
                email: email.toLowerCase(),
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

// Listando todos os usuários
export const listarUsuarios = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            // sort = 'usuarios.nome',
            sort = 'usuarios.id',
            order = 'ASC',
            deletados = 'all'
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

// Listando usuário pelo ID
export const listarUsuarioPorId = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id) {
            lancarErro('O campo id é obrigatório.')
        }

        const query = await connection('usuarios')
            .join('niveis_acesso', 'usuarios.nivel_acesso_id', '=', 'niveis_acesso.id')
            .where('usuarios.id', id)
            .select([
                'usuarios.id',
                'usuarios.nome',
                'usuarios.email',
                'usuarios.senha_hash',
                'usuarios.nivel_acesso_id',
                'niveis_acesso.nome AS cargo',
                'usuarios.ativo',
                // 'usuarios.criado_em',
                connection.raw(`
                    TO_CHAR(usuarios.criado_em, 'DD/MM/YYYY HH24:MI:SS') AS criado_em,
                    TO_CHAR(usuarios.atualizado_em, 'DD/MM/YYYY HH24:MI:SS') AS atualizado_em`),
                'usuarios.deletado_em',
            ])


        if (!query || query.length === 0) {
            lancarErro('Usuário não encontrado.', 404)
        }

        const usuario = query[0];
        delete usuario.senha_hash; // Remover a senha do resultado

        res.status(200).json({
            status: 'success',
            data: usuario
        })
    } catch (error) {
        next(error);
    }
}

// Edição do usuário
export const editarUsuario = async (req, res, next) => {

    const trx = await connection.transaction();

    try {
        
        if (!req.body) {
            lancarErro('O corpo da requisição não pode estar vazio.', 400)
        }

        const { id } = req.params;
        const { nome, email, nivel_acesso_id, ativo } = req.body;

        const usuarioExiste = await connection('usuarios')
            .transacting(trx)
            .join('niveis_acesso', 'usuarios.nivel_acesso_id', '=', 'niveis_acesso.id')
            .where('usuarios.id', id)
            .whereNull('usuarios.deletado_em')
            .select(
                'usuarios.*',
                'niveis_acesso.nome as cargo'
            )
            .first()

        if (!usuarioExiste) {
            lancarErro('Usuário não encontrado', 404);
        }

        if (
            usuarioExiste.cargo === 'admin' &&
            req.usuario.cargo !== 'admin'
        ) {
            lancarErro('Você não tem permissão para editar um administrador', 403);
        }

        if (email && email.toLowerCase() !== usuarioExiste.email) {
            const emailConflitante = await connection('usuarios')
                .transacting(trx)
                .where('usuarios.email', email.toLowerCase())
                .whereNot('usuarios.id', id)  // 👈 IMPORTANTE: Ignora o próprio usuário
                .first();

            if (emailConflitante) {
                lancarErro('O email já está em uso')
            }
        }

        const [usuarioAtualizado] = await connection('usuarios')
            .transacting(trx)
            .where('usuarios.id', id)
            .update({
                'nome': nome || usuarioExiste.nome,
                'email': email || usuarioExiste.email,
                'nivel_acesso_id': nivel_acesso_id || usuarioExiste.nivel_acesso_id,
                'ativo': ativo !== undefined ? ativo : usuarioExiste.ativo
                // 'atualizado_em': new Date()
            })
            .returning(['id', 'nome', 'email', 'ativo'])

        // Log de auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'USUARIOS.EDITAR',
                descricao: `O colaborador ${req.usuario.nome} editou os dados de ${usuarioAtualizado.nome} (ID: ${id})`,
                payload: JSON.stringify({
                    dados_enviados: req.body,
                    usuario_agetado_id: id
                })
            })


        await trx.commit();

        res.status(200).json({
            status: 'success',
            message: 'Coladorador atualizado com sucesso',
            data: usuarioAtualizado
        })

    } catch (error) {

        if (trx) {

            await trx.rollback();
        }

        next(error);

    }

}

// Inativação do usuário
export const inativarUsuario = async (req, res, next) => {

    const trx = await connection.transaction()

    try {
        const { id } = req.params

        const usuarioExiste = await connection('usuarios')
            .transacting(trx)
            .where('usuarios.id', id)
            .whereNull('deletado_em')
            .first()

        if (!usuarioExiste) {
            await trx.rollback()
            lancarErro('Usuário não encontrado ou já se encontra inativo', 404);
        }

        const [usuario] = await connection('usuarios')
            .transacting(trx)
            .where('usuarios.id', id)
            .update({
                ativo: false,
                deletado_em: new Date()
            })
            .returning(['nome'])

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'USUARIOS.INATIVAR',
                descricao: `${req.usuario.nome} inativou o acesso de ${usuario.nome}`,
                payload: JSON.stringify({ id_afetado: id })
            })

        await trx.commit();
        res.status(200).json({
            status: 'success',
            message: 'Usuário inativado com sucesso!'
        });
    } catch (error) {

        if (trx) {

            await trx.rollback();
        }

        next(error);

    }
}


// Reativação do usuário
export const reativarUsuario = async (req, res, next) => {

    const trx = await connection.transaction();

    try {

        const { id } = req.params;

        const usuarioExiste = await connection('usuarios')
            .transacting(trx)
            .where('usuarios.id', id)
            .whereNotNull('deletado_em')
            .first()

        if (!usuarioExiste) {

            await trx.rollback()

            lancarErro('Usuário não encontrado ou já se encontra ativo', 404);

        }

        const [usuario] = await connection('usuarios')
            .transacting(trx)
            .where('usuarios.id', id)
            .update({
                ativo: true,
                deletado_em: null
            })
            .returning(['nome'])

        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id: req.usuario.id,
            metodo: req.method,
            endpoint: req.originalUrl,
            acao: 'USUARIOS.ATIVAR',
            descricao: `${req.usuario.nome} reativou o acesso de ${usuario.nome}`,
            payload: JSON.stringify({ id_afetado: id })
        });

        await trx.commit();

        res.status(200).json({
            status: 'success',
            message: 'Usuário reativado com sucesso!'
        });

    } catch (error) {

        if (trx) {

            await trx.rollback();
        }

        next(error);
    }
}
