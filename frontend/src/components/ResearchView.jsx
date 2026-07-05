import ReactMarkdown from 'react-markdown';

const FIELDS = [
  { key: 'one_liner',   label: 'Summary' },
  { key: 'mechanism',   label: 'How It Works' },
  { key: 'when_to_use', label: 'When to Use' },
  { key: 'tradeoffs',   label: 'Tradeoffs' },
  { key: 'interview',   label: 'Interview Take' },
  { key: 'related',     label: 'Related Concepts' },
  { key: 'diagram',     label: 'Diagram' },
];

const markdownComponents = {
  p: ({ children }) => <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">{children}</ol>,
  li: ({ children }) => <li className="text-sm text-gray-700 dark:text-gray-300">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-800 dark:text-gray-200">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
  code: ({ children }) => <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-800 dark:text-gray-200">{children}</code>,
};

function FieldSection({ label, content, isDiagram }) {
  if (!content) return null;

  if (isDiagram) {
    return (
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{label}</h3>
        <pre className="overflow-x-auto rounded-lg bg-gray-900 text-green-400 p-4 text-xs font-mono leading-5 whitespace-pre">
          {content}
        </pre>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{label}</h3>
      <div className="prose-sm max-w-none">
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </div>
    </section>
  );
}

export default function ResearchView({ research }) {
  if (!research) return null;
  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Research</h2>
      <div className="space-y-5">
        {FIELDS.map(({ key, label }) => (
          <FieldSection key={key} label={label} content={research[key]} isDiagram={key === 'diagram'} />
        ))}
      </div>
    </div>
  );
}
