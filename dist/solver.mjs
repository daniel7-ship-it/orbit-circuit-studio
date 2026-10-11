export function pins(c){return c.type==='ground'?[`${c.id}:0`]:[`${c.id}:0`,`${c.id}:1`];}
export function solve(project,{transient=false}={}){
 const cs=project.components, wires=project.wires, parent=new Map();
 cs.forEach(c=>pins(c).forEach(p=>parent.set(p,p)));
 const find=p=>{if(!parent.has(p))throw Error('A wire references a missing terminal.');while(parent.get(p)!==p)p=parent.get(p);return p;};
 const join=(a,b)=>parent.set(find(a),find(b));wires.forEach(w=>join(w.a,w.b));
 const grounds=cs.filter(c=>c.type==='ground');if(!grounds.length)throw Error('Add ground and connect it to the return wire.');
 grounds.slice(1).forEach(c=>join(pins(grounds[0])[0],pins(c)[0]));
 const g=find(pins(grounds[0])[0]); const roots=[...new Set(cs.flatMap(c=>pins(c).map(find)))].filter(r=>r!==g);
 const idx=p=>{const r=find(p);return r===g?-1:roots.indexOf(r);};
 const sources=cs.filter(c=>c.type==='source');if(!sources.length)throw Error('Add a voltage source to power the circuit.');
 cs.filter(c=>c.type!=='ground').forEach(c=>{if(!Number.isFinite(c.value)||c.value<=0)throw Error(`${c.label}: enter a positive value.`);if(pins(c).some(p=>!wires.some(w=>w.a===p||w.b===p)))throw Error(`${c.label} has an unconnected pin. Click two pins to wire them.`);});
 const n=roots.length+sources.length;if(n>100)throw Error('This first version supports up to 100 electrical unknowns.');
 const rs=cs.filter(c=>c.type==='resistor'), caps=cs.filter(c=>c.type==='capacitor');
 const duration=0.02, steps=400, dt=duration/steps;let previous=Array(n).fill(0);
 const samples=[];let last;
 for(let step=0;step<(transient?steps+1:1);step++){
  const A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);
  const stamp=(c,y,i=0)=>{const a=idx(pins(c)[0]),d=idx(pins(c)[1]);if(a>=0){A[a][a]+=y;b[a]+=i;}if(d>=0){A[d][d]+=y;b[d]-=i;}if(a>=0&&d>=0){A[a][d]-=y;A[d][a]-=y;}};
  rs.forEach(c=>stamp(c,1/c.value));
  if(transient)caps.forEach(c=>{const a=idx(pins(c)[0]),d=idx(pins(c)[1]),y=c.value/dt;stamp(c,y,y*((a<0?0:previous[a])-(d<0?0:previous[d])));});
  sources.forEach((c,k)=>{const a=idx(pins(c)[0]),d=idx(pins(c)[1]),j=roots.length+k;if(a>=0){A[a][j]=1;A[j][a]=1;}if(d>=0){A[d][j]=-1;A[j][d]=-1;}b[j]=transient&&step===0?0:c.value;});
  last=linear(A,b);previous=last;
  const voltages=Object.fromEntries(cs.flatMap(c=>pins(c).map(p=>[p,idx(p)<0?0:last[idx(p)]])));
  samples.push({t:step*dt,voltages});
 }
 return {samples,voltages:samples.at(-1).voltages,ground:g,duration,method:transient?'Backward Euler · 50 µs step':'DC operating point'};
}
function linear(A,b){const n=b.length;for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(A[i][k])>Math.abs(A[p][k]))p=i;if(Math.abs(A[p][k])<1e-14)throw Error('The circuit has a floating node or conflicting sources. Check ground and wire connections.');[A[p],A[k]]=[A[k],A[p]];[b[p],b[k]]=[b[k],b[p]];for(let i=k+1;i<n;i++){const f=A[i][k]/A[k][k];for(let j=k;j<n;j++)A[i][j]-=f*A[k][j];b[i]-=f*b[k];}}const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=b[i];for(let j=i+1;j<n;j++)s-=A[i][j]*x[j];x[i]=s/A[i][i];}return x;}
