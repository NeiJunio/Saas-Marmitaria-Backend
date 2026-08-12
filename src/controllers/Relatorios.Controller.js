import connection from "../database/connection.js";
import { lancarErro } from "../utils/errorUtils.js";

export const listarCatalogoRelatorios = async (req, res, next) => {
    try {
        const relatorios = await connection('catalogo_relatorios')
            .where('ativo', true)
            .orderBy('id', 'asc')
            .select([
                'id',
                'nome',
                'descricao',
                'funcao_db',
                'filtros_config',
                'colunas_config'
            ]);

        return res.status(200).json({
            status: 'success',
            data: relatorios
        });
    } catch (error) {
        next(error);
    }
};

export const gerarRelatorio = async (req, res, next) => {

    try {

        const { id } = req.params;
        const filtros = req.body;

        if (!id) {
            return next(lancarErro('O parâmetro ID do relatório é obrigatório.', 400));
        }

        const relatorio = await connection('catalogo_relatorios')
            .where('id', id)
            .where('ativo', true)
            .first();

        if (!relatorio) {
            return next(lancarErro('Relatório não encontrado ou inativo.', 404));
        }

        const filtrosJson = JSON.stringify(filtros || {});

        const resultado = await connection.raw(
            `SELECT * FROM ${relatorio.funcao_db}(?)`,
            [filtrosJson]
        );

        await connection('logs').insert({
            tipo: 'ACAO',
            usuario_id: req.usuario.id, // Assumindo que seu middleware de auth injeta o req.usuario
            metodo: req.method,
            endpoint: req.originalUrl,
            acao: 'RELATORIOS.GERAR',
            descricao: `O usuário ${req.usuario.nome} gerou o relatório: ${relatorio.nome}`,
            payload: JSON.stringify({
                relatorio_id: id,
                nome_relatorio: relatorio.nome,
                filtros_utilizados: filtros
            })
        });

        return res.status(200).json({
            status: 'success',
            data: {
                nome: relatorio.nome,
                colunas: relatorio.colunas_config,
                dados: resultado.rows
            }
        });

    } catch (error) {
        next(error);
    }
}