import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

interface JsonNodeProps {
  nodeKey?: string | number;
  value: any;
  depth: number;
  isLast: boolean;
  globalExpandState?: boolean; // true = expand all, false = collapse all, undefined = manual
}

function JsonTreeNode({ nodeKey, value, depth, isLast, globalExpandState }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 3);

  // Sync with global expand/collapse controls
  useEffect(() => {
    if (globalExpandState !== undefined) {
      setIsExpanded(globalExpandState);
    }
  }, [globalExpandState]);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const renderKey = () => {
    if (nodeKey === undefined) return null;
    return (
      <span className="json-key">
        {typeof nodeKey === 'string' ? `"${nodeKey}"` : nodeKey}
        <span style={{ color: 'var(--color-text-muted)', margin: '0 4px' }}>:</span>
      </span>
    );
  };

  // 1. Handle null
  if (value === null) {
    return (
      <div className="json-node">
        {renderKey()}
        <span className="json-value-null">null</span>
        {!isLast && <span className="json-brace">,</span>}
      </div>
    );
  }

  // 2. Handle Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="json-node">
          {renderKey()}
          <span className="json-brace">[]</span>
          {!isLast && <span className="json-brace">,</span>}
        </div>
      );
    }

    return (
      <div className="json-node">
        <div className="json-node-expandable" onClick={toggleExpand} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <ChevronRight 
            size={12} 
            className={`json-node-toggle-icon ${isExpanded ? 'expanded' : ''}`} 
          />
          {renderKey()}
          <span className="json-brace">[</span>
          {!isExpanded && (
            <>
              <span style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem', margin: '0 4px' }}>
                {`/* ${value.length} items */`}
              </span>
              <span className="json-brace">]</span>
              {!isLast && <span className="json-brace">,</span>}
            </>
          )}
        </div>
        
        {isExpanded && (
          <>
            {value.map((item, idx) => (
              <JsonTreeNode
                key={idx}
                nodeKey={idx}
                value={item}
                depth={depth + 1}
                isLast={idx === value.length - 1}
                globalExpandState={globalExpandState}
              />
            ))}
            <div style={{ marginLeft: 0 }}>
              <span className="json-brace">]</span>
              {!isLast && <span className="json-brace">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  // 3. Handle Objects
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return (
        <div className="json-node">
          {renderKey()}
          <span className="json-brace">{"{}"}</span>
          {!isLast && <span className="json-brace">,</span>}
        </div>
      );
    }

    return (
      <div className="json-node">
        <div className="json-node-expandable" onClick={toggleExpand} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <ChevronRight 
            size={12} 
            className={`json-node-toggle-icon ${isExpanded ? 'expanded' : ''}`} 
          />
          {renderKey()}
          <span className="json-brace">{"{"}</span>
          {!isExpanded && (
            <>
              <span style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem', margin: '0 4px' }}>
                {`/* ${keys.length} keys */`}
              </span>
              <span className="json-brace">{"}"}</span>
              {!isLast && <span className="json-brace">,</span>}
            </>
          )}
        </div>

        {isExpanded && (
          <>
            {keys.map((k, idx) => (
              <JsonTreeNode
                key={k}
                nodeKey={k}
                value={value[k]}
                depth={depth + 1}
                isLast={idx === keys.length - 1}
                globalExpandState={globalExpandState}
              />
            ))}
            <div style={{ marginLeft: 0 }}>
              <span className="json-brace">{"}"}</span>
              {!isLast && <span className="json-brace">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  // 4. Handle primitives (strings, numbers, booleans)
  let valClass = 'json-value-string';
  let formattedValue = JSON.stringify(value);

  if (typeof value === 'number') {
    valClass = 'json-value-number';
  } else if (typeof value === 'boolean') {
    valClass = 'json-value-boolean';
  } else if (typeof value === 'string') {
    // Show standard quotes inside the string value without escaping them visually
    formattedValue = `"${value.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`;
  }

  return (
    <div className="json-node">
      {renderKey()}
      <span className={valClass}>{formattedValue}</span>
      {!isLast && <span className="json-brace">,</span>}
    </div>
  );
}

interface JsonTreeProps {
  data: any;
  globalExpandState?: boolean;
}

export function JsonTree({ data, globalExpandState }: JsonTreeProps) {
  return (
    <div className="json-tree">
      <div className="json-brace" style={{ marginBottom: 4 }}>
        {Array.isArray(data) ? '[' : '{'}
      </div>
      
      {Array.isArray(data) ? (
        data.map((item, idx) => (
          <JsonTreeNode
            key={idx}
            nodeKey={idx}
            value={item}
            depth={1}
            isLast={idx === data.length - 1}
            globalExpandState={globalExpandState}
          />
        ))
      ) : (
        Object.keys(data).map((k, idx, arr) => (
          <JsonTreeNode
            key={k}
            nodeKey={k}
            value={data[k]}
            depth={1}
            isLast={idx === arr.length - 1}
            globalExpandState={globalExpandState}
          />
        ))
      )}

      <div className="json-brace" style={{ marginTop: 4 }}>
        {Array.isArray(data) ? ']' : '}'}
      </div>
    </div>
  );
}
