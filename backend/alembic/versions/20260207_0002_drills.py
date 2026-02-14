"""drills table + seed drills

Revision ID: 20260207_0002
Revises: 20260207_0001
Create Date: 2026-02-07

"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone


revision = "20260207_0002"
down_revision = "20260207_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "drills",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_by_user_id", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_drills_subject", "drills", ["subject"])
    op.create_index("ix_drills_created_by_user_id", "drills", ["created_by_user_id"])

    drills_table = sa.table(
        "drills",
        sa.column("id", sa.String()),
        sa.column("subject", sa.String()),
        sa.column("question", sa.Text()),
        sa.column("answer", sa.Text()),
        sa.column("tags_json", sa.Text()),
        sa.column("created_by_user_id", sa.String()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        drills_table,
        [
            {
                "id": "sql-joins-1",
                "subject": "SQL",
                "question": "Qual a diferença entre INNER JOIN e LEFT JOIN?",
                "answer": "INNER JOIN retorna apenas linhas com correspondência nas duas tabelas. LEFT JOIN retorna todas as linhas da tabela da esquerda e, quando não há match, preenche a direita com NULL.",
                "tags_json": '["joins","fundamentos"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "sql-where-having",
                "subject": "SQL",
                "question": "Quando usar WHERE e quando usar HAVING?",
                "answer": "WHERE filtra linhas antes do GROUP BY (dados brutos). HAVING filtra grupos depois do GROUP BY (resultados agregados).",
                "tags_json": '["agregacao"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "sql-window-1",
                "subject": "SQL",
                "question": "O que são window functions e pra que servem?",
                "answer": "São funções (ex: ROW_NUMBER, SUM OVER) que calculam valores usando uma janela de linhas relacionadas, sem colapsar o resultado como o GROUP BY.",
                "tags_json": '["window"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "sql-index-1",
                "subject": "SQL",
                "question": "Por que um índice pode acelerar consultas — e quando pode piorar?",
                "answer": "Índices aceleram leitura ao evitar varreduras completas. Podem piorar em cargas com muitas escritas (INSERT/UPDATE/DELETE) e em consultas que retornam grande parte da tabela.",
                "tags_json": '["performance"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "sql-normalization",
                "subject": "SQL",
                "question": "Qual a ideia de normalização (3FN) em bancos relacionais?",
                "answer": "Reduzir redundância e anomalias de atualização, garantindo dependências funcionais bem definidas; em geral, cada fato é armazenado uma vez e referenciado por chaves.",
                "tags_json": '["modelagem"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "py-list-vs-tuple",
                "subject": "Python",
                "question": "Quando usar list vs tuple?",
                "answer": "List é mutável (adicionar/remover/alterar). Tuple é imutável; costuma ser usada para dados fixos e pode ser mais eficiente/segura para chaves.",
                "tags_json": '["fundamentos"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "py-dict-comprehension",
                "subject": "Python",
                "question": "O que é dict comprehension? Dê um exemplo.",
                "answer": "É uma forma concisa de construir dicionários: {k: v for ...}. Ex: {i: i*i for i in range(5)}.",
                "tags_json": '["fundamentos"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "py-iterable-iterator",
                "subject": "Python",
                "question": "Qual a diferença entre iterable e iterator?",
                "answer": "Iterable pode ser iterado (implementa __iter__). Iterator é o objeto que produz itens (implementa __next__ e __iter__).",
                "tags_json": '["fundamentos"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "py-exceptions",
                "subject": "Python",
                "question": "Como usar try/except/finally de forma correta?",
                "answer": "Use try para o trecho que pode falhar, except para capturar exceções específicas, else para o caminho sem erro e finally para limpeza (fecha arquivos/conexões).",
                "tags_json": '["boas praticas"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "py-pandas-groupby",
                "subject": "Python",
                "question": "No pandas, o que o groupby faz?",
                "answer": "Agrupa linhas por uma ou mais chaves e permite aplicar agregações/transformações (sum, mean, count, transform, apply).",
                "tags_json": '["pandas"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "xl-xlookup",
                "subject": "Excel",
                "question": "Para que serve o XLOOKUP/PROCX e o que ele melhora em relação ao PROCV?",
                "answer": "Procura valores de forma flexível (esquerda/direita), aceita correspondência aproximada, retorno padrão quando não encontra e é mais robusto que PROCV.",
                "tags_json": '["lookup"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "xl-pivot",
                "subject": "Excel",
                "question": "Qual o benefício de usar Tabela Dinâmica?",
                "answer": "Resume grandes tabelas rapidamente (soma/contagem/média), permite segmentar e reorganizar campos sem fórmulas complexas.",
                "tags_json": '["analise"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "xl-powerquery",
                "subject": "Excel",
                "question": "O que o Power Query resolve bem em projetos de dados?",
                "answer": "ETL leve: importar, limpar, transformar, mesclar e automatizar atualizações de dados sem repetir passos manualmente.",
                "tags_json": '["etl"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "dm-star-schema",
                "subject": "Data Modeling",
                "question": "O que é um modelo estrela (star schema)?",
                "answer": "Fato central (medidas) ligada a dimensões (atributos descritivos). Facilita BI e consultas analíticas com JOINs previsíveis.",
                "tags_json": '["bi"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "dm-scd2",
                "subject": "Data Modeling",
                "question": "O que é SCD Type 2 em dimensões?",
                "answer": "Mantém histórico criando novas linhas quando um atributo muda, usando datas de vigência e/ou flag de registro atual.",
                "tags_json": '["dimensoes"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "cloud-s3",
                "subject": "Cloud",
                "question": "Por que separar dados em camadas (raw/bronze, silver, gold) num data lake?",
                "answer": "Organiza a evolução do dado: raw preserva origem, silver padroniza/limpa, gold entrega dados prontos para consumo (BI/ML) com qualidade e governança.",
                "tags_json": '["lakehouse"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "etl-idempotent",
                "subject": "ETL",
                "question": "O que significa um pipeline idempotente?",
                "answer": "Executar o pipeline múltiplas vezes produz o mesmo resultado final (sem duplicar/estragar dados). Geralmente envolve upsert, chaves naturais e controle de incremental.",
                "tags_json": '["boas praticas"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "spark-partition",
                "subject": "Spark",
                "question": "Para que serve particionamento (partitioning) em arquivos Parquet?",
                "answer": "Acelera leitura ao permitir pruning de partições (ler só pastas relevantes) e reduz custo. Particiona por colunas usadas em filtros (ex: data).",
                "tags_json": '["performance"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "kafka-topic",
                "subject": "Kafka",
                "question": "Qual a função de partitions em um tópico Kafka?",
                "answer": "Permitem paralelismo e escala. A ordem é garantida dentro de uma partition (não no tópico inteiro).",
                "tags_json": '["streaming"]',
                "created_by_user_id": None,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_drills_created_by_user_id", table_name="drills")
    op.drop_index("ix_drills_subject", table_name="drills")
    op.drop_table("drills")
