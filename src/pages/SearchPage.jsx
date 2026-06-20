import { FileSearch, Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api.js';
import { EvidenceList, FormPanel, SectionTitle } from '../components.jsx';

export function SearchPage({ projectId }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [semantic, setSemantic] = useState(false);
  const [results, setResults] = useState([]);

  async function runSearch(event) {
    event.preventDefault();
    setResults(await (semantic ? api.semanticSearch({ projectId, q: query, type }) : api.search({ projectId, q: query, type })));
  }

  return (
    <section className="workspace">
      <div className="workspace-main">
        <FormPanel title="全局搜索" onSubmit={runSearch}>
          <div className="search-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="签证编号、材料名称、计量月份、部位名称" />
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">全部类型</option>
              <option value="variation">签证变更单</option>
              <option value="hidden">隐蔽工程记录</option>
              <option value="material">材料进场记录</option>
              <option value="monthly">月度计量记录</option>
              <option value="supplemental">后补资料</option>
            </select>
            <button>
              <Search size={16} />
              搜索
            </button>
          </div>
          <label className="toggle-field">
            <input type="checkbox" checked={semantic} onChange={(event) => setSemantic(event.target.checked)} />
            AI 语义搜索
          </label>
        </FormPanel>
      </div>
      <aside className="workspace-side">
        <SectionTitle icon={FileSearch} title="搜索结果" />
        <EvidenceList records={results} />
      </aside>
    </section>
  );
}
