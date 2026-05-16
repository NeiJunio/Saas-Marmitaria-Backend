import connection from "../database/connection.js";
import { hashPassword } from "../utils/passwordUtils.js";
import { lancarErro } from "../utils/errorUtils.js";

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
    // 1. Validações de Formato (Fail Fast) - Fora da Transaction
    const { nome, email, senha, nivel_acesso_id } = req.body;

    if (!nome || !email || !senha || !nivel_acesso_id) {
        return next(lancarErro('Preencha todos os campos corretamente.', 400));
    }

    if (!isValidEmail(email)) {
        return next(lancarErro('E-mail inválido.', 400));
    }

    if (!isValidPassword(senha)) {
        return next(lancarErro('A senha não atende aos requisitos de segurança.', 400));
    }

    // Iniciamos a transação
    const trx = await connection.transaction();

    try {
        // 2. Verificar se o e-mail já existe (ignora se está deletado ou não, 
        // pois e-mail costuma ser chave única global no sistema)
        const usuarioExiste = await connection('usuarios')
            .transacting(trx)
            .where({ email: email.toLowerCase() })
            .first();

        if (usuarioExiste) {
            await trx.rollback();
            return next(lancarErro('Este e-mail já está em uso.', 400));
        }

        // 3. Hash da senha
        const passwordHash = await hashPassword(senha);

        // 4. Inserção do Usuário
        const [novoUsuario] = await connection('usuarios')
            .transacting(trx)
            .insert({
                nome: nome.trim(),
                email: email.toLowerCase(),
                senha_hash: passwordHash,
                nivel_acesso_id: nivel_acesso_id,
                ativo: true // Garantimos que ele nasce ativo
            })
            .returning(['id', 'nome', 'email', 'nivel_acesso_id']);

        // 5. Log de Auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario?.id || novoUsuario.id, // Se for um auto-cadastro, usa o ID do novo
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'USUARIOS.CRIAR',
                descricao: `Novo usuário cadastrado: ${novoUsuario.nome} (ID: ${novoUsuario.id})`,
                payload: JSON.stringify({
                    usuario_criado_id: novoUsuario.id,
                    nivel_acesso: novoUsuario.nivel_acesso_id,
                    contexto: {
                        ip: req.ip,
                        user_agent: req.headers['user-agent']
                    }
                })
            });

        await trx.commit();

        return res.status(201).json({
            status: 'success',
            data: novoUsuario
        });

    } catch (error) {
        if (trx) await trx.rollback();
        next(error);
    }
};

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

        const countQuery = await query.clone().clearSelect().count('usuarios.id AS total').first();

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

        if (!req.body || Object.keys(req.body).length === 0) {
            return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
        }

        const { id } = req.params;
        const { nome, email, nivel_acesso_id } = req.body;

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
                'nivel_acesso_id': nivel_acesso_id || usuarioExiste.nivel_acesso_id
                // 'atualizado_em': new Date()
            })
            .returning(['id', 'nome', 'email'])

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
    const trx = await connection.transaction();

    try {
        const { id } = req.params;

        // Alteramos a busca para encontrar o usuário se ele estiver ATIVO 
        // e não estiver deletado.
        const usuarioExiste = await connection('usuarios')
            .transacting(trx)
            .where('id', id)
            .where('ativo', true) // Só inativa quem está ativo
            .whereNull('deletado_em')
            .first();

        if (!usuarioExiste) {
            await trx.rollback();
            // Mensagem genérica para evitar confusão
            return res.status(404).json({ message: 'Usuário não encontrado ou já está inativo' });
        }

        const [usuario] = await connection('usuarios')
            .transacting(trx)
            .where('id', id)
            .update({
                ativo: false,
                deletado_em: connection.fn.now() // Mantemos o timestamp para auditoria
            })
            .returning(['nome']);

        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id: req.usuario.id,
            metodo: req.method,
            endpoint: req.originalUrl,
            acao: 'USUARIOS.INATIVAR',
            descricao: `${req.usuario.nome} inativou o acesso de ${usuario.nome}`,
            payload: JSON.stringify({ id_afetado: id })
        });

        await trx.commit();
        res.status(200).json({ message: 'Usuário inativado com sucesso!' });
    } catch (error) {
        if (trx) await trx.rollback();
        next(error);
    }
};

// Reativar o usuario (teste)
export const reativarUsuario = async (req, res, next) => {
    const trx = await connection.transaction();

    try {
        const { id } = req.params;

        // AQUI ESTÁ A CORREÇÃO:
        // Buscamos o usuário se ele estiver inativo OU se tiver data de deleção
        const usuarioInativo = await connection('usuarios')
            .transacting(trx)
            .where('id', id)
            .andWhere(function() {
                this.where('ativo', false)
                    .orWhereNotNull('deletado_em');
            })
            .first();

        if (!usuarioInativo) {
            await trx.rollback();
            return res.status(404).json({ message: 'Usuário não encontrado ou já está ativo' });
        }

        const [usuario] = await connection('usuarios')
            .transacting(trx)
            .where('id', id)
            .update({
                ativo: true,
                deletado_em: null // Limpamos o timestamp independente de como foi inativado
            })
            .returning(['nome']);

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
        res.status(200).json({ message: 'Usuário reativado com sucesso!' });
    } catch (error) {
        if (trx) await trx.rollback();
        next(error);
    }
};