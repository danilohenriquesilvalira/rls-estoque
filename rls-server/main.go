// main.go - Servidor API moderno para RLS Estoque usando Gin e pgx

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Configuração do banco de dados
const (
	host     = "localhost"
	port     = 5432
	user     = "danilo"
	password = "Danilo@34333528"
	dbname   = "rls_estoque"
)

// Estruturas de dados
type Produto struct {
	ID               int       `json:"id,omitempty"`
	Codigo           string    `json:"codigo"`
	Nome             string    `json:"nome"`
	Descricao        string    `json:"descricao,omitempty"`
	Quantidade       int       `json:"quantidade"`
	QuantidadeMinima int       `json:"quantidade_minima,omitempty"`
	Localizacao      string    `json:"localizacao,omitempty"`
	Fornecedor       string    `json:"fornecedor,omitempty"`
	Notas            string    `json:"notas,omitempty"`
	DataCriacao      time.Time `json:"data_criacao,omitempty"`
	DataAtualizacao  time.Time `json:"data_atualizacao,omitempty"`
}

type Movimentacao struct {
	ID               int       `json:"id,omitempty"`
	ProdutoID        int       `json:"produto_id"`
	Tipo             string    `json:"tipo"` // 'entrada' ou 'saida'
	Quantidade       int       `json:"quantidade"`
	Notas            string    `json:"notas,omitempty"`
	DataMovimentacao time.Time `json:"data_movimentacao,omitempty"`
}

type Configuracao struct {
	ID              int       `json:"id,omitempty"`
	Chave           string    `json:"chave"`
	Valor           string    `json:"valor"`
	Descricao       string    `json:"descricao,omitempty"`
	DataAtualizacao time.Time `json:"data_atualizacao,omitempty"`
}

type DashboardData struct {
	TotalProdutos        int                `json:"total_produtos"`
	TotalItens           int                `json:"total_itens"`
	EstoqueBaixo         int                `json:"estoque_baixo"`
	UltimasMovimentacoes []MovimentacaoView `json:"ultimas_movimentacoes"`
	TopProdutos          []ProdutoView      `json:"top_produtos"`
}

type MovimentacaoView struct {
	ID               int       `json:"id,omitempty"`
	Tipo             string    `json:"tipo"`
	Quantidade       int       `json:"quantidade"`
	DataMovimentacao time.Time `json:"data_movimentacao"`
	Notas            string    `json:"notas,omitempty"`
	ProdutoCodigo    string    `json:"produto_codigo"`
	ProdutoNome      string    `json:"produto_nome"`
}

type ProdutoView struct {
	Codigo     string `json:"codigo"`
	Nome       string `json:"nome"`
	Quantidade int    `json:"quantidade"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

var db *pgxpool.Pool

// Logger middleware
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Tempo inicial
		startTime := time.Now()

		// Processar request
		c.Next()

		// Tempo após processar
		endTime := time.Now()
		latency := endTime.Sub(startTime)

		// Acessar os detalhes da requisição
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()
		path := c.Request.URL.Path

		log.Printf("[API] %s | %3d | %v | %s | %s",
			method, statusCode, latency, clientIP, path)
	}
}

func main() {
	// Configurar logging
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	log.Printf("Iniciando servidor RLS Estoque API...")

	// Inicializar conexão com o banco de dados
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%d/%s", user, password, host, port, dbname)
	log.Printf("Conectando ao PostgreSQL: %s:%d/%s", host, port, dbname)

	var err error
	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		log.Fatalf("Erro ao criar configuração de pool: %v", err)
	}

	// Configurar o pool de conexões
	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	// Criar o pool
	db, err = pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalf("Não foi possível conectar ao banco de dados: %v", err)
	}
	defer db.Close()

	// Testar conexão
	err = db.Ping(context.Background())
	if err != nil {
		log.Fatalf("Não foi possível pingar o banco de dados: %v", err)
	}
	log.Println("✓ Conectado ao banco de dados PostgreSQL!")

	// Configurar o Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(Logger())

	// Configurar CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Agrupar rotas API
	api := r.Group("/api")
	{
		// Rotas de produtos
		api.GET("/produtos", getProdutos)
		api.GET("/produtos/:id", getProduto)
		api.POST("/produtos", criarProduto)
		api.PUT("/produtos/:id", atualizarProduto)
		api.DELETE("/produtos/:id", deletarProduto)
		api.GET("/produtos/codigo/:codigo", getProdutoPorCodigo)
		api.GET("/produtos/estoque-baixo", getProdutosEstoqueBaixo)

		// Rotas de movimentações
		api.GET("/movimentacoes", getMovimentacoes)
		api.GET("/movimentacoes/:id", getMovimentacao)
		api.POST("/movimentacoes", criarMovimentacao)
		api.GET("/movimentacoes/produto/:produto_id", getMovimentacoesPorProduto)

		// Rotas de configurações
		api.GET("/configuracoes", getConfiguracoes)
		api.GET("/configuracoes/:chave", getConfiguracao)
		api.PUT("/configuracoes/:chave", atualizarConfiguracao)

		// Rotas de dashboard
		api.GET("/dashboard", getDashboardData)
	}

	// Iniciar servidor
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Logar endereços de acesso
	log.Printf("Servidor rodando nas seguintes URLs:")
	log.Printf("- Local: http://localhost:%s", port)
	log.Printf("- Rede: http://192.168.1.85:%s", port)
	log.Printf("- Aceita conexões do celular (IP: 192.168.1.84)")

	log.Fatal(r.Run(":" + port))
}

// Handlers de Produtos

func getProdutos(c *gin.Context) {
	log.Println("[DB] Buscando lista de produtos")

	// Parâmetros opcionais de consulta para paginação
	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 100
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	log.Printf("[DB] Realizando consulta com limit=%d, offset=%d", limit, offset)

	// Consulta SQL
	rows, err := db.Query(context.Background(), `
		SELECT id, codigo, nome, descricao, quantidade, quantidade_minima, 
		       localizacao, fornecedor, notas, data_criacao, data_atualizacao
		FROM produtos
		ORDER BY nome
		LIMIT $1 OFFSET $2
	`, limit, offset)

	if err != nil {
		log.Printf("[ERROR] Erro ao consultar produtos: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar produtos"})
		return
	}
	defer rows.Close()

	// Processar resultados
	produtos := []Produto{}
	for rows.Next() {
		var p Produto
		var descricao, localizacao, fornecedor, notas *string
		var quantidadeMinima *int
		var dataAtualizacao *time.Time

		err := rows.Scan(
			&p.ID, &p.Codigo, &p.Nome, &descricao, &p.Quantidade,
			&quantidadeMinima, &localizacao, &fornecedor, &notas,
			&p.DataCriacao, &dataAtualizacao,
		)

		if err != nil {
			log.Printf("[ERROR] Erro ao processar produto: %v", err)
			continue
		}

		// Tratar campos nulos
		if descricao != nil {
			p.Descricao = *descricao
		}
		if quantidadeMinima != nil {
			p.QuantidadeMinima = *quantidadeMinima
		}
		if localizacao != nil {
			p.Localizacao = *localizacao
		}
		if fornecedor != nil {
			p.Fornecedor = *fornecedor
		}
		if notas != nil {
			p.Notas = *notas
		}
		if dataAtualizacao != nil {
			p.DataAtualizacao = *dataAtualizacao
		}

		produtos = append(produtos, p)
	}

	// Verificar erros durante a iteração
	if err = rows.Err(); err != nil {
		log.Printf("[ERROR] Erro ao processar produtos: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao processar produtos"})
		return
	}

	log.Printf("[DB] Retornando %d produtos", len(produtos))
	// Retornar lista de produtos
	c.JSON(http.StatusOK, produtos)
}

func getProduto(c *gin.Context) {
	// Obter ID da URL
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Printf("[ERROR] ID inválido: %s", idStr)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "ID inválido"})
		return
	}

	log.Printf("[DB] Buscando produto com ID: %d", id)

	// Consultar produto por ID
	var p Produto
	var descricao, localizacao, fornecedor, notas *string
	var quantidadeMinima *int
	var dataAtualizacao *time.Time

	err = db.QueryRow(context.Background(), `
		SELECT id, codigo, nome, descricao, quantidade, quantidade_minima, 
		       localizacao, fornecedor, notas, data_criacao, data_atualizacao
		FROM produtos
		WHERE id = $1
	`, id).Scan(
		&p.ID, &p.Codigo, &p.Nome, &descricao, &p.Quantidade,
		&quantidadeMinima, &localizacao, &fornecedor, &notas,
		&p.DataCriacao, &dataAtualizacao,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Produto não encontrado com ID: %d", id)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Produto não encontrado"})
		} else {
			log.Printf("[ERROR] Erro ao buscar produto: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar produto"})
		}
		return
	}

	// Tratar campos nulos
	if descricao != nil {
		p.Descricao = *descricao
	}
	if quantidadeMinima != nil {
		p.QuantidadeMinima = *quantidadeMinima
	}
	if localizacao != nil {
		p.Localizacao = *localizacao
	}
	if fornecedor != nil {
		p.Fornecedor = *fornecedor
	}
	if notas != nil {
		p.Notas = *notas
	}
	if dataAtualizacao != nil {
		p.DataAtualizacao = *dataAtualizacao
	}

	log.Printf("[DB] Produto encontrado: %s (ID: %d)", p.Nome, p.ID)
	// Retornar produto
	c.JSON(http.StatusOK, p)
}

func getProdutoPorCodigo(c *gin.Context) {
	// Obter código da URL
	codigo := c.Param("codigo")
	log.Printf("[DB] Buscando produto com código: %s", codigo)

	// Consultar produto por código
	var p Produto
	var descricao, localizacao, fornecedor, notas *string
	var quantidadeMinima *int
	var dataAtualizacao *time.Time

	err := db.QueryRow(context.Background(), `
		SELECT id, codigo, nome, descricao, quantidade, quantidade_minima, 
		       localizacao, fornecedor, notas, data_criacao, data_atualizacao
		FROM produtos
		WHERE codigo = $1
	`, codigo).Scan(
		&p.ID, &p.Codigo, &p.Nome, &descricao, &p.Quantidade,
		&quantidadeMinima, &localizacao, &fornecedor, &notas,
		&p.DataCriacao, &dataAtualizacao,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Produto não encontrado com código: %s", codigo)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Produto não encontrado"})
		} else {
			log.Printf("[ERROR] Erro ao buscar produto: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar produto"})
		}
		return
	}

	// Tratar campos nulos
	if descricao != nil {
		p.Descricao = *descricao
	}
	if quantidadeMinima != nil {
		p.QuantidadeMinima = *quantidadeMinima
	}
	if localizacao != nil {
		p.Localizacao = *localizacao
	}
	if fornecedor != nil {
		p.Fornecedor = *fornecedor
	}
	if notas != nil {
		p.Notas = *notas
	}
	if dataAtualizacao != nil {
		p.DataAtualizacao = *dataAtualizacao
	}

	log.Printf("[DB] Produto encontrado: %s (ID: %d)", p.Nome, p.ID)
	// Retornar produto
	c.JSON(http.StatusOK, p)
}

func criarProduto(c *gin.Context) {
	log.Println("[API] Iniciando criação de produto")

	// Decodificar produto do request
	var p Produto
	if err := c.ShouldBindJSON(&p); err != nil {
		log.Printf("[ERROR] Dados inválidos: %v", err)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Dados inválidos"})
		return
	}

	// Validar campos obrigatórios
	if p.Codigo == "" || p.Nome == "" {
		log.Printf("[ERROR] Campos obrigatórios ausentes. Código: '%s', Nome: '%s'", p.Codigo, p.Nome)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Código e nome são obrigatórios"})
		return
	}

	log.Printf("[DB] Verificando se já existe produto com código: %s", p.Codigo)
	// Verificar se já existe um produto com o mesmo código
	var existingId int
	err := db.QueryRow(context.Background(), "SELECT id FROM produtos WHERE codigo = $1", p.Codigo).Scan(&existingId)
	if err == nil {
		log.Printf("[DB] Produto já existe com código: %s (ID: %d)", p.Codigo, existingId)
		c.JSON(http.StatusConflict, ErrorResponse{Error: "Já existe um produto com este código"})
		return
	} else if err != pgx.ErrNoRows {
		log.Printf("[ERROR] Erro ao verificar produto existente: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao verificar produto existente"})
		return
	}

	log.Printf("[DB] Inserindo novo produto: %s (Código: %s)", p.Nome, p.Codigo)
	// Inserir novo produto
	err = db.QueryRow(context.Background(), `
		INSERT INTO produtos(
			codigo, nome, descricao, quantidade, quantidade_minima,
			localizacao, fornecedor, notas
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, data_criacao
	`, p.Codigo, p.Nome, p.Descricao, p.Quantidade, p.QuantidadeMinima,
		p.Localizacao, p.Fornecedor, p.Notas).Scan(&p.ID, &p.DataCriacao)

	if err != nil {
		log.Printf("[ERROR] Erro ao criar produto: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao criar produto"})
		return
	}

	log.Printf("[DB] Produto criado com sucesso! ID: %d, Código: %s, Nome: %s", p.ID, p.Codigo, p.Nome)

	// Se a quantidade inicial for maior que zero, registrar movimentação de entrada
	if p.Quantidade > 0 {
		log.Printf("[DB] Registrando movimentação inicial de entrada para produto ID: %d, Quantidade: %d", p.ID, p.Quantidade)
		_, err = db.Exec(context.Background(), `
			INSERT INTO movimentacoes(produto_id, tipo, quantidade, notas)
			VALUES ($1, 'entrada', $2, 'Estoque inicial')
		`, p.ID, p.Quantidade)

		if err != nil {
			log.Printf("[WARN] Erro ao registrar movimentação inicial: %v", err)
			// Não é um erro crítico, continuamos mesmo se falhar
		} else {
			log.Printf("[DB] Movimentação inicial registrada com sucesso")
		}
	}

	// Retornar produto criado
	c.JSON(http.StatusCreated, p)
}

func atualizarProduto(c *gin.Context) {
	// Obter ID da URL
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Printf("[ERROR] ID inválido: %s", idStr)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "ID inválido"})
		return
	}

	log.Printf("[API] Iniciando atualização de produto ID: %d", id)

	// Verificar se o produto existe
	var existingProduto Produto
	err = db.QueryRow(context.Background(), "SELECT id, quantidade FROM produtos WHERE id = $1", id).Scan(&existingProduto.ID, &existingProduto.Quantidade)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Produto não encontrado com ID: %d", id)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Produto não encontrado"})
		} else {
			log.Printf("[ERROR] Erro ao verificar produto: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao verificar produto"})
		}
		return
	}

	// Decodificar produto do request
	var p Produto
	if err := c.ShouldBindJSON(&p); err != nil {
		log.Printf("[ERROR] Dados inválidos: %v", err)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Dados inválidos"})
		return
	}

	// Validar campos obrigatórios
	if p.Codigo == "" || p.Nome == "" {
		log.Printf("[ERROR] Campos obrigatórios ausentes. Código: '%s', Nome: '%s'", p.Codigo, p.Nome)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Código e nome são obrigatórios"})
		return
	}

	// Verificar se o código já está sendo usado por outro produto
	var existingId int
	err = db.QueryRow(context.Background(), "SELECT id FROM produtos WHERE codigo = $1 AND id != $2", p.Codigo, id).Scan(&existingId)
	if err == nil {
		log.Printf("[DB] Código '%s' já está sendo usado por outro produto (ID: %d)", p.Codigo, existingId)
		c.JSON(http.StatusConflict, ErrorResponse{Error: "Já existe outro produto com este código"})
		return
	} else if err != pgx.ErrNoRows {
		log.Printf("[ERROR] Erro ao verificar produto existente: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao verificar produto existente"})
		return
	}

	// Se a quantidade foi alterada, registrar movimentação
	if p.Quantidade != existingProduto.Quantidade {
		var tipo string
		var quantidade int

		if p.Quantidade > existingProduto.Quantidade {
			tipo = "entrada"
			quantidade = p.Quantidade - existingProduto.Quantidade
			log.Printf("[DB] Registrando entrada de %d itens para produto ID: %d", quantidade, id)
		} else {
			tipo = "saida"
			quantidade = existingProduto.Quantidade - p.Quantidade
			log.Printf("[DB] Registrando saída de %d itens para produto ID: %d", quantidade, id)
		}

		_, err = db.Exec(context.Background(), `
			INSERT INTO movimentacoes(produto_id, tipo, quantidade, notas)
			VALUES ($1, $2, $3, 'Ajuste manual')
		`, id, tipo, quantidade)

		if err != nil {
			log.Printf("[WARN] Erro ao registrar movimentação: %v", err)
			// Não é um erro crítico, continuamos mesmo se falhar
		} else {
			log.Printf("[DB] Movimentação registrada com sucesso")
		}
	}

	log.Printf("[DB] Atualizando produto ID: %d, Nome: %s", id, p.Nome)
	// Atualizar produto
	_, err = db.Exec(context.Background(), `
		UPDATE produtos SET 
			codigo = $1, 
			nome = $2, 
			descricao = $3, 
			quantidade = $4, 
			quantidade_minima = $5,
			localizacao = $6, 
			fornecedor = $7, 
			notas = $8,
			data_atualizacao = CURRENT_TIMESTAMP
		WHERE id = $9
	`, p.Codigo, p.Nome, p.Descricao, p.Quantidade, p.QuantidadeMinima,
		p.Localizacao, p.Fornecedor, p.Notas, id)

	if err != nil {
		log.Printf("[ERROR] Erro ao atualizar produto: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao atualizar produto"})
		return
	}

	log.Printf("[DB] Produto atualizado com sucesso! ID: %d", id)

	// Obter produto atualizado
	p.ID = id
	err = db.QueryRow(context.Background(), `
		SELECT data_criacao, data_atualizacao
		FROM produtos
		WHERE id = $1
	`, id).Scan(&p.DataCriacao, &p.DataAtualizacao)

	if err != nil {
		log.Printf("[WARN] Erro ao obter datas do produto: %v", err)
		// Não é um erro crítico, continuamos mesmo se falhar
	}

	// Retornar produto atualizado
	c.JSON(http.StatusOK, p)
}

func deletarProduto(c *gin.Context) {
	// Obter ID da URL
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Printf("[ERROR] ID inválido: %s", idStr)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "ID inválido"})
		return
	}

	log.Printf("[API] Iniciando exclusão de produto ID: %d", id)

	// Verificar se o produto existe
	var existingId int
	err = db.QueryRow(context.Background(), "SELECT id FROM produtos WHERE id = $1", id).Scan(&existingId)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Produto não encontrado com ID: %d", id)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Produto não encontrado"})
		} else {
			log.Printf("[ERROR] Erro ao verificar produto: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao verificar produto"})
		}
		return
	}

	log.Printf("[DB] Excluindo produto ID: %d", id)
	// Excluir produto
	_, err = db.Exec(context.Background(), "DELETE FROM produtos WHERE id = $1", id)
	if err != nil {
		log.Printf("[ERROR] Erro ao excluir produto: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao excluir produto"})
		return
	}

	log.Printf("[DB] Produto excluído com sucesso! ID: %d", id)
	// Retornar sucesso
	c.JSON(http.StatusOK, gin.H{"message": "Produto excluído com sucesso"})
}

func getProdutosEstoqueBaixo(c *gin.Context) {
	log.Println("[DB] Buscando produtos com estoque baixo")

	// Consultar produtos com estoque baixo
	rows, err := db.Query(context.Background(), `
		SELECT id, codigo, nome, descricao, quantidade, quantidade_minima, 
		       localizacao, fornecedor, notas, data_criacao, data_atualizacao
		FROM produtos
		WHERE quantidade < COALESCE(quantidade_minima, 5)
		ORDER BY quantidade ASC
	`)

	if err != nil {
		log.Printf("[ERROR] Erro ao buscar produtos com estoque baixo: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar produtos com estoque baixo"})
		return
	}
	defer rows.Close()

	// Processar resultados
	produtos := []Produto{}
	for rows.Next() {
		var p Produto
		var descricao, localizacao, fornecedor, notas *string
		var quantidadeMinima *int
		var dataAtualizacao *time.Time

		err := rows.Scan(
			&p.ID, &p.Codigo, &p.Nome, &descricao, &p.Quantidade,
			&quantidadeMinima, &localizacao, &fornecedor, &notas,
			&p.DataCriacao, &dataAtualizacao,
		)

		if err != nil {
			log.Printf("[ERROR] Erro ao processar produto: %v", err)
			continue
		}

		// Tratar campos nulos
		if descricao != nil {
			p.Descricao = *descricao
		}
		if quantidadeMinima != nil {
			p.QuantidadeMinima = *quantidadeMinima
		} else {
			p.QuantidadeMinima = 5 // Valor padrão
		}
		if localizacao != nil {
			p.Localizacao = *localizacao
		}
		if fornecedor != nil {
			p.Fornecedor = *fornecedor
		}
		if notas != nil {
			p.Notas = *notas
		}
		if dataAtualizacao != nil {
			p.DataAtualizacao = *dataAtualizacao
		}

		produtos = append(produtos, p)
	}

	// Verificar erros durante a iteração
	if err = rows.Err(); err != nil {
		log.Printf("[ERROR] Erro ao processar produtos: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao processar produtos"})
		return
	}

	log.Printf("[DB] Encontrados %d produtos com estoque baixo", len(produtos))
	// Retornar lista de produtos
	c.JSON(http.StatusOK, produtos)
}

// Handlers de Movimentações

func getMovimentacoes(c *gin.Context) {
	log.Println("[DB] Buscando lista de movimentações")

	// Parâmetros opcionais de consulta para paginação
	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 100
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	log.Printf("[DB] Realizando consulta com limit=%d, offset=%d", limit, offset)

	// Consultar movimentações
	rows, err := db.Query(context.Background(), `
		SELECT m.id, m.produto_id, m.tipo, m.quantidade, m.notas, m.data_movimentacao,
			   p.codigo as produto_codigo, p.nome as produto_nome
		FROM movimentacoes m
		JOIN produtos p ON m.produto_id = p.id
		ORDER BY m.data_movimentacao DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)

	if err != nil {
		log.Printf("[ERROR] Erro ao buscar movimentações: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar movimentações"})
		return
	}
	defer rows.Close()

	// Processar resultados
	movimentacoes := []struct {
		Movimentacao
		ProdutoCodigo string `json:"produto_codigo"`
		ProdutoNome   string `json:"produto_nome"`
	}{}

	for rows.Next() {
		var m struct {
			Movimentacao
			ProdutoCodigo string `json:"produto_codigo"`
			ProdutoNome   string `json:"produto_nome"`
		}
		var notas *string

		err := rows.Scan(
			&m.ID, &m.ProdutoID, &m.Tipo, &m.Quantidade, &notas, &m.DataMovimentacao,
			&m.ProdutoCodigo, &m.ProdutoNome,
		)

		if err != nil {
			log.Printf("[ERROR] Erro ao processar movimentação: %v", err)
			continue
		}

		// Tratar campos nulos
		if notas != nil {
			m.Notas = *notas
		}

		movimentacoes = append(movimentacoes, m)
	}

	// Verificar erros durante a iteração
	if err = rows.Err(); err != nil {
		log.Printf("[ERROR] Erro ao processar movimentações: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao processar movimentações"})
		return
	}

	log.Printf("[DB] Retornando %d movimentações", len(movimentacoes))
	// Retornar lista de movimentações
	c.JSON(http.StatusOK, movimentacoes)
}

func getMovimentacao(c *gin.Context) {
	// Obter ID da URL
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Printf("[ERROR] ID inválido: %s", idStr)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "ID inválido"})
		return
	}

	log.Printf("[DB] Buscando movimentação com ID: %d", id)

	// Consultar movimentação por ID
	var m struct {
		Movimentacao
		ProdutoCodigo string `json:"produto_codigo"`
		ProdutoNome   string `json:"produto_nome"`
	}
	var notas *string

	err = db.QueryRow(context.Background(), `
		SELECT m.id, m.produto_id, m.tipo, m.quantidade, m.notas, m.data_movimentacao,
			   p.codigo as produto_codigo, p.nome as produto_nome
		FROM movimentacoes m
		JOIN produtos p ON m.produto_id = p.id
		WHERE m.id = $1
	`, id).Scan(
		&m.ID, &m.ProdutoID, &m.Tipo, &m.Quantidade, &notas, &m.DataMovimentacao,
		&m.ProdutoCodigo, &m.ProdutoNome,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Movimentação não encontrada com ID: %d", id)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Movimentação não encontrada"})
		} else {
			log.Printf("[ERROR] Erro ao buscar movimentação: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar movimentação"})
		}
		return
	}

	// Tratar campos nulos
	if notas != nil {
		m.Notas = *notas
	}

	log.Printf("[DB] Movimentação encontrada: ID: %d, Tipo: %s, Quantidade: %d", m.ID, m.Tipo, m.Quantidade)
	// Retornar movimentação
	c.JSON(http.StatusOK, m)
}

func criarMovimentacao(c *gin.Context) {
	log.Println("[API] Iniciando criação de movimentação")

	// Decodificar movimentação do request
	var m Movimentacao
	if err := c.ShouldBindJSON(&m); err != nil {
		log.Printf("[ERROR] Dados inválidos: %v", err)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Dados inválidos"})
		return
	}

	// Validar campos obrigatórios
	if m.ProdutoID <= 0 || m.Quantidade <= 0 || (m.Tipo != "entrada" && m.Tipo != "saida") {
		log.Printf("[ERROR] Campos obrigatórios inválidos. ProdutoID: %d, Quantidade: %d, Tipo: %s",
			m.ProdutoID, m.Quantidade, m.Tipo)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Produto, quantidade e tipo (entrada/saida) são obrigatórios"})
		return
	}

	log.Printf("[DB] Verificando produto ID: %d", m.ProdutoID)
	// Verificar se o produto existe
	var existingId int
	var quantidade int
	err := db.QueryRow(context.Background(), "SELECT id, quantidade FROM produtos WHERE id = $1", m.ProdutoID).Scan(&existingId, &quantidade)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Produto não encontrado com ID: %d", m.ProdutoID)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Produto não encontrado"})
		} else {
			log.Printf("[ERROR] Erro ao verificar produto: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao verificar produto"})
		}
		return
	}

	// Verificar se há quantidade suficiente para saída
	if m.Tipo == "saida" && quantidade < m.Quantidade {
		log.Printf("[ERROR] Quantidade insuficiente para saída. Solicitado: %d, Disponível: %d",
			m.Quantidade, quantidade)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Quantidade insuficiente em estoque"})
		return
	}

	log.Printf("[DB] Iniciando transação para registrar movimentação")
	// Iniciar transação
	tx, err := db.Begin(context.Background())
	if err != nil {
		log.Printf("[ERROR] Erro ao iniciar transação: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao iniciar transação"})
		return
	}
	defer tx.Rollback(context.Background()) // Rollback caso ocorra algum erro

	log.Printf("[DB] Inserindo movimentação: Produto ID: %d, Tipo: %s, Quantidade: %d",
		m.ProdutoID, m.Tipo, m.Quantidade)
	// Inserir movimentação
	err = tx.QueryRow(context.Background(), `
		INSERT INTO movimentacoes(produto_id, tipo, quantidade, notas)
		VALUES ($1, $2, $3, $4)
		RETURNING id, data_movimentacao
	`, m.ProdutoID, m.Tipo, m.Quantidade, m.Notas).Scan(&m.ID, &m.DataMovimentacao)

	if err != nil {
		log.Printf("[ERROR] Erro ao registrar movimentação: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao registrar movimentação"})
		return
	}

	// Atualizar quantidade do produto
	var novaQuantidade int
	if m.Tipo == "entrada" {
		novaQuantidade = quantidade + m.Quantidade
		log.Printf("[DB] Atualizando quantidade do produto ID: %d, Quantidade anterior: %d, Nova quantidade: %d",
			m.ProdutoID, quantidade, novaQuantidade)
	} else {
		novaQuantidade = quantidade - m.Quantidade
		log.Printf("[DB] Atualizando quantidade do produto ID: %d, Quantidade anterior: %d, Nova quantidade: %d",
			m.ProdutoID, quantidade, novaQuantidade)
	}

	_, err = tx.Exec(context.Background(), "UPDATE produtos SET quantidade = $1 WHERE id = $2", novaQuantidade, m.ProdutoID)
	if err != nil {
		log.Printf("[ERROR] Erro ao atualizar quantidade do produto: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao atualizar quantidade do produto"})
		return
	}

	log.Printf("[DB] Confirmando transação")
	// Commit da transação
	if err = tx.Commit(context.Background()); err != nil {
		log.Printf("[ERROR] Erro ao finalizar transação: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao finalizar transação"})
		return
	}

	log.Printf("[DB] Movimentação registrada com sucesso! ID: %d", m.ID)
	// Retornar movimentação criada
	c.JSON(http.StatusCreated, m)
}

func getMovimentacoesPorProduto(c *gin.Context) {
	// Obter produto_id da URL
	produtoIDStr := c.Param("produto_id")
	produtoID, err := strconv.Atoi(produtoIDStr)
	if err != nil {
		log.Printf("[ERROR] ID de produto inválido: %s", produtoIDStr)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "ID de produto inválido"})
		return
	}

	log.Printf("[DB] Buscando movimentações do produto ID: %d", produtoID)

	// Verificar se o produto existe
	var existingId int
	err = db.QueryRow(context.Background(), "SELECT id FROM produtos WHERE id = $1", produtoID).Scan(&existingId)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Produto não encontrado com ID: %d", produtoID)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Produto não encontrado"})
		} else {
			log.Printf("[ERROR] Erro ao verificar produto: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao verificar produto"})
		}
		return
	}

	// Consultar movimentações do produto
	rows, err := db.Query(context.Background(), `
		SELECT id, produto_id, tipo, quantidade, notas, data_movimentacao
		FROM movimentacoes
		WHERE produto_id = $1
		ORDER BY data_movimentacao DESC
	`, produtoID)

	if err != nil {
		log.Printf("[ERROR] Erro ao buscar movimentações: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar movimentações"})
		return
	}
	defer rows.Close()

	// Processar resultados
	movimentacoes := []Movimentacao{}
	for rows.Next() {
		var m Movimentacao
		var notas *string

		err := rows.Scan(
			&m.ID, &m.ProdutoID, &m.Tipo, &m.Quantidade, &notas, &m.DataMovimentacao,
		)

		if err != nil {
			log.Printf("[ERROR] Erro ao processar movimentação: %v", err)
			continue
		}

		// Tratar campos nulos
		if notas != nil {
			m.Notas = *notas
		}

		movimentacoes = append(movimentacoes, m)
	}

	// Verificar erros durante a iteração
	if err = rows.Err(); err != nil {
		log.Printf("[ERROR] Erro ao processar movimentações: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao processar movimentações"})
		return
	}

	log.Printf("[DB] Retornando %d movimentações para o produto ID: %d", len(movimentacoes), produtoID)
	// Retornar lista de movimentações
	c.JSON(http.StatusOK, movimentacoes)
}

// Handlers de Configurações

func getConfiguracoes(c *gin.Context) {
	log.Println("[DB] Buscando lista de configurações")

	// Consultar todas as configurações
	rows, err := db.Query(context.Background(), `
		SELECT id, chave, valor, descricao, data_atualizacao
		FROM configuracoes
		ORDER BY chave
	`)

	if err != nil {
		log.Printf("[ERROR] Erro ao buscar configurações: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar configurações"})
		return
	}
	defer rows.Close()

	// Processar resultados
	configuracoes := []Configuracao{}
	for rows.Next() {
		var conf Configuracao
		var descricao *string

		err := rows.Scan(
			&conf.ID, &conf.Chave, &conf.Valor, &descricao, &conf.DataAtualizacao,
		)

		if err != nil {
			log.Printf("[ERROR] Erro ao processar configuração: %v", err)
			continue
		}

		// Tratar campos nulos
		if descricao != nil {
			conf.Descricao = *descricao
		}

		configuracoes = append(configuracoes, conf)
	}

	// Verificar erros durante a iteração
	if err = rows.Err(); err != nil {
		log.Printf("[ERROR] Erro ao processar configurações: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao processar configurações"})
		return
	}

	log.Printf("[DB] Retornando %d configurações", len(configuracoes))
	// Retornar lista de configurações
	c.JSON(http.StatusOK, configuracoes)
}

func getConfiguracao(c *gin.Context) {
	// Obter chave da URL
	chave := c.Param("chave")
	log.Printf("[DB] Buscando configuração com chave: %s", chave)

	// Consultar configuração por chave
	var conf Configuracao
	var descricao *string

	err := db.QueryRow(context.Background(), `
		SELECT id, chave, valor, descricao, data_atualizacao
		FROM configuracoes
		WHERE chave = $1
	`, chave).Scan(
		&conf.ID, &conf.Chave, &conf.Valor, &descricao, &conf.DataAtualizacao,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Configuração não encontrada com chave: %s", chave)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Configuração não encontrada"})
		} else {
			log.Printf("[ERROR] Erro ao buscar configuração: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao buscar configuração"})
		}
		return
	}

	// Tratar campos nulos
	if descricao != nil {
		conf.Descricao = *descricao
	}

	log.Printf("[DB] Configuração encontrada: %s = %s", conf.Chave, conf.Valor)
	// Retornar configuração
	c.JSON(http.StatusOK, conf)
}

func atualizarConfiguracao(c *gin.Context) {
	// Obter chave da URL
	chave := c.Param("chave")
	log.Printf("[API] Iniciando atualização de configuração: %s", chave)

	// Verificar se a configuração existe
	var existingId int
	err := db.QueryRow(context.Background(), "SELECT id FROM configuracoes WHERE chave = $1", chave).Scan(&existingId)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("[DB] Configuração não encontrada com chave: %s", chave)
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "Configuração não encontrada"})
		} else {
			log.Printf("[ERROR] Erro ao verificar configuração: %v", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao verificar configuração"})
		}
		return
	}

	// Decodificar configuração do request
	var conf Configuracao
	if err := c.ShouldBindJSON(&conf); err != nil {
		log.Printf("[ERROR] Dados inválidos: %v", err)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Dados inválidos"})
		return
	}

	// Validar campos obrigatórios
	if conf.Valor == "" {
		log.Printf("[ERROR] Valor não pode ser vazio para chave: %s", chave)
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Valor é obrigatório"})
		return
	}

	log.Printf("[DB] Atualizando configuração %s = %s", chave, conf.Valor)
	// Atualizar configuração
	var dataAtualizacao time.Time
	err = db.QueryRow(context.Background(), `
		UPDATE configuracoes SET 
			valor = $1, 
			descricao = $2,
			data_atualizacao = CURRENT_TIMESTAMP
		WHERE chave = $3
		RETURNING id, data_atualizacao
	`, conf.Valor, conf.Descricao, chave).Scan(&conf.ID, &dataAtualizacao)

	if err != nil {
		log.Printf("[ERROR] Erro ao atualizar configuração: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Erro ao atualizar configuração"})
		return
	}

	// Definir chave e data de atualização
	conf.Chave = chave
	conf.DataAtualizacao = dataAtualizacao

	log.Printf("[DB] Configuração atualizada com sucesso! %s = %s", chave, conf.Valor)
	// Retornar configuração atualizada
	c.JSON(http.StatusOK, conf)
}

// Handler para Dashboard

func getDashboardData(c *gin.Context) {
	log.Println("[DB] Gerando dados para o dashboard")

	dashboardData := DashboardData{}

	// 1. Total de produtos
	err := db.QueryRow(context.Background(), "SELECT COUNT(*) FROM produtos").Scan(&dashboardData.TotalProdutos)
	if err != nil {
		log.Printf("[WARN] Erro ao contar produtos: %v", err)
		// Continuar mesmo com erro
	} else {
		log.Printf("[DB] Total de produtos: %d", dashboardData.TotalProdutos)
	}

	// 2. Total de itens em estoque
	err = db.QueryRow(context.Background(), "SELECT COALESCE(SUM(quantidade), 0) FROM produtos").Scan(&dashboardData.TotalItens)
	if err != nil {
		log.Printf("[WARN] Erro ao somar itens em estoque: %v", err)
		// Continuar mesmo com erro
	} else {
		log.Printf("[DB] Total de itens em estoque: %d", dashboardData.TotalItens)
	}

	// 3. Produtos com estoque baixo
	err = db.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM produtos
		WHERE quantidade < COALESCE(quantidade_minima, 5)
	`).Scan(&dashboardData.EstoqueBaixo)
	if err != nil {
		log.Printf("[WARN] Erro ao contar produtos com estoque baixo: %v", err)
		// Continuar mesmo com erro
	} else {
		log.Printf("[DB] Produtos com estoque baixo: %d", dashboardData.EstoqueBaixo)
	}

	// 4. Últimas movimentações
	rows, err := db.Query(context.Background(), `
		SELECT m.id, m.tipo, m.quantidade, m.data_movimentacao, m.notas,
			   p.codigo as produto_codigo, p.nome as produto_nome
		FROM movimentacoes m
		JOIN produtos p ON m.produto_id = p.id
		ORDER BY m.data_movimentacao DESC
		LIMIT 10
	`)

	if err != nil {
		log.Printf("[WARN] Erro ao buscar últimas movimentações: %v", err)
		// Continuar mesmo com erro
	} else {
		defer rows.Close()

		// Processar resultados
		movimentacoes := []MovimentacaoView{}
		for rows.Next() {
			var m MovimentacaoView
			var notas *string

			err := rows.Scan(
				&m.ID, &m.Tipo, &m.Quantidade, &m.DataMovimentacao, &notas,
				&m.ProdutoCodigo, &m.ProdutoNome,
			)

			if err != nil {
				log.Printf("[WARN] Erro ao processar movimentação: %v", err)
				continue
			}

			// Tratar campos nulos
			if notas != nil {
				m.Notas = *notas
			}

			movimentacoes = append(movimentacoes, m)
		}

		// Verificar erros durante a iteração
		if err = rows.Err(); err != nil {
			log.Printf("[WARN] Erro ao processar movimentações: %v", err)
			// Continuar mesmo com erro
		}

		dashboardData.UltimasMovimentacoes = movimentacoes
		log.Printf("[DB] Últimas movimentações: %d registros", len(movimentacoes))
	}

	// 5. Top produtos por quantidade
	rows, err = db.Query(context.Background(), `
		SELECT codigo, nome, quantidade
		FROM produtos
		ORDER BY quantidade DESC
		LIMIT 5
	`)

	if err != nil {
		log.Printf("[WARN] Erro ao buscar top produtos: %v", err)
		// Continuar mesmo com erro
	} else {
		defer rows.Close()

		// Processar resultados
		topProdutos := []ProdutoView{}
		for rows.Next() {
			var p ProdutoView

			err := rows.Scan(&p.Codigo, &p.Nome, &p.Quantidade)

			if err != nil {
				log.Printf("[WARN] Erro ao processar produto: %v", err)
				continue
			}

			topProdutos = append(topProdutos, p)
		}

		// Verificar erros durante a iteração
		if err = rows.Err(); err != nil {
			log.Printf("[WARN] Erro ao processar produtos: %v", err)
			// Continuar mesmo com erro
		}

		dashboardData.TopProdutos = topProdutos
		log.Printf("[DB] Top produtos: %d registros", len(topProdutos))
	}

	log.Println("[API] Dashboard gerado com sucesso")
	// Retornar dados do dashboard
	c.JSON(http.StatusOK, dashboardData)
}
