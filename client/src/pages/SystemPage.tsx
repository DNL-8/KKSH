import { useState, useEffect } from 'react';
import { Icon } from '../components/common/Icon';
import { useSystemRPG } from '../lib/systemStore';

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
  
  /* Sistema Holográfico Refinado */
  .hologram-bg {
    background-color: transparent;
    background-image: 
      radial-gradient(circle at 50% 0%, rgba(8, 145, 178, 0.1) 0%, transparent 50%),
      linear-gradient(rgba(8, 145, 178, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(8, 145, 178, 0.03) 1px, transparent 1px);
    background-size: 100% 100%, 40px 40px, 40px 40px;
    background-attachment: fixed;
  }
  
  .scanline {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 15vh;
    background: linear-gradient(to bottom, transparent, rgba(6, 182, 212, 0.05), transparent);
    animation: scanline 10s linear infinite;
    pointer-events: none;
    z-index: 100;
  }

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
const RANKS = [
    { name: 'F', minXp: 0, color: 'text-zinc-400', glow: 'shadow-[0_0_15px_rgba(161,161,170,0.4)]', border: 'border-zinc-600', bg: 'from-zinc-800 to-zinc-950' },
    { name: 'E', minXp: 50, color: 'text-slate-200', glow: 'shadow-[0_0_20px_rgba(226,232,240,0.5)]', border: 'border-slate-500', bg: 'from-slate-700 to-slate-950' },
    { name: 'D', minXp: 150, color: 'text-emerald-400', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.5)]', border: 'border-emerald-500', bg: 'from-emerald-900 to-zinc-950' },
    { name: 'C', minXp: 400, color: 'text-cyan-400', glow: 'shadow-[0_0_25px_rgba(34,211,238,0.6)]', border: 'border-cyan-500', bg: 'from-cyan-900 to-zinc-950' },
    { name: 'B', minXp: 800, color: 'text-purple-400', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.6)]', border: 'border-purple-500', bg: 'from-purple-900 to-zinc-950' },
    { name: 'A', minXp: 1500, color: 'text-red-500', glow: 'shadow-[0_0_35px_rgba(239,68,68,0.7)]', border: 'border-red-500', bg: 'from-red-900 to-zinc-950' },
    { name: 'S', minXp: 3000, color: 'text-yellow-400', glow: 'shadow-[0_0_40px_rgba(250,204,21,0.8)]', border: 'border-yellow-400', bg: 'from-yellow-900 to-zinc-950' },
];

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
    <div className={`relative bg-zinc-950/80 backdrop-blur-2xl border border-cyan-500/20 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden ${className}`}>
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        <div className="bg-black/40 border-b border-white/5 px-5 py-3 flex justify-between items-center">
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

    const [user, setUser] = useSystemRPG();

    const [activeDungeon, setActiveDungeon] = useState<any>(null);
    const [workoutTimer, setWorkoutTimer] = useState(0);
    const [completedBlocks, setCompletedBlocks] = useState<any[]>([]);
    const [xpGainedInfo, setXpGainedInfo] = useState<any>(null);
    const [showSystemAlert, setShowSystemAlert] = useState(false);

    const getRank = (xp: number) => [...RANKS].reverse().find(r => xp >= r.minXp) || RANKS[0];

    const getNextRank = (xp: number) => {
        const currentIdx = RANKS.findIndex(r => r.name === getRank(xp).name);
        return currentIdx < RANKS.length - 1 ? RANKS[currentIdx + 1] : RANKS[RANKS.length - 1];
    };

    useEffect(() => {
        let interval: any;
        if (screen === 'workout') {
            interval = setInterval(() => setWorkoutTimer((prev) => prev + 1), 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [screen]);

    const toggleBlock = (blockId: string) => {
        if (completedBlocks.includes(blockId)) {
            setCompletedBlocks(completedBlocks.filter(id => id !== blockId));
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

        const newXp = user.xp + totalXpGained;
        setUser(prev => ({
            xp: newXp,
            streak: prev.streak + 1,
            activeMinutes: prev.activeMinutes + simulatedMinutes,
            completedRaids: prev.completedRaids + 1,
            attributes: {
                ...prev.attributes,
                vigor: prev.attributes.vigor + (blocksCount >= 4 ? 2 : 0),
                forca: prev.attributes.forca + (blocksCount >= 3 ? 2 : 0),
                inteligencia: prev.attributes.inteligencia + 1,
                agilidade: prev.attributes.agilidade + 1
            }
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
        <div className="min-h-[calc(100vh-10rem)] hologram-bg flex flex-col items-center justify-center p-6 text-zinc-300 font-sans relative overflow-hidden rounded-[32px] border border-cyan-900/40">
            <div className="scanline"></div>

            <div className="animate-screen w-full max-w-md z-10">
                <SystemWindow title="AVISO DO SISTEMA">
                    <div className="text-center mb-8 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
                        <Icon name="exclamation" className="mx-auto text-5xl text-cyan-400 mb-4 relative z-10 animate-float drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                        <h1 className="text-2xl font-black tracking-widest text-white uppercase">
                            Sincronização
                        </h1>
                        <p className="mt-2 text-xs text-cyan-400/60 font-mono tracking-widest">NOVO ARSENAL DETETADO</p>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); setScreen('dashboard'); }} className="space-y-6">
                        <div className="bg-black/30 p-4 border border-white/5 rounded-lg">
                            <h3 className="text-[10px] font-mono text-cyan-500 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Icon name="target" className="text-sm" /> Itens no Inventário
                            </h3>
                            <ul className="text-sm text-zinc-400 space-y-3">
                                {[
                                    { icon: "dumbbell", text: 'Barra 1,50m', color: 'text-cyan-400' },
                                    { icon: "dumbbell", text: 'Barra curta 20cm (Halter)', color: 'text-cyan-400' },
                                    { icon: "hexagon", text: '4x Anilhas de 5kg (20kg)', color: 'text-cyan-400' },
                                    { icon: "sword", text: 'Barra Fixa (Épico)', color: 'text-purple-400' },
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded transition-colors">
                                        <Icon name={item.icon} className={`text-base ${item.color}`} />
                                        <span className="font-medium tracking-wide">{item.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button type="submit" className="btn-primary w-full py-4 rounded-xl font-black text-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                            Aceder ao Sistema <Icon name="angle-right" className="text-xl" />
                        </button>
                    </form>
                </SystemWindow>
            </div>
        </div>
    );

    const renderDashboard = () => {
        const rankObj = getRank(user.xp);
        const nextRank = getNextRank(user.xp);
        const progressToNext = Math.min(100, Math.max(0, ((user.xp - rankObj.minXp) / (nextRank.minXp - rankObj.minXp)) * 100));

        // Simular que hoje é "Segunda" para a primeira raid
        const featuredDungeon = WEEKLY_DUNGEONS[0];
        const upcomingDungeons = WEEKLY_DUNGEONS.slice(1);

        return (
            <div className="min-h-[calc(100vh-10rem)] hologram-bg text-zinc-300 p-4 md:p-8 font-sans relative rounded-[32px] border border-cyan-900/40">
                <div className="scanline"></div>

                <div className="animate-screen max-w-4xl mx-auto space-y-8 relative z-10 pb-10">

                    {/* Cartão do Jogador */}
                    <SystemWindow title="STATUS DO JOGADOR" icon="shield">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-widest">
                                    {user.name}
                                </h2>
                                <div className="flex items-center gap-2 mt-2 bg-black/50 px-3 py-1.5 rounded-md border border-white/5 w-max">
                                    <span className="text-[10px] font-mono text-cyan-500/80 uppercase">Classe:</span>
                                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Monarca das Sombras</span>
                                </div>
                            </div>

                            {/* Rank */}
                            <div className="relative group shrink-0">
                                <div className={`w-20 h-20 flex items-center justify-center bg-gradient-to-br ${rankObj.bg} border border-white/10 ${rankObj.glow} rounded-2xl shadow-xl transition-transform duration-500 hover:scale-105`}>
                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                    <span className={`text-4xl font-black ${rankObj.color} drop-shadow-[0_0_15px_currentColor]`}>
                                        {rankObj.name}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Barra de XP */}
                        <div className="mt-8">
                            <div className="flex justify-between text-[10px] font-mono mb-2 uppercase tracking-widest">
                                <span className="text-zinc-500">Energia Vital</span>
                                <span className="text-cyan-400 font-bold">{user.xp} <span className="text-zinc-600">/ {nextRank.minXp} XP</span></span>
                            </div>
                            <div className="w-full bg-black h-2 rounded-full border border-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] transition-all duration-1000 ease-out relative"
                                    style={{ width: `${progressToNext}%` }}
                                >
                                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/40 to-transparent"></div>
                                </div>
                            </div>
                        </div>
                    </SystemWindow>

                    {/* Missão em Destaque (Próxima) */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-mono text-cyan-500 uppercase tracking-[0.3em] font-bold px-1 flex items-center gap-2">
                            <Icon name="pulse" className="text-sm" /> Próxima Missão
                        </h3>

                        <div
                            onClick={() => startDungeon(featuredDungeon)}
                            className="group cursor-pointer bg-gradient-to-br from-cyan-950/40 to-blue-900/20 backdrop-blur-xl border border-cyan-500/30 p-8 rounded-3xl shadow-lg hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all relative overflow-hidden"
                        >
                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-colors"></div>

                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[10px] font-black font-mono text-black bg-cyan-500 px-2 py-1 rounded uppercase tracking-widest shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                                            {featuredDungeon.day}
                                        </span>
                                        <span className="text-[10px] font-mono text-cyan-400 border border-cyan-500/30 px-2 py-1 rounded uppercase tracking-widest">
                                            Rank {featuredDungeon.rank}
                                        </span>
                                    </div>
                                    <h3 className="text-3xl font-bold text-white uppercase tracking-wide">
                                        {featuredDungeon.title}
                                    </h3>
                                    <p className="text-sm text-zinc-400 mt-1">{featuredDungeon.type}</p>
                                </div>

                                <div className="flex items-center gap-4 bg-black/40 px-4 py-3 rounded-xl border border-white/5 w-max">
                                    <div className="flex items-center gap-2 text-zinc-300 text-sm font-bold">
                                        <Icon name="clock" className="text-sm text-cyan-500" /> ~{featuredDungeon.estimatedMinutes}m
                                    </div>
                                    <Icon name="angle-right" className="text-2xl text-cyan-500 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Outros Portais (Scroll Horizontal/Grid) */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] font-bold px-1 flex items-center gap-2 mt-8">
                            <Icon name="calendar" className="text-sm" /> Agenda Semanal
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {upcomingDungeons.map((dungeon) => (
                                <div
                                    key={dungeon.id}
                                    onClick={() => startDungeon(dungeon)}
                                    className="group cursor-pointer bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 p-5 rounded-2xl hover:bg-zinc-800/80 hover:border-zinc-600 transition-all flex flex-col justify-between min-h-[120px]"
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                                                {dungeon.day}
                                            </span>
                                            <span className="text-[10px] font-mono text-purple-400">
                                                R-{dungeon.rank}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-sm text-zinc-200 uppercase tracking-wide group-hover:text-white transition-colors line-clamp-2">
                                            {dungeon.title}
                                        </h4>
                                    </div>
                                </div>
                            ))}
                            <div className="bg-black/40 border border-zinc-900 border-dashed p-4 rounded-xl flex items-center justify-center min-h-[120px] opacity-50">
                                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest text-center flex flex-col items-center gap-2">
                                    <Icon name="lock" className="text-base" /> Domingo: Zona Segura
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    const renderPreview = () => (
        <div className="min-h-[calc(100vh-10rem)] hologram-bg text-zinc-300 p-4 md:p-8 flex flex-col font-sans relative rounded-[32px] border border-cyan-900/40">
            <div className="scanline"></div>

            <div className="animate-screen max-w-2xl w-full mx-auto flex-1 flex flex-col relative z-10 pb-6">

                <button onClick={() => setScreen('dashboard')} className="self-start text-[10px] font-mono text-cyan-500/70 hover:text-cyan-400 mb-8 flex items-center uppercase tracking-[0.2em] transition-transform hover:-translate-x-1 bg-cyan-500/10 px-3 py-2 rounded-lg">
                    <Icon name="angle-left" className="text-sm mr-1" /> Voltar
                </button>

                <div className="mb-8 relative">
                    <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-purple-500 to-cyan-500 rounded-full"></div>
                    <span className="inline-block text-[10px] font-mono text-purple-400 border border-purple-500/30 bg-purple-500/10 px-2 py-1 rounded-md uppercase tracking-widest mb-3">
                        Rank {activeDungeon.rank} • {activeDungeon.day}
                    </span>
                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-wider mb-3 drop-shadow-md">
                        {activeDungeon.title}
                    </h2>
                    <div className="flex gap-4 text-sm font-medium text-zinc-400 mb-6 bg-black/40 p-3 rounded-lg w-max border border-white/5">
                        <span className="flex items-center gap-1.5"><Icon name="pulse" className="text-sm text-cyan-500" /> {activeDungeon.type}</span>
                        <span className="flex items-center gap-1.5"><Icon name="clock" className="text-sm text-cyan-500" /> ~{activeDungeon.estimatedMinutes}m</span>
                    </div>

                    <div className="bg-gradient-to-r from-blue-900/30 to-transparent border-l-2 border-blue-500 p-5 rounded-r-lg">
                        <p className="text-[11px] font-mono text-blue-200 uppercase tracking-widest flex items-start gap-4">
                            <Icon name="flame" className="text-xl text-blue-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">Aumentar 2 reps ou adicionar carga (+5kg) se o treino anterior foi fácil. O Sistema recompensa o esforço.</span>
                        </p>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto mb-8 pr-2">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] mb-2 pl-1">
                        Alvos da Missão
                    </div>
                    {activeDungeon.blocks.map((block: any, idx: number) => (
                        <div key={block.id} className="group bg-zinc-900/60 backdrop-blur-sm p-5 rounded-2xl border border-white/5 flex gap-4 items-center hover:bg-zinc-800 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-black border border-zinc-700 flex items-center justify-center text-xs font-mono font-bold text-zinc-500 shrink-0 group-hover:border-cyan-500/50 group-hover:text-cyan-400 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all">
                                {String(idx + 1).padStart(2, '0')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-zinc-200 text-sm md:text-base uppercase tracking-wide truncate">{block.title}</p>
                                <p className="text-xs font-medium text-zinc-500 mt-1 truncate">{block.desc}</p>
                            </div>
                            <div className="shrink-0 text-right">
                                <span className="text-[11px] font-black font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1.5 rounded-lg border border-cyan-900/50 whitespace-nowrap shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]">
                                    {block.time}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => { setWorkoutTimer(0); setCompletedBlocks([]); setScreen('workout'); }}
                    className="btn-danger mt-auto w-full py-5 text-white font-black font-mono tracking-[0.2em] uppercase rounded-xl flex items-center justify-center gap-3"
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
            <div className="min-h-screen hologram-bg text-zinc-300 p-4 md:p-8 flex flex-col relative font-sans">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100%] h-[300px] bg-red-900/10 blur-[100px] pointer-events-none animate-pulse-glow"></div>

                <div className="animate-screen max-w-2xl w-full mx-auto flex-1 flex flex-col relative z-10">

                    {/* Header Fixo - Timer */}
                    <div className="bg-black/60 backdrop-blur-xl border border-red-900/30 rounded-2xl p-6 mb-8 shadow-2xl flex justify-between items-center sticky top-4 z-20">
                        <div>
                            <p className="text-[11px] font-bold font-mono text-red-500/80 uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div> Em Combate
                            </p>
                            <p className="text-5xl md:text-6xl font-mono font-black text-white tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                                {formatTime(workoutTimer)}
                            </p>
                        </div>

                        <button
                            onClick={() => setShowSystemAlert(true)}
                            className="group w-16 h-16 bg-blue-950/30 rounded-full border border-blue-500/30 flex items-center justify-center hover:bg-blue-900/50 transition-all hover:scale-105"
                        >
                            <Icon name="brain" className="text-3xl text-blue-400 drop-shadow-[0_0_8px_currentColor]" />
                        </button>
                    </div>

                    {/* Lista de Tarefas */}
                    <div className="flex-1 space-y-4 overflow-y-auto pb-24 scrollbar-hide">
                        {activeDungeon.blocks.map((block: any) => {
                            const isChecked = completedBlocks.includes(block.id);
                            return (
                                <div
                                    key={block.id}
                                    onClick={() => toggleBlock(block.id)}
                                    className={`relative p-5 md:p-6 rounded-2xl cursor-pointer transition-all duration-300 border ${isChecked
                                        ? 'bg-black/40 border-cyan-500/20 opacity-50 backdrop-blur-sm'
                                        : 'bg-zinc-900/60 border-white/5 hover:bg-zinc-800/80 shadow-lg hover:-translate-y-0.5'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-black uppercase tracking-wide text-base md:text-lg transition-colors ${isChecked ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-100'}`}>
                                                {block.title}
                                            </p>
                                            <p className={`text-xs mt-1.5 uppercase font-medium ${isChecked ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                                                {block.desc}
                                            </p>
                                            <div className="mt-4">
                                                <span className={`inline-block text-[11px] font-bold font-mono px-3 py-1.5 rounded-lg border flex items-center gap-2 w-max ${isChecked ? 'border-zinc-800 text-zinc-600 bg-transparent' : 'border-zinc-700 text-cyan-400 bg-black/50'}`}>
                                                    <Icon name="clock" className="text-xs" /> {block.time}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Checkbox Recompensa */}
                                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${isChecked ? 'border-cyan-500 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'border-zinc-700 bg-black'
                                            }`}>
                                            {isChecked && <Icon name="check" className="text-2xl text-cyan-400 drop-shadow-md" />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Bottom Action Area */}
                    <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/90 to-transparent p-4 md:p-6 z-20">
                        <div className="max-w-xl mx-auto">
                            <div className="flex justify-between items-center mb-2 px-2 opacity-50 hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => setWorkoutTimer(timer => timer + 3000)}
                                    className="text-[10px] font-black font-mono text-zinc-500 hover:text-red-400 uppercase tracking-widest bg-red-950/30 px-3 py-1 rounded"
                                >
                                    [ Debug: +50 Min ]
                                </button>
                            </div>

                            <button
                                onClick={finishWorkout}
                                disabled={completedBlocks.length === 0}
                                className={`w-full py-5 rounded-2xl font-black font-mono tracking-[0.2em] text-lg uppercase transition-all flex items-center justify-center gap-2 shadow-2xl ${completedBlocks.length > 0
                                    ? 'btn-primary text-black'
                                    : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                                    }`}
                            >
                                Extrair Recompensas
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modal Mentor */}
                {showSystemAlert && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg p-4">
                        <div className="animate-screen bg-blue-950/80 border-2 border-blue-500/40 rounded-3xl max-w-sm w-full p-8 shadow-[0_0_50px_rgba(59,130,246,0.3)] relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full"></div>

                            <button onClick={() => setShowSystemAlert(false)} className="absolute top-5 right-5 text-blue-400 hover:text-white bg-blue-900/50 rounded-full p-2 transition-colors z-10">
                                <Icon name="cross" className="text-sm" />
                            </button>

                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                                    <Icon name="brain" className="text-2xl text-blue-400 drop-shadow-[0_0_10px_currentColor]" />
                                </div>
                                <h3 className="text-base font-black font-mono text-white uppercase tracking-widest">Análise Tática</h3>
                            </div>

                            <p className="text-blue-100/90 text-sm md:text-base leading-relaxed mb-8 relative z-10">
                                Descanso é onde a força é forjada. Aguarde <strong className="text-white font-black bg-blue-900/50 px-2 py-0.5 rounded">60-90s</strong> entre séries pesadas para restaurar HP/Mana antes do próximo ataque.
                            </p>

                            <button onClick={() => setShowSystemAlert(false)} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-110 text-black text-sm font-black font-mono uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.5)] relative z-10">
                                Entendido
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderSummary = () => (
        <div className="min-h-screen hologram-bg flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            <div className="scanline"></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[300px] h-[300px] bg-cyan-500/10 blur-[100px] rounded-full animate-pulse-glow"></div>
            </div>

            <div className="animate-screen max-w-sm w-full relative z-10">

                <div className="text-center mb-10">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-b from-yellow-400/20 to-transparent rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(250,204,21,0.2)]">
                        <Icon name="trophy" className="text-[64px] text-yellow-400 drop-shadow-[0_0_15px_currentColor]" />
                    </div>
                    <p className="text-cyan-400 font-mono text-[11px] font-bold tracking-[0.4em] uppercase mb-3">Janela de Sistema</p>
                    <h2 className="text-5xl font-black text-white uppercase tracking-widest drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                        Concluído
                    </h2>
                </div>

                <SystemWindow title="Recompensas Adquiridas" className="mb-10 min-h-[auto]">
                    <div className="space-y-5 text-sm">
                        <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                            <span className="text-zinc-400 uppercase font-bold tracking-wider">Inimigos Mortos</span>
                            <span className="text-cyan-400 font-mono font-black text-base drop-shadow-md">+{xpGainedInfo.blocks} XP</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                            <span className="text-zinc-400 uppercase font-bold tracking-wider">Tempo em Batalha</span>
                            <span className="text-cyan-400 font-mono font-black text-base drop-shadow-md">+{xpGainedInfo.time} XP</span>
                        </div>
                        {xpGainedInfo.streak > 0 && (
                            <div className="flex justify-between items-center bg-orange-500/10 p-3 rounded-xl border border-orange-500/30">
                                <span className="text-orange-400 flex items-center gap-2 uppercase font-bold tracking-wider">
                                    <Icon name="flame" className="text-lg drop-shadow-[0_0_5px_currentColor]" /> Combo Diário
                                </span>
                                <span className="text-orange-400 font-mono font-black text-base drop-shadow-md">+{xpGainedInfo.streak} XP</span>
                            </div>
                        )}

                        <div className="pt-6 mt-4 flex justify-between items-center border-t border-white/10 relative">
                            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
                            <span className="text-white uppercase tracking-widest font-black text-base">Total Ganho</span>
                            <span className="text-yellow-400 font-mono text-3xl font-black drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">
                                +{xpGainedInfo.total} <span className="text-lg">XP</span>
                            </span>
                        </div>
                    </div>
                </SystemWindow>

                <button
                    onClick={resetToDashboard}
                    className="w-full py-5 border-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-950/50 hover:text-white hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] rounded-2xl font-mono font-black tracking-[0.2em] text-sm uppercase transition-all"
                >
                    Fechar Janela
                </button>
            </div>
        </div>
    );

    return (
        <>
            <style>{globalStyles}</style>
            <div className="custom-scrollbar w-full h-full overflow-clip text-slate-800 dark:text-zinc-100 transition-colors">
                {screen === 'onboarding' && renderOnboarding()}
                {screen === 'dashboard' && renderDashboard()}
                {screen === 'preview' && renderPreview()}
                {screen === 'workout' && renderWorkout()}
                {screen === 'summary' && renderSummary()}
            </div>
        </>
    );
}
