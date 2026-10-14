CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    classe ENUM('admin', 'cliente', 'funcionario')
        NOT NULL DEFAULT 'cliente',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE servicos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL UNIQUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE solicitacoes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL,
    servico_id INT UNSIGNED NOT NULL,
    descricao TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_solicitacao_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES users(id),

    CONSTRAINT fk_solicitacao_servico
        FOREIGN KEY (servico_id)
        REFERENCES servicos(id)
);

CREATE TABLE ordens (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT UNSIGNED NOT NULL,
    servico_id INT UNSIGNED NOT NULL,
    descricao TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'aberta',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ordem_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES users(id),

    CONSTRAINT fk_ordem_servico
        FOREIGN KEY (servico_id)
        REFERENCES servicos(id)
);

CREATE TABLE ordem_funcionarios (
    ordem_id INT UNSIGNED NOT NULL,
    funcionarios_id INT UNSIGNED NOT NULL,

    PRIMARY KEY (ordem_id, funcionarios_id),

    CONSTRAINT fk_ordem_funcionario_ordem
        FOREIGN KEY (ordem_id)
        REFERENCES ordens(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ordem_funcionario_usuario
        FOREIGN KEY (funcionarios_id)
        REFERENCES users(id)
);