from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models import Drill, User

DEFAULT_DRILLS: list[dict] = [
    {
        "id": "sql-joins-1",
        "subject": "SQL",
        "question": "Qual a diferença entre INNER JOIN e LEFT JOIN?",
        "answer": "INNER JOIN retorna apenas linhas com correspondência nas duas tabelas. LEFT JOIN retorna todas as linhas da tabela da esquerda e, quando não há match, preenche a direita com NULL.",
        "tags": ["joins", "fundamentos"],
    },
    {
        "id": "sql-where-having",
        "subject": "SQL",
        "question": "Quando usar WHERE e quando usar HAVING?",
        "answer": "WHERE filtra linhas antes do GROUP BY (dados brutos). HAVING filtra grupos depois do GROUP BY (resultados agregados).",
        "tags": ["agregacao"],
    },
    {
        "id": "sql-window-1",
        "subject": "SQL",
        "question": "O que são window functions e pra que servem?",
        "answer": "São funções (ex: ROW_NUMBER, SUM OVER) que calculam valores usando uma janela de linhas relacionadas, sem colapsar o resultado como o GROUP BY.",
        "tags": ["window"],
    },
    {
        "id": "sql-index-1",
        "subject": "SQL",
        "question": "Por que um índice pode acelerar consultas — e quando pode piorar?",
        "answer": "Índices aceleram leitura ao evitar varreduras completas. Podem piorar em cargas com muitas escritas (INSERT/UPDATE/DELETE) e em consultas que retornam grande parte da tabela.",
        "tags": ["performance"],
    },
    {
        "id": "sql-normalization",
        "subject": "SQL",
        "question": "Qual a ideia de normalização (3FN) em bancos relacionais?",
        "answer": "Reduzir redundância e anomalias de atualização, garantindo dependências funcionais bem definidas; em geral, cada fato é armazenado uma vez e referenciado por chaves.",
        "tags": ["modelagem"],
    },
    {
        "id": "py-list-vs-tuple",
        "subject": "Python",
        "question": "Quando usar list vs tuple?",
        "answer": "List é mutável (adicionar/remover/alterar). Tuple é imutável; costuma ser usada para dados fixos e pode ser mais eficiente/segura para chaves.",
        "tags": ["fundamentos"],
    },
    {
        "id": "py-dict-comprehension",
        "subject": "Python",
        "question": "O que é dict comprehension? Dê um exemplo.",
        "answer": "É uma forma concisa de construir dicionários: {k: v for ...}. Ex: {i: i*i for i in range(5)}.",
        "tags": ["fundamentos"],
    },
    {
        "id": "py-iterable-iterator",
        "subject": "Python",
        "question": "Qual a diferença entre iterable e iterator?",
        "answer": "Iterable pode ser iterado (implementa __iter__). Iterator é o objeto que produz itens (implementa __next__ e __iter__).",
        "tags": ["fundamentos"],
    },
    {
        "id": "py-exceptions",
        "subject": "Python",
        "question": "Como usar try/except/finally de forma correta?",
        "answer": "Use try para o trecho que pode falhar, except para capturar exceções específicas, else para o caminho sem erro e finally para limpeza (fecha arquivos/conexões).",
        "tags": ["boas praticas"],
    },
    {
        "id": "py-pandas-groupby",
        "subject": "Python",
        "question": "No pandas, o que o groupby faz?",
        "answer": "Agrupa linhas por uma ou mais chaves e permite aplicar agregações/transformações (sum, mean, count, transform, apply).",
        "tags": ["pandas"],
    },
    {
        "id": "xl-xlookup",
        "subject": "Excel",
        "question": "Para que serve o XLOOKUP/PROCX e o que ele melhora em relação ao PROCV?",
        "answer": "Procura valores de forma flexível (esquerda/direita), aceita correspondência aproximada, retorno padrão quando não encontra e é mais robusto que PROCV.",
        "tags": ["lookup"],
    },
    {
        "id": "xl-pivot",
        "subject": "Excel",
        "question": "Qual o benefício de usar Tabela Dinâmica?",
        "answer": "Resume grandes tabelas rapidamente (soma/contagem/média), permite segmentar e reorganizar campos sem fórmulas complexas.",
        "tags": ["analise"],
    },
    {
        "id": "xl-powerquery",
        "subject": "Excel",
        "question": "O que o Power Query resolve bem em projetos de dados?",
        "answer": "ETL leve: importar, limpar, transformar, mesclar e automatizar atualizações de dados sem repetir passos manualmente.",
        "tags": ["etl"],
    },
    {
        "id": "dm-star-schema",
        "subject": "Data Modeling",
        "question": "O que é um modelo estrela (star schema)?",
        "answer": "Fato central (medidas) ligada a dimensões (atributos descritivos). Facilita BI e consultas analíticas com JOINs previsíveis.",
        "tags": ["bi"],
    },
    {
        "id": "dm-scd2",
        "subject": "Data Modeling",
        "question": "O que é SCD Type 2 em dimensões?",
        "answer": "Mantém histórico criando novas linhas quando um atributo muda, usando datas de vigência e/ou flag de registro atual.",
        "tags": ["dimensoes"],
    },
    {
        "id": "cloud-s3",
        "subject": "Cloud",
        "question": "Por que separar dados em camadas (raw/bronze, silver, gold) num data lake?",
        "answer": "Organiza a evolução do dado: raw preserva origem, silver padroniza/limpa, gold entrega dados prontos para consumo (BI/ML) com qualidade e governança.",
        "tags": ["lakehouse"],
    },
    {
        "id": "etl-idempotent",
        "subject": "ETL",
        "question": "O que significa um pipeline idempotente?",
        "answer": "Executar o pipeline múltiplas vezes produz o mesmo resultado final (sem duplicar/estragar dados). Geralmente envolve upsert, chaves naturais e controle de incremental.",
        "tags": ["boas praticas"],
    },
    {
        "id": "spark-partition",
        "subject": "Spark",
        "question": "Para que serve particionamento (partitioning) em arquivos Parquet?",
        "answer": "Acelera leitura ao permitir pruning de partições (ler só pastas relevantes) e reduz custo. Particiona por colunas usadas em filtros (ex: data).",
        "tags": ["performance"],
    },
    {
        "id": "kafka-topic",
        "subject": "Kafka",
        "question": "Qual a função de partitions em um tópico Kafka?",
        "answer": "Permitem paralelismo e escala. A ordem é garantida dentro de uma partition (não no tópico inteiro).",
        "tags": ["streaming"],
    },
]


def ensure_default_drills(session: Session) -> None:
    existing = session.exec(select(Drill.id).limit(1)).first()
    if existing:
        return
    now = datetime.now(timezone.utc)
    for d in DEFAULT_DRILLS:
        session.add(
            Drill(
                id=d["id"],
                subject=d["subject"],
                question=d["question"],
                answer=d["answer"],
                tags_json=json.dumps(d.get("tags", [])),
                created_by_user_id=None,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )
    session.commit()


def ensure_dev_user(
    session: Session, email: str = "test@example.com", password: str = "test123"
) -> None:
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        # In test env, always recreate the seeded user so e2e starts from a clean state.
        if settings.env == "test":
            session.delete(existing)
            session.commit()
            existing = None

    if existing:
        # Keep e2e/dev login deterministic even if the user password changed manually.
        if not verify_password(password, existing.password_hash):
            existing.password_hash = hash_password(password)
            session.add(existing)
            session.commit()
        return
    user = User(email=email, password_hash=hash_password(password))
    session.add(user)
    session.commit()


def ensure_dev_seed_data(session: Session) -> None:
    """Seed a minimal dataset for local development / e2e.

    This is intentionally small and safe to run multiple times.
    """

    ensure_default_drills(session)
    ensure_dev_user(session)
    ensure_dev_user(session, email="happy@example.com", password="test123")
