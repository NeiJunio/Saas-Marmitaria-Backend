import swaggerJSDoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SaaS Marmitaria - Documentação API',
            version: '1.0.0',
            description: 'Documentação das rotas do sistema de gestão de marmitarias',
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Servidor Local',
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'token',
                    description: 'Token JWT armazenado em cookie HTTPOnly',
                },
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                // ========== SCHEMAS DE USUÁRIOS ==========
                Usuario: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do usuário', example: 1 },
                        nome: { type: 'string', description: 'Nome completo do usuário', example: 'João Silva' },
                        email: { type: 'string', format: 'email', description: 'E-mail único do usuário', example: 'joao@email.com' },
                        nivel_acesso_id: { type: 'integer', description: 'ID do nível de acesso', example: 1 },
                        cargo: { type: 'string', description: 'Nome do cargo/nível de acesso', example: 'Administrador' },
                        ativo: { type: 'boolean', description: 'Status de atividade do usuário', example: true },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-04-26T10:00:00.000Z' },
                        atualizado_em: { type: 'string', format: 'date-time', description: 'Data da última atualização', example: '2026-04-26T10:00:00.000Z' },
                        deletado_em: { type: 'string', format: 'date-time', nullable: true, description: 'Data de exclusão (soft delete)', example: null },
                    },
                },
                UsuarioCreate: {
                    type: 'object',
                    required: ['nome', 'email', 'senha', 'nivel_acesso_id'],
                    properties: {
                        nome: { type: 'string', description: 'Nome completo do usuário', example: 'João Silva' },
                        email: { type: 'string', format: 'email', description: 'E-mail único do usuário', example: 'joao@email.com' },
                        senha: { type: 'string', description: 'Senha (mín 12 caracteres, maiúsculas, minúsculas, números e especiais)', example: 'Senha@12345' },
                        nivel_acesso_id: { type: 'integer', description: 'ID do nível de acesso', example: 1 },
                    },
                },
                UsuarioUpdate: {
                    type: 'object',
                    properties: {
                        nome: { type: 'string', description: 'Nome completo do usuário', example: 'João Silva' },
                        email: { type: 'string', format: 'email', description: 'E-mail único do usuário', example: 'joao@email.com' },
                        nivel_acesso_id: { type: 'integer', description: 'ID do nível de acesso', example: 1 },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                    },
                },

                // ========== SCHEMAS DE NÍVEIS DE ACESSO ==========
                NivelAcesso: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do nível de acesso', example: 1 },
                        nome: { type: 'string', maxLength: 50, description: 'Nome do nível de acesso', example: 'Administrador' },
                        descricao: { type: 'string', description: 'Descrição do nível de acesso', example: 'Acesso total ao sistema' },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                    },
                },

                // ========== SCHEMAS DE PERMISSÕES ==========
                Permissao: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único da permissão', example: 1 },
                        nome: { type: 'string', maxLength: 50, description: 'Nome da permissão (formato: recurso.acao)', example: 'usuarios.listar' },
                        descricao: { type: 'string', nullable: true, description: 'Descrição da permissão', example: 'Permite listar usuários' },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-04-26T10:00:00.000Z' },
                    },
                },
                PermissaoUsuario: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do vínculo', example: 1 },
                        usuario_id: { type: 'integer', description: 'ID do usuário', example: 1 },
                        permissao_id: { type: 'integer', description: 'ID da permissão', example: 1 },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-04-26T10:00:00.000Z' },
                    },
                },

                // ========== SCHEMAS DE LOGS ==========
                Log: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do log', example: 1 },
                        usuario_id: { type: 'integer', nullable: true, description: 'ID do usuário (pode ser nulo para erros)', example: 1 },
                        tipo: { type: 'string', enum: ['ACAO', 'ERRO'], description: 'Tipo do log: ACAO (ação bem-sucedida) ou ERRO (falha técnica)', example: 'ACAO' },
                        acao: { type: 'string', maxLength: 50, description: 'Código da ação', example: 'USUARIOS.LOGIN' },
                        descricao: { type: 'string', description: 'Descrição detalhada do log', example: 'O colaborador João Silva realizou login no sistema.' },
                        metodo: { type: 'string', maxLength: 10, description: 'Método HTTP (GET, POST, PATCH, etc)', example: 'POST' },
                        endpoint: { type: 'string', description: 'Rota acessada', example: '/auth/login' },
                        payload: { type: 'object', nullable: true, description: 'Dados adicionais em formato JSON', example: { ip: '192.168.1.1' } },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-04-26T10:00:00.000Z' },
                    },
                },

                // ========== SCHEMAS DE NEGÓCIO ==========
                StatusLoja: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do status', example: 1 },
                        esta_aberta: { type: 'boolean', description: 'Indica se a loja está aberta para pedidos', example: true },
                        atualizado_em: { type: 'string', format: 'date-time', description: 'Data da última atualização', example: '2026-04-26T10:00:00.000Z' },
                    },
                },
                MetodoPagamento: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do método', example: 1 },
                        nome: { type: 'string', maxLength: 50, description: 'Nome do método de pagamento', example: 'Dinheiro' },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-05-10T13:46:05.000Z' },
                        atualizado_em: { type: 'string', format: 'date-time', description: 'Data da última atualização', example: '2026-05-10T13:46:05.000Z' },
                        deletado_em: { type: 'string', format: 'date-time', nullable: true, description: 'Data de exclusão (soft delete)', example: null },
                    },
                },
                MetodoPagamentoCreate: {
                    type: 'object',
                    required: ['nome'],
                    properties: {
                        nome: { type: 'string', maxLength: 50, description: 'Nome do método de pagamento', example: 'Cartão de Crédito' },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                    },
                },
                MetodoPagamentoUpdate: {
                    type: 'object',
                    properties: {
                        nome: { type: 'string', maxLength: 50, description: 'Nome do método de pagamento', example: 'Cartão de Débito' },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: false },
                    },
                },
                TamanhoMarmita: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do tamanho', example: 1 },
                        nome: { type: 'string', maxLength: 50, description: 'Nome do tamanho (P, M, G, etc)', example: 'Grande' },
                        preco_base: { type: 'number', format: 'decimal', description: 'Preço base do tamanho', example: 25.00 },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-05-01T14:25:31.000Z' },
                        atualizado_em: { type: 'string', format: 'date-time', description: 'Data da última atualização', example: '2026-05-01T14:25:31.000Z' },
                        deletado_em: { type: 'string', format: 'date-time', nullable: true, description: 'Data de exclusão (soft delete)', example: null },
                    },
                },
                TamanhoMarmitaCreate: {
                    type: 'object',
                    required: ['nome', 'preco_base'],
                    properties: {
                        nome: { type: 'string', maxLength: 50, description: 'Nome do tamanho (P, M, G, etc)', example: 'Grande' },
                        preco_base: { type: 'number', format: 'decimal', description: 'Preço base do tamanho', example: 25.00 },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                    },
                },
                TamanhoMarmitaUpdate: {
                    type: 'object',
                    properties: {
                        nome: { type: 'string', maxLength: 50, description: 'Nome do tamanho (P, M, G, etc)', example: 'Grande' },
                        preco_base: { type: 'number', format: 'decimal', description: 'Preço base do tamanho', example: 25.00 },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                    },
                },
                CategoriaAlimento: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único da categoria', example: 1 },
                        nome: { type: 'string', maxLength: 50, description: 'Nome da categoria', example: 'Proteína' },
                        limite_escolhas: { type: 'integer', description: 'Limite de escolhas por categoria no pedido', example: 2 },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-05-01T14:25:31.000Z' },
                        atualizado_em: { type: 'string', format: 'date-time', description: 'Data da última atualização', example: '2026-05-01T14:25:31.000Z' },
                        deletado_em: { type: 'string', format: 'date-time', nullable: true, description: 'Data de exclusão (soft delete)', example: null },
                    },
                },
                CategoriaAlimentoCreate: {
                    type: 'object',
                    required: ['nome', 'limite_escolhas'],
                    properties: {
                        nome: { type: 'string', maxLength: 50, description: 'Nome da categoria', example: 'Proteína' },
                        limite_escolhas: { type: 'integer', description: 'Limite de escolhas por categoria no pedido', example: 2 },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                    },
                },
                CategoriaAlimentoUpdate: {
                    type: 'object',
                    properties: {
                        nome: { type: 'string', maxLength: 50, description: 'Nome da categoria', example: 'Proteína' },
                        limite_escolhas: { type: 'integer', description: 'Limite de escolhas por categoria no pedido', example: 2 },
                        ativo: { type: 'boolean', description: 'Status de atividade', example: true },
                    },
                },
                Alimento: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do alimento', example: 1 },
                        categoria_id: { type: 'integer', description: 'ID da categoria do alimento', example: 1 },
                        nome: { type: 'string', maxLength: 100, description: 'Nome do alimento', example: 'Frango Grelhado' },
                        descricao: { type: 'string', nullable: true, description: 'Descrição do alimento', example: 'Filé de frango grelhado com temperos' },
                        disponivel_hoje: { type: 'boolean', description: 'Disponibilidade do alimento para o dia', example: true },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-04-26T10:00:00.000Z' },
                        atualizado_em: { type: 'string', format: 'date-time', description: 'Data da última atualização', example: '2026-04-26T10:00:00.000Z' },
                        deletado_em: { type: 'string', format: 'date-time', nullable: true, description: 'Data de exclusão (soft delete)', example: null },
                    },
                },
                AlimentoCreate: {
                    type: 'object',
                    required: ['nome', 'categoria_id'],
                    properties: {
                        nome: { type: 'string', maxLength: 100, description: 'Nome do alimento', example: 'Frango Grelhado' },
                        categoria_id: { type: 'integer', description: 'ID da categoria do alimento', example: 1 },
                        descricao: { type: 'string', nullable: true, description: 'Descrição do alimento', example: 'Filé de frango grelhado com temperos' },
                        disponivel_hoje: { type: 'boolean', description: 'Disponibilidade do alimento para o dia', example: true },
                    },
                },
                AlimentoUpdate: {
                    type: 'object',
                    properties: {
                        nome: { type: 'string', maxLength: 100, description: 'Nome do alimento', example: 'Frango Grelhado' },
                        categoria_id: { type: 'integer', description: 'ID da categoria do alimento', example: 1 },
                        descricao: { type: 'string', nullable: true, description: 'Descrição do alimento', example: 'Filé de frango grelhado com temperos' },
                        disponivel_hoje: { type: 'boolean', description: 'Disponibilidade do alimento para o dia', example: true },
                    },
                },
                Pedido: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do pedido', example: 1 },
                        nome_cliente: { type: 'string', maxLength: 100, description: 'Nome do cliente', example: 'Maria Santos' },
                        telefone_cliente: { type: 'string', maxLength: 20, description: 'Telefone de contato', example: '(11) 99999-9999' },
                        endereco_cliente: { type: 'string', maxLength: 255, description: 'Endereço de entrega', example: 'Rua Example, 123' },
                        tipo_pedido: { type: 'string', enum: ['Presencial', 'Remoto'], description: 'Tipo de pedido: Presencial (retirada) ou Remoto (entrega)', example: 'Remoto' },
                        metodo_pagamento_id: { type: 'integer', description: 'ID do método de pagamento', example: 1 },
                        status: { type: 'string', enum: ['Pendente', 'Em Preparo', 'Pronto para Retirada', 'Saiu para Entrega', 'Entregue', 'Cancelado'], description: 'Status do pedido', example: 'Pendente' },
                        valor_total: { type: 'number', format: 'decimal', description: 'Valor total do pedido', example: 50.00 },
                        observacoes: { type: 'string', nullable: true, description: 'Observações do pedido', example: 'Sem cebola' },
                        criado_em: { type: 'string', format: 'date-time', description: 'Data de criação', example: '2026-04-26T10:00:00.000Z' },
                        atualizado_em: { type: 'string', format: 'date-time', description: 'Data da última atualização', example: '2026-04-26T10:00:00.000Z' },
                        deletado_em: { type: 'string', format: 'date-time', nullable: true, description: 'Data de exclusão (soft delete)', example: null },
                    },
                },
                PedidoCreate: {
                    type: 'object',
                    required: ['nome_cliente', 'telefone_cliente', 'endereco_cliente', 'tipo_pedido', 'metodo_pagamento_id', 'marmitas'],
                    properties: {
                        nome_cliente: { type: 'string', maxLength: 100, description: 'Nome do cliente', example: 'Maria Santos' },
                        telefone_cliente: { type: 'string', maxLength: 20, description: 'Telefone de contato', example: '(11) 99999-9999' },
                        endereco_cliente: { type: 'string', maxLength: 255, description: 'Endereço de entrega', example: 'Rua Example, 123' },
                        tipo_pedido: { type: 'string', enum: ['Presencial', 'Remoto'], description: 'Tipo de pedido: Presencial (retirada) ou Remoto (entrega)', example: 'Remoto' },
                        metodo_pagamento_id: { type: 'integer', description: 'ID do método de pagamento', example: 1 },
                        observacoes: { type: 'string', nullable: true, description: 'Observações do pedido', example: 'Sem cebola' },
                        marmitas: {
                            type: 'array',
                            description: 'Lista de marmitas do pedido',
                            items: {
                                type: 'object',
                                properties: {
                                    tamanho_marmita_id: { type: 'integer', description: 'ID do tamanho da marmita', example: 1 },
                                    quantidade: { type: 'integer', description: 'Quantidade', example: 2 },
                                    alimentos: {
                                        type: 'array',
                                        description: 'Lista de IDs dos alimentos selecionados',
                                        items: { type: 'integer', example: 1 }
                                    }
                                },
                                required: ['tamanho_marmita_id', 'quantidade', 'alimentos']
                            }
                        }
                    },
                },
                PedidoUpdate: {
                    type: 'object',
                    properties: {
                        nome_cliente: { type: 'string', maxLength: 100, description: 'Nome do cliente', example: 'Maria Santos Atualizada' },
                        endereco_cliente: { type: 'string', maxLength: 255, description: 'Endereço de entrega', example: 'Rua Nova, 456' },
                        telefone_cliente: { type: 'string', maxLength: 20, description: 'Telefone de contato', example: '(11) 99999-9999' },
                        metodo_pagamento_id: { type: 'integer', description: 'ID do método de pagamento', example: 2 },
                        observacoes: { type: 'string', nullable: true, description: 'Observações do pedido', example: 'Sem cebola, adicionar molho' },
                        marmitas: {
                            type: 'array',
                            description: 'Lista de marmitas do pedido (opcional para update)',
                            items: {
                                type: 'object',
                                properties: {
                                    tamanho_marmita_id: { type: 'integer', description: 'ID do tamanho da marmita', example: 1 },
                                    quantidade: { type: 'integer', description: 'Quantidade', example: 2 },
                                    alimentos: {
                                        type: 'array',
                                        description: 'Lista de IDs dos alimentos selecionados',
                                        items: { type: 'integer', example: 1 }
                                    }
                                }
                            }
                        }
                    },
                },
                ItemPedido: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único do item', example: 1 },
                        pedido_id: { type: 'integer', description: 'ID do pedido pai', example: 1 },
                        tamanho_marmita_id: { type: 'integer', description: 'ID do tamanho da marmita', example: 1 },
                        quantidade: { type: 'integer', description: 'Quantidade do item', example: 2 },
                        preco_unitario: { type: 'number', format: 'decimal', description: 'Preço unitário', example: 25.00 },
                        subtotal: { type: 'number', format: 'decimal', description: 'Subtotal (quantidade * preco_unitario)', example: 50.00 },
                    },
                },
                ComposicaoItemPedido: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'ID único da composição', example: 1 },
                        item_pedido_id: { type: 'integer', description: 'ID do item do pedido', example: 1 },
                        alimento_id: { type: 'integer', description: 'ID do alimento selecionado', example: 1 },
                    },
                },

                // ========== SCHEMAS DE RESPOSTA ==========
                Error: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'fail' },
                        message: { type: 'string', example: 'Mensagem de erro' },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'success' },
                        message: { type: 'string', example: 'Operação realizada com sucesso' },
                        data: { type: 'object', description: 'Dados da resposta' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        total: { type: 'integer', description: 'Total de registros', example: 100 },
                        page: { type: 'integer', description: 'Página atual', example: 1 },
                        lastPage: { type: 'integer', description: 'Última página', example: 10 },
                    },
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'senha'],
                    properties: {
                        email: { type: 'string', format: 'email', description: 'E-mail do usuário', example: 'joao@email.com' },
                        senha: { type: 'string', description: 'Senha do usuário', example: 'Senha@12345' },
                    },
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'success' },
                        message: { type: 'string', example: 'Login realizado com sucesso' },
                        data: {
                            type: 'object',
                            properties: {
                                usuario: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'integer', example: 1 },
                                        nome: { type: 'string', example: 'João Silva' },
                                        cargo: { type: 'string', example: 'Administrador' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                Unauthorized: {
                    description: 'Não autorizado - Token inválido ou ausente',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { status: 'fail', message: 'Token não fornecido' },
                        },
                    },
                },
                Forbidden: {
                    description: 'Proibido - Usuário sem permissão',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { status: 'fail', message: 'Acesso negado' },
                        },
                    },
                },
                NotFound: {
                    description: 'Não encontrado - Recurso não existe',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { status: 'fail', message: 'Usuário não encontrado' },
                        },
                    },
                },
                BadRequest: {
                    description: 'Requisição inválida - Dados incorretos',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { status: 'fail', message: 'Preencha todos os campos corretamente' },
                        },
                    },
                },
                InternalServerError: {
                    description: 'Erro interno do servidor',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { status: 'error', message: 'Erro interno do servidor' },
                        },
                    },
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'Endpoints de autenticação' },
            { name: 'Usuarios', description: 'Gerenciamento de usuários' },
            { name: 'NiveisAcesso', description: 'Níveis de acesso (cargos)' },
            { name: 'Permissoes', description: 'Sistema de permissões RBAC' },
            { name: 'Logs', description: 'Logs de auditoria' },
            { name: 'Pedidos', description: 'Gerenciamento de pedidos' },
            { name: 'MetodosPagamento', description: 'Gerenciamento de métodos de pagamento' },
            { name: 'Negocios', description: 'Recursos de negócio (alimentos, tamanhos, categorias, etc)' },
            { name: 'TamanhosMarmitas', description: 'Gerenciamento de tamanhos de marmitas' },
            { name: 'Alimentos', description: 'Gerenciamento de alimentos e cardápio' },
            { name: 'CategoriaAlimento', description: 'Categorias de alimentos' },
            { name: 'Categorias Alimentos', description: 'Categorias de alimentos' },
            { name: 'StatusLoja', description: 'Status operacional da loja' },
        ],
    },
    apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);