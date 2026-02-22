import { useState, useEffect } from "react";
import { Icon } from "../components/common/Icon";
import { useSystemRPG, getRank, getNextRank } from "../lib/systemStore";

// --- ESTILOS GLOBAIS (UX/UI Premium + Animações) ---
const globalStyles = `
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes pulseGlow {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.05); }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-pulse-glow { animation: pulseGlow 4s ease-in-out infinite; }
  .animate-screen { animation: fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  
  /* Efeitos 3D Suaves */
  .card-3d-wrap {
    perspective: 1000px;
  }
  .card-3d-element {
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    transform-style: preserve-3d;
  }
  .card-3d-wrap:hover .card-3d-element {
    transform: translateY(-5px) rotateX(2deg) rotateY(-2deg);
    box-shadow: 0 15px 30px rgba(0,0,0,0.6), 0 0 15px rgba(6, 182, 212, 0.2);
  }
  
  .btn-primary {
    transition: all 0.2s ease;
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    box-shadow: 0 4px 0 #0e7490, 0 10px 20px rgba(6, 182, 212, 0.3);
  }
  .btn-primary:active {
    transform: translateY(4px);
    box-shadow: 0 0px 0 #0e7490, 0 5px 10px rgba(6, 182, 212, 0.3);
  }
  .btn-danger {
    transition: all 0.2s ease;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 4px 0 #991b1b, 0 10px 20px rgba(239, 68, 68, 0.3);
  }
  .btn-danger:active {
    transform: translateY(4px);
    box-shadow: 0 0px 0 #991b1b, 0 5px 10px rgba(239, 68, 68, 0.3);
  }
`;

// --- CONSTANTES E REGRAS DO JOGO ---
const WEEKLY_DUNGEONS = [
    {
        id: 'seg',
        day: 'Segunda',
        title: "Peito + Tríceps",
        rank: "D",
        type: "Força e Hipertrofia",
        estimatedMinutes: 60,
        blocks: [
            { id: 'seg_aq1', title: "Polichinelo", desc: "Aquecimento", time: "2 min" },
            { id: 'seg_aq2', title: "Flexão Leve", desc: "Aquecimento", time: "2 x 10 reps" },
            { id: 'seg_aq3', title: "Mobilidade Ombro", desc: "Aquecimento", time: "3 min" },
            { id: 'seg_1', title: "Supino no Chão c/ Barra", desc: "Principal: Foco em peitoral", time: "4 x 8–12 reps" },
            { id: 'seg_2', title: "Supino Pegada Fechada", desc: "Principal: Foco tríceps", time: "3 x 10 reps" },
            { id: 'seg_3', title: "Pullover com Barra", desc: "Principal: Expansão", time: "3 x 12 reps" },
            { id: 'seg_4', title: "Mergulho entre Cadeiras", desc: "Principal: Peso corporal", time: "3 x 8–12 reps" },
            { id: 'seg_fin', title: "Flexão (Finalizador)", desc: "Até falhar", time: "2 séries" },
            { id: 'seg_al', title: "Alongamento Superior", desc: "Volta à calma", time: "5 min" },
        ]
    },
    {
        id: 'ter',
        day: 'Terça',
        title: "Pernas (Quadríceps)",
        rank: "D",
        type: "Força Inferior",
        estimatedMinutes: 60,
        blocks: [
            { id: 'ter_aq', title: "Mobilidade Quadril + Joelho", desc: "Aquecimento", time: "10 min" },
            { id: 'ter_1', title: "Agachamento com Barra", desc: "Principal: Base forte", time: "4 x 10–12 reps" },
            { id: 'ter_2', title: "Agachamento Frontal", desc: "Principal: Foco quadríceps", time: "3 x 10 reps" },
            { id: 'ter_3', title: "Avanço com Barra", desc: "Principal: Unilateral", time: "3 x 10 cada perna" },
            { id: 'ter_4', title: "Isometria na Parede", desc: "Resistência (Wall sit)", time: "3 x 40 seg" },
            { id: 'ter_fin', title: "Agachamento Livre (Finalizador)", desc: "Ritmo contínuo", time: "5 min diretos" },
            { id: 'ter_al', title: "Alongamento Inferior", desc: "Volta à calma", time: "5 min" },
        ]
    },
    {
        id: 'qua',
        day: 'Quarta',
        title: "Costas + Bíceps",
        rank: "D",
        type: "Força de Puxada",
        estimatedMinutes: 60,
        blocks: [
            { id: 'qua_aq', title: "Rotação + Escápulas", desc: "Aquecimento", time: "10 min" },
            { id: 'qua_1', title: "Remada Curvada com Barra", desc: "Principal: Dorsal", time: "4 x 8–12 reps" },
            { id: 'qua_2', title: "Levantamento Terra", desc: "Principal: Cadeia posterior pesada", time: "4 x 8 reps" },
            { id: 'qua_3', title: "Rosca Direta com Barra", desc: "Principal: Bíceps", time: "3 x 10–12 reps" },
            { id: 'qua_4', title: "Remada Unilateral", desc: "Usar barra curta (halter)", time: "3 x 10 cada lado" },
            { id: 'qua_al', title: "Alongamento Costas", desc: "Volta à calma", time: "5 min" },
        ]
    },
    {
        id: 'qui',
        day: 'Quinta',
        title: "Calistenia (Barra Fixa)",
        rank: "C",
        type: "Peso Corporal e Core",
        estimatedMinutes: 60,
        blocks: [
            { id: 'qui_aq1', title: "Polichinelos + Rotação", desc: "Aquecimento", time: "2 min" },
            { id: 'qui_aq2', title: "Barras Leves + Flexões", desc: "Aquecimento (2x5 barras, 2x10 flexões)", time: "8 min" },
            { id: 'qui_1', title: "Barra Fixa (Pronada)", desc: "Força: Se falhar, faça negativas de 3-5s", time: "4 x 6–10 reps" },
            { id: 'qui_2', title: "Barra Fixa (Supinada)", desc: "Força: Chin-up para bíceps/dorsal", time: "3 x 6–10 reps" },
            { id: 'qui_3', title: "Flexão de Braço", desc: "Força: Peito e Tríceps", time: "3 x 12–15 reps" },
            { id: 'qui_4', title: "Australian Pull-up", desc: "Força: Em barra baixa ou mesa", time: "3 x 10–12 reps" },
            { id: 'qui_5', title: "Elevação de Pernas (Barra)", desc: "Core: Meta final de 15 reps limpas", time: "3 x 8–12 reps" },
            { id: 'qui_6', title: "Prancha + Abd. Bicicleta", desc: "Core: 40-60s prancha e 20 bicicletas", time: "3 séries" },
            { id: 'qui_fin', title: "Finalizador Hardcore", desc: "3x: 5 barras, 10 flexões, 15 agachamentos", time: "Sem descanso" },
        ]
    },
    {
        id: 'sex',
        day: 'Sexta',
        title: "Ombro + Abdômen",
        rank: "C",
        type: "Força e Core",
        estimatedMinutes: 60,
        blocks: [
            { id: 'sex_aq', title: "Rotação Manguito + Core", desc: "Aquecimento", time: "10 min" },
            { id: 'sex_1', title: "Desenvolvimento com Barra", desc: "Principal: Ombros completos", time: "4 x 8–12 reps" },
            { id: 'sex_2', title: "Elevação Frontal", desc: "Principal: Deltoide anterior", time: "3 x 12 reps" },
            { id: 'sex_3', title: "Remada Alta", desc: "Principal: Trapézio e ombro", time: "3 x 10 reps" },
            { id: 'sex_4', title: "Prancha Abdominal", desc: "Core: Isometria", time: "3 x 40–60 seg" },
            { id: 'sex_5', title: "Abdominal com Peso", desc: "Core: Usar anilha", time: "3 x 15 reps" },
            { id: 'sex_al', title: "Alongamento Geral", desc: "Volta à calma", time: "5 min" },
        ]
    },
    {
        id: 'sab',
        day: 'Sábado',
        title: "BOSS RAID: Full Body Metabólico",
        rank: "B",
        type: "Condicionamento Extremo",
        estimatedMinutes: 60,
        blocks: [
            { id: 'sab_aq', title: "Aquecimento Dinâmico", desc: "Preparo cardíaco", time: "10 min" },
            { id: 'sab_1', title: "Thruster com Barra", desc: "Circuito: Voltas 1 a 4", time: "12 reps" },
            { id: 'sab_2', title: "Terra + Remada", desc: "Circuito: Voltas 1 a 4", time: "10 reps" },
            { id: 'sab_3', title: "Burpee", desc: "Circuito: Voltas 1 a 4", time: "10 reps" },
            { id: 'sab_4', title: "Mountain Climber", desc: "Circuito: Voltas 1 a 4", time: "30 seg" },
            { id: 'sab_desc', title: "Descanso do Circuito", desc: "Recuperação", time: "1 min por volta" },
            { id: 'sab_al', title: "Alongamento Completo", desc: "Volta à calma", time: "10 min" },
        ]
    }
];

// Componente Visual: Janela de Sistema 3D Refinada
const SystemWindow = ({ children, className = "", title = "MENSAGEM DO SISTEMA", icon = "terminal", headerAction = null }: any) => (
    <div className={`relative liquid-glass-inner backdrop-blur-2xl border border-white/20 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden ${className}`}>
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        <div className="liquid-glass-inner border-b px-5 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Icon name={icon} className="text-sm text-cyan-400 opacity-80" />
                <span className="text-cyan-400 text-[10px] sm:text-xs font-mono uppercase tracking-[0.2em] font-semibold">{title}</span>
            </div>
            {headerAction}
        </div>
        <div className="p-6">
            {children}
        </div>
    </div>
);

export function SystemPage() {
    const [screen, setScreen] = useState('onboarding');

    const [user, setUser, isLoading] = useSystemRPG();
    const [activeDungeon, setActiveDungeon] = useState<any>(null);
    const [workoutTimer, setWorkoutTimer] = useState(0);
    const [completedBlocks, setCompletedBlocks] = useState<any[]>([]);
    const [xpGainedInfo, setXpGainedInfo] = useState<any>(null);
    const [showSystemAlert, setShowSystemAlert] = useState(false);

    useEffect(() => {
        let interval: any;
        if (screen === 'workout') {
            interval = setInterval(() => setWorkoutTimer((prev: number) => prev + 1), 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [screen]);

    const toggleBlock = (blockId: string) => {
        if (completedBlocks.includes(blockId)) {
            setCompletedBlocks(completedBlocks.filter((id: string = "") => id !== blockId));
        } else {
            setCompletedBlocks([...completedBlocks, blockId]);
        }
    };

    const startDungeon = (dungeon: any) => {
        setActiveDungeon(dungeon);
        setScreen('preview');
    };

    const finishWorkout = () => {
        const blocksCount = completedBlocks.length;
        const simulatedMinutes = Math.max(Math.floor(workoutTimer / 2), blocksCount * 5);

        const xpBlocks = blocksCount * 10;
        const xpTime = Math.min(simulatedMinutes * 2, 150);
        const streakBonus = user.streak > 0 ? 15 : 0;

        const totalXpGained = xpBlocks + xpTime + streakBonus;

        setXpGainedInfo({ blocks: xpBlocks, time: xpTime, streak: streakBonus, total: totalXpGained, simulatedMinutes });

        const newXp = (user.xp || 0) + totalXpGained;
        setUser((prev: any) => ({
            xp: newXp,
            streak: (prev.streak || 0) + 1,
            active_minutes: (prev.active_minutes || 0) + simulatedMinutes,
            completed_raids: (prev.completed_raids || 0) + 1,
            vigor: (prev.vigor || 10) + (blocksCount >= 4 ? 2 : 0),
            forca: (prev.forca || 10) + (blocksCount >= 3 ? 2 : 0),
            inteligencia: (prev.inteligencia || 10) + 1,
            agilidade: (prev.agilidade || 10) + 1
        }));

        setScreen('summary');
    };

    const resetToDashboard = () => {
        setWorkoutTimer(0);
        setCompletedBlocks([]);
        setXpGainedInfo(null);
        setActiveDungeon(null);
        setScreen('dashboard');
    };

    // --- ECRÃS ---

    const renderOnboarding = () => (
        <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center p-6 text-slate-800 font-sans relative overflow-hidden">
            <div className="animate-screen w-full max-w-md z-10">
                <SystemWindow title="AVISO DO SISTEMA">
                    <div className="text-center mb-8 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
                        <Icon name="exclamation" className="mx-auto text-5xl text-cyan-400 mb-4 relative z-10 animate-float" />
                        <h1 className="text-2xl font-black tracking-widest text-slate-900 uppercase">
                            Sincronização
                        </h1>
                        <p className="mt-2 text-xs text-cyan-400/60 font-mono tracking-widest">NOVO ARSENAL DETETADO</p>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); setScreen('dashboard'); }} className="space-y-6">
                        <div className="liquid-glass-inner p-4 border border-white/10 rounded-lg">
                            <h3 className="text-[10px] font-mono text-cyan-500 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Icon name="target" className="text-sm" /> Itens no Inventário
                            </h3>
                            <ul className="text-sm text-slate-600 space-y-3">
                                {[
                                    { icon: "dumbbell", text: 'Barra 1,50m', color: 'text-cyan-400' },
                                    { icon: "dumbbell", text: 'Barra curta 20cm (Halter)', color: 'text-cyan-400' },
                                    { icon: "hexagon", text: '4x Anilhas de 5kg (20kg)', color: 'text-cyan-400' },
                                    { icon: "sword", text: 'Barra Fixa (Épico)', color: 'text-purple-400' },
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-3 p-2 hover:liquid-glass-inner rounded transition-colors">
                                        <Icon name={item.icon} className={`text-base ${item.color}`} />
                                        <span className="font-medium tracking-wide">{item.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button type="submit" className="btn-primary w-full py-4 rounded-xl font-black text-slate-900 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                            Aceder ao Sistema <Icon name="angle-right" className="text-xl" />
                        </button>
                    </form>
                </SystemWindow>
            </div>
        </div>
    );

    const renderDashboard = () => {
        const rankObj = getRank(user.xp || 0);
        const nextRank = getNextRank(user.xp || 0);
        const progressToNext = Math.min(100, Math.max(0, (((user.xp || 0) - rankObj.minXp) / (nextRank.minXp - rankObj.minXp)) * 100));

        const featuredDungeon = WEEKLY_DUNGEONS[0];
        const upcomingDungeons = WEEKLY_DUNGEONS.slice(1);

        return (
            <div className="min-h-[calc(100vh-10rem)] text-slate-800 p-4 md:p-8 font-sans relative">
                <div className="animate-screen max-w-4xl mx-auto space-y-8 relative z-10 pb-10">
                    <SystemWindow title="STATUS DO JOGADOR" icon="shield">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-widest">
                                    {user.name || "Jogador"}
                                </h2>
                                <div className="flex items-center gap-2 mt-2 liquid-glass-inner px-3 py-1.5 rounded-md border border-white/10 w-max">
                                    <span className="text-[10px] font-mono text-cyan-500/80 uppercase">Classe:</span>
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Solo Leveler</span>
                                </div>
                            </div>
                            <div className="relative group shrink-0">
                                <div className={`w-20 h-20 flex items-center justify-center bg-gradient-to-br ${rankObj.bg} border border-white/20 rounded-2xl shadow-xl transition-transform duration-500 hover:scale-105`}>
                                    <span className={`text-4xl font-black ${rankObj.color}`}>
                                        {rankObj.name}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <div className="flex justify-between text-[10px] font-mono mb-2 uppercase tracking-widest">
                                <span className="text-slate-500">Energia Vital</span>
                                <span className="text-cyan-600 font-bold">{user.xp || 0} <span className="text-slate-400">/ {nextRank.minXp} XP</span></span>
                            </div>
                            <div className="w-full liquid-glass-inner h-2 rounded-full border border-white/10 overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] transition-all duration-1000 ease-out"
                                    style={{ width: `${progressToNext}%` }}
                                />
                            </div>
                        </div>
                    </SystemWindow>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-mono text-cyan-600 uppercase tracking-[0.3em] font-bold px-1 flex items-center gap-2">
                            <Icon name="pulse" className="text-sm" /> Próxima Missão
                        </h3>
                        <div
                            onClick={() => startDungeon(featuredDungeon)}
                            className="group cursor-pointer liquid-glass-inner p-8 rounded-3xl shadow-lg hover:border-cyan-400 transition-all relative overflow-hidden"
                        >
                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[10px] font-black font-mono text-white bg-cyan-600 px-2 py-1 rounded uppercase tracking-widest">
                                            {featuredDungeon.day}
                                        </span>
                                        <span className="text-[10px] font-mono text-cyan-600 border border-cyan-500/30 px-2 py-1 rounded uppercase tracking-widest">
                                            Rank {featuredDungeon.rank}
                                        </span>
                                    </div>
                                    <h3 className="text-3xl font-bold text-slate-900 uppercase tracking-wide">
                                        {featuredDungeon.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 mt-1">{featuredDungeon.type}</p>
                                </div>
                                <div className="flex items-center gap-4 liquid-glass-inner px-4 py-3 rounded-2xl w-max">
                                    <div className="flex items-center gap-2 text-slate-800 text-sm font-bold">
                                        <Icon name="clock" className="text-sm text-cyan-600" /> ~{featuredDungeon.estimatedMinutes}m
                                    </div>
                                    <Icon name="angle-right" className="text-2xl text-cyan-600 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] font-bold px-1 flex items-center gap-2 mt-8">
                            <Icon name="calendar" className="text-sm" /> Agenda Semanal
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {upcomingDungeons.map((dungeon) => (
                                <div
                                    key={dungeon.id}
                                    onClick={() => startDungeon(dungeon)}
                                    className="group cursor-pointer liquid-glass-inner p-5 rounded-2xl hover:border-cyan-400 transition-all flex flex-col justify-between min-h-[120px]"
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black font-mono text-white bg-blue-500 px-2 py-1 rounded uppercase tracking-widest">
                                                {dungeon.day}
                                            </span>
                                            <span className="text-[10px] font-mono text-cyan-600">
                                                R-{dungeon.rank}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wide group-hover:text-cyan-600 transition-colors line-clamp-2">
                                            {dungeon.title}
                                        </h4>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderPreview = () => (
        <div className="min-h-[calc(100vh-10rem)] text-slate-800 p-4 md:p-8 flex flex-col font-sans relative">
            <div className="animate-screen max-w-2xl w-full mx-auto flex-1 flex flex-col relative z-10 pb-6">
                <button onClick={() => setScreen('dashboard')} className="self-start text-[10px] font-mono text-cyan-600 hover:text-cyan-500 mb-8 flex items-center uppercase tracking-[0.2em] transition-transform hover:-translate-x-1 liquid-glass-inner px-3 py-2 rounded-lg">
                    <Icon name="angle-left" className="text-sm mr-1" /> Voltar
                </button>

                <div className="mb-8 relative">
                    <span className="inline-block text-[10px] font-mono text-purple-600 border border-purple-500/30 liquid-glass-inner px-2 py-1 rounded-md uppercase tracking-widest mb-3">
                        Rank {activeDungeon?.rank} • {activeDungeon?.day}
                    </span>
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-wider mb-3">
                        {activeDungeon?.title}
                    </h2>
                    <div className="flex gap-4 text-sm font-medium text-slate-600 mb-6 liquid-glass-inner p-3 rounded-lg w-auto max-w-max border border-white/10">
                        <span className="flex items-center gap-1.5"><Icon name="pulse" className="text-sm text-cyan-600" /> {activeDungeon?.type}</span>
                        <span className="flex items-center gap-1.5"><Icon name="clock" className="text-sm text-cyan-600" /> ~{activeDungeon?.estimatedMinutes}m</span>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto mb-8 pr-2 custom-scrollbar">
                    {activeDungeon?.blocks.map((block: any, idx: number) => (
                        <div key={block.id} className="group liquid-glass-inner p-5 rounded-2xl border border-white/10 flex gap-4 items-center hover:border-cyan-400 transition-colors">
                            <div className="w-10 h-10 rounded-xl liquid-glass-inner border border-slate-300 flex items-center justify-center text-xs font-mono font-bold text-slate-500 shrink-0">
                                {String(idx + 1).padStart(2, '0')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-900 text-sm md:text-base uppercase tracking-wide truncate">{block.title}</p>
                                <p className="text-xs font-medium text-slate-500 mt-1 truncate">{block.desc}</p>
                            </div>
                            <div className="shrink-0 text-right">
                                <span className="text-[11px] font-black font-mono text-cyan-600 liquid-glass-inner px-3 py-1.5 rounded-lg border border-cyan-500/20 whitespace-nowrap">
                                    {block.time}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => { setWorkoutTimer(0); setCompletedBlocks([]); setScreen('workout'); }}
                    className="btn-danger w-full py-5 text-white font-black font-mono tracking-[0.2em] uppercase rounded-xl flex items-center justify-center gap-3"
                >
                    <Icon name="sword" className="text-xl" /> Iniciar Incursão
                </button>
            </div>
        </div>
    );

    const renderWorkout = () => {
        const formatTime = (seconds: number) => {
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        };

        return (
            <div className="min-h-screen text-slate-800 p-4 md:p-8 flex flex-col relative font-sans">
                <div className="animate-screen max-w-2xl w-full mx-auto flex-1 flex flex-col relative z-10">
                    <div className="liquid-glass-inner backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 mb-8 shadow-2xl flex justify-between items-center sticky top-4 z-20">
                        <div>
                            <p className="text-[11px] font-bold font-mono text-red-600 uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> Em Combate
                            </p>
                            <p className="text-5xl md:text-6xl font-mono font-black text-slate-900 tracking-widest">
                                {formatTime(workoutTimer)}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowSystemAlert(true)}
                            className="group w-16 h-16 liquid-glass-inner rounded-full border border-cyan-500/30 flex items-center justify-center hover:scale-105 transition-transform"
                        >
                            <Icon name="brain" className="text-3xl text-cyan-600" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto pb-40 custom-scrollbar">
                        {activeDungeon?.blocks.map((block: any) => {
                            const isChecked = completedBlocks.includes(block.id);
                            return (
                                <div
                                    key={block.id}
                                    onClick={() => toggleBlock(block.id)}
                                    className={`relative p-5 md:p-6 rounded-2xl cursor-pointer transition-all duration-300 border ${isChecked
                                        ? 'liquid-glass-inner opacity-40'
                                        : 'liquid-glass-inner border-white/20 hover:border-cyan-400'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-black uppercase tracking-wide text-base md:text-lg ${isChecked ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                                {block.title}
                                            </p>
                                            <p className={`text-xs mt-1.5 uppercase font-medium ${isChecked ? 'text-slate-400' : 'text-slate-600'}`}>
                                                {block.desc}
                                            </p>
                                        </div>
                                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${isChecked ? 'border-cyan-500 bg-cyan-500/20' : 'border-slate-300'}`}>
                                            {isChecked && <Icon name="check" className="text-2xl text-cyan-600" />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="fixed bottom-0 left-0 w-full liquid-glass-inner border-t border-white/20 p-4 md:p-6 z-20 backdrop-blur-2xl">
                        <div className="max-w-xl mx-auto">
                            <button
                                onClick={finishWorkout}
                                disabled={completedBlocks.length === 0}
                                className={`w-full py-5 rounded-2xl font-black font-mono tracking-[0.2em] text-lg uppercase transition-all ${completedBlocks.length > 0
                                    ? 'btn-primary text-white'
                                    : 'liquid-glass-inner text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                Extrair Recompensas
                            </button>
                        </div>
                    </div>
                </div>

                {showSystemAlert && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md">
                        <div className="animate-screen liquid-glass-inner border-2 border-cyan-500/40 rounded-3xl max-w-sm w-full p-8 shadow-2xl">
                            <h3 className="text-base font-black font-mono text-slate-900 uppercase tracking-widest mb-4">Análise Tática</h3>
                            <p className="text-slate-700 text-sm leading-relaxed mb-8">
                                O Sistema recomenda períodos de descanso de 60-90s entre as séries para maximizar o ganho de XP e regeneração de vigor.
                            </p>
                            <button onClick={() => setShowSystemAlert(false)} className="w-full py-4 btn-primary text-white font-black font-mono uppercase rounded-xl">
                                Entendido
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderSummary = () => (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            <div className="animate-screen max-w-sm w-full relative z-10">
                <div className="text-center mb-10">
                    <Icon name="trophy" className="text-[64px] text-yellow-500 mb-4" />
                    <h2 className="text-5xl font-black text-slate-900 uppercase tracking-widest">Concluído</h2>
                </div>

                <SystemWindow title="Recompensas Adquiridas">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center liquid-glass-inner p-3 rounded-xl">
                            <span className="text-slate-600 font-bold uppercase text-xs">Ações</span>
                            <span className="text-cyan-600 font-mono font-black">+{xpGainedInfo?.blocks} XP</span>
                        </div>
                        <div className="flex justify-between items-center liquid-glass-inner p-3 rounded-xl">
                            <span className="text-slate-600 font-bold uppercase text-xs">Tempo</span>
                            <span className="text-cyan-600 font-mono font-black">+{xpGainedInfo?.time} XP</span>
                        </div>
                        <div className="pt-4 mt-4 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-slate-900 font-black uppercase tracking-widest">Total</span>
                            <span className="text-yellow-600 font-mono text-3xl font-black">+{xpGainedInfo?.total} XP</span>
                        </div>
                    </div>
                </SystemWindow>

                <button onClick={resetToDashboard} className="w-full mt-8 py-5 btn-primary text-white rounded-2xl font-black uppercase tracking-widest">
                    Fechar Janela
                </button>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
                <div className="text-cyan-600 animate-pulse text-xl tracking-[0.3em] font-mono font-bold">
                    NEURAL SINC... [UPLINK]
                </div>
            </div>
        );
    }

    return (
        <>
            <style>{globalStyles}</style>
            <div className="w-full h-full text-slate-900">
                {screen === 'onboarding' && renderOnboarding()}
                {screen === 'dashboard' && renderDashboard()}
                {screen === 'preview' && renderPreview()}
                {screen === 'workout' && renderWorkout()}
                {screen === 'summary' && renderSummary()}
            </div>
        </>
    );
}
