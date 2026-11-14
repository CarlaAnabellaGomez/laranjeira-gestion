import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,GoogleAuthProvider,signInWithPopup,signOut,sendPasswordResetEmail,updateProfile} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot,setDoc,updateDoc,runTransaction,addDoc,increment} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const cfgFb={apiKey:"AIzaSyDSFDXEku0rMLacznM73yXoXmLsWDyx8S8",authDomain:"laranjeira-sas.firebaseapp.com",projectId:"laranjeira-sas",storageBucket:"laranjeira-sas.firebasestorage.app",messagingSenderId:"253987626533",appId:"1:253987626533:web:9c392b03b1fa35015729cc"};
const OWNER='gomez.charlie29@gmail.com';
const app=initializeApp(cfgFb),auth=getAuth(app),fs=getFirestore(app);auth.languageCode='es';
const $=q=>document.querySelector(q);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>(Math.round(n||0)<0?'−$':'$')+Math.abs(Math.round(n||0)).toLocaleString('es-AR');
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const match=(t,q)=>norm(q).trim().split(/\s+/).every(w=>norm(t).includes(w));
const r2=x=>Math.round(x*100)/100;
const S={bajas:[],reposiciones:[],u:null,perfil:null,owner:false,clientes:[],productos:[],pedidos:[],config:{},vista:'lista',draft:null,q:'',subs:[]};
const ofertaAct=p=>!!(p&&p.oferta&&p.oferta.hasta>=today()&&(p.oferta.desde||'')<=today());
const precio=(p,l)=>Math.round(ofertaAct(p)?(l==='min'?p.oferta.min:p.oferta.may):(l==='min'?p.precioMin:p.precioMay))||0;
const costoU=(p,l)=>l==='min'?(p.costo||0)/(p.kgUn||1):(p.costo||0);
const total=its=>its.reduce((s,i)=>s+i.cant*i.precio,0);
function msg(t,err){const m=$('#msg');m.textContent=t;m.className='msg'+(err?' err':'');m.style.display='block';clearTimeout(msg.t);msg.t=setTimeout(()=>m.style.display='none',2800)}
const propios=()=>!S.owner&&S.perfil&&(S.perfil.acc||[]).includes('propios');
const misClientes=()=>propios()?S.clientes.filter(c=>c.vendedorId===S.perfil.vendedorId):S.clientes;
const misPedidos=()=>{const ids=new Set(misClientes().map(c=>c.id));return S.pedidos.filter(p=>!propios()||ids.has(p.clienteId)||p.creadoPor===S.u.uid)};
const nombreYo=()=>(S.perfil&&S.perfil.nombre)||S.u.displayName||S.u.email;

// ---------- login
function loginUI(modo){$('#top').classList.add('solo');$('#main').innerHTML=`<div class="card"><h2>${modo==='alta'?'Crear cuenta':'Ingresar'}</h2>
 <button class="s full" id="lg_g">Entrar con Google</button><div class="mu c">o con tu email</div>
 ${modo==='alta'?'<label>Nombre y apellido<input id="lg_n" autocomplete="name"></label>':''}
 <label>Email<input id="lg_e" type="email" autocomplete="email"></label><label>Contraseña<input id="lg_p" type="password"></label>
 <button class="b full" id="lg_ok">${modo==='alta'?'Crear cuenta':'Ingresar'}</button><div id="lg_m" class="mu" style="margin-top:8px"></div>
 <div class="row sp" style="margin-top:12px">${modo==='alta'?'<a href="#" id="lg_sw">Ya tengo cuenta</a>':'<a href="#" id="lg_sw">Crear una cuenta</a><a href="#" id="lg_r">Olvidé mi contraseña</a>'}</div></div>`;
 const m=t=>$('#lg_m').textContent=t;const er=e=>({'auth/invalid-credential':'Email o contraseña incorrectos.','auth/email-already-in-use':'Ese email ya tiene cuenta: ingresá.','auth/weak-password':'Mínimo 6 caracteres.','auth/invalid-email':'Email no válido.'}[e.code]||('Error: '+e.code));
 $('#lg_g').onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){m(er(e))}};
 $('#lg_sw').onclick=e=>{e.preventDefault();loginUI(modo==='alta'?'login':'alta')};
 if($('#lg_r'))$('#lg_r').onclick=async e=>{e.preventDefault();const em=$('#lg_e').value.trim();if(!em)return m('Escribí tu email primero.');try{await sendPasswordResetEmail(auth,em);m('Te mandamos un email para cambiarla.')}catch(x){m(er(x))}};
 $('#lg_ok').onclick=async()=>{const em=$('#lg_e').value.trim(),pw=$('#lg_p').value;try{if(modo==='alta'){const c=await createUserWithEmailAndPassword(auth,em,pw);const n=$('#lg_n').value.trim();if(n)await updateProfile(c.user,{displayName:n});location.reload()}else await signInWithEmailAndPassword(auth,em,pw)}catch(e){m(er(e))}}}

// ---------- arranque
let iniciado=false;
onAuthStateChanged(auth,u=>{if(!u){if(iniciado)location.reload();else loginUI('login');return}if(iniciado)return;iniciado=true;S.u=u;
 S.owner=u.email===OWNER&&u.emailVerified;$('#yo').textContent=u.displayName||u.email;$('#salir').style.display='';$('#salir').onclick=()=>signOut(auth);
 if(S.owner){S.perfil={rol:'Administrador',activo:true,secc:['pedido'],acc:[]};conectar();return}
 let prev;onSnapshot(doc(fs,'usuarios/'+u.uid),d=>{const v=d.exists()?d.data():null;const k=JSON.stringify(v);if(prev!==undefined&&k!==prev){location.reload();return}prev=k;S.perfil=v;
  if(!v||!v.activo||!(v.secc||[]).includes('pedido')){pendiente(v);if(!v)setDoc(doc(fs,'solicitudes/'+u.uid),{creado:new Date().toISOString(),nombre:u.displayName||u.email,email:u.email||'',origen:'app vendedores'}).catch(()=>{});return}
  conectar()},()=>pendiente(null))});
function pendiente(v){$('#top').classList.add('solo');$('#main').innerHTML=`<div class="card"><h2>${v&&v.activo===false?'Tu acceso está desactivado':v?'Sin permiso para cargar pedidos':'Esperando aprobación'}</h2><p class="mu">${v?'Pedile a la administración que te habilite "Nuevo pedido".':'La administración ya recibió tu solicitud. Cuando te apruebe, esta pantalla se actualiza sola.'}</p></div>`}
function conectar(){$('#top').classList.remove('solo');$('#main').innerHTML='<div class="card mu">Cargando…</div>';let n=0;const listo=()=>{if(++n>=4)render()};
 const sub=(col,key)=>onSnapshot(collection(fs,col),s=>{S[key]=s.docs.map(d=>({id:d.id,...d.data()}));if(!sub[key]){sub[key]=1;listo()}else if(!document.activeElement||!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))if(S.vista!=='form')render()},e=>{msg('Error de datos: '+e.code,true)});
 sub('clientes','clientes');sub('productos','productos');sub('pedidos','pedidos');onSnapshot(collection(fs,'bajas'),s=>{S.bajas=s.docs.map(d=>({id:d.id,...d.data()}));if(S.vista==='det')render()},()=>{});onSnapshot(collection(fs,'reposiciones'),s=>{S.reposiciones=s.docs.map(d=>({id:d.id,...d.data()}));if(S.vista==='det')render()},()=>{});
 onSnapshot(doc(fs,'config/main'),d=>{S.config=d.exists()?d.data():{};if(!sub.cfg){sub.cfg=1;listo()}},()=>{if(!sub.cfg){sub.cfg=1;listo()}})}
window.go=v=>{S.vista=v;render();window.scrollTo(0,0)};
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.vista||(S.vista==='form'&&b.dataset.v==='nuevo'&&!S.draft.editId)));
 if(S.vista==='lista')return vLista();if(S.vista==='nuevo'){nuevo();return}if(S.vista==='form')return vForm();if(S.vista==='det')return vDet()}

const fh=f=>{try{return new Date(f).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}catch(e){return f}};
const ultNo=p=>{const e=p.entregas||[];const u=e[e.length-1];return p.estado!=='entregado'&&u&&u.resultado==='No entregado'?u:null};
// ---------- lista
function vLista(){const q=S.q;let ps=misPedidos().slice().sort((a,b)=>(!!(b.habilitadoCorreccion&&b.estado==='entregado'))-(!!(a.habilitadoCorreccion&&a.estado==='entregado'))||b.numero-a.numero);if(q)ps=ps.filter(p=>match(p.clienteNombre+' '+p.numero,q));const todos=ps;if(S.fe)ps=ps.filter(p=>p.estado===S.fe);
 const pend=todos.filter(p=>p.estado==='pendiente').length;const hoy=today(),deHoy=ps.filter(p=>p.fecha===hoy&&p.estado!=='anulado');
 $('#main').innerHTML=`<div class="kp"><div><span>Pedidos de hoy</span><b>${deHoy.length}</b></div><div><span>Por entregar</span><b>${pend}</b></div></div>
 <div class="row" style="margin-bottom:8px">${['','pendiente','entregado'].map(f=>`<button class="${(S.fe||'')===f?'b':'s'}" style="flex:1;padding:8px" onclick="S.fe='${f}';vLista()">${f===''?'Todos':f==='pendiente'?'⏳ Pendientes':'✅ Entregados'}</button>`).join('')}</div>
 <input id="q" class="full" placeholder="Buscar cliente o N° de pedido…" value="${esc(q)}">
 ${ps.slice(0,80).map(p=>`<div class="ped ${p.estado}" onclick="ver('${p.id}')">${p.habilitadoCorreccion&&p.estado==='entregado'?'<div class="mu" style="color:#a15c00;font-weight:600">🔓 Habilitado para corregir</div>':''}<div class="row sp"><b>N° ${p.numero} · ${esc(p.clienteNombre)}</b><span class="tag ${p.estado}">${p.estado}</span></div>
  <div class="row sp mu"><span>${p.fecha}${p.entrega&&p.entrega!==p.fecha?' · entrega '+p.entrega:''} · ${p.cond==='CC'?'Cta. cte.':'Contado'}</span><b style="color:#222">${money(p.total)}</b></div>
  ${p.estado==='entregado'?`<div class="mu">🚚 Entregado${p.entregadoPorNombre?' por '+esc(p.entregadoPorNombre):''}${p.entregadoEn?' · '+fh(p.entregadoEn):''}</div>`:ultNo(p)?`<div class="mu" style="color:#c62828">❌ No entregado: ${esc(ultNo(p).motivo)} · ${fh(ultNo(p).fecha)}</div>`:''}
  ${p.historial&&p.historial.length?`<div class="mu">✏️ corregido ${p.historial.length} vez/veces</div>`:''}</div>`).join('')||'<div class="card mu">Todavía no hay pedidos.</div>'}`;
 $('#q').oninput=e=>{S.q=e.target.value;clearTimeout(S.t);S.t=setTimeout(()=>{vLista();const i=$('#q');i.focus();i.setSelectionRange(i.value.length,i.value.length)},300)}}

// ---------- formulario
function nuevo(){S.draft={cli:null,items:[],cond:'CONTADO',lista:'may',nota:'',fent:today()};S.vista='form';vForm()}
window.ver=id=>{S.detId=id;S.vista='det';render();window.scrollTo(0,0)};
window.editar=id=>{const p=S.pedidos.find(x=>x.id===id);S.draft={editId:id,cli:p.clienteId,items:p.items.map(i=>({...i})),cond:p.cond,lista:(p.items[0]&&p.items[0].lista)||'may',nota:p.nota||'',fent:p.entrega||p.fecha,numero:p.numero};S.vista='form';vForm();window.scrollTo(0,0)};
function vForm(){const d=S.draft;const c=S.clientes.find(x=>x.id===d.cli);
 $('#main').innerHTML=`<div class="card"><h2>${d.editId?'Corregir pedido N° '+d.numero:'Nuevo pedido'}</h2>
 ${c?`<div class="cli"><div><b>${esc(c.nombre)}</b><div class="mu">${esc(c.telefono||'')} ${c.direccion?'· '+esc(c.direccion):''}</div></div>${d.editId?'':'<button class="s" onclick="cambiarCli()">Cambiar</button>'}</div>`
  :`<input id="cq" class="full" placeholder="Buscar cliente…" autocomplete="off"><div id="cs" class="sug"></div><button class="s full" style="margin-top:6px" onclick="nuevoCli()">+ Cliente nuevo</button>`}
 <div class="row" style="margin-top:10px"><label>Condición<select id="f_c"><option value="CONTADO" ${d.cond==='CONTADO'?'selected':''}>Contado</option><option value="CC" ${d.cond==='CC'?'selected':''}>Cuenta corriente</option></select></label>
 <label>Precio<select id="f_l"><option value="may" ${d.lista==='may'?'selected':''}>Mayorista (bulto)</option><option value="min" ${d.lista==='min'?'selected':''}>Minorista (kg/un)</option></select></label>
 <label>Entrega<input type="date" id="f_e" value="${d.fent}"></label></div></div>
 <div class="card"><h3>Productos</h3><input id="pq" class="full" placeholder="Agregar producto…" autocomplete="off"><div id="ps" class="sug"></div>
 <div id="its">${d.items.map((i,k)=>`<div class="it"><div class="g"><b>${esc(i.nombre)}${i.oferta?' 🔥':''}</b><div class="mu">${money(i.precio)} ${i.lista==='min'?'kg/un':'bulto'}</div></div>
  <div class="q"><button onclick="cant(${k},-${i.lista==='min'?1:0.5})">−</button><input type="number" inputmode="decimal" step="0.5" value="${i.cant}" onchange="cant(${k},null,this.value)"><button onclick="cant(${k},${i.lista==='min'?1:0.5})">+</button></div>
  <div class="st">${money(i.cant*i.precio)}</div><button class="x" onclick="quitar(${k})">✕</button></div>`).join('')||'<div class="mu" style="padding:8px 0">Buscá y agregá productos.</div>'}</div>
 <div class="tot">Total <b>${money(total(d.items))}</b></div>
 <textarea id="f_n" placeholder="Nota (horario, dirección, etc.)">${esc(d.nota)}</textarea>
 ${d.editId?'<input id="f_mot" class="full" placeholder="Motivo de la corrección (ej.: el cliente sumó 2 cajones)">':''}
 <div class="mu" style="margin:6px 0">Los cobros los registra la administración.</div>
 <button class="b full" id="save" onclick="guardar()">${d.editId?'Guardar corrección':'Guardar pedido'}</button><button class="s full" style="margin-top:6px" onclick="cancelar()">Cancelar</button></div>`;
 $('#f_c').onchange=e=>d.cond=e.target.value;$('#f_l').onchange=e=>{d.lista=e.target.value};$('#f_e').onchange=e=>d.fent=e.target.value;$('#f_n').oninput=e=>d.nota=e.target.value;
 if(!c)picker('#cq','#cs',q=>misClientes().filter(x=>match(x.nombre+' '+(x.telefono||''),q)).slice(0,10).map(x=>({id:x.id,html:`${esc(x.nombre)} <span class="mu">${esc(x.telefono||'')}</span>`})),id=>{const x=S.clientes.find(y=>y.id===id);d.cli=id;d.cond=x.tipo==='CUENTA CORRIENTE'?'CC':'CONTADO';vForm()});
 picker('#pq','#ps',q=>S.productos.filter(x=>x.activo!==false&&match(x.nombre,q)).slice(0,12).map(x=>({id:x.id,html:`${esc(x.nombre)}${ofertaAct(x)?' 🔥':''} <span class="mu">${money(precio(x,d.lista))}</span>`})),id=>{const p=S.productos.find(x=>x.id===id);
  const e=d.items.find(i=>i.prodId===id&&i.lista===d.lista);if(e)e.cant=r2(e.cant+(d.lista==='min'?1:1));else d.items.push({prodId:p.id,nombre:p.nombre,cant:1,precio:precio(p,d.lista),costo:costoU(p,d.lista),lista:d.lista,oferta:ofertaAct(p)?p.oferta.pct:0});vForm();setTimeout(()=>$('#pq').focus(),0)})}
window.cant=(k,dl,v)=>{const i=S.draft.items[k];i.cant=Math.max(0,r2(v!=null?parseFloat(v)||0:i.cant+dl));guardarCampos();vForm()};
window.quitar=k=>{S.draft.items.splice(k,1);guardarCampos();vForm()};
const guardarCampos=()=>{const n=$('#f_n');if(n)S.draft.nota=n.value};
window.cambiarCli=()=>{S.draft.cli=null;vForm()};
window.cancelar=()=>{const e=S.draft.editId;S.draft=null;if(e)ver(e);else go('lista')};
window.nuevoCli=()=>{dlg(`<h2>Cliente nuevo</h2><label>Nombre / comercio<input id="nc_n"></label><label>Teléfono<input id="nc_t" type="tel"></label><label>Dirección<input id="nc_d"></label>
 <label>Tipo<select id="nc_tp"><option>CONTADO</option><option>CUENTA CORRIENTE</option></select></label><button class="b full" onclick="guardarCli()">Guardar cliente</button><button class="s full" style="margin-top:6px" onclick="cerrar()">Cancelar</button>`)};
window.guardarCli=async()=>{const n=$('#nc_n').value.trim().toUpperCase();if(!n)return msg('Poné el nombre',true);const id='C-'+norm(n).replace(/[^a-z0-9]+/g,'-').slice(0,40)+'-'+Date.now().toString(36);
 const d={nombre:n,telefono:$('#nc_t').value.trim(),direccion:$('#nc_d').value.trim(),tipo:$('#nc_tp').value,categoria:'Nuevo',vendedorId:(S.perfil&&S.perfil.vendedorId)||'',estadoContacto:'Cliente',creado:new Date().toISOString(),creadoPor:S.u.uid};
 try{await setDoc(doc(fs,'clientes/'+id),d);S.clientes.push({id,...d});S.draft.cli=id;S.draft.cond=d.tipo==='CUENTA CORRIENTE'?'CC':'CONTADO';cerrar();vForm();msg('Cliente guardado')}catch(e){msg('No se pudo guardar: '+e.code,true)}};
function difs(a,b){const k=i=>i.prodId+'|'+(i.lista||'may');const A=Object.fromEntries(a.map(i=>[k(i),i])),B=Object.fromEntries(b.map(i=>[k(i),i]));const out=[];
 for(const [x,i] of Object.entries(B)){const o=A[x];if(!o)out.push('+ '+i.cant+' '+i.nombre);else if(o.cant!==i.cant)out.push(i.nombre+': '+o.cant+' → '+i.cant);else if(o.precio!==i.precio)out.push(i.nombre+': precio '+money(o.precio)+' → '+money(i.precio))}
 for(const [x,o] of Object.entries(A))if(!B[x])out.push('− '+o.cant+' '+o.nombre+' (quitado)');return out}
window.guardar=async()=>{guardarCampos();const d=S.draft;const c=S.clientes.find(x=>x.id===d.cli);const its=d.items.filter(i=>i.cant>0);if(!c)return msg('Elegí el cliente',true);if(!its.length)return msg('Agregá al menos un producto',true);
 const b=$('#save');b.disabled=true;b.textContent='Guardando…';const ahora=new Date().toISOString();
 try{if(d.editId){const old=S.pedidos.find(p=>p.id===d.editId);const hab=old.estado==='entregado'&&old.habilitadoCorreccion;if(old.estado!=='pendiente'&&!hab)throw{code:'El pedido ya está '+old.estado+': no se puede corregir'};
   const cambios=difs(old.items,its);if(old.entrega!==d.fent)cambios.push('Entrega: '+old.entrega+' → '+d.fent);if(old.cond!==d.cond)cambios.push('Condición: '+old.cond+' → '+d.cond);if((old.nota||'')!==d.nota)cambios.push('Nota cambiada');
   if(!cambios.length){b.disabled=false;b.textContent='Guardar corrección';return msg('No hay cambios',true)}
   const upd={items:its,total:total(its),costo:its.reduce((s,i)=>s+i.cant*(i.costo||0),0),cond:d.cond,nota:d.nota,entrega:d.fent,editado:ahora,
    ...(hab?{habilitadoCorreccion:null}:{}),historial:[...(old.historial||[]),{postEntrega:!!hab,fecha:ahora,totalAnterior:old.total,totalNuevo:total(its),itemsAnteriores:old.items,por:nombreYo(),porId:S.u.uid,cambios,motivo:($('#f_mot')&&$('#f_mot').value)||'',origen:'app vendedores'}].slice(-30)};
   await updateDoc(doc(fs,'pedidos/'+d.editId),upd);S.draft=null;msg('Corrección guardada');ver(d.editId)}
  else{const base={fecha:today(),entrega:d.fent||today(),clienteId:c.id,clienteNombre:c.nombre,vendedorId:c.vendedorId||(S.perfil&&S.perfil.vendedorId)||'',items:its,total:total(its),costo:its.reduce((s,i)=>s+i.cant*(i.costo||0),0),cond:d.cond,estado:'pendiente',nota:d.nota,creado:ahora,creadoPor:S.u.uid,creadoPorNombre:nombreYo(),origen:'app vendedores'};
   const maxNum=Math.max(0,...S.pedidos.map(p=>p.numero||0));
   const id=await runTransaction(fs,async t=>{const cr=doc(fs,'config/main');const cs=await t.get(cr);let n=Math.max((cs.exists()&&cs.data().proximo)||1,maxNum+1);
    for(let k=0;k<20;k++){const pr=doc(fs,'pedidos/P'+String(n).padStart(6,'0'));const ex=await t.get(pr);if(!ex.exists()){t.set(pr,{...base,numero:n});if(cs.exists())t.update(cr,{proximo:n+1});else t.set(cr,{proximo:n+1});return pr.id}n++}throw{code:'sin número'}});
   S.draft=null;msg('Pedido guardado');ver(id)}}
 catch(e){b.disabled=false;b.textContent=d.editId?'Guardar corrección':'Guardar pedido';msg('No se pudo guardar: '+(e.code||e.message),true)}};

// ---------- detalle
function boletaTxt(p){const n=(S.config&&S.config.negocio)||'Laranjeira S.A.S';return `*${n}* – Pedido N° ${p.numero}\nCliente: ${p.clienteNombre}\nFecha: ${p.fecha} · Entrega: ${p.entrega}\n`+p.items.map(i=>`• ${i.cant} ${i.lista==='min'?'kg/un':'bulto'} ${i.nombre}${i.oferta?' 🔥':''} x ${money(i.precio)} = ${money(i.cant*i.precio)}`).join('\n')+`\n*TOTAL: ${money(p.total)}*\nCondición: ${p.cond==='CC'?'Cuenta corriente':'Contado'}`+(p.nota?`\nNota: ${p.nota}`:'')+(p.historial&&p.historial.length?`\n_Pedido corregido el ${new Date(p.editado).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}_`:'')}
function vDet(){const p=S.pedidos.find(x=>x.id===S.detId);if(!p)return go('lista');const c=S.clientes.find(x=>x.id===p.clienteId)||{};const tel=String(c.telefono||'').replace(/\D/g,'').slice(-10);const t=boletaTxt(p);
 $('#main').innerHTML=`<button class="s" onclick="go('lista')">← Mis pedidos</button>
 ${p.habilitadoCorreccion&&p.estado==='entregado'?`<div class="card" style="background:#fff3cd;border-color:#ffe08a">🔓 <b>La administración habilitó este pedido para corregir.</b>${p.habilitadoCorreccion.motivo?`<div class="mu">Motivo: ${esc(p.habilitadoCorreccion.motivo)}</div>`:''}<div class="mu">Podés corregir cantidades, registrar devoluciones por mal estado o reposiciones. Al guardar una corrección o tocar <b>Terminar</b> se vuelve a cerrar.</div><button class="b full" style="margin-top:8px" onclick="terminarHab('${p.id}')">✅ Terminar y cerrar el pedido</button></div>`:''}
 <div class="card"><div class="row sp"><h2>Pedido N° ${p.numero}</h2><span class="tag ${p.estado}">${p.estado}</span></div><div class="mu">${esc(p.clienteNombre)} · ${p.fecha} · entrega ${p.entrega} · ${p.cond==='CC'?'Cuenta corriente':'Contado'}</div>
 <table>${p.items.map(i=>`<tr><td>${i.cant} ${i.lista==='min'?'kg/un':'bulto'}</td><td>${esc(i.nombre)}${i.oferta?' 🔥':''}</td><td class="n">${money(i.cant*i.precio)}</td></tr>`).join('')}<tr><th colspan="2">Total</th><th class="n">${money(p.total)}</th></tr></table>
 ${p.nota?`<div class="mu">Nota: ${esc(p.nota)}</div>`:''}
 ${p.entregas&&p.entregas.length?`<div style="margin-top:8px">${p.entregas.slice().reverse().map(x=>`<div class="mu">${x.resultado==='Entregado'?'✅':'❌'} <b>${esc(x.resultado)}</b> · ${fh(x.fecha)} · ${esc(x.vendedorNombre||'')}${x.motivo?' · '+esc(x.motivo):''}${x.nota?' · '+esc(x.nota):''}</div>`).join('')}</div>`:''}
 <div class="row" style="margin-top:10px">${p.estado==='pendiente'?`<button class="b" onclick="entrega('${p.id}')">🚚 Registrar entrega</button>`:''}${p.estado==='entregado'&&p.habilitadoCorreccion?`<button class="s" onclick="devolucion('${p.id}')">↩️ Devolución mal estado</button><button class="s" onclick="reposicion('${p.id}')">🔄 Reposición</button>`:''}${p.estado==='pendiente'||(p.estado==='entregado'&&p.habilitadoCorreccion)?`<button class="b" onclick="editar('${p.id}')">✏️ Corregir</button>`:`<span class="mu">${p.estado==='entregado'?'Ya entregado: para cambios hablá con la administración.':'Pedido anulado.'}</span>`}
 ${tel?`<a class="s" href="https://wa.me/549${tel}?text=${encodeURIComponent(t)}" target="_blank" rel="noopener">📲 Enviar boleta</a>`:''}<button class="s" onclick="copiar('${p.id}')">Copiar boleta</button></div></div>
 ${(()=>{const bs=S.bajas.filter(b=>b.pedidoId===p.id),rs=S.reposiciones.filter(r=>r.pedidoId===p.id);return bs.length||rs.length?`<div class="card"><h3>Devoluciones y reposiciones</h3>${bs.map(b=>`<div class="hist" style="border-color:#c62828;background:#fff5f5">↩️ <b>Devolución</b> · ${b.fecha} · ${esc(b.items.map(i=>i.cant+' '+i.nombre).join(', '))}<div class="mu">${esc(b.motivo)}${b.acreditar?' · descuento '+money(b.monto):''}${b.registradoPor?' · '+esc(b.registradoPor):''}${b.obs?' · '+esc(b.obs):''}</div></div>`).join('')}${rs.map(r=>`<div class="hist">🔄 <b>Reposición</b> · ${r.fecha} · ${esc(r.items.map(i=>i.cant+' '+i.retNombre+' → '+i.repCant+' '+i.repNombre).join(', '))}<div class="mu">${esc(r.motivo)}${r.diferencia?' · diferencia '+money(r.diferencia):''}${r.registradoPor?' · '+esc(r.registradoPor):''}${r.obs?' · '+esc(r.obs):''}</div></div>`).join('')}</div>`:''})()}
 <div class="card"><h3>Historial de correcciones</h3>${(p.historial||[]).slice().reverse().map(h=>`<div class="hist"><div class="row sp"><b>${new Date(h.fecha).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}</b><span class="mu">${esc(h.por||'Administración')}</span></div>
  ${h.cambios?`<ul>${h.cambios.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<div class="mu">Cambios hechos desde el sistema</div>'}${h.postEntrega?'<div class="mu">🔓 Corrección después de entregado</div>':''}${h.motivo?`<div class="mu">Motivo: ${esc(h.motivo)}</div>`:''}<div class="mu">Total ${money(h.totalAnterior)} → ${money(h.totalNuevo??p.total)}</div></div>`).join('')||'<div class="mu">Sin correcciones.</div>'}
  <div class="mu" style="margin-top:6px">Creado ${p.creadoPorNombre?'por '+esc(p.creadoPorNombre)+' ':''}el ${p.fecha}.</div></div>`}
window.copiar=async id=>{try{await navigator.clipboard.writeText(boletaTxt(S.pedidos.find(p=>p.id===id)));msg('Boleta copiada')}catch(e){msg('No se pudo copiar',true)}};

const MOT_NOENT=['Cliente cerrado / no estaba','Rechazó el pedido','Falta de mercadería','Dirección incorrecta','Se reprograma','Otro'];
window.entrega=id=>{const p=S.pedidos.find(x=>x.id===id);dlg(`<h2>🚚 Entrega – Pedido N° ${p.numero}</h2><div class="mu">${esc(p.clienteNombre)} · ${money(p.total)}</div>
 <div class="row" style="margin:10px 0"><button class="b" style="flex:1" id="en_si" onclick="S.enR='Entregado';$('#en_mw').style.display='none';this.className='b';$('#en_no').className='s'">✅ Entregado</button><button class="s" style="flex:1" id="en_no" onclick="S.enR='No entregado';$('#en_mw').style.display='';this.className='b';$('#en_si').className='s'">❌ No entregado</button></div>
 <div id="en_mw" style="display:none"><label>Motivo<select id="en_m">${MOT_NOENT.map(m=>`<option>${m}</option>`).join('')}</select></label></div>
 <label>Nota<input id="en_n" placeholder="Ej.: lo recibió el encargado"></label>
 <div class="mu" style="margin-bottom:8px">Se registra a tu nombre con la hora actual.</div>
 <button class="b full" onclick="guardarEntrega('${id}')">Guardar</button><button class="s full" style="margin-top:6px" onclick="cerrar()">Cancelar</button>`);S.enR='Entregado'};
window.guardarEntrega=async id=>{const p=S.pedidos.find(x=>x.id===id);const r=S.enR||'Entregado';const ahora=new Date().toISOString();const vid=(S.perfil&&S.perfil.vendedorId)||p.vendedorId||'';
 const reg={resultado:r,fecha:ahora,vendedorId:vid,vendedorNombre:nombreYo(),motivo:r==='No entregado'?$('#en_m').value:'',nota:$('#en_n').value,registradoPor:nombreYo(),registrado:ahora,origen:'app vendedores'};
 const upd={entregas:[...(p.entregas||[]),reg].slice(-20)};if(r==='Entregado')Object.assign(upd,{estado:'entregado',entregadoPor:vid,entregadoPorNombre:nombreYo(),entregadoEn:ahora});else Object.assign(upd,{estado:'pendiente',entregadoPor:'',entregadoPorNombre:'',entregadoEn:''});
 try{await updateDoc(doc(fs,'pedidos/'+id),upd);cerrar();msg(r==='Entregado'?'Entrega registrada':'Registrado: no entregado');ver(id)}catch(e){msg('No se pudo guardar: '+e.code,true)}};
// ---------- devolución / reposición (pedido reabierto)
const MOT_BAJA=['Mal estado / podrido','Golpeado','Maduro de más','Vencido','Otro'];
const MOT_REP=['Producto equivocado','Calibre o tamaño no pedido','Madurez no adecuada','Cambio a pedido del cliente','Faltante de la entrega','Otro'];
window.terminarHab=async id=>{try{await updateDoc(doc(fs,'pedidos/'+id),{habilitadoCorreccion:null});msg('Pedido cerrado');ver(id)}catch(e){msg('No se pudo: '+e.code,true)}};
window.devolucion=id=>{const p=S.pedidos.find(x=>x.id===id);dlg(`<h2>↩️ Devolución por mal estado</h2><div class="mu">Pedido N° ${p.numero} · ${esc(p.clienteNombre)}. Lo devuelto se da de baja (va a Bajas, no vuelve al stock).</div>
 ${p.items.map((i,k)=>`<div class="it" style="grid-template-columns:1fr auto"><div><b>${esc(i.nombre)}</b><div class="mu">pedido: ${i.cant} ${i.lista==='min'?'kg/un':'bulto'}</div></div><div class="q"><input type="number" inputmode="decimal" step="0.5" min="0" max="${i.cant}" id="dv_${k}" value="0" style="width:80px"></div></div>`).join('')}
 <label>Motivo<select id="dv_m">${MOT_BAJA.map(x=>`<option>${x}</option>`).join('')}</select></label>
 <label style="display:flex;gap:8px;align-items:center;color:var(--tx)"><input type="checkbox" id="dv_a" checked style="width:auto"> Descontar del total del cliente</label>
 <label>Observaciones<input id="dv_o"></label><button class="b full" onclick="guardarDev('${id}')">Registrar devolución</button><button class="s full" style="margin-top:6px" onclick="cerrar()">Cancelar</button>`)};
window.guardarDev=async id=>{const p=S.pedidos.find(x=>x.id===id);const items=p.items.map((i,k)=>({prodId:i.prodId,nombre:i.nombre,unidad:i.lista==='min'?'kg/un':'bulto',cant:Math.min(parseFloat($('#dv_'+k).value)||0,i.cant),precio:i.precio,costo:i.costo||0})).filter(i=>i.cant>0);
 if(!items.length)return msg('Indicá cuánto devuelve',true);
 const d={fecha:today(),tipo:'devolucion',pedidoId:id,numero:p.numero,clienteId:p.clienteId,clienteNombre:p.clienteNombre,items,motivo:$('#dv_m').value,obs:$('#dv_o').value,acreditar:$('#dv_a').checked,monto:items.reduce((s,i)=>s+i.cant*i.precio,0),costoPerdido:items.reduce((s,i)=>s+i.cant*i.costo,0),registradoPor:nombreYo(),origen:'app vendedores',creado:new Date().toISOString()};
 try{await addDoc(collection(fs,'bajas'),d);cerrar();msg('Devolución registrada');ver(id)}catch(e){msg('No se pudo guardar: '+e.code,true)}};
window.reposicion=id=>{const p=S.pedidos.find(x=>x.id===id);const opts=sel=>S.productos.filter(x=>x.activo!==false).slice().sort((a,b)=>a.nombre<b.nombre?-1:1).map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.nombre)}</option>`).join('');
 dlg(`<h2>🔄 Reposición</h2><div class="mu">Pedido N° ${p.numero} · ${esc(p.clienteNombre)}. Lo que devuelve vuelve al stock y sale otro producto en reemplazo.</div>
 ${p.items.map((i,k)=>`<div style="border-bottom:1px solid #f0f0f0;padding:8px 0"><b>${esc(i.nombre)}</b> <span class="mu">pedido: ${i.cant} × ${money(i.precio)}</span>
  <div class="row" style="margin-top:6px"><label style="min-width:90px;flex:0">Devuelve<input type="number" inputmode="decimal" step="0.5" min="0" max="${i.cant}" id="rp_c${k}" value="0" oninput="$('#rp_q${k}').value=this.value;repPrev('${id}')"></label>
  <label>Se entrega<select id="rp_p${k}" onchange="repPrev('${id}')">${opts(i.prodId)}</select></label><label style="min-width:90px;flex:0">Cant.<input type="number" inputmode="decimal" step="0.5" min="0" id="rp_q${k}" value="0" oninput="repPrev('${id}')"></label></div></div>`).join('')}
 <div id="rp_prev" class="mu" style="margin:8px 0"></div>
 <label style="display:flex;gap:8px;align-items:center;color:var(--tx)"><input type="checkbox" id="rp_aj" checked style="width:auto" onchange="repPrev('${id}')"> Actualizar el pedido con la diferencia de precio</label>
 <label>Motivo<select id="rp_m">${MOT_REP.map(x=>`<option>${x}</option>`).join('')}</select></label><label>Observaciones<input id="rp_o"></label>
 <button class="b full" onclick="guardarRep('${id}')">Registrar reposición</button><button class="s full" style="margin-top:6px" onclick="cerrar()">Cancelar</button>`);repPrev(id)};
function repLeer(p){const out=[];p.items.forEach((i,k)=>{const c=Math.min(parseFloat($('#rp_c'+k).value)||0,i.cant),q=parseFloat($('#rp_q'+k).value)||0;if(c<=0&&q<=0)return;const rp=S.productos.find(x=>x.id===$('#rp_p'+k).value)||{};const l=i.lista||'may';
 out.push({k,retProdId:i.prodId,retNombre:i.nombre,cant:c,retPrecio:i.precio,repProdId:rp.id||i.prodId,repNombre:rp.nombre||i.nombre,repCant:q,repPrecio:rp.id===i.prodId?i.precio:precio(rp,l),lista:l,repCosto:costoU(rp,l)})});return out}
function repNuevo(p,its){let a=p.items.map(x=>({...x}));for(const r of its)a[r.k].cant=r2(a[r.k].cant-r.cant);for(const r of its){if(r.repCant<=0)continue;const e=a.find(x=>x.prodId===r.repProdId&&x.precio===r.repPrecio&&(x.lista||'may')===r.lista);if(e)e.cant=r2(e.cant+r.repCant);else a.push({prodId:r.repProdId,nombre:r.repNombre,cant:r.repCant,precio:r.repPrecio,lista:r.lista,costo:r.repCosto})}a=a.filter(x=>x.cant>0);return{a,t:total(a)}}
window.repPrev=id=>{const p=S.pedidos.find(x=>x.id===id);const its=repLeer(p);const e=$('#rp_prev');if(!its.length){e.textContent='';return}const dif=its.reduce((s,r)=>s+r.repCant*r.repPrecio-r.cant*r.retPrecio,0);
 e.innerHTML=Math.abs(dif)<1?'Sin diferencia de precio.':`Diferencia: <b>${dif>0?'+':''}${money(dif)}</b>${$('#rp_aj').checked?` · total del pedido ${money(p.total)} → <b>${money(repNuevo(p,its).t)}</b>`:''}`};
window.guardarRep=async id=>{const p=S.pedidos.find(x=>x.id===id);const its=repLeer(p);if(!its.length)return msg('Indicá las cantidades',true);const dif=Math.round(its.reduce((s,r)=>s+r.repCant*r.repPrecio-r.cant*r.retPrecio,0));const aj=$('#rp_aj').checked&&Math.abs(dif)>=1;const ahora=new Date().toISOString();
 const d={fecha:today(),pedidoId:id,numero:p.numero,clienteId:p.clienteId,clienteNombre:p.clienteNombre,items:its.map(({k,...r})=>r),motivo:$('#rp_m').value,obs:$('#rp_o').value,diferencia:dif,ajustado:aj,registradoPor:nombreYo(),origen:'app vendedores',creado:ahora};
 try{await addDoc(collection(fs,'reposiciones'),d);
  for(const r of its){const pr=S.productos.find(x=>x.id===r.retProdId),pq=S.productos.find(x=>x.id===r.repProdId);const b=(x,c)=>r.lista==='min'?c/((x&&x.kgUn)||1):c;
   if(r.cant>0&&pr)await updateDoc(doc(fs,'productos/'+r.retProdId),{stock:increment(r2(b(pr,r.cant)))});if(r.repCant>0&&pq)await updateDoc(doc(fs,'productos/'+r.repProdId),{stock:increment(-r2(b(pq,r.repCant)))})}
  if(aj){const n=repNuevo(p,its);await updateDoc(doc(fs,'pedidos/'+id),{items:n.a,total:n.t,costo:n.a.reduce((s,i)=>s+i.cant*(i.costo||0),0),editado:ahora,historial:[...(p.historial||[]),{fecha:ahora,totalAnterior:p.total,totalNuevo:n.t,itemsAnteriores:p.items,por:nombreYo(),porId:S.u.uid,cambios:['Reposición: '+its.map(r=>r.cant+' '+r.retNombre+' → '+r.repCant+' '+r.repNombre).join(', ')],motivo:d.motivo,postEntrega:p.estado==='entregado',origen:'app vendedores'}].slice(-30)})}
  cerrar();msg('Reposición registrada'+(aj?' y pedido actualizado':''));ver(id)}catch(e){msg('No se pudo guardar: '+e.code,true)}};
// ---------- utilidades
function picker(inp,box,src,pick){const I=$(inp),B=$(box);if(!I)return;let list=[],act=0;
 const draw=()=>{B.innerHTML=list.map((x,k)=>`<div class="${k===act?'on':''}" data-k="${k}">${x.html}</div>`).join('');B.style.display=list.length?'block':'none'};
 I.oninput=()=>{const q=I.value.trim();list=q?src(q):[];act=0;draw()};I.onkeydown=e=>{if(e.key==='Enter'&&list[act]){e.preventDefault();pick(list[act].id)}else if(e.key==='ArrowDown'){act=Math.min(act+1,list.length-1);draw()}else if(e.key==='ArrowUp'){act=Math.max(act-1,0);draw()}};
 B.onmousedown=e=>{const d=e.target.closest('[data-k]');if(d){e.preventDefault();pick(list[+d.dataset.k].id)}}}
function dlg(h){$('#dlg').innerHTML=`<div class="dlg"><div class="card">${h}</div></div>`}window.cerrar=()=>$('#dlg').innerHTML='';
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
