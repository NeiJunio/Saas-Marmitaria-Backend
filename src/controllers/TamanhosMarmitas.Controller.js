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

export const deletarTamanhoMarmita = async (req, res, next) => {

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