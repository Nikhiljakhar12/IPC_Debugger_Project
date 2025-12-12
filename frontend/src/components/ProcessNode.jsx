import React from 'react';
export default function ProcessNode({ p }){
return (
<div>
<div style={{display:'flex', justifyContent:'space-between'}}>
<div><strong>{p.pid}</strong> — {p.name}</div>
<div className="small">{p.state}</div>
</div>
{p.heldLocks && p.heldLocks.length>0 && <div className="small">Locks: {p.heldLocks.join(',')}</div>}
</div>
);
}
