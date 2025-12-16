import React from 'react';

export default function ProcessNode({ p, onKill }) {
  const stateColor = {
    ready: '#16a34a',
    running: '#2563eb',
    blocked: '#dc2626',
    terminated: '#6b7280'
  }[p.state] || '#374151';

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        background: '#f9fafb',
        marginBottom: 10
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: 15 }}>{p.pid}</strong>
          <span style={{ color: '#6b7280' }}> — {p.name}</span>
        </div>

        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: 'white',
            background: stateColor
          }}
        >
          {p.state}
        </span>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 12, color: '#4b5563', marginTop: 6 }}>
        Priority: <strong>{p.priority ?? 1}</strong>
      </div>

      {/* Locks */}
      {p.heldLocks?.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 12 }}>
          🔒 <strong>Locks:</strong>{' '}
          {p.heldLocks.map(l => (
            <span
              key={l}
              style={{
                marginRight: 6,
                padding: '2px 6px',
                borderRadius: 6,
                background: '#e0f2fe',
                color: '#0369a1'
              }}
            >
              {l}
            </span>
          ))}
        </div>
      )}

      {/* Waiting */}
      {p.waitingFor && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>
          ⏳ Waiting for {p.waitingFor.type}:{' '}
          {p.waitingFor.channelId}
          {p.waitingFor.lockName ? `:${p.waitingFor.lockName}` : ''}
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button
          onClick={() => onKill?.(p.pid)}
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            padding: '4px 10px',
            fontSize: 12,
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          ❌ Kill
        </button>
      </div>
    </div>
  );
}
