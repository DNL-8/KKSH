export interface ExcelMission {
    id: string;
    title: string;
    xp: number;
    type: "Logic" | "Visual" | "Data" | "Automation";
    completed: boolean;
}

export interface ExcelBoss {
    name: string;
    hp: number;
    rank: string; // Using string to allow "Rank F" etc strings, or could import HunterRank
    image: string;
    description: string;
    stats: {
        atk: string;
        def: string;
        spd: string;
    };
}

export interface ExcelQuestion {
    id: string;
    text: string;
    options: string[];
    correctAnswer: number; // 0-3 index
    damage: number;
}

export interface ExcelModule {
    id: string;
    title: string;
    description: string;
    icon: string;
    difficulty: "Iniciante" | "Intermediário" | "Avançado" | "Lendário";
    missions: ExcelMission[];
    boss: ExcelBoss;
    questions: ExcelQuestion[];
    color: string;
}

export const EXCEL_MODULES: ExcelModule[] = [
    {
        id: "basic",
        title: "Excel Essencial",
        description: "Domine a interface, atalhos e as fórmulas fundamentais. A base de tudo.",
        icon: "table",
        difficulty: "Iniciante",
        color: "text-green-500",
        missions: [
            { id: "m1", title: "Dominar Atalhos de Navegação", xp: 50, type: "Logic", completed: false },
            { id: "m2", title: "Fórmulas SOMA e MEDIA", xp: 50, type: "Logic", completed: false },
            { id: "m3", title: "Formatação Condicional Básica", xp: 75, type: "Visual", completed: false },
        ],
        boss: {
            name: "O Planilhador Caótico",
            hp: 100,
            rank: "F",
            image: "/assets/bosses/excel_basic_boss.png", // Placeholder
            description: "Uma entidade feita de células mescladas incorretamente e dados não formatados.",
            stats: { atk: "150", def: "50", spd: "Slow" },
        },
        questions: [
            {
                id: "q1",
                text: "Qual atalho seleciona toda a coluna atual?",
                options: ["Ctrl + Espaço", "Shift + Espaço", "Ctrl + A", "Alt + F4"],
                correctAnswer: 0,
                damage: 15,
            },
            {
                id: "q2",
                text: "Qual símbolo inicia uma fórmula no Excel?",
                options: [">", "#", "=", "@"],
                correctAnswer: 2,
                damage: 15,
            },
            {
                id: "q3",
                text: "Como fixar uma célula em uma fórmula (referência absoluta)?",
                options: ["Usando %", "Usando $", "Usando &", "Usando *"],
                correctAnswer: 1,
                damage: 20,
            },
        ]
    },
    {
        id: "intermediate",
        title: "Dominando Lógica",
        description: "Funções lógicas (SE, E, OU) e de busca (PROCV, INDICE+CORRESP).",
        icon: "calculator",
        difficulty: "Intermediário",
        color: "text-blue-500",
        missions: [
            { id: "m4", title: "Aninhamento de SE", xp: 150, type: "Logic", completed: false },
            { id: "m5", title: "PROCV entre planilhas", xp: 200, type: "Data", completed: false },
            { id: "m6", title: "Validacão de Dados", xp: 100, type: "Logic", completed: false },
        ],
        boss: {
            name: "Erro #N/D",
            hp: 250,
            rank: "D",
            image: "/assets/bosses/excel_inter_boss.png",
            description: "Um fantasma que assombra quem não trava as células corretamente.",
            stats: { atk: "400", def: "200", spd: "Medium" },
        },
        questions: [
            {
                id: "q_int_1",
                text: "O que a função E(A1>10; A2<5) retorna se A1=12 e A2=4?",
                options: ["FALSO", "VERDADEIRO", "#N/D", "ERRO"],
                correctAnswer: 1,
                damage: 30,
            },
            {
                id: "q_int_2",
                text: "Qual o quarto argumento do PROCV (Procurar Intervalo)?",
                options: ["Número da coluna", "Valor procurado", "Correspondência (0 ou 1)", "Matriz tabela"],
                correctAnswer: 2,
                damage: 35,
            },
            {
                id: "q_int_3",
                text: "A função CONT.SE serve para:",
                options: ["Somar valores", "Contar células não vazias", "Contar células que atendem a um critério", "Contar caracteres"],
                correctAnswer: 2,
                damage: 25,
            }
        ]
    },
    {
        id: "advanced",
        title: "Mestrado em Dados",
        description: "Tabelas Dinâmicas, Power Pivot e análise de grandes volumes de dados.",
        icon: "database",
        difficulty: "Avançado",
        color: "text-purple-500",
        missions: [
            { id: "m7", title: "Tabela Dinâmica com Slicers", xp: 300, type: "Data", completed: false },
            { id: "m8", title: "Campos Calculados", xp: 350, type: "Logic", completed: false },
            { id: "m9", title: "Dashboard Interativo", xp: 500, type: "Visual", completed: false },
        ],
        boss: {
            name: "Leviatã de Dados",
            hp: 600,
            rank: "B",
            image: "/assets/bosses/excel_adv_boss.png",
            description: "Um monstro marinho que se alimenta de gigabytes de dados brutos.",
            stats: { atk: "1.2k", def: "800", spd: "Fast" },
        },
        questions: [
            {
                id: "q_adv_1",
                text: "O que é uma Segmentação de Dados (Slicer)?",
                options: ["Uma fórmula de corte", "Um filtro visual interativo", "Uma macro", "Um gráfico de pizza"],
                correctAnswer: 1,
                damage: 50,
            },
            {
                id: "q_adv_2",
                text: "Em Tabelas Dinâmicas, onde colocamos campos numéricos para somar?",
                options: ["Filtros", "Colunas", "Linhas", "Valores"],
                correctAnswer: 3,
                damage: 45,
            },
            {
                id: "q_adv_3",
                text: "Qual atalho atualiza todas as Tabeas Dinâmicas?",
                options: ["F5", "Ctrl + Alt + F5", "Alt + F5", "Shift + F9"],
                correctAnswer: 1,
                damage: 60,
            }
        ]
    },
    {
        id: "dashboards",
        title: "Dashboards Impressionadores",
        description: "Crie visuais estonteantes que contam histórias com dados.",
        icon: "chart-histogram",
        difficulty: "Avançado",
        color: "text-orange-500",
        missions: [
            { id: "m10", title: "Gráfico de Velocímetro", xp: 400, type: "Visual", completed: false },
            { id: "m11", title: "Design de Layout Executivo", xp: 450, type: "Visual", completed: false },
            { id: "m12", title: "Menu de Navegação VBA", xp: 500, type: "Automation", completed: false },
        ],
        boss: {
            name: "O Ilusionista Visual",
            hp: 800,
            rank: "A",
            image: "/assets/bosses/excel_dash_boss.png",
            description: "Ele confunde seus inimigos com gráficos 3D ruins e cores sem contraste.",
            stats: { atk: "1.8k", def: "500", spd: "Very Fast" },
        },
        questions: [
            {
                id: "q_dash_1",
                text: "Qual gráfico é ideal para mostrar tendências ao longo do tempo?",
                options: ["Pizza", "Linha", "Radar", "Dispersão"],
                correctAnswer: 1,
                damage: 70,
            },
            {
                id: "q_dash_2",
                text: "Para criar um Gráfico de Velocímetro, combinamos quais gráficos?",
                options: ["Barra + Linha", "Rosca + Pizza", "Área + Coluna", "Bolhas + Radar"],
                correctAnswer: 1,
                damage: 80,
            },
            {
                id: "q_dash_3",
                text: "Qual regra de design ajuda a destacar o mais importante?",
                options: ["Usar todas as cores", "Espaço em branco (Respiro)", "Gráficos 3D", "Muitas bordas"],
                correctAnswer: 1,
                damage: 60,
            }
        ]
    },
    {
        id: "vba",
        title: "O Código Proibido (VBA)",
        description: "Automação total. Crie macros e ferramentas que trabalham por você.",
        icon: "brackets-curly",
        difficulty: "Lendário",
        color: "text-red-500",
        missions: [
            { id: "m13", title: "Loop For Each", xp: 800, type: "Automation", completed: false },
            { id: "m14", title: "UserForm Complexo", xp: 1000, type: "Visual", completed: false },
            { id: "m15", title: "Integração Outlook", xp: 1200, type: "Automation", completed: false },
        ],
        boss: {
            name: "Loop Infinito",
            hp: 1500,
            rank: "S",
            image: "/assets/bosses/excel_vba_boss.png",
            description: "Uma singularidade temporal que trava o Excel para sempre.",
            stats: { atk: "MAX", def: "9999", spd: "Instant" },
        },
        questions: [
            {
                id: "q_vba_1",
                text: "Qual objeto representa uma célula no VBA?",
                options: ["Cell", "Box", "Range", "Sheet"],
                correctAnswer: 2,
                damage: 100,
            },
            {
                id: "q_vba_2",
                text: "Para declarar uma variável de texto, usamos:",
                options: ["Dim x As String", "Dim x As Text", "Dim x As Char", "Var x = Text"],
                correctAnswer: 0,
                damage: 90,
            },
            {
                id: "q_vba_3",
                text: "Qual comando sai de um loop For?",
                options: ["Stop", "Exit For", "Break", "End"],
                correctAnswer: 1,
                damage: 110,
            }
        ]
    },
    {
        id: "powerquery",
        title: "Power Query & BI",
        description: "ETL avançado. Trate dados de múltiplas fontes sem esforço.",
        icon: "chart-network",
        difficulty: "Lendário",
        color: "text-yellow-500",
        missions: [
            { id: "m16", title: "Unpivot Columns", xp: 600, type: "Data", completed: false },
            { id: "m17", title: "M Language Custom Function", xp: 900, type: "Logic", completed: false },
            { id: "m18", title: "Conexão com API Web", xp: 1000, type: "Data", completed: false },
        ],
        boss: {
            name: "A Hidra M",
            hp: 1200,
            rank: "S",
            image: "/assets/bosses/excel_pq_boss.png",
            description: "Corte uma etapa de consulta e duas nascem no lugar.",
            stats: { atk: "3.5k", def: "1.5k", spd: "Fast" },
        },
        questions: [
            {
                id: "q_pq_1",
                text: "Qual a linguagem utilizada pelo Power Query?",
                options: ["DAX", "SQL", "M", "VBA"],
                correctAnswer: 2,
                damage: 120,
            },
            {
                id: "q_pq_2",
                text: "O que a operação 'Unpivot' faz?",
                options: ["Remove pivôs", "Transforma colunas em linhas", "Transforma linhas em colunas", "Exclui duplicatas"],
                correctAnswer: 1,
                damage: 130,
            },
            {
                id: "q_pq_3",
                text: "Power Query é uma ferramenta de:",
                options: ["Design", "ETL (Extração, Transformação, Carregamento)", "Edição de Vídeo", "Criação de Jogos"],
                correctAnswer: 1,
                damage: 100,
            }
        ]
    },
];
