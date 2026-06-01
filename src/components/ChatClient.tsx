'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, SendHorizonal } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  '来週欠品しそうな商品は？',
  '賞味期限が7日以内のロットを教えて',
  '今週の出荷予定を教えて',
  '在庫が10個以下の商品は？',
  '今後14日以内の入荷予定は？',
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-violet-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  // Render assistant message with basic markdown-like formatting
  const lines = message.content.split('\n');
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles size={13} className="text-violet-600" />
      </div>
      <div className="max-w-[80%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 leading-relaxed space-y-1">
        {lines.map((line, i) => {
          if (line.startsWith('# ')) return <p key={i} className="font-bold text-slate-800 text-base">{line.slice(2)}</p>;
          if (line.startsWith('## ')) return <p key={i} className="font-semibold text-slate-800">{line.slice(3)}</p>;
          if (line.startsWith('- ') || line.startsWith('• ')) return <p key={i} className="pl-3 before:content-['•'] before:mr-2 before:text-violet-400">{line.slice(2)}</p>;
          if (line.startsWith('| ')) return <p key={i} className="font-mono text-xs text-slate-600 whitespace-pre">{line}</p>;
          if (line === '') return <div key={i} className="h-1" />;
          if (/^\*\*.+\*\*$/.test(line)) return <p key={i} className="font-semibold text-slate-800">{line.replace(/\*\*/g, '')}</p>;
          return <p key={i}>{line}</p>;
        })}
      </div>
    </div>
  );
}

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.content ?? 'エラーが発生しました。' }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: '通信エラーが発生しました。' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-2xl">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-5 pt-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                <Sparkles size={13} className="text-violet-600" />
              </div>
              <p className="text-sm text-slate-600">在庫・出荷・入荷について何でも聞いてください。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}

        {loading && (
          <div className="flex gap-2.5 items-center">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <Sparkles size={13} className="text-violet-600 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex gap-2 items-end bg-white border border-slate-300 rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent transition-shadow">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="在庫・出荷・入荷について質問する..."
            rows={1}
            disabled={loading}
            className="flex-1 resize-none text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent leading-relaxed disabled:opacity-50"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-1.5 text-violet-600 hover:text-violet-700 disabled:opacity-30 transition-colors shrink-0"
            aria-label="送信"
          >
            <SendHorizonal size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 ml-1">Shift+Enterで改行、Enterで送信</p>
      </div>
    </div>
  );
}
