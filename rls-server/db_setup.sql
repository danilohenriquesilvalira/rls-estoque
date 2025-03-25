-- Script de configuração do banco de dados RLS Estoque
-- Execute como usuário com privilégios de criação de banco de dados:
-- psql -U postgres -f db_setup.sql

-- Criar banco de dados
CREATE DATABASE rls_estoque;

-- Conectar ao banco de dados criado
\c rls_estoque

-- Criar tabela de produtos
CREATE TABLE produtos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    quantidade INTEGER NOT NULL DEFAULT 0,
    quantidade_minima INTEGER,
    localizacao VARCHAR(100),
    fornecedor VARCHAR(200),
    notas TEXT,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP
);

-- Criar tabela de movimentações
CREATE TABLE movimentacoes (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER REFERENCES produtos(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    quantidade INTEGER NOT NULL,
    notas TEXT,
    data_movimentacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de configurações
CREATE TABLE configuracoes (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descricao TEXT,
    data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inserir configurações iniciais
INSERT INTO configuracoes (chave, valor, descricao)
VALUES ('versao_app', '1.0.0', 'Versão atual do aplicativo');

INSERT INTO configuracoes (chave, valor, descricao)
VALUES ('alerta_estoque_baixo', 'true', 'Ativar alertas de estoque baixo');

INSERT INTO configuracoes (chave, valor, descricao)
VALUES ('nivel_estoque_baixo', '5', 'Nível considerado estoque baixo');

-- Criar função para atualizar timestamp de atualização
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.data_atualizacao = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar timestamp em produtos
CREATE TRIGGER update_produtos_timestamp
BEFORE UPDATE ON produtos
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();

-- Criar trigger para atualizar timestamp em configurações
CREATE TRIGGER update_configuracoes_timestamp
BEFORE UPDATE ON configuracoes
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();

-- Inserir produtos de exemplo (opcional)
INSERT INTO produtos (codigo, nome, descricao, quantidade, quantidade_minima, localizacao, fornecedor)
VALUES 
('001', 'Motor 220V', 'Motor elétrico monofásico 220V', 10, 5, 'Prateleira A1', 'Fornecedor XYZ'),
('002', 'Sensor de Proximidade', 'Sensor indutivo NPN', 15, 8, 'Prateleira B3', 'Fornecedor ABC'),
('003', 'Painel de Controle', 'Painel de controle industrial', 5, 2, 'Prateleira C2', 'Fornecedor DEF');

-- Inserir movimentações de exemplo para os produtos acima (opcional)
INSERT INTO movimentacoes (produto_id, tipo, quantidade, notas)
VALUES 
(1, 'entrada', 10, 'Estoque inicial'),
(2, 'entrada', 20, 'Estoque inicial'),
(3, 'entrada', 5, 'Estoque inicial'),
(2, 'saida', 5, 'Utilizado em projeto A');

-- Conceder permissões (ajuste para seu usuário específico)
-- GRANT ALL PRIVILEGES ON DATABASE rls_estoque TO seu_usuario;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO seu_usuario;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO seu_usuario;

-- Exemplo de concessão para o usuário 'danilo'
GRANT ALL PRIVILEGES ON DATABASE rls_estoque TO danilo;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO danilo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO danilo;

-- Exibir confirmação
\echo 'Banco de dados rls_estoque configurado com sucesso!'
\echo 'Tabelas criadas: produtos, movimentacoes, configuracoes'