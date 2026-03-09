import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── Storage ──────────────────────────────────────────────────────────────────
const SK = { inc:"samu3-incidents", cfg:"samu3-config", usr:"samu3-users" };
async function sg(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}}
async function ss(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

const DEF_CFG = {
  bases:["USB 01","USB 02","USA 01","USA 02"],
  viaturas:[{id:1,nome:"SAMU 191",base:"USA 01"},{id:2,nome:"SAMU 192",base:"USB 01"},{id:3,nome:"SAMU 193",base:"USB 02"},{id:4,nome:"SAMU 194",base:"USA 02"}],
  equipe:[
    {id:1,nome:"Dr. Ricardo",funcao:"Médico(a)"},{id:2,nome:"Dra. Patrícia",funcao:"Médico(a)"},
    {id:3,nome:"Ana Costa",funcao:"Enfermeiro(a)"},{id:4,nome:"Carla Santos",funcao:"Enfermeiro(a)"},
    {id:5,nome:"Lucas Mendes",funcao:"Socorrista"},
    {id:6,nome:"João Pedro",funcao:"Motorista"},{id:7,nome:"Pedro Lima",funcao:"Motorista"},{id:8,nome:"Marcos Silva",funcao:"Motorista"},
  ],
};
const DEF_USERS = [{email:"admin@samu.com",senha:"samu2024",nome:"Administrador"}];

const TIPOS=["Clínico","Trauma","Obstétrico","Psiquiátrico","Pediátrico","Cardíaco","AVC","Intoxicação","Outro"];
const DESFECHOS=["Transportado UPA","Transportado Hospital","Alta no Local","Recusa de Atendimento","Transferência Inter-hospitalar","Óbito no Local","Outro"];
const FUNCOES=["Médico(a)","Enfermeiro(a)","Socorrista","Motorista","TEM"];
const FCOLORS={"Médico(a)":"#06b6d4","Enfermeiro(a)":"#22c55e","Socorrista":"#f97316","Motorista":"#94a3b8","TEM":"#8b5cf6"};
const CC=["#1e3a5f","#f97316","#10b981","#3b82f6","#8b5cf6","#ef4444"];

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
function buildWA(f){
  return `🚑 *RELATÓRIO SAMU*\n━━━━━━━━━━━━━━━━━━━━\n📋 *Protocolo:* ${f.numero||"—"}\n📅 *Data:* ${f.data||"—"}\n⏰ *Chamado:* ${f.horaChamado||"—"}  *Chegada:* ${f.horaChegada||"—"}\n🏥 *Hospital:* ${f.horaHospital||"—"}  *Liberação:* ${f.horaLiberacao||"—"}\n🚑 *Viatura:* ${f.viatura||"—"}  🏠 *Base:* ${f.base||"—"}\n\n📍 *LOCAL*\n${[f.endereco,f.bairro].filter(Boolean).join(", ")||"Não informado"}\n\n👤 *PACIENTE*\nNome: ${f.pacienteNome||"Não identificado"}\nIdade: ${f.pacienteIdade||"—"} anos  Sexo: ${f.pacienteSexo||"—"}\n\n🏥 *OCORRÊNCIA*\nTipo: ${f.tipo||"—"}\nQueixa: ${f.queixa||"—"}\nDestino: ${f.destino||"—"}\n\n🩺 *CONDUTA*\n${f.conduta||"Não informada"}\n\n📌 *DESFECHO*\n${f.desfecho||"—"}\n\n👨‍⚕️ *EQUIPE*\nMédico(a): ${f.medico||"—"}\nEnfermeiro(a): ${f.enfermeiro||"—"}\nSocorrista: ${f.socorrista||"—"}\nMotorista: ${f.motorista||"—"}\n\n${f.obs?`📝 *OBS:* ${f.obs}\n`:""}━━━━━━━━━━━━━━━━━━━━\n_Sistema SAMU Gestão_ ✅`;
}

// ─── AI extract ───────────────────────────────────────────────────────────────
async function extractPhoto(b64,mime){
  const res=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
      messages:[{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:mime,data:b64}},
        {type:"text",text:`Analise esta imagem de relatório SAMU. Retorne SOMENTE JSON válido sem markdown:\n{"numero":"","data":"dd/mm/aaaa","horaChamado":"HH:MM","horaChegada":"HH:MM","horaHospital":"HH:MM","horaLiberacao":"HH:MM","base":"","viatura":"","endereco":"","bairro":"","tipo":"","pacienteNome":"","pacienteIdade":"","pacienteSexo":"M ou F","queixa":"","conduta":"","destino":"","desfecho":"","medico":"","enfermeiro":"","socorrista":"","motorista":"","status":"Finalizado","obs":""}`}
      ]}]
    })
  });
  const d=await res.json();
  const txt=d.content?.find(b=>b.type==="text")?.text||"{}";
  try{return JSON.parse(txt.replace(/```json|```/g,"").trim());}catch{return {};}
}

const todayStr=()=>new Date().toLocaleDateString("pt-BR");
const autoNum=(list)=>{const ns=list.map(i=>parseInt(i.numero)).filter(Boolean);return String(ns.length?Math.max(...ns)+1:191);};
const EMPTY={numero:"",data:todayStr(),horaChamado:"",horaChegada:"",horaHospital:"",horaLiberacao:"",base:"",viatura:"",endereco:"",bairro:"",tipo:"",pacienteNome:"",pacienteIdade:"",pacienteSexo:"",queixa:"",conduta:"",destino:"",desfecho:"",medico:"",enfermeiro:"",socorrista:"",motorista:"",status:"Em andamento",obs:""};

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG="#f0f2f5";
const WHITE="#ffffff";
const NAVY="#1e3a5f";
const ORANGE="#f97316";
const TEXT="#0f172a";
const MUTED="#64748b";
const BORDER="#e2e8f0";
const INPUT_BG="#f0f2f5";
const RADIUS=14;

// ─── Reusable components ──────────────────────────────────────────────────────
function Badge({s}){
  const m={
    "Finalizado":{bg:"#f0f2f5",color:TEXT,fw:700},
    "Em andamento":{bg:ORANGE,color:"#fff",fw:700},
  }[s]||{bg:"#f0f2f5",color:MUTED,fw:600};
  return <span style={{padding:"5px 12px",borderRadius:20,fontSize:13,fontWeight:m.fw,background:m.bg,color:m.color,whiteSpace:"nowrap"}}>{s}</span>;
}

// Mobile input
function MInput({label,name,val,onChange,placeholder,type,req}){
  return(
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:14,fontWeight:500,color:TEXT,marginBottom:6}}>{label}{req&&<span style={{color:"#ef4444"}}> *</span>}</label>
      <input name={name} value={val} onChange={onChange} placeholder={placeholder||""} type={type||"text"}
        style={{width:"100%",padding:"14px 16px",border:"none",borderRadius:RADIUS,fontSize:15,color:TEXT,background:INPUT_BG,boxSizing:"border-box",outline:"none",WebkitAppearance:"none"}}/>
    </div>
  );
}
function MSelect({label,name,val,onChange,options,req}){
  return(
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:14,fontWeight:500,color:TEXT,marginBottom:6}}>{label}{req&&<span style={{color:"#ef4444"}}> *</span>}</label>
      <select name={name} value={val} onChange={onChange}
        style={{width:"100%",padding:"14px 16px",border:"none",borderRadius:RADIUS,fontSize:15,color:val?TEXT:MUTED,background:INPUT_BG,boxSizing:"border-box",outline:"none",WebkitAppearance:"none",appearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 16px center"}}>
        <option value="">Selecione</option>
        {options.map(o=><option key={typeof o==="string"?o:o.id} value={typeof o==="string"?o:o.nome}>{typeof o==="string"?o:o.nome}</option>)}
      </select>
    </div>
  );
}
function MTextarea({label,name,val,onChange,placeholder,rows=4}){
  return(
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:14,fontWeight:500,color:TEXT,marginBottom:6}}>{label}</label>
      <textarea name={name} value={val} onChange={onChange} placeholder={placeholder||""} rows={rows}
        style={{width:"100%",padding:"14px 16px",border:"none",borderRadius:RADIUS,fontSize:15,color:TEXT,background:INPUT_BG,boxSizing:"border-box",outline:"none",resize:"vertical",WebkitAppearance:"none"}}/>
    </div>
  );
}
function FormSection({title,children}){
  return(
    <div style={{background:WHITE,borderRadius:RADIUS,padding:"20px 16px",marginBottom:12}}>
      <div style={{fontSize:17,fontWeight:700,color:TEXT,marginBottom:4,display:"flex",alignItems:"center",gap:8}}>{title}</div>
      <div style={{height:1,background:BORDER,marginBottom:16}}/>
      {children}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic={
  menu:<svg width="22"height="22"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><line x1="3"y1="6"x2="21"y2="6"/><line x1="3"y1="12"x2="21"y2="12"/><line x1="3"y1="18"x2="21"y2="18"/></svg>,
  x:<svg width="22"height="22"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><line x1="18"y1="6"x2="6"y2="18"/><line x1="6"y1="6"x2="18"y2="18"/></svg>,
  dash:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><rect x="3"y="3"width="7"height="7"rx="1.5"/><rect x="14"y="3"width="7"height="7"rx="1.5"/><rect x="3"y="14"width="7"height="7"rx="1.5"/><rect x="14"y="14"width="7"height="7"rx="1.5"/></svg>,
  plus:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2.5"viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  cam:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12"cy="13"r="4"/></svg>,
  list:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  cog:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><circle cx="12"cy="12"r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  out:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21"y1="12"x2="9"y2="12"/></svg>,
  back:<svg width="22"height="22"fill="none"stroke="currentColor"strokeWidth="2.5"viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>,
  eye:<svg width="18"height="18"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12"cy="12"r="3"/></svg>,
  wa:<svg width="18"height="18"fill="currentColor"viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  trash:<svg width="18"height="18"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
  search:<svg width="18"height="18"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><circle cx="11"cy="11"r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  save:<svg width="18"height="18"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  arr:<svg width="16"height="16"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  act:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  clk:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><circle cx="12"cy="12"r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  chk:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  warn:<svg width="20"height="20"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><circle cx="12"cy="12"r="10"/><line x1="12"y1="8"x2="12"y2="12"/><line x1="12"y1="16"x2="12.01"y2="16"/></svg>,
  loc:<svg width="16"height="16"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12"cy="10"r="3"/></svg>,
  amb:<svg width="16"height="16"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><rect x="1"y="10"width="22"height="10"rx="2"/><path d="M5 10V6a1 1 0 011-1h4l2-3h4l2 3h1a1 1 0 011 1v4"/><circle cx="7"cy="20"r="2"/><circle cx="17"cy="20"r="2"/></svg>,
  ppl:<svg width="16"height="16"fill="none"stroke="currentColor"strokeWidth="2"viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9"cy="7"r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
};

const TT={contentStyle:{background:NAVY,border:"none",borderRadius:10,color:"#fff",fontSize:12},cursor:{fill:"#f8fafc"}};

// ─── Logo ─────────────────────────────────────────────────────────────────────
function LogoIcon({size=36}){
  return(
    <div style={{width:size,height:size,background:ORANGE,borderRadius:size*0.24,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <svg width={size*0.55} height={size*0.55} fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    </div>
  );
}

// ─── Top Header ──────────────────────────────────────────────────────────────
function TopBar({onMenu,title}){
  return(
    <div style={{background:WHITE,borderBottom:`1px solid ${BORDER}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:50}}>
      <button onClick={onMenu} style={{background:"none",border:"none",cursor:"pointer",color:TEXT,padding:4,display:"flex"}}>{Ic.menu}</button>
      <LogoIcon size={34}/>
      <span style={{fontWeight:700,fontSize:17,color:TEXT}}>SAMU</span>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function Drawer({open,onClose,page,onNav,user,onLogout}){
  const items=[
    {id:"dashboard",label:"Dashboard",icon:Ic.dash},
    {id:"novo",label:"Novo Atendimento",icon:Ic.plus},
    {id:"captura",label:"Captura por Foto",icon:Ic.cam},
    {id:"atendimentos",label:"Atendimentos",icon:Ic.list},
    {id:"config",label:"Configurações",icon:Ic.cog},
  ];
  return(
    <>
      {open&&<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:100}}/>}
      <div style={{position:"fixed",top:0,left:open?0:-280,width:270,height:"100%",background:NAVY,zIndex:101,transition:"left 0.25s ease",display:"flex",flexDirection:"column",boxShadow:"4px 0 24px rgba(0,0,0,.2)"}}>
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid rgba(255,255,255,.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><LogoIcon size={36}/><div><div style={{color:"#fff",fontWeight:700,fontSize:16}}>SAMU</div><div style={{color:"#94a3b8",fontSize:11}}>Gestão de Atendimentos</div></div></div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",padding:4,display:"flex"}}>{Ic.x}</button>
        </div>
        {user&&<div style={{padding:"12px 20px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{color:"#94a3b8",fontSize:11,marginBottom:2}}>Logado como</div>
          <div style={{color:"#e2e8f0",fontSize:14,fontWeight:600}}>{user.nome}</div>
        </div>}
        <nav style={{flex:1,padding:"8px 8px",overflowY:"auto"}}>
          {items.map(it=>(
            <button key={it.id} onClick={()=>{onNav(it.id);onClose();}}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,cursor:"pointer",marginBottom:2,
                color:page===it.id?"#fff":  "#94a3b8",background:page===it.id?"rgba(249,115,22,.2)":"transparent",
                fontWeight:page===it.id?700:400,fontSize:15,border:"none",width:"100%",textAlign:"left",transition:"all .15s"}}>
              <span style={{color:page===it.id?ORANGE:"#94a3b8"}}>{it.icon}</span>{it.label}
            </button>
          ))}
        </nav>
        <div style={{padding:"12px 8px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
          <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,cursor:"pointer",color:"#f87171",background:"transparent",fontWeight:600,fontSize:15,border:"none",width:"100%",textAlign:"left"}}>
            {Ic.out} Sair
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage({users,onLogin}){
  const [email,setEmail]=useState("");
  const [senha,setSenha]=useState("");
  const [err,setErr]=useState("");
  const submit=()=>{
    const u=users.find(u=>u.email===email&&u.senha===senha);
    if(u)onLogin(u);
    else setErr("E-mail ou senha incorretos.");
  };
  return(
    <div style={{minHeight:"100vh",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <LogoIcon size={72}/>
        <div style={{marginTop:12,fontSize:26,fontWeight:800,color:TEXT}}>SAMU</div>
        <div style={{color:MUTED,fontSize:15,marginTop:2}}>Gestão de Atendimentos</div>
      </div>
      <div style={{background:WHITE,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:420,boxShadow:"0 4px 24px rgba(0,0,0,.06)"}}>
        <div style={{fontSize:22,fontWeight:800,color:TEXT,marginBottom:4}}>Entrar</div>
        <div style={{color:MUTED,fontSize:14,marginBottom:24}}>Faça login para acessar o sistema</div>
        {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",color:"#dc2626",fontSize:13,marginBottom:16}}>{err}</div>}
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:14,fontWeight:500,color:TEXT,marginBottom:6}}>E-mail</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" type="email"
            style={{width:"100%",padding:"14px 16px",border:"none",borderRadius:RADIUS,fontSize:15,color:TEXT,background:INPUT_BG,boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{marginBottom:24}}>
          <label style={{display:"block",fontSize:14,fontWeight:500,color:TEXT,marginBottom:6}}>Senha</label>
          <input value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" type="password"
            style={{width:"100%",padding:"14px 16px",border:"none",borderRadius:RADIUS,fontSize:15,color:TEXT,background:INPUT_BG,boxSizing:"border-box",outline:"none"}}/>
        </div>
        <button onClick={submit} style={{width:"100%",padding:"15px",background:NAVY,color:"#fff",border:"none",borderRadius:RADIUS,fontWeight:700,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          → Entrar
        </button>
        <div style={{textAlign:"center",marginTop:16,color:MUTED,fontSize:14}}>
          Não tem conta? <span style={{color:ORANGE,fontWeight:600}}>Cadastre-se</span>
        </div>
        <div style={{marginTop:20,background:INPUT_BG,borderRadius:10,padding:"10px 14px",fontSize:12,color:MUTED,textAlign:"center"}}>
          Demo: <strong>admin@samu.com</strong> / <strong>samu2024</strong>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({incidents,onNav}){
  const t=todayStr();
  const todayCnt=incidents.filter(i=>i.data===t).length;
  const ongoing=incidents.filter(i=>i.status==="Em andamento").length;
  const done=incidents.filter(i=>i.status==="Finalizado").length;

  const baseMap={};incidents.forEach(i=>{if(i.base)baseMap[i.base]=(baseMap[i.base]||0)+1;});
  const baseData=Object.entries(baseMap).map(([name,value])=>({name,value}));

  const profMap={};
  incidents.forEach(i=>{[i.medico,i.enfermeiro,i.socorrista,i.motorista].filter(Boolean).forEach(p=>{profMap[p]=(profMap[p]||0)+1;});});
  const profData=Object.entries(profMap).map(([n,v])=>({n,v})).sort((a,b)=>b.v-a.v);

  const recent=[...incidents].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  const vn=s=>s?.match(/\d+/)?.[0]||"—";
  const bs=s=>s?.split(" ").pop()||"";

  const StatCard=({label,val,color,icon})=>(
    <div style={{background:WHITE,borderRadius:16,padding:"16px",flex:1,minWidth:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <span style={{fontSize:13,color:MUTED,lineHeight:1.3}}>{label}</span>
        <span style={{color}}>{icon}</span>
      </div>
      <div style={{fontSize:34,fontWeight:800,color:TEXT,lineHeight:1}}>{val}</div>
    </div>
  );

  return(
    <div style={{padding:"20px 16px",background:BG,minHeight:"100%"}}>
      <div style={{fontSize:28,fontWeight:800,color:TEXT,marginBottom:2}}>Dashboard</div>
      <div style={{color:MUTED,fontSize:14,marginBottom:20}}>Visão geral dos atendimentos SAMU</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <StatCard label="Total de Atendimentos" val={incidents.length} color={ORANGE} icon={Ic.act}/>
        <StatCard label="Hoje" val={todayCnt} color="#3b82f6" icon={Ic.clk}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <StatCard label="Em Andamento" val={ongoing} color="#f59e0b" icon={Ic.warn}/>
        <StatCard label="Finalizados" val={done} color="#10b981" icon={Ic.chk}/>
      </div>

      {baseData.length>0&&<>
        <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:700,fontSize:16,color:TEXT,marginBottom:14}}>
            <span style={{color:ORANGE}}>{Ic.amb}</span> Atendimentos por Base
          </div>
          <ResponsiveContainer width="100%"height={170}>
            <BarChart data={baseData} barSize={36}>
              <XAxis dataKey="name" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} width={20}/>
              <Tooltip {...TT}/>
              <Bar dataKey="value" name="Atendimentos" fill={NAVY} radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:700,fontSize:16,color:TEXT,marginBottom:14}}>
            <span style={{color:ORANGE}}>📈</span> Distribuição por Base
          </div>
          <ResponsiveContainer width="100%"height={200}>
            <PieChart>
              <Pie data={baseData} dataKey="value" nameKey="name" cx="50%"cy="50%"innerRadius={50}outerRadius={82}paddingAngle={3}
                label={({name,value})=>`${name}: ${value}`} labelLine={true}>
                {baseData.map((_,i)=><Cell key={i} fill={CC[i%CC.length]}/>)}
              </Pie>
              <Tooltip {...TT}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </>}

      {profData.length>0&&(
        <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:700,fontSize:16,color:TEXT,marginBottom:14}}>
            <span style={{color:ORANGE}}>{Ic.ppl}</span> Atendimentos por Profissional
          </div>
          {profData.map(p=>(
            <div key={p.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:INPUT_BG,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              <div>
                <div style={{fontWeight:600,fontSize:15,color:TEXT}}>{p.n}</div>
                <div style={{color:MUTED,fontSize:12,marginTop:1}}>Profissional</div>
              </div>
              <div style={{width:32,height:32,borderRadius:16,background:BORDER,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15,color:TEXT}}>{p.v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:16,color:TEXT}}>Últimos Atendimentos</div>
          <button onClick={()=>onNav("atendimentos")} style={{background:"none",border:"none",color:ORANGE,fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            Ver todos {Ic.arr}
          </button>
        </div>
        {recent.length===0
          ?<div style={{textAlign:"center",color:MUTED,padding:"20px 0",fontSize:14}}>Nenhum atendimento ainda</div>
          :recent.map(inc=>(
            <div key={inc.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:44,height:44,borderRadius:12,background:NAVY,color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,lineHeight:1.2,flexShrink:0}}>
                  <span>{vn(inc.viatura)}</span>
                  <span style={{fontSize:9,color:"#93c5fd",fontWeight:500}}>{bs(inc.base)}</span>
                </div>
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:TEXT}}>{inc.pacienteNome||"Não identificado"}</div>
                  <div style={{color:MUTED,fontSize:12,marginTop:1}}>{inc.queixa||inc.tipo||"—"}</div>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                <Badge s={inc.status}/>
                <div style={{color:MUTED,fontSize:12,marginTop:4}}>{inc.horaChamado||""}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Capture ──────────────────────────────────────────────────────────────────
function CapturePage({onManual}){
  const [loading,setLoading]=useState(false);
  const [preview,setPreview]=useState(null);
  const [err,setErr]=useState("");
  const ref=useRef();

  const processFile=async(file)=>{
    if(!file||!file.type.startsWith("image/"))return;
    setErr("");setLoading(true);
    const reader=new FileReader();
    reader.onload=async(e)=>{
      setPreview(e.target.result);
      try{const b64=e.target.result.split(",")[1];const data=await extractPhoto(b64,file.type||"image/jpeg");onManual(data);}
      catch{setErr("Não foi possível extrair os dados. Verifique se a foto está nítida.");setLoading(false);}
    };
    reader.readAsDataURL(file);
  };

  return(
    <div style={{padding:"20px 16px",background:BG,minHeight:"100%"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{fontSize:28,fontWeight:800,color:TEXT,marginBottom:2}}>Captura por Foto</div>
      <div style={{color:MUTED,fontSize:14,marginBottom:20}}>Tire uma foto do resumo do app da regulação para pré-preencher o atendimento</div>
      <input ref={ref} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>processFile(e.target.files[0])}/>

      <div style={{background:WHITE,borderRadius:20,padding:"28px 20px",textAlign:"center",marginBottom:12}}>
        {loading?(
          <>
            {preview&&<img src={preview} alt="" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:14,marginBottom:16,opacity:.7}}/>}
            <div style={{width:56,height:56,border:`4px solid ${BORDER}`,borderTop:`4px solid ${ORANGE}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
            <div style={{fontWeight:700,fontSize:18,color:TEXT,marginBottom:4}}>IA analisando...</div>
            <div style={{color:MUTED,fontSize:14,animation:"pulse 1.5s ease-in-out infinite"}}>Extraindo dados do relatório</div>
          </>
        ):(
          <>
            <div style={{width:88,height:88,background:ORANGE,borderRadius:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,margin:"0 auto 20px"}}>📷</div>
            <div style={{fontWeight:700,fontSize:20,color:TEXT,marginBottom:4}}>Captura por Foto com IA</div>
            <div style={{color:MUTED,fontSize:14,lineHeight:1.6,marginBottom:20}}>
              Tire uma foto ou faça upload da tela de resumo do app da regulação. A IA extrai automaticamente os dados e pré-preenche o formulário.
            </div>
            {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"12px 14px",color:"#dc2626",fontSize:13,marginBottom:16,textAlign:"left"}}>{err}</div>}
            <div style={{background:INPUT_BG,borderRadius:14,padding:"16px",textAlign:"left",marginBottom:24}}>
              <div style={{fontWeight:600,fontSize:14,color:TEXT,marginBottom:10}}>Como funciona:</div>
              {[["📱","Tire foto ou faça upload do resumo da regulação"],["🤖","IA extrai os dados automaticamente"],["📋","Formulário pré-preenchido para revisão"],["✏️","Complete com informações adicionais"],["📲","Salve e envie pelo WhatsApp"]].map(([em,txt])=>(
                <div key={txt} style={{display:"flex",gap:10,marginBottom:7,fontSize:13,color:MUTED}}><span>{em}</span><span>{txt}</span></div>
              ))}
            </div>
            <button onClick={()=>ref.current.click()} style={{width:"100%",padding:"15px",background:ORANGE,color:"#fff",border:"none",borderRadius:RADIUS,fontWeight:700,fontSize:16,cursor:"pointer",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              📷 Fotografar Relatório
            </button>
            <button onClick={()=>ref.current.click()} style={{width:"100%",padding:"15px",background:INPUT_BG,color:TEXT,border:"none",borderRadius:RADIUS,fontWeight:600,fontSize:15,cursor:"pointer",marginBottom:10}}>
              ⬆️ Upload de Foto
            </button>
            <button onClick={()=>onManual({})} style={{width:"100%",padding:"15px",background:WHITE,color:TEXT,border:`1px solid ${BORDER}`,borderRadius:RADIUS,fontWeight:600,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              Preencher Manualmente {Ic.arr}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────
function FormPage({initial,incidents,cfg,onSave,onCancel}){
  const [form,setForm]=useState({...EMPTY,numero:autoNum(incidents),...initial});
  const [saved,setSaved]=useState(false);
  const [waMsg,setWaMsg]=useState("");
  const [copied,setCopied]=useState(false);
  const ch=e=>{const{name,value}=e.target;setForm(p=>({...p,[name]:value}));};
  const handleSave=()=>{
    const inc={...form,id:initial.id||Date.now(),createdAt:initial.createdAt||Date.now()};
    onSave(inc);setWaMsg(buildWA(inc));setSaved(true);
  };
  const copy=()=>{navigator.clipboard.writeText(waMsg).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});};

  const medicos=cfg.equipe.filter(e=>e.funcao==="Médico(a)");
  const enfermeiros=cfg.equipe.filter(e=>e.funcao==="Enfermeiro(a)");
  const socorristas=cfg.equipe.filter(e=>["Socorrista","TEM"].includes(e.funcao));
  const motoristas=cfg.equipe.filter(e=>e.funcao==="Motorista");

  if(saved){
    return(
      <div style={{padding:"20px 16px",background:BG,minHeight:"100%"}}>
        <div style={{background:WHITE,borderRadius:20,padding:"32px 20px",textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:56,marginBottom:12}}>✅</div>
          <div style={{fontWeight:800,fontSize:22,color:TEXT,marginBottom:6}}>Atendimento Salvo!</div>
          <div style={{color:MUTED,marginBottom:20}}>Mensagem pronta para o WhatsApp</div>
          <div style={{background:INPUT_BG,borderRadius:14,padding:14,fontFamily:"monospace",fontSize:12,color:"#166534",whiteSpace:"pre-wrap",lineHeight:1.6,maxHeight:280,overflowY:"auto",textAlign:"left",marginBottom:20}}>{waMsg}</div>
          <button onClick={copy} style={{width:"100%",padding:"15px",background:ORANGE,color:"#fff",border:"none",borderRadius:RADIUS,fontWeight:700,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:10}}>
            {Ic.wa} {copied?"Copiado!":"Copiar para WhatsApp"}
          </button>
          <button onClick={onCancel} style={{width:"100%",padding:"15px",background:INPUT_BG,color:TEXT,border:"none",borderRadius:RADIUS,fontWeight:600,fontSize:15,cursor:"pointer"}}>
            Ver Atendimentos
          </button>
        </div>
      </div>
    );
  }

  return(
    <div style={{background:BG,minHeight:"100%"}}>
      {/* Sub header */}
      <div style={{background:WHITE,borderBottom:`1px solid ${BORDER}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",color:TEXT,padding:4,display:"flex"}}>{Ic.back}</button>
        <div>
          <div style={{fontWeight:700,fontSize:17,color:TEXT}}>{initial.id?"Editar Atendimento":"Novo Atendimento"}</div>
          <div style={{color:MUTED,fontSize:12}}>Preencha os dados do atendimento</div>
        </div>
      </div>

      <div style={{padding:"12px 16px 120px"}}>
        <FormSection title="📋 Dados Gerais">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <MInput label="Nº Atendimento" name="numero" val={form.numero} onChange={ch} placeholder="Auto"/>
            <MInput label="Data" name="data" val={form.data} onChange={ch} type="date" req/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <MSelect label="Base *" name="base" val={form.base} onChange={ch} options={cfg.bases}/>
            <MSelect label="Viatura" name="viatura" val={form.viatura} onChange={ch} options={cfg.viaturas}/>
          </div>
        </FormSection>

        <FormSection title="🕐 Horários">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <MInput label="Chamado" name="horaChamado" val={form.horaChamado} onChange={ch} type="time"/>
            <MInput label="Chegada" name="horaChegada" val={form.horaChegada} onChange={ch} type="time"/>
            <MInput label="Hospital" name="horaHospital" val={form.horaHospital} onChange={ch} type="time"/>
            <MInput label="Liberação" name="horaLiberacao" val={form.horaLiberacao} onChange={ch} type="time"/>
          </div>
        </FormSection>

        <FormSection title="👤 Paciente">
          <MInput label="Nome *" name="pacienteNome" val={form.pacienteNome} onChange={ch} placeholder="Nome do paciente" req/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <MInput label="Idade" name="pacienteIdade" val={form.pacienteIdade} onChange={ch} placeholder="Anos"/>
            <MSelect label="Sexo" name="pacienteSexo" val={form.pacienteSexo} onChange={ch} options={["M","F","Outro"]}/>
          </div>
          <MInput label="Endereço" name="endereco" val={form.endereco} onChange={ch} placeholder="Rua, número"/>
          <MInput label="Bairro" name="bairro" val={form.bairro} onChange={ch} placeholder="Bairro"/>
        </FormSection>

        <FormSection title="🔍 Atendimento">
          <MTextarea label="Queixa Principal *" name="queixa" val={form.queixa} onChange={ch} placeholder="Descreva a queixa" rows={3}/>
          <MTextarea label="Conduta" name="conduta" val={form.conduta} onChange={ch} placeholder="Procedimentos realizados" rows={3}/>
          <MInput label="Destino" name="destino" val={form.destino} onChange={ch} placeholder="Hospital / UPA destino"/>
          <MSelect label="Tipo de Ocorrência" name="tipo" val={form.tipo} onChange={ch} options={TIPOS}/>
          <MSelect label="Desfecho" name="desfecho" val={form.desfecho} onChange={ch} options={DESFECHOS}/>
          <MSelect label="Status" name="status" val={form.status} onChange={ch} options={["Em andamento","Finalizado"]}/>
        </FormSection>

        <FormSection title="👥 Equipe">
          <MSelect label="Médico(a)" name="medico" val={form.medico} onChange={ch} options={medicos}/>
          <MSelect label="Enfermeiro(a)" name="enfermeiro" val={form.enfermeiro} onChange={ch} options={enfermeiros}/>
          <MSelect label="Socorrista" name="socorrista" val={form.socorrista} onChange={ch} options={socorristas}/>
          <MSelect label="Motorista" name="motorista" val={form.motorista} onChange={ch} options={motoristas}/>
        </FormSection>

        <FormSection title="📝 Observações">
          <MTextarea label="" name="obs" val={form.obs} onChange={ch} placeholder="Informações adicionais..." rows={4}/>
        </FormSection>
      </div>

      {/* Sticky bottom button */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:WHITE,borderTop:`1px solid ${BORDER}`,padding:"12px 16px",zIndex:40}}>
        <button onClick={handleSave} style={{width:"100%",padding:"16px",background:ORANGE,color:"#fff",border:"none",borderRadius:RADIUS,fontWeight:700,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {Ic.save} Salvar e Gerar WhatsApp
        </button>
      </div>
    </div>
  );
}

// ─── Atendimentos ─────────────────────────────────────────────────────────────
function AtendimentosPage({incidents,onDelete,onEdit,onNew}){
  const [q,setQ]=useState("");
  const [detail,setDetail]=useState(null);
  const [copied,setCopied]=useState(null);
  const vn=s=>s?.match(/\d+/)?.[0]||"—";
  const bs=s=>s?.split(" ").pop()||"";
  const copyWA=inc=>{navigator.clipboard.writeText(buildWA(inc)).then(()=>{setCopied(inc.id);setTimeout(()=>setCopied(null),2000);});};

  const filtered=incidents
    .filter(i=>!q||[i.pacienteNome,i.numero,i.queixa,i.base,i.viatura,i.medico,i.socorrista].some(f=>f?.toLowerCase().includes(q.toLowerCase())))
    .sort((a,b)=>b.createdAt-a.createdAt);

  if(detail){
    const inc=detail;
    return(
      <div style={{background:BG,minHeight:"100%"}}>
        <div style={{background:WHITE,borderBottom:`1px solid ${BORDER}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setDetail(null)} style={{background:"none",border:"none",cursor:"pointer",color:TEXT,padding:4,display:"flex"}}>{Ic.back}</button>
          <div style={{flex:1,fontWeight:700,fontSize:17,color:TEXT}}>Detalhes</div>
          <button onClick={()=>{setDetail(null);onEdit(inc);}} style={{background:INPUT_BG,border:"none",color:TEXT,borderRadius:8,padding:"6px 12px",fontWeight:600,fontSize:13,cursor:"pointer"}}>✏️ Editar</button>
        </div>
        <div style={{padding:"12px 16px 32px"}}>
          <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <div style={{width:52,height:52,borderRadius:14,background:NAVY,color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,lineHeight:1.2,flexShrink:0}}>
                <span>{vn(inc.viatura)}</span><span style={{fontSize:10,color:"#93c5fd"}}>{bs(inc.base)}</span>
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:18,color:TEXT}}>{inc.pacienteNome||"Não identificado"}</div>
                <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                  {inc.numero&&<span style={{background:"#f0f9ff",color:"#0369a1",padding:"3px 9px",borderRadius:8,fontSize:12,fontWeight:600}}>#{inc.numero}</span>}
                  <Badge s={inc.status}/>
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
              {[["Data",inc.data],["Chamado",inc.horaChamado],["Chegada",inc.horaChegada],["Liberação",inc.horaLiberacao],["Base",inc.base],["Viatura",inc.viatura],["Médico",inc.medico],["Enfermeiro",inc.enfermeiro],["Socorrista",inc.socorrista],["Motorista",inc.motorista]].filter(([,v])=>v).map(([l,v])=>(
                <div key={l}><div style={{fontSize:11,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>{l}</div><div style={{fontSize:14,color:TEXT,fontWeight:500}}>{v}</div></div>
              ))}
            </div>
            {inc.endereco&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>Endereço</div><div style={{fontSize:14,color:TEXT}}>{[inc.endereco,inc.bairro].filter(Boolean).join(", ")}</div></div>}
            {inc.queixa&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>Queixa</div><div style={{fontSize:14,color:TEXT}}>{inc.queixa}</div></div>}
            {inc.conduta&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>Conduta</div><div style={{fontSize:14,color:TEXT}}>{inc.conduta}</div></div>}
          </div>
          <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:15,color:TEXT,marginBottom:12}}>💬 Mensagem WhatsApp</div>
            <div style={{background:INPUT_BG,borderRadius:12,padding:12,fontFamily:"monospace",fontSize:11.5,color:"#166534",whiteSpace:"pre-wrap",lineHeight:1.6,maxHeight:220,overflowY:"auto",marginBottom:12}}>{buildWA(inc)}</div>
            <button onClick={()=>copyWA(inc)} style={{width:"100%",padding:"14px",background:ORANGE,color:"#fff",border:"none",borderRadius:RADIUS,fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {Ic.wa} {copied===inc.id?"Copiado!":"Copiar Mensagem"}
            </button>
          </div>
          <button onClick={()=>{onDelete(inc.id);setDetail(null);}} style={{width:"100%",padding:"14px",background:"#fef2f2",color:"#dc2626",border:"none",borderRadius:RADIUS,fontWeight:600,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {Ic.trash} Excluir Atendimento
          </button>
        </div>
      </div>
    );
  }

  return(
    <div style={{padding:"20px 16px",background:BG,minHeight:"100%"}}>
      <div style={{fontSize:28,fontWeight:800,color:TEXT,marginBottom:2}}>Atendimentos</div>
      <div style={{color:MUTED,fontSize:14,marginBottom:16}}>{incidents.length} registros</div>

      <div style={{position:"relative",marginBottom:16}}>
        <div style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:MUTED,pointerEvents:"none"}}>{Ic.search}</div>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar paciente, nº, queixa..."
          style={{width:"100%",padding:"14px 14px 14px 42px",border:"none",borderRadius:RADIUS,fontSize:15,color:TEXT,background:WHITE,boxSizing:"border-box",outline:"none"}}/>
      </div>

      {filtered.length===0
        ?<div style={{background:WHITE,borderRadius:16,padding:"40px 20px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:8}}>🔍</div>
          <div style={{color:MUTED,fontSize:14}}>{q?"Nenhum resultado":"Nenhum atendimento registrado"}</div>
          {!q&&<button onClick={onNew} style={{background:ORANGE,color:"#fff",border:"none",borderRadius:RADIUS,padding:"12px 24px",fontWeight:700,fontSize:15,cursor:"pointer",marginTop:16}}>+ Novo Atendimento</button>}
        </div>
        :filtered.map(inc=>(
          <div key={inc.id} style={{background:WHITE,borderRadius:16,padding:"16px",marginBottom:10,cursor:"pointer"}} onClick={()=>setDetail(inc)}>
            <div style={{display:"flex",gap:12,marginBottom:10}}>
              <div style={{width:46,height:46,borderRadius:12,background:NAVY,color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,lineHeight:1.2,flexShrink:0}}>
                <span>{vn(inc.viatura)}</span>
                <span style={{fontSize:9,color:"#93c5fd",fontWeight:500}}>{bs(inc.base)}</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                  <span style={{fontWeight:700,fontSize:15,color:TEXT}}>{inc.pacienteNome||"Não identificado"} {inc.numero&&<span style={{color:MUTED,fontWeight:400,fontSize:13}}>#{inc.numero}</span>}</span>
                  <Badge s={inc.status}/>
                </div>
                <div style={{color:MUTED,fontSize:13,marginTop:3}}>{inc.queixa||inc.tipo||"—"}</div>
                <div style={{color:"#94a3b8",fontSize:12,marginTop:2}}>
                  {[inc.data,inc.horaChamado&&`${inc.horaChamado}${inc.horaChegada?` → ${inc.horaChegada}`:""}`].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,paddingTop:10,borderTop:`1px solid ${BORDER}`}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setDetail(inc)} style={{flex:1,padding:"8px",background:INPUT_BG,border:"none",borderRadius:8,cursor:"pointer",color:MUTED,display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontSize:13,fontWeight:500}}>
                {Ic.eye} Ver
              </button>
              <button onClick={()=>copyWA(inc)} style={{flex:1,padding:"8px",background:INPUT_BG,border:"none",borderRadius:8,cursor:"pointer",color:copied===inc.id?"#16a34a":MUTED,display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontSize:13,fontWeight:500}}>
                {Ic.wa} WhatsApp
              </button>
              <button onClick={()=>onDelete(inc.id)} style={{width:40,height:36,background:"#fef2f2",border:"none",borderRadius:8,cursor:"pointer",color:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {Ic.trash}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────
function ConfigPage({cfg,setCfg}){
  const [tab,setTab]=useState("bases");
  const [nb,setNb]=useState("");
  const [nv,setNv]=useState({nome:"",base:""});
  const [np,setNp]=useState({nome:"",funcao:""});

  const addBase=()=>{if(!nb.trim())return;setCfg({...cfg,bases:[...cfg.bases,nb.trim()]});setNb("");};
  const delBase=b=>setCfg({...cfg,bases:cfg.bases.filter(x=>x!==b)});
  const addViat=()=>{if(!nv.nome.trim())return;setCfg({...cfg,viaturas:[...cfg.viaturas,{id:Date.now(),...nv}]});setNv({nome:"",base:""});};
  const delViat=id=>setCfg({...cfg,viaturas:cfg.viaturas.filter(v=>v.id!==id)});
  const addProf=()=>{if(!np.nome.trim()||!np.funcao)return;setCfg({...cfg,equipe:[...cfg.equipe,{id:Date.now(),...np}]});setNp({nome:"",funcao:""});};
  const delProf=id=>setCfg({...cfg,equipe:cfg.equipe.filter(p=>p.id!==id)});
  const grouped=FUNCOES.reduce((acc,f)=>{acc[f]=cfg.equipe.filter(p=>p.funcao===f);return acc;},{});

  const inpS={width:"100%",padding:"13px 14px",border:"none",borderRadius:RADIUS,fontSize:15,color:TEXT,background:INPUT_BG,boxSizing:"border-box",outline:"none"};
  const selS={...inpS,appearance:"none",WebkitAppearance:"none"};
  const addBtn={background:ORANGE,color:"#fff",border:"none",borderRadius:12,width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,cursor:"pointer",flexShrink:0};
  const delBtnS={background:"transparent",border:"none",cursor:"pointer",color:"#ef4444",padding:8,display:"flex",borderRadius:8};

  return(
    <div style={{padding:"20px 16px",background:BG,minHeight:"100%"}}>
      <div style={{fontSize:28,fontWeight:800,color:TEXT,marginBottom:2}}>Configurações</div>
      <div style={{color:MUTED,fontSize:14,marginBottom:20}}>Cadastre bases, viaturas e equipe</div>

      {/* Tabs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,background:INPUT_BG,borderRadius:14,padding:4,marginBottom:16}}>
        {[["bases","📍 Bases"],["viaturas","🚑 Viaturas"],["equipe","👥 Equipe"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 4px",border:"none",cursor:"pointer",borderRadius:10,fontWeight:600,fontSize:13,transition:"all .15s",background:tab===id?WHITE:"transparent",color:tab===id?TEXT:MUTED,boxShadow:tab===id?"0 1px 3px rgba(0,0,0,.1)":"none"}}>{label}</button>
        ))}
      </div>

      {tab==="bases"&&(
        <>
          <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:15,color:TEXT,marginBottom:14}}>Adicionar Base</div>
            <div style={{display:"flex",gap:10}}>
              <input value={nb} onChange={e=>setNb(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addBase()} placeholder="Ex: USB 03" style={{...inpS,flex:1}}/>
              <button onClick={addBase} style={addBtn}>+</button>
            </div>
          </div>
          <div style={{background:WHITE,borderRadius:16,padding:"18px 16px"}}>
            <div style={{fontWeight:700,fontSize:15,color:TEXT,marginBottom:14}}>Bases Cadastradas ({cfg.bases.length})</div>
            {cfg.bases.map(b=>(
              <div key={b} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:INPUT_BG,borderRadius:12,padding:"13px 14px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10,fontSize:15,color:TEXT,fontWeight:500}}><span style={{color:ORANGE}}>{Ic.loc}</span>{b}</div>
                <button style={delBtnS} onClick={()=>delBase(b)}>{Ic.trash}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab==="viaturas"&&(
        <>
          <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:15,color:TEXT,marginBottom:14}}>Adicionar Viatura</div>
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <input value={nv.nome} onChange={e=>setNv(p=>({...p,nome:e.target.value}))} placeholder="Ex: SAMU 195" style={{...inpS,flex:1}}/>
              <button onClick={addViat} style={addBtn}>+</button>
            </div>
            <select value={nv.base} onChange={e=>setNv(p=>({...p,base:e.target.value}))} style={selS}>
              <option value="">Selecionar Base</option>
              {cfg.bases.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{background:WHITE,borderRadius:16,padding:"18px 16px"}}>
            <div style={{fontWeight:700,fontSize:15,color:TEXT,marginBottom:14}}>Viaturas Cadastradas ({cfg.viaturas.length})</div>
            {cfg.viaturas.map(v=>(
              <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:INPUT_BG,borderRadius:12,padding:"13px 14px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{color:ORANGE}}>{Ic.amb}</span>
                  <span style={{fontSize:15,color:TEXT,fontWeight:500}}>{v.nome}</span>
                  <span style={{background:NAVY,color:"#93c5fd",padding:"2px 8px",borderRadius:8,fontSize:11,fontWeight:700}}>{v.base}</span>
                </div>
                <button style={delBtnS} onClick={()=>delViat(v.id)}>{Ic.trash}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab==="equipe"&&(
        <>
          <div style={{background:WHITE,borderRadius:16,padding:"18px 16px",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:15,color:TEXT,marginBottom:14}}>Adicionar Profissional</div>
            <input value={np.nome} onChange={e=>setNp(p=>({...p,nome:e.target.value}))} placeholder="Nome completo" style={{...inpS,marginBottom:10}}/>
            <div style={{display:"flex",gap:10}}>
              <select value={np.funcao} onChange={e=>setNp(p=>({...p,funcao:e.target.value}))} style={{...selS,flex:1}}>
                <option value="">Função</option>
                {FUNCOES.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
              <button onClick={addProf} style={addBtn}>+</button>
            </div>
          </div>
          <div style={{background:WHITE,borderRadius:16,padding:"18px 16px"}}>
            <div style={{fontWeight:700,fontSize:15,color:TEXT,marginBottom:14}}>Equipe ({cfg.equipe.length})</div>
            {FUNCOES.map(f=>grouped[f]?.length>0&&(
              <div key={f}>
                <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,margin:"12px 0 8px"}}>{f}s ({grouped[f].length})</div>
                {grouped[f].map(p=>(
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:INPUT_BG,borderRadius:12,padding:"13px 14px",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{background:`${FCOLORS[p.funcao]}22`,color:FCOLORS[p.funcao],padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:700}}>{p.funcao}</span>
                      <span style={{fontSize:15,color:TEXT,fontWeight:500}}>{p.nome}</span>
                    </div>
                    <button style={delBtnS} onClick={()=>delProf(p.id)}>{Ic.trash}</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [page,setPage]=useState("dashboard");
  const [incidents,setIncidents]=useState([]);
  const [cfg,setCfgState]=useState(DEF_CFG);
  const [users,setUsers]=useState(DEF_USERS);
  const [user,setUser]=useState(null);
  const [editingInc,setEditingInc]=useState(null);
  const [prefilled,setPrefilled]=useState(null);
  const [drawerOpen,setDrawerOpen]=useState(false);

  useEffect(()=>{
    Promise.all([sg(SK.inc),sg(SK.cfg),sg(SK.usr)]).then(([inc,c,u])=>{
      if(inc)setIncidents(inc);
      if(c)setCfgState(c);
      if(u)setUsers(u);
    });
  },[]);

  const saveInc=async(inc)=>{
    const upd=editingInc?incidents.map(i=>i.id===inc.id?inc:i):[...incidents,inc];
    setIncidents(upd);await ss(SK.inc,upd);setEditingInc(null);setPrefilled(null);
  };
  const delInc=async(id)=>{const upd=incidents.filter(i=>i.id!==id);setIncidents(upd);await ss(SK.inc,upd);};
  const saveCfg=async(c)=>{setCfgState(c);await ss(SK.cfg,c);};

  const nav=(p)=>{setPage(p);setEditingInc(null);setPrefilled(null);};

  if(!user) return(
    <div style={{maxWidth:480,margin:"0 auto"}}>
      <style>{`*{box-sizing:border-box;}body{margin:0;}`}</style>
      <LoginPage users={users} onLogin={setUser}/>
    </div>
  );

  const isFormPage=page==="novo"||page==="editar";

  return(
    <div style={{maxWidth:480,margin:"0 auto",background:BG,minHeight:"100vh",position:"relative"}}>
      <style>{`*{box-sizing:border-box;}body{margin:0;background:#f0f2f5;}input,select,textarea{font-family:inherit;}button{font-family:inherit;}`}</style>
      <Drawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} page={page} onNav={nav} user={user} onLogout={()=>setUser(null)}/>
      {!isFormPage&&<TopBar onMenu={()=>setDrawerOpen(true)}/>}
      <div>
        {page==="dashboard"&&<Dashboard incidents={incidents} onNav={nav}/>}
        {page==="captura"&&<CapturePage onManual={d=>{setPrefilled(d||{});setEditingInc(null);setPage("novo");}}/>}
        {isFormPage&&<FormPage initial={editingInc||prefilled||{}} incidents={incidents} cfg={cfg} onSave={saveInc} onCancel={()=>{setPage("atendimentos");setEditingInc(null);setPrefilled(null);}}/>}
        {page==="atendimentos"&&<AtendimentosPage incidents={incidents} onDelete={delInc} onEdit={inc=>{setEditingInc(inc);setPage("editar");}} onNew={()=>nav("novo")}/>}
        {page==="config"&&<ConfigPage cfg={cfg} setCfg={saveCfg}/>}
      </div>
    </div>
  );
}
