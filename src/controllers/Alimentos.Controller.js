import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const listarAlimentos = async (req, res, next) => {

    try {

        const {
            page = 1,
            // limit = 10,
            search = '',
            categoria_alimento_id,
            status = 'todos'
        } = req.query;

        // const offset = (page - 1) * limit;

        const query = connection('alimentos')
            .join('categorias_alimentos', 'alimentos.categoria_id', '=', 'categorias_alimentos.id')
            .whereNull('alimentos.deletado_em')

        // Filtros dinâmicos
        if (search) {
            query.where('alimentos.nome', 'ILIKE', `%${search}%`)
        }

        if (categoria_alimento_id) {
            query.where('alimentos.categoria_id', categoria_alimento_id)
        }

        if (status === 'ativo') {
            query.where('alimentos.ativo', true)
        }

        //  console.log("SQL GERADO: ", query.toString());

        const total = await query.clone().count('alimentos.id AS total').first();

        const alimentos = await query
            .select([
                'alimentos.*',
                'categorias_alimentos.nome AS categoria_nome',
                'categorias_alimentos.id AS categoria_id',
                'categorias_alimentos.limite_escolhas'
            ])
            // .limit(limit)
            // .offset(offset)
            .orderBy('alimentos.nome', 'ASC')

        return res.status(200).json({
            status: 'success',
            pagination: { total: parseInt(total.total), page: parseInt(page) },
            data: alimentos
        });

    } catch (error) {
        next(error)
    }

}

// export const listarAlimentosAdmin = async (req, res, next) => {
//     try {
//         const {
//             page = 1, limit = 10, search = '',
//             sort = 'id', order = 'ASC', excluidos = 'mixed'
//         } = req.query;

//         const offset = (page - 1) * limit;

//         const query = connection('alimentos as a')
//             .leftJoin('categorias_alimentos as c', 'a.categoria_id', 'c.id')
//             .select([
//                 'a.id',
//                 'a.nome',
//                 'a.categoria_id',
//                 'a.disponivel_hoje',
//                 'a.deletado_em',
//                 'c.nome as categoria_nome'
//             ]);

//         if (excluidos === 'false') query.whereNull('a.deletado_em');
//         if (excluidos === 'true') query.whereNotNull('a.deletado_em');

//         if (search) {
//             query.andWhere(function () {
//                 this.where('a.nome', 'ilike', `%${search}%`);
//             });
//         }

//         const countQuery = await query.clone().clearSelect().count('a.id AS total').first();
//         const { total } = countQuery || { total: 0 };

//         // Evita ambiguidade na ordenação adicionando o prefixo da tabela
//         const sortColumn = sort === 'nome' ? 'a.nome' : `a.${sort}`;

//         const alimentos = await query
//             .orderBy(sortColumn, order)
//             .limit(limit)
//             .offset(offset);

//         return res.json({
//             status: 'success',
//             data: alimentos,
//             pagination: {
//                 total: parseInt(total || 0),
//                 page: parseInt(page),
//                 last_page: Math.ceil((total || 0) / limit)
//             }
//         });

//     } catch (error) {
//         next(error);
//     }
// };

export const listarAlimentosAdmin = async (req, res, next) => {
    try {
        const {
            page = 1, limit = 10, search = '',
            sort = 'id', order = 'ASC', excluidos = 'mixed'
        } = req.query;

        const offset = (page - 1) * limit;

        const query = connection('alimentos as a')
            .leftJoin('categorias_alimentos as c', 'a.categoria_id', 'c.id')
            .select([
                'a.id',
                'a.nome',
                'a.categoria_id',
                'a.disponivel_hoje',
                'a.deletado_em',
                'c.nome as categoria_nome'
            ]);

        if (excluidos === 'false') query.whereNull('a.deletado_em');
        if (excluidos === 'true') query.whereNotNull('a.deletado_em');

        if (search) {
            query.andWhere(function () {
                this.where('a.nome', 'ilike', `%${search}%`);
            });
        }

        const countQuery = await query.clone().clearSelect().count('a.id AS total').first();
        const { total } = countQuery || { total: 0 };

        // 🚀 SOLUÇÃO: Dicionário que mapeia o "sort" do frontend para a tabela correta do banco
        const colunasOrdenacaoValidas = {
            id: 'a.id',
            nome: 'a.nome',
            categoria_id: 'a.categoria_id',
            disponivel_hoje: 'a.disponivel_hoje',
            deletado_em: 'a.deletado_em',
            categoria_nome: 'c.nome' // Aqui é o "pulo do gato": aponta para a tabela "c"
        };

        // Se o frontend mandar algo bizarro, cai no padrão (a.id)
        const sortColumn = colunasOrdenacaoValidas[sort] || 'a.id';

        // Garante que o order é ASC ou DESC
        const direcao = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const alimentos = await query
            .orderBy(sortColumn, direcao)
            .limit(limit)
            .offset(offset);

        return res.json({
            status: 'success',
            data: alimentos,
            pagination: {
                total: parseInt(total || 0),
                page: parseInt(page),
                last_page: Math.ceil((total || 0) / limit)
            }
        });

    } catch (error) {
        next(error);
    }
};

export const buscarAlimentoPorId = async (req, res, next) => {
    try {
        const { id } = req.params;
        const alimento = await connection('alimentos').where({ id }).first();

        if (!alimento) return next(lancarErro('Alimento não encontrado.', 404));

        return res.status(200).json({ status: 'success', data: alimento });
    } catch (error) {
        next(error);
    }
}

export const criarAlimento = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { nome, descricao, categoria_id } = req.body;
    const usuario_id = req.usuario.id;

    if (!nome || !categoria_id) {
        return next(lancarErro('Nome e categoria do alimento são obrigatórios', 400));
    }

    const nomeFormatado = nome.trim().toUpperCase();
    const trx = await connection.transaction();

    try {
        const categoriaAlimento = await connection('categorias_alimentos')
            .transacting(trx)
            .where('id', categoria_id)
            .whereNull('deletado_em')
            .forUpdate()
            .first();

        if (!categoriaAlimento) {
            await trx.rollback();
            return next(lancarErro('A categoria do alimento não existe ou foi removida', 400));
        }

        // Verifica se já existe outro alimento ativo com o mesmo nome.
        const alimentoExistente = await connection('alimentos')
            .transacting(trx)
            .where('nome', nomeFormatado)
            .whereNull('deletado_em')
            .first();

        if (alimentoExistente) {
            await trx.rollback();
            return next(lancarErro(`Já existe um alimento cadastrado com o nome "${nomeFormatado}".`, 409));
        }

        const [novoAlimento] = await connection('alimentos')
            .transacting(trx)
            .insert({
                nome: nomeFormatado,
                descricao,
                categoria_id
            })
            .returning('*');

        // Registra a criação do alimento no histórico de auditoria.
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id,
                acao: 'ALIMENTO.CRIAR',
                descricao: `Criou o alimento ${novoAlimento.nome} na categoria ${categoriaAlimento.nome}`,
                payload: JSON.stringify(novoAlimento)
            });

        await trx.commit();

        return res.status(201).json({
            status: 'success',
            data: novoAlimento
        });
    } catch (error) {
        await trx.rollback();

        // PostgreSQL 23505 = violação de restrição UNIQUE.
        if (error.code === '23505' && error.constraint === 'idx_nome_alimento_ativo') {
            return next(lancarErro(`Já existe um alimento cadastrado com o nome "${nomeFormatado}".`, 409));
        }

        return next(error);
    }
};


export const editarAlimento = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { id } = req.params;
    const {
        nome,
        descricao,
        categoria_id,
        disponivel_hoje
    } = req.body;

    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();

    try {

        const alimentoAtual = await connection('alimentos')
            .transacting(trx)
            .where('id', id)
            .whereNull('deletado_em')
            .forUpdate()
            .first();

        if (!alimentoAtual) {
            await trx.rollback();
            return next(lancarErro('Alimento não encontrado', 404));
        }

        const camposParaAtualizar = {};

        if (nome !== undefined && nome.trim().toUpperCase() !== alimentoAtual.nome) {

            const jaExiste = await connection('alimentos')
                .transacting(trx)
                .where('nome', nome.trim().toUpperCase())
                .whereNot('id', id)
                .whereNull('deletado_em')
                .first()

            if (jaExiste) {
                await trx.rollback();
                return next(lancarErro(`Já existe um alimento cadastrado com o nome "${nome.trim().toUpperCase()}".`, 409));
            }
            camposParaAtualizar.nome = nome.trim().toUpperCase();

        }

        if (categoria_id !== undefined && categoria_id !== alimentoAtual.categoria_id) {

            const categoriaValida = await connection('categorias_alimentos')
                .transacting(trx)
                .where('id', categoria_id)
                .whereNull('deletado_em')
                .first()

            if (!categoriaValida) {
                await trx.rollback();
                return next(lancarErro('Categoria inválida ou removida', 400))
            }

            camposParaAtualizar.categoria_id = categoria_id;

        }

        if (disponivel_hoje !== undefined) {
            if (typeof disponivel_hoje !== 'boolean') {
                await trx.rollback();
                return next(lancarErro('O campo disponível_hoje deve ser verdadeiro ou falso', 400))
            }

            camposParaAtualizar.disponivel_hoje = disponivel_hoje;

        }

        if (descricao !== undefined) {
            camposParaAtualizar.descricao = descricao;
        }

        if (Object.keys(camposParaAtualizar).length === 0) {
            await trx.rollback(); // Importante para liberar a conexão
            return res.status(200).json({
                status: 'success',
                message: 'Nenhum dado alterado, os valores já são os mesmos.',
                data: alimentoAtual
            });
        }

        // Update
        const [alimentoAtualizado] = await connection('alimentos')
            .transacting(trx)
            .where('id', id)
            .update(camposParaAtualizar)
            .returning('*')

        const alteracoes = Object.keys(camposParaAtualizar).join(', ');

        // Logs de auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: usuario_id,
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'ALIMENTO.EDITAR',
                descricao: `Editou o alimento #${id} (${alimentoAtualizado.nome}). Campos alterados: ${alteracoes}`,
                payload: JSON.stringify({
                    antigo: alimentoAtual,
                    novo: camposParaAtualizar
                })
            });

        await trx.commit();
        return res.status(200).json({
            status: 'success',
            data: alimentoAtualizado
        });

    } catch (error) {
        await trx.rollback();

        // Proteção final caso duas alterações simultâneas tentem usar o mesmo nome.
        if (error.code === '23505' && error.constraint === 'idx_nome_alimento_ativo') {
            const nomeFormatado = nome?.trim().toUpperCase();
            return next(lancarErro(`Já existe um alimento cadastrado com o nome "${nomeFormatado}".`, 409));
        }

        return next(error);
    }
}


export const inativarAlimento = async (req, res, next) => {
    const trx = await connection.transaction();
    try {
        const { id } = req.params;

        const alimento = await connection('alimentos')
            .transacting(trx).where({ id }).whereNull('deletado_em').first();

        if (!alimento) {
            await trx.rollback();
            return res.status(404).json({ message: 'Alimento não encontrado ou já inativo' });
        }

        await connection('alimentos')
            .transacting(trx)
            .where({ id })
            .update({
                disponivel_hoje: false,
                deletado_em: connection.fn.now()
            });

        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id: req.usuario.id,
            metodo: req.method,
            endpoint: req.originalUrl,
            acao: 'ALIMENTO.INATIVAR',
            descricao: `${req.usuario.nome || 'Usuário'} inativou o alimento ${alimento.nome}`,
            payload: JSON.stringify({ id_afetado: id })
        });

        await trx.commit();
        res.status(200).json({ message: 'Alimento inativado!' });
    } catch (error) {
        if (trx) await trx.rollback();
        next(error);
    }
};

export const reativarAlimento = async (req, res, next) => {
    const trx = await connection.transaction();
    try {
        const { id } = req.params;

        const alimento = await connection('alimentos')
            .transacting(trx)
            .where({ id })
            .whereNotNull('deletado_em')
            .first();

        if (!alimento) {
            await trx.rollback();
            return res.status(404).json({ message: 'Alimento não encontrado ou já ativo' });
        }

        await connection('alimentos')
            .transacting(trx)
            .where({ id })
            .update({
                disponivel_hoje: true,
                deletado_em: null
            });

        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id: req.usuario.id,
            metodo: req.method,
            endpoint: req.originalUrl,
            acao: 'ALIMENTO.REATIVAR',
            descricao: `${req.usuario.nome || 'Usuário'} reativou o alimento ${alimento.nome}`,
            payload: JSON.stringify({ id_afetado: id })
        });

        await trx.commit();
        res.status(200).json({ message: 'Alimento reativado!' });
    } catch (error) {
        if (trx) await trx.rollback();
        next(error);
    }
};
// 🚀 1. Função para ligar/desligar a chavinha de um único alimento
export const alternarDisponibilidade = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { disponivel_hoje } = req.body;

        if (typeof disponivel_hoje !== 'boolean') {
            return res.status(400).json({ message: 'O valor de disponivel_hoje deve ser um booleano (true ou false).' });
        }

        const atualizados = await connection('alimentos')
            .where({ id })
            .update({ disponivel_hoje });

        if (atualizados === 0) {
            return res.status(404).json({ message: 'Alimento não encontrado.' });
        }

        return res.status(200).json({
            status: 'success',
            message: `Disponibilidade do alimento ${id} alterada para ${disponivel_hoje}`
        });
    } catch (error) {
        next(error);
    }
};

// 🚀 2. Função "Fechar Loja": Desliga a chavinha de todos os alimentos ativos de uma vez
export const zerarCardapio = async (req, res, next) => {
    const trx = await connection.transaction();
    try {
        // Atualiza todos os alimentos para indisponível (apenas os que não foram excluídos)
        await connection('alimentos')
            .transacting(trx)
            .whereNull('deletado_em')
            .update({ disponivel_hoje: false });

        await connection('status_loja')
            .transacting(trx)
            // .where('id', req.usuario.tenant_id)
            .update({ esta_aberta: false });

        // Salva no log de auditoria quem apertou o botão de fechar a loja
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id: req.usuario.id, // Certifique-se de que o ID do usuário vem do seu middleware de auth
                metodo: req.method,
                endpoint: req.originalUrl,
                acao: 'CARDAPIO.ZERAR',
                descricao: `O usuário zerou o cardápio (Encerrou expediente)`,
                payload: JSON.stringify({ acao: 'zerar_cardapio_diario' })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            message: 'Cardápio zerado com sucesso. Expediente encerrado!'
        });
    } catch (error) {
        if (trx) await trx.rollback();
        next(error);
    }
};

// 🚀 Função da Vitrine do Cliente
export const listarCardapioParaCliente = async (req, res, next) => {
    try {
        const alimentos = await connection('alimentos as a')
            .leftJoin('categorias_alimentos as c', 'a.categoria_id', 'c.id')
            .select([
                'a.id',
                'a.nome',
                'a.descricao',
                'c.limite_escolhas',
                'c.nome as categoria_nome'
            ])
            .where('a.disponivel_hoje', true)
            .whereNull('a.deletado_em')
            .where('a.disponivel_hoje', true)
            .orderBy('c.id', 'ASC')
            .orderBy('a.nome', 'ASC');

        return res.status(200).json({
            status: 'success',
            data: alimentos
        });
    } catch (error) {
        next(error);
    }
};