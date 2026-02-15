from __future__ import annotations

from typing import TypedDict


class CombatQuestion(TypedDict):
    id: str
    text: str
    options: list[str]
    correctAnswer: int
    damage: int


class CombatBoss(TypedDict):
    name: str
    hp: int
    rank: str


class CombatModule(TypedDict):
    id: str
    title: str
    boss: CombatBoss
    questions: list[CombatQuestion]


COMBAT_MODULES: list[CombatModule] = [
    {
        "id": "basic",
        "title": "Excel Essencial",
        "boss": {"name": "O Planilhador Caotico", "hp": 100, "rank": "F"},
        "questions": [
            {
                "id": "q1",
                "text": "Qual atalho seleciona toda a coluna atual?",
                "options": ["Ctrl + Espaco", "Shift + Espaco", "Ctrl + A", "Alt + F4"],
                "correctAnswer": 0,
                "damage": 15,
            },
            {
                "id": "q2",
                "text": "Qual simbolo inicia uma formula no Excel?",
                "options": [">", "#", "=", "@"],
                "correctAnswer": 2,
                "damage": 15,
            },
            {
                "id": "q3",
                "text": "Como fixar uma celula em uma formula (referencia absoluta)?",
                "options": ["Usando %", "Usando $", "Usando &", "Usando *"],
                "correctAnswer": 1,
                "damage": 20,
            },
        ],
    },
    {
        "id": "intermediate",
        "title": "Dominando Logica",
        "boss": {"name": "Erro #N/D", "hp": 250, "rank": "D"},
        "questions": [
            {
                "id": "q_int_1",
                "text": "O que a funcao E(A1>10; A2<5) retorna se A1=12 e A2=4?",
                "options": ["FALSO", "VERDADEIRO", "#N/D", "ERRO"],
                "correctAnswer": 1,
                "damage": 30,
            },
            {
                "id": "q_int_2",
                "text": "Qual o quarto argumento do PROCV (Procurar Intervalo)?",
                "options": [
                    "Numero da coluna",
                    "Valor procurado",
                    "Correspondencia (0 ou 1)",
                    "Matriz tabela",
                ],
                "correctAnswer": 2,
                "damage": 35,
            },
            {
                "id": "q_int_3",
                "text": "A funcao CONT.SE serve para:",
                "options": [
                    "Somar valores",
                    "Contar celulas nao vazias",
                    "Contar celulas que atendem a um criterio",
                    "Contar caracteres",
                ],
                "correctAnswer": 2,
                "damage": 25,
            },
        ],
    },
    {
        "id": "advanced",
        "title": "Mestrado em Dados",
        "boss": {"name": "Leviata de Dados", "hp": 600, "rank": "B"},
        "questions": [
            {
                "id": "q_adv_1",
                "text": "O que e uma Segmentacao de Dados (Slicer)?",
                "options": ["Uma formula de corte", "Um filtro visual interativo", "Uma macro", "Um grafico de pizza"],
                "correctAnswer": 1,
                "damage": 50,
            },
            {
                "id": "q_adv_2",
                "text": "Em Tabelas Dinamicas, onde colocamos campos numericos para somar?",
                "options": ["Filtros", "Colunas", "Linhas", "Valores"],
                "correctAnswer": 3,
                "damage": 45,
            },
            {
                "id": "q_adv_3",
                "text": "Qual atalho atualiza todas as Tabelas Dinamicas?",
                "options": ["F5", "Ctrl + Alt + F5", "Alt + F5", "Shift + F9"],
                "correctAnswer": 1,
                "damage": 60,
            },
        ],
    },
    {
        "id": "dashboards",
        "title": "Dashboards Impressionadores",
        "boss": {"name": "O Ilusionista Visual", "hp": 800, "rank": "A"},
        "questions": [
            {
                "id": "q_dash_1",
                "text": "Qual grafico e ideal para mostrar tendencias ao longo do tempo?",
                "options": ["Pizza", "Linha", "Radar", "Dispersao"],
                "correctAnswer": 1,
                "damage": 70,
            },
            {
                "id": "q_dash_2",
                "text": "Para criar um Grafico de Velocimetro, combinamos quais graficos?",
                "options": ["Barra + Linha", "Rosca + Pizza", "Area + Coluna", "Bolhas + Radar"],
                "correctAnswer": 1,
                "damage": 80,
            },
            {
                "id": "q_dash_3",
                "text": "Qual regra de design ajuda a destacar o mais importante?",
                "options": ["Usar todas as cores", "Espaco em branco (Respiro)", "Graficos 3D", "Muitas bordas"],
                "correctAnswer": 1,
                "damage": 60,
            },
        ],
    },
    {
        "id": "vba",
        "title": "O Codigo Proibido (VBA)",
        "boss": {"name": "Loop Infinito", "hp": 1500, "rank": "S"},
        "questions": [
            {
                "id": "q_vba_1",
                "text": "Qual objeto representa uma celula no VBA?",
                "options": ["Cell", "Box", "Range", "Sheet"],
                "correctAnswer": 2,
                "damage": 100,
            },
            {
                "id": "q_vba_2",
                "text": "Para declarar uma variavel de texto, usamos:",
                "options": ["Dim x As String", "Dim x As Text", "Dim x As Char", "Var x = Text"],
                "correctAnswer": 0,
                "damage": 90,
            },
            {
                "id": "q_vba_3",
                "text": "Qual comando sai de um loop For?",
                "options": ["Stop", "Exit For", "Break", "End"],
                "correctAnswer": 1,
                "damage": 110,
            },
        ],
    },
    {
        "id": "powerquery",
        "title": "Power Query & BI",
        "boss": {"name": "A Hidra M", "hp": 1200, "rank": "S"},
        "questions": [
            {
                "id": "q_pq_1",
                "text": "Qual a linguagem utilizada pelo Power Query?",
                "options": ["DAX", "SQL", "M", "VBA"],
                "correctAnswer": 2,
                "damage": 120,
            },
            {
                "id": "q_pq_2",
                "text": "O que a operacao 'Unpivot' faz?",
                "options": [
                    "Remove pivos",
                    "Transforma colunas em linhas",
                    "Transforma linhas em colunas",
                    "Exclui duplicatas",
                ],
                "correctAnswer": 1,
                "damage": 130,
            },
            {
                "id": "q_pq_3",
                "text": "Power Query e uma ferramenta de:",
                "options": [
                    "Design",
                    "ETL (Extracao, Transformacao, Carregamento)",
                    "Edicao de Video",
                    "Criacao de Jogos",
                ],
                "correctAnswer": 1,
                "damage": 100,
            },
        ],
    },
]


MODULE_BY_ID: dict[str, CombatModule] = {m["id"]: m for m in COMBAT_MODULES}


def get_combat_module(module_id: str | None) -> CombatModule:
    if module_id and module_id in MODULE_BY_ID:
        return MODULE_BY_ID[module_id]
    return COMBAT_MODULES[0]

