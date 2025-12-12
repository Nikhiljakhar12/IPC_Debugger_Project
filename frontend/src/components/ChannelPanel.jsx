import React from 'react';
export default function ChannelPanel({ c }){
return (
<div>
<div style={{display:'flex', justifyContent:'space-between'}}>
<div><strong>{c.cid}</strong> — {c.type}</div>
<div className="small">{c.buffer?.length ?? 0}/{c.bufferSize}</div>
</div>
{c.type === 'shared' && <div className="small">Memory keys: {Object.keys(c.memory||{}).join(', ')}</div>}
</div>
);
}
