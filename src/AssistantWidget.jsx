import { Bot, Send, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { api } from './api.js';
import { evidenceLabels } from './domain.js';

const starterMessage = {
  role: 'assistant',
  content: '我是项目证据链助手。可以帮你分析当前项目证据、提示缺口，也可以生成证据录入草稿。',
  basis: 'professional'
};

const basisLabels = {
  project: '来源：当前项目摘要',
  professional: '来源：AI 专业经验',
  mixed: '来源：项目摘要 + AI 专业经验'
};

export function AssistantWidget({ projectId, currentPage, currentEvidenceType = 'variation', onApplyDraft }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([starterMessage]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = !projectId || busy;

  async function sendMessage(event) {
    event.preventDefault();
    const content = input.trim();
    if (!content || disabled) return;
    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    try {
      const result = await api.assistantChat({
        projectId,
        currentPage,
        currentEvidenceType,
        messages: nextMessages
      });
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: result.reply,
          basis: result.basis,
          draft: result.draft,
          meta: [result.provider, result.model].filter(Boolean).join(' · ')
        }
      ]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: error.message || 'AI 助手暂时不可用，请稍后再试。',
          error: true
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  function applyDraft(draft) {
    onApplyDraft?.(draft);
    setOpen(false);
  }

  function askToFillCurrentForm() {
    const label = evidenceLabels[currentEvidenceType] || '证据';
    setInput(`请根据当前项目情况，帮我填写一份${label}表单草稿。字段尽量完整，填不准的地方请在备注或警告里提醒我。`);
  }

  return (
    <div className={open ? 'assistant-widget open' : 'assistant-widget'}>
      {open && (
        <section className="assistant-panel" aria-label="AI 助手对话框">
          <header className="assistant-head">
            <div>
              <span><Sparkles size={15} /> 项目 AI 助手</span>
              <strong>证据链问答与草稿</strong>
            </div>
            <button type="button" className="icon-button secondary" onClick={() => setOpen(false)} aria-label="关闭 AI 助手">
              <X size={17} />
            </button>
          </header>

          <div className="assistant-messages">
            {!projectId && <p className="assistant-hint">先创建或选择项目后，AI 助手才能读取当前项目摘要。</p>}
            {projectId && currentPage === 'evidence' && (
              <div className="assistant-quick-actions">
                <button type="button" className="secondary" onClick={askToFillCurrentForm}>
                  帮我填写当前表单
                </button>
              </div>
            )}
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`assistant-message ${message.role}${message.error ? ' error' : ''}`}>
                <p>{message.content}</p>
                {message.basis && <span className="assistant-basis">{basisLabels[message.basis] || basisLabels.professional}</span>}
                {message.meta && <small>{message.meta}</small>}
                {message.draft && (
                  <div className="assistant-draft">
                    <strong>{evidenceLabels[message.draft.type] || '证据'}草稿</strong>
                    <span>置信度 {Math.round((message.draft.confidence || 0) * 100)}%</span>
                    {(message.draft.warnings || []).map((warning) => <em key={warning}>{warning}</em>)}
                    <button type="button" onClick={() => applyDraft(message.draft)}>
                      填入证据表单
                    </button>
                  </div>
                )}
              </article>
            ))}
            {busy && <article className="assistant-message assistant"><p>正在分析当前项目...</p></article>}
          </div>

          <form className="assistant-input-row" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={projectId ? '说“帮我填写当前表单”，或描述要录入的证据' : '先选择项目'}
              disabled={!projectId || busy}
            />
            <button type="submit" className="icon-button" disabled={disabled || !input.trim()} aria-label="发送给 AI 助手">
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
      <button type="button" className="assistant-bubble" onClick={() => setOpen((value) => !value)} aria-label="打开 AI 助手">
        <Bot size={24} />
      </button>
    </div>
  );
}
