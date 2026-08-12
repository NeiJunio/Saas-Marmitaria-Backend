import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

function normalizarNome(nome) {
    return String(nome)
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function normalizarPreco(preco) {
    if (preco === undefined || preco === null || String(preco).trim() === '') {
        return null;
    }

    const valor = Number(
        typeof preco === 'string'
            ? preco.replace(',', '.')
            : preco
    );

    if (!Number.isFinite(valor) || valor < 0) {
        return null;
    }

    return Number(valor.toFixed(2));
}

export const listarTamanhosMarmitas = async (req, res, next) => {
    try {
        const tamanhos = await connection('tamanhos_marmitas')
            .whereNull('deletado_em')
            .where('ativo', true)
            .orderBy('preco_base', 'asc');

        return res.status(200).json({
            status: 'success',
            results: tamanhos.length,
            data: tamanhos
        });
    } catch (error) {
        return next(error);
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

        const pageNumber = Number.parseInt(page, 10) || 1;
        const limitNumber = Number.parseInt(limit, 10) || 10;
        const offset = (pageNumber - 1) * limitNumber;

        const colunasOrdenacao = {
            id: 'id',
            nome: 'nome',
            preco_base: 'preco_base',
            ativo: 'ativo',
            deletado_em: 'deletado_em'
        };

        const colunaOrdenacao = colunasOrdenacao[sort] || 'id';
        const direcao = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

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

        if (String(search).trim()) {
            query.andWhere('nome', 'ILIKE', `%${String(search).trim()}%`);
        }

        const countQuery = await query
            .clone()
            .clearSelect()
            .count('id AS total')
            .first();

        const total = Number(countQuery?.total || 0);

        const tamanhos = await query
            .orderBy(colunaOrdenacao, direcao)
            .limit(limitNumber)
            .offset(offset);

        return res.status(200).json({
            status: 'success',
            data: tamanhos,
            pagination: {
                total,
                page: pageNumber,
                lastPage: Math.max(Math.ceil(total / limitNumber), 1)
            }
        });
    } catch (error) {
        return next(error);
    }
};

export const buscarTamanhoMarmitaPorId = async (req, res, next) => {
    try {
        const { id } = req.params;

        const tamanho = await connection('tamanhos_marmitas')
            .where({ id })
            .first();

        if (!tamanho) {
            return next(lancarErro('Tamanho de marmita não encontrado.', 404));
        }

        return res.status(200).json({
            status: 'success',
            data: tamanho
        });
    } catch (error) {
        return next(error);
    }
};

export const criarTamanhoMarmita = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { nome, preco_base } = req.body;
    const usuario_id = req.usuario.id;

    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
        return next(lancarErro('O nome do tamanho é obrigatório.', 400));
    }

    const precoFormatado = normalizarPreco(preco_base);

    if (precoFormatado === null) {
        return next(lancarErro('O preço base deve ser um número válido e maior ou igual a zero.', 400));
    }

    const nomeFormatado = normalizarNome(nome);
    const trx = await connection.transaction();

    try {
        const tamanhoExistente = await connection('tamanhos_marmitas')
            .transacting(trx)
            .whereRaw('UPPER(TRIM(nome)) = ?', [nomeFormatado])
            .whereNull('deletado_em')
            .first();

        if (tamanhoExistente) {
            await trx.rollback();

            return next(
                lancarErro(
                    `Já existe um tamanho de marmita cadastrado com o nome "${nomeFormatado}".`,
                    409
                )
            );
        }

        const [novoTamanho] = await connection('tamanhos_marmitas')
            .transacting(trx)
            .insert({
                nome: nomeFormatado,
                preco_base: precoFormatado
            })
            .returning('*');

        await connection('logs')
            .transacting(trx)
            .insert({
                tipo: 'ACAO',
                usuario_id,
                acao: 'TAMANHO.CRIAR',
                descricao: `Criou novo tamanho: ${novoTamanho.nome} com preço base R$ ${novoTamanho.preco_base}`,
                payload: JSON.stringify(novoTamanho)
            });

        await trx.commit();

        return res.status(201).json({
            status: 'success',
            data: novoTamanho
        });
    } catch (error) {
        await trx.rollback();

        if (error.code === '23505') {
            return next(
                lancarErro(
                    `Já existe um tamanho de marmita cadastrado com o nome "${nomeFormatado}".`,
                    409
                )
            );
        }

        return next(error);
    }
};

export const editarTamanhoMarmita = async (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return next(lancarErro('O corpo da requisição não pode estar vazio.', 400));
    }

    const { id } = req.params;
    const { nome, preco_base, ativo } = req.body;
    const usuario_id = req.usuario.id;

    if (nome === undefined && preco_base === undefined && ativo === undefined) {
        return next(lancarErro('Nenhum dado informado para atualização.', 400));
    }

    if (nome !== undefined && (typeof nome !== 'string' || nome.trim() === '')) {
        return next(lancarErro('O nome do tamanho não pode ficar vazio.', 400));
    }

    let precoFormatado;

    if (preco_base !== undefined) {
        precoFormatado = normalizarPreco(preco_base);

        if (precoFormatado === null) {
            return next(lancarErro('O preço base deve ser um número válido e maior ou igual a zero.', 400));
        }
    }

    if (ativo !== undefined && typeof ativo !== 'boolean') {
        return next(lancarErro('O campo ativo deve ser true ou false.', 400));
    }

    const trx = await connection.transaction();
    let nomeFinalParaErro = nome ? normalizarNome(nome) : '';

    try {
        const tamanhoAntigo = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .whereNull('deletado_em')
            .forUpdate()
            .first();

        if (!tamanhoAntigo) {
            await trx.rollback();
            return next(lancarErro('Tamanho de marmita não encontrado.', 404));
        }

        const camposParaAtualizar = {};

        if (nome !== undefined) {
            const nomeFormatado = normalizarNome(nome);
            nomeFinalParaErro = nomeFormatado;

            if (nomeFormatado !== tamanhoAntigo.nome) {
                const tamanhoExistente = await connection('tamanhos_marmitas')
                    .transacting(trx)
                    .whereRaw('UPPER(TRIM(nome)) = ?', [nomeFormatado])
                    .whereNot('id', id)
                    .whereNull('deletado_em')
                    .first();

                if (tamanhoExistente) {
                    await trx.rollback();

                    return next(
                        lancarErro(
                            `Já existe um tamanho de marmita cadastrado com o nome "${nomeFormatado}".`,
                            409
                        )
                    );
                }

                camposParaAtualizar.nome = nomeFormatado;
            }
        }

        if (
            preco_base !== undefined &&
            precoFormatado !== Number(tamanhoAntigo.preco_base)
        ) {
            camposParaAtualizar.preco_base = precoFormatado;
        }

        if (ativo !== undefined && ativo !== tamanhoAntigo.ativo) {
            camposParaAtualizar.ativo = ativo;
        }

        if (Object.keys(camposParaAtualizar).length === 0) {
            await trx.rollback();

            return res.status(200).json({
                status: 'success',
                message: 'Nenhuma alteração necessária, os dados já são os mesmos.',
                data: tamanhoAntigo
            });
        }

        const [tamanhoAtualizado] = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .update(camposParaAtualizar)
            .returning('*');

        const mudancas = Object.keys(camposParaAtualizar);

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
        await trx.rollback();

        if (error.code === '23505') {
            return next(
                lancarErro(
                    `Já existe um tamanho de marmita cadastrado com o nome "${nomeFinalParaErro}".`,
                    409
                )
            );
        }

        return next(error);
    }
};

export const inativarTamanhoMarmita = async (req, res, next) => {
    const { id } = req.params;
    const usuario_id = req.usuario.id;
    const trx = await connection.transaction();

    try {
        const tamanho = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .whereNull('deletado_em')
            .forUpdate()
            .first();

        if (!tamanho) {
            await trx.rollback();

            return next(
                lancarErro(
                    'Tamanho não encontrado. Não é possível excluir um registro inexistente.',
                    404
                )
            );
        }

        await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .update({
                ativo: false,
                deletado_em: connection.fn.now()
            });

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
        await trx.rollback();
        return next(error);
    }
};

export const reativarTamanhoMarmita = async (req, res, next) => {
    const { id } = req.params;
    const usuario_id = req.usuario.id;
    const trx = await connection.transaction();
    let nomeTamanho = '';

    try {
        const tamanhoInativo = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .andWhere(function () {
                this
                    .where('ativo', false)
                    .orWhereNotNull('deletado_em');
            })
            .forUpdate()
            .first();

        if (!tamanhoInativo) {
            await trx.rollback();
            return next(lancarErro('Tamanho não encontrado ou já está ativo.', 404));
        }

        nomeTamanho = tamanhoInativo.nome;

        const tamanhoComMesmoNome = await connection('tamanhos_marmitas')
            .transacting(trx)
            .whereRaw('UPPER(TRIM(nome)) = ?', [normalizarNome(tamanhoInativo.nome)])
            .whereNot('id', id)
            .whereNull('deletado_em')
            .first();

        if (tamanhoComMesmoNome) {
            await trx.rollback();

            return next(
                lancarErro(
                    `Não é possível restaurar o tamanho "${tamanhoInativo.nome}" porque já existe outro tamanho ativo com o mesmo nome.`,
                    409
                )
            );
        }

        const [tamanhoReativado] = await connection('tamanhos_marmitas')
            .transacting(trx)
            .where({ id })
            .update({
                ativo: true,
                deletado_em: null
            })
            .returning('*');

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
            message: `Tamanho "${tamanhoInativo.nome}" reativado com sucesso.`,
            data: tamanhoReativado
        });
    } catch (error) {
        await trx.rollback();

        if (error.code === '23505') {
            return next(
                lancarErro(
                    `Não é possível restaurar o tamanho "${nomeTamanho}" porque já existe outro tamanho ativo com o mesmo nome.`,
                    409
                )
            );
        }

        return next(error);
    }
};