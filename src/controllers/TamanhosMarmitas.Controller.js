import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const listarTamanhosMarmitas = async (req, res, next) => {
    try {
        const tamanhos = await connection('tamanhos_marmitas')
            .whereNull('deletado_em') // Ignora os excluídos (Soft Delete)
            .where('ativo', true)      // Mostra apenas o que está disponível para venda
            .orderBy('preco_base', 'asc'); // Organiza do mais barato ao mais caro

        return res.status(200).json({
            status: 'success',
            results: tamanhos.length,
            data: tamanhos
        });
    } catch (error) {
        next(error);
    }
};

export const listarTamanhosMarmitasAdmin = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            sort = 'id',
            order = 'ASC',
            deletados = 'all'
        } = req.query;

        const offset = (page - 1) * limit;

        const query = connection('tamanhos_marmitas')
            .select([
                'id',
                'nome',
                'preco_base',
                'ativo',
                'deletado_em'
            ]);

        if (deletados === 'false') {
            query.whereNull('deletado_em');
        } else if (deletados === 'true') {
            query.whereNotNull('deletado_em');
        }

        if (search) {
            query.andWhere(function () {
                this.where('nome', 'ilike', `%${search}%`);
            });
        }

        const countQuery = await query.clone().clearSelect().count('id AS total').first();

        const { total } = countQuery || { total: 0 };

        const tamanhos = await query
            .orderBy(sort, order)
            .limit(limit)
            .offset(offset);

        return res.json({
            status: 'success',
            data: tamanhos,
            pagination: {
                total: parseInt(total || 0),
                page: parseInt(page),
                lastPage: Math.ceil((total || 0) / limit)
            }
        });

    } catch (error) {
        next(error);
    }
};

export const buscarTamanhoMarmitaPorId = async (req, res, next) => {
    try {
        const { id } = req.params;

        const tamanho = await connection('tamanhos_marmitas')
            .where({ id })
            .first();

        if (!tamanho) {
            return res.status(404).json({ 
                status: 'error',
                message: 'Tamanho de marmita não encontrado.' 
            });
        }

        return res.status(200).json({
            status: 'success',
            data: tamanho
        });
    } catch (error) {
        next(error);
    }
};

export const criarTamanhoMarmita = async (req, res, next) => {

    const { nome, preco_base } = req.body;
    const usuario_id = req.usuario.id;

    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
        return next(lancarErro('O nome do tamanho é obrigatório.', 400));
    }
    if (preco_base === undefined || typeof preco_base !== 'number' || preco_base < 0) {
        return next(lancarErro('O preço base deve ser um número válido e maior ou igual a zero.', 400));
    }

    const trx = await connection.transaction()

    try {

        const nomeFormatado = nome.trim().toUpperCase();

        const tamanhoExistente = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where('nome', nomeFormatado)
            .whereNull('deletado_em')
            .first();

        if (tamanhoExistente) {
            await trx.rollback();
            return next(lancarErro(`O tamanho "${nomeFormatado}" já está cadastrado no sistema.`, 400));
        }

        const [novoTamanho] = await connection('tamanhos_marmitas')
            .transacting(trx)
            .insert({
                nome: nomeFormatado,
                preco_base: preco_base
            })
            .returning('*')

        //Logs de Auditoria
        await connection('logs').transacting(trx).insert({
            tipo: 'ACAO',
            usuario_id,
            acao: 'TAMANHO.CRIAR',
            descricao: `Criou novo tamanho: ${novoTamanho.nome} com preço base R$ ${novoTamanho.preco_base}`,
            payload: JSON.stringify(novoTamanho)
        });

        await trx.commit()

        return res.status(201).json({
            status: 'success',
            data: novoTamanho
        })

    } catch (error) {

        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
}

export const editarTamanhoMarmita = async (req, res, next) => {

    const { id } = req.params;

    const { nome, preco_base, ativo } = req.body;
    const usuario_id = req.usuario.id;

    if (nome === undefined && preco_base === undefined && ativo === undefined) {
        return next(lancarErro('Nenhum dado informado para atualização.', 400));
    }

    const trx = await connection.transaction();

    try {
        const tamanhoAntigo = await connection('tamanhos_marmitas')
            .where({ id })
            .whereNull('deletado_em')
            .first();

        if (!tamanhoAntigo) {
            await trx.rollback();
            return next(lancarErro('Tamanho não encontrado', 404));
        }

        const camposParaAtualizar = {};

        if (nome !== undefined) {
            if (typeof nome !== 'string' || nome.trim() === '') return next(lancarErro('Nome inválido.', 400));
            camposParaAtualizar.nome = nome.trim().toUpperCase();
        }

        if (preco_base !== undefined) {
            if (typeof preco_base !== 'number' || preco_base < 0) return next(lancarErro('Preço inválido.', 400));
            camposParaAtualizar.preco_base = preco_base;
        }

        if (ativo !== undefined) {
            if (typeof ativo !== 'boolean') return next(lancarErro('O campo ativo deve ser booleano.', 400));
            camposParaAtualizar.ativo = ativo;
        }

        const [tamanhoAtualizado] = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .update(camposParaAtualizar)
            .returning('*');

        // Gerar descrição baseada no que mudou
        let mudancas = Object.keys(camposParaAtualizar);

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id,
                acao: 'TAMANHO.EDITAR',
                descricao: `Editou tamanho #${id}. Alterou: ${mudancas.join(', ')}`,
                payload: JSON.stringify({
                    antes: tamanhoAntigo,
                    depois: tamanhoAtualizado
                })
            });

        await trx.commit();

        return res.status(200).json({
            status: 'success',
            data: tamanhoAtualizado
        });

    } catch (error) {
        if (trx) {
            await trx.rollback();
        }

        next(error);
    }
};

export const inativarTamanhoMarmita = async (req, res, next) => {

    const { id } = req.params;
    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();

    try {
        // 1. Validação de existência: Busca o registro antes de agir
        const tamanho = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .whereNull('deletado_em')
            .first();

        if (!tamanho) {
            await trx.rollback();
            return next(lancarErro('Tamanho não encontrado. Não é possível excluir um registro inexistente.', 404));
        }

        // 2. Ação de desativação (Soft Delete)
        await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .update({
                ativo: false,
                deletado_em: connection.fn.now()
            });

        // 3. Log de Auditoria (Agora garantido que o nome existe)
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id,
                acao: 'TAMANHO.DELETAR',
                descricao: `Removeu o tamanho #${id} (${tamanho.nome})`,
                payload: JSON.stringify({
                    id,
                    nome: tamanho.nome
                })
            });

        await trx.commit();
        return res.status(200).json({
            status: 'success',
            message: `Tamanho "${tamanho.nome}" removido com sucesso.`
        });

    } catch (error) {
        if (trx) await trx.rollback();
        next(error);
    }
};

export const reativarTamanhoMarmita = async (req, res, next) => {

    const { id } = req.params;
    const usuario_id = req.usuario.id;

    const trx = await connection.transaction();

    try {
        // 1. Validação: Busca o tamanho se ele estiver inativo OU se tiver data de deleção
        const tamanhoInativo = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .andWhere(function() {
                this.where('ativo', false)
                    .orWhereNotNull('deletado_em');
            })
            .first();

        if (!tamanhoInativo) {
            await trx.rollback();
            return next(lancarErro('Tamanho não encontrado ou já está ativo.', 404));
        }

        // 2. Ação de reativação (Removendo o Soft Delete)
        await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .update({
                ativo: true,
                deletado_em: null // Limpa o timestamp para restaurar o registro
            });

        // 3. Log de Auditoria
        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id,
                acao: 'TAMANHO.REATIVAR',
                descricao: `Reativou o tamanho #${id} (${tamanhoInativo.nome})`,
                payload: JSON.stringify({
                    id,
                    nome: tamanhoInativo.nome
                })
            });

        await trx.commit();
        
        return res.status(200).json({
            status: 'success',
            message: `Tamanho "${tamanhoInativo.nome}" reativado com sucesso.`
        });

    } catch (error) {
        if (trx) await trx.rollback();
        next(error);
    }
};