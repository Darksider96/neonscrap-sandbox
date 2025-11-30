import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MessageSquare, Send, X, Cpu, Terminal } from 'lucide-react';
import { NetrunnerAIProps } from '../../types';

export const NetrunnerAI: React.FC<NetrunnerAIProps> = ({ isOpen, onClose, onCheat }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Interface Netrunner v9.0 inicializada. Como posso auxiliar seus protocolos de sobrevivência, chapa?' }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    const lowerMsg = userMsg.trim().toLowerCase();

    // Cheat Code Interception
    if (lowerMsg === 'nane') {
        setTimeout(() => {
            onCheat('nane');
            setMessages(prev => [...prev, { role: 'ai', text: '⚠️ ALERTA DE SISTEMA: ACESSO ROOT DETECTADO.\n>> MODO DEUS: ATIVADO.\n>> GRAVIDADE: DESLIGADA.\n>> Voe livre, lenda.' }]);
            setLoading(false);
        }, 800);
        return;
    }

    if (lowerMsg === 'normal') {
        setTimeout(() => {
            onCheat('normal');
            setMessages(prev => [...prev, { role: 'ai', text: '>> PROTOCOLOS DE SEGURANÇA RESTAURADOS.\n>> MODO DEUS: DESATIVADO.\n>> Gravidade e danos normalizados. Boa sorte.' }]);
            setLoading(false);
        }, 800);
        return;
    }

    if (lowerMsg === 'day') {
        setTimeout(() => {
            onCheat('day');
            setMessages(prev => [...prev, { role: 'ai', text: '>> COMANDO ACEITO: Protocolo Solar ativado. Haja luz.' }]);
            setLoading(false);
        }, 800);
        return;
    }

    if (lowerMsg === 'night') {
        setTimeout(() => {
            onCheat('night');
            setMessages(prev => [...prev, { role: 'ai', text: '>> COMANDO ACEITO: Protocolo Noturno ativado. Modo furtivo.' }]);
            setLoading(false);
        }, 800);
        return;
    }

    if (!process.env.API_KEY) {
        setLoading(false);
        setMessages(prev => [...prev, { role: 'ai', text: 'ERRO: Conexão com uplink de satélite falhou. Verifique API_KEY.' }]);
        return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemPrompt = `
        Você é "Netrunner", uma IA assistente cínica, mas útil, em um jogo de sobrevivência cyberpunk chamado "NeonScrap".
        O usuário é um sucateiro tentando sobreviver nas ruínas de uma cidade futurista.
        Mantenha as respostas curtas, imersivas e estilizadas como saída de terminal.
        Responda estritamente em Português do Brasil.
        Refira-se a "Concreto", "Neon" e "Circuitos" como recursos valiosos.
        O mundo é perigoso. Use gírias cyberpunk brasileiras ou adaptadas (ex: "chapa", "tranqueira", "cromo", "fita errada").
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMsg,
        config: {
          systemInstruction: systemPrompt,
        }
      });

      setMessages(prev => [...prev, { role: 'ai', text: response.text }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: 'ERRO: Falha na conexão neural.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-4 right-4 w-80 bg-slate-900/90 border border-cyan-500 rounded-lg backdrop-blur-md flex flex-col shadow-[0_0_15px_rgba(6,182,212,0.5)] z-50">
      <div className="flex justify-between items-center p-3 border-b border-cyan-500/30">
        <div className="flex items-center gap-2 text-cyan-400">
          <Cpu size={16} />
          <span className="font-bold text-sm tracking-wider">NETRUNNER_IA</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="h-64 overflow-y-auto p-3 space-y-3 flex flex-col custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`text-xs p-2 rounded max-w-[90%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-cyan-900/50 text-cyan-100 self-end border border-cyan-700' : 'bg-slate-800 text-slate-300 self-start border border-slate-700 font-mono'}`}>
             <span className="block font-bold mb-1 opacity-50 uppercase text-[10px] flex items-center gap-1">
                {m.role === 'user' ? 'SUCATEIRO' : <><Terminal size={10}/> SISTEMA</>}
             </span>
             {m.text}
          </div>
        ))}
        {loading && <div className="text-xs text-cyan-500 animate-pulse pl-2">Processando consulta neural...</div>}
      </div>

      <div className="p-2 border-t border-cyan-500/30 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Consultar banco de dados..."
          className="flex-1 bg-black/50 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
        />
        <button 
          onClick={handleSend}
          disabled={loading}
          className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white p-1.5 rounded transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};