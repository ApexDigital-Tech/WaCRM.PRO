import{j as o,A as R,m as h}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c66.js";import{M as ee,R as te}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c655.js";import{n as u,o as g,p as V,t as ae,q as L,r as ie,s as oe,w as O,A as ne}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c621.js";import{u as C}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c638.js";import{d as k,e as se,f as M,M as re,o as ce,g as le}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c633.js";import{w as H,c as S,b as _,i as de,C as T,s as ue,p as pe,n as me,x as fe,d as ge}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c65.js";import{a as D}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c64.js";import{W as q,V as b}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c63.js";import{a as c,d as v}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c62.js";import{_ as y}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c68.js";import{M as ye}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c656.js";import{s as w,u as xe}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c657.js";import{X as z}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c67.js";import{u as he,o as be,a as ve,F as we}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c6.js";import{T as Se}from"./v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c658.js";const _e=(e,t)=>{e.forEach(a=>{a.addedNodes.forEach(n=>{t(a)})})},Ee=e=>{const{update:t}=V.getState(),{getElement:a}=u.getState(),{setIsOpen:n}=g.getState();_e(e,s=>{const i=s.addedNodes[0];i?.id==="main"?n(!0):i?.classList?.contains(a("closeChat"))&&(t("closeChat"),n(!1))})},je=e=>{const{setIsThree:t}=g.getState(),{getElement:a}=u.getState();e[0].target.classList.contains(a("two"))?t(!1):t(!0)},A=(e,t,a)=>{new MutationObserver(t).observe(e,a)},B=()=>{const{getSeletor:e}=u.getState();e("menuLateral",t=>{A(t,Ee,{childList:!0})}),e("waPage",t=>{A(t,je,{attributes:!0})})},Ce=()=>{H(u.getState().getElement("paneSide"),()=>{B(),u.getState().getSeletor("whatsModal",e=>{A(e,t=>{const{setIsOpen:a}=g.getState();t[0].addedNodes.length>0?a(!1):a(!0)},{childList:!0})})})},Me=()=>{if(document.getElementById("piracy-overlay"))return;const e=document.createElement("style");e.id="piracy-styles",e.textContent=`
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
  
      .piracy-overlay {
        position: fixed;
        inset: 0;
        background: #18181B;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: 'Inter', sans-serif;
        backdrop-filter: blur(8px);
        padding: 20px;
      }
  
      .piracy-modal {
        background: #09090B;
        color: #fff;
        border-radius: 20px;
        padding: 40px;
        max-width: 480px;
        width: 100%;
        max-height: 90vh;   
        overflow-y: auto; 
        animation: fadeIn 0.5s ease-out;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        gap: 28px;
        border: 1px solid #2c2c2e;
      }
  
      .piracy-icon {
        font-size: 64px;
        align-self: center;
        color: #f1c40f;
        margin-bottom: 4px;
      }
  
      .piracy-title {
        font-size: 30px;
        text-align: center;
        color: #ff4d4f;
        font-weight: 800;
        text-transform: uppercase;
        line-height: 1.1;
        margin-bottom: -8px;
      }
  
      .piracy-subtitle {
        font-size: 16px;
        text-align: center;
        color: #ffa502;
        font-weight: 600;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
  
      .piracy-text {
        font-size: 15px;
        line-height: 1.7;
        color: #dcdde1;
        text-align: center;
      }
  
      .piracy-text p {
        margin: 0 0 16px 0;
      }
  
      .piracy-text p:last-child {
        margin-bottom: 0;
      }
  
      .piracy-text strong {
        color: #ff6b6b;
      }
  
      .piracy-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        justify-content: center;
        margin-top: 8px;
      }
  
      .piracy-btn-primary, .piracy-btn-secondary {
        padding: 14px 28px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
  
      .piracy-btn-primary {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }
  
      .piracy-btn-primary:hover {
        background: linear-gradient(135deg, #059669, #047857);
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
      }
  
      .piracy-btn-secondary {
        background: transparent;
        color: #f39c12;
        border: 2px solid #f39c12;
      }
  
      .piracy-btn-secondary:hover {
        background: #f39c12;
        color: #fff;
        transform: translateY(-2px);
      }
  
      .piracy-footer {
        font-size: 12px;
        color: #a4b0be;
        text-align: center;
        margin-top: 16px;
        line-height: 1.5;
      }
  
      .piracy-brand {
        color: #10b981;
        font-weight: 800;
        font-size: 16px;
        text-transform: uppercase;
        letter-spacing: 1px;
        text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
      }
  
      @media (max-width: 480px) {
        .piracy-modal {
          padding: 32px 24px;
          gap: 24px;
        }
        .piracy-title {
          font-size: 24px;
        }
        .piracy-icon {
          font-size: 56px;
        }
        .piracy-buttons {
          flex-direction: column;
        }
        .piracy-btn-primary, .piracy-btn-secondary {
          width: 100%;
        }
      }
    `,document.head.appendChild(e);const t=`
      <div class="piracy-modal">
        <div class="piracy-icon">⚠️</div>
        <div class="piracy-title">Pirataria Detectada</div>
        <div class="piracy-subtitle">Extensão não oficial</div>
        <div class="piracy-text">
          <p><strong>Atenção:</strong> Esta extensão foi identificada como <strong>pirata</strong>.</p>
          <p>Ela pode conter <strong>malware</strong>, capturar seus dados ou comprometer sua segurança.</p>
          <p><strong>Crime:</strong> Violação de direitos autorais prevista na Lei 9.610/98.</p>
          <p>Evite riscos: use a versão oficial da Chrome Web Store.</p>
        </div>
        <div class="piracy-buttons">
          <button class="piracy-btn-primary" id="piracy-store-btn">Ir para versão oficial</button>
          <button class="piracy-btn-secondary" id="piracy-support-btn">Fale conosco</button>
        </div>
        <div class="piracy-footer">
          Proteja-se e use fontes oficiais. <br/>
          <span>waTidy</span> - Extensão Oficial
        </div>
      </div>
    `,a=document.createElement("div");a.className="piracy-overlay",a.id="piracy-overlay",a.innerHTML=t,a.addEventListener("click",n=>{const s=n.target;if(s){if(s.id==="piracy-store-btn")window.open("https://chromewebstore.google.com/detail/gjlfpggiddcminhebiejofeglfjmleli","_blank");else if(s.id==="piracy-support-btn"){const i=document.createElement("a");i.href="https://wa.me/553129424122?text=Ol%C3%A1%2C%20tudo%20bem%3F%20Notei%20que%20estou%20usando%20uma%20vers%C3%A3o%20n%C3%A3o%20oficial%20da%20extens%C3%A3o%20e%20gostaria%20de%20migrar%20para%20a%20vers%C3%A3o%20oficial.%20Podem%20me%20ajudar%20com%20isso%3F",i.target="_blank",i.rel="noreferrer",i.click()}}}),requestAnimationFrame(()=>{document.body.innerHTML="",document.body.appendChild(a)})},Ae=async()=>{const{config:e,getUrl:t}=S.getState(),{session:a,user:n}=_.getState(),{domSelector:s}=u.getState(),i=de();if(s.update_path_active!=="true")return;const r={phone:(await q.Conn("getMyDeviceId")).user,chromeStoreID:chrome.runtime.id,checkout:i,painel_cliente:b.painel_cliente,backend:b.backend_plugin,user_logado:{session:a,user:n},nome:e.name,tutorial:t("redes_sociais","youtube").link,suporte_clientes:{premium:t("principais","suporte_premium").link,gratuitos:t("principais","suporte_gratuitos").link},timeZone:ae()};(await D.post(s.update_path_new,r,{headers:{"Content-Type":"application/json","access-token":b.cript_key}})).data.pt&&Me()},Le=()=>{c.useEffect(()=>{const e=t=>{if(t.data.type==="Ev"&&t.data.action==="chat.active_chat"){const a=JSON.parse(t.data.model);a&&(a.id={server:"@"+a.id.split("@")[1],user:a.id.split("@")[0],_serialized:a.id},a.default_id={server:"@"+a.default_id.split("@")[1],user:a.default_id.split("@")[0],_serialized:a.default_id},L.setState({activeChat:a}))}};return window.addEventListener("message",e),()=>{window.removeEventListener("message",e)}},[])},W=c.createContext(void 0);function bt(){const e=c.useContext(W);if(!e)throw new Error("Place PrivacityContext inside PrivacityProvider");return e}const F={privacitySettings:!0};function ke({children:e}){const t={photoHidden:{hide:!1},nameHidden:{hide:!1},midiaHidden:{hide:!1},galeryHidden:{hide:!1},lastMessageHidden:{hide:!1},messageHidden:{hide:!1}},[a,n]=c.useState(t);return c.useEffect(()=>{if(F.privacitySettings&&localStorage.getItem("privacityOptions")){let i=T.decryptData(localStorage.getItem("privacityOptions"));n(i),F.privacitySettings=!1}else{let i=T.encryptData(a);localStorage.setItem("privacityOptions",i)}let s="";Object.entries(a).map(([i,r])=>{r.hide&&(s+=i+" ")}),s.length===0?document.body.removeAttribute("hide"):document.body.setAttribute("hide",s)},[a]),o.jsx(W.Provider,{value:{privacityOptions:a,setPrivacityOptions:n},children:e})}const ze=c.lazy(() => __vitePreload(()=>import(chrome.runtime.getURL("content/assets/js/v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c649.js")).then(e=>e.i),[]));function Ne(){return k(t=>t.activeHeader)&&o.jsx(c.Suspense,{fallback:o.jsx(o.Fragment,{}),children:o.jsx(ze,{})})}const Ie=c.lazy(() => __vitePreload(()=>import(chrome.runtime.getURL("content/assets/js/v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c650.js")),[]));function Oe(){return o.jsx(c.Suspense,{fallback:o.jsx(o.Fragment,{}),children:o.jsx(Ie,{})})}const $=document.createElement("section");$.setAttribute("data-id","ChatName");const Y=document.createElement("section");Y.setAttribute("data-id","MenuVertical");const U=document.createElement("section");U.setAttribute("data-id","MenuHorizontal");const X=document.createElement("section");X.setAttribute("data-id","ActionMonitor");const N=document.createElement("section");N.setAttribute("data-id","AssistenteDeChat");const E=document.createElement("section");E.setAttribute("data-id","FooterIconsLeft");E.setAttribute("style","display: contents;");const I=document.createElement("section");I.setAttribute("data-id","FooterIconsRight");const Te=[{father:()=>u.getState().getSeletor("chatName"),children:$,type:"insert",renderInblockChat:!0},{father:()=>u.getState().getSeletor("menuVertical"),children:Y,type:"prepend",renderInblockChat:!0},{father:()=>u.getState().getSeletor("menuHorizontal"),children:U,type:"prepend",renderInblockChat:!0},{father:()=>u.getState().getSeletor("assistenteChat"),children:N,type:"prepend",renderInblockChat:!1},{father:()=>u.getState().getSeletor("actionMonitor"),children:X,type:"insertAdjacentElement",renderInblockChat:!1},{father:()=>u.getState().getSeletor("footerIconsLeft"),children:E,type:"prepend",renderInblockChat:!1},{father:()=>u.getState().getSeletor("respostaRapida"),children:I,type:"appendChild",renderInblockChat:!1}];function Fe(){const e=L(t=>t.activeChat);c.useEffect(()=>{if(!e)return;const{getSeletor:t}=u.getState(),a=[];return Te.forEach(({father:s,children:i,type:r,renderInblockChat:l})=>{switch(r){case"prepend":s()?.prepend(i);break;case"insert":let p=s();p&&(p.innerHTML="",p.prepend(i));break;case"insertAdjacentElement":s()?.insertAdjacentElement("afterend",i);break;default:s()?.appendChild(i);break}}),t("observerFooterNewModel",s=>{const i=new MutationObserver(r=>{r[0].removedNodes.length!==0&&(t("respostaRapida",l=>{l.appendChild(I)}),t("footerIconsLeft",l=>{l.prepend(E)}),t("assistenteChat",l=>{l.prepend(N)}))});i.observe(s,{childList:!0}),a.push(i)}),()=>{a.forEach(s=>s.disconnect())}},[e])}const Pe=c.lazy(() => __vitePreload(()=>import(chrome.runtime.getURL("content/assets/js/v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c651.js")),[]));function Re(){const e=L(t=>t.activeChat);return Fe(),c.useEffect(()=>{if(!e)return;V.getState().update(e.id._serialized),ie.getState().configAssinatura(),oe.getState().getActiveChat(e.id._serialized),se.getState().insertBtnTradutor(),e.id.user&&(O.getState().setActiveUser(e),O.getState().setActivePerfil(e.id.user)),B(),C.setState({textAssistente:""});const{assistente:t,manipulatedInputText:a,formatTextAssistente:n}=C.getState();if(t.active){const s=e.draftMessage;s?.text?.length>0&&n(s.text),a()}},[e]),e?o.jsx(c.Suspense,{fallback:o.jsx(o.Fragment,{}),children:o.jsx(Pe,{})}):null}const G=document.createElement("section");G.setAttribute("data-id","MenuLateral");G.setAttribute("render-mode","window");const Ve=c.lazy(() => __vitePreload(()=>import(chrome.runtime.getURL("content/assets/js/v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c652.js")),[]));function He(){const e=g(n=>n.menuContent),t=g(n=>n.isOpen),a=g(n=>n.isThree);return e.children!=="close"&&!a&&t&&o.jsx(c.Suspense,{fallback:o.jsx(o.Fragment,{}),children:o.jsx(Ve,{})})}const De=c.lazy(() => __vitePreload(()=>import(chrome.runtime.getURL("content/assets/js/v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c653.js")).then(e=>e.i),[]));function qe(){return k(t=>t.activeView)&&o.jsx(c.Suspense,{fallback:o.jsx(o.Fragment,{}),children:o.jsx(De,{})})}const Be=()=>new Promise(e=>{const t=()=>{const{session:s}=_.getState(),{is_load:i,config:r}=S.getState();s.is_load&&i&&(a(),n(),e({session:s,config:r}))},a=_.subscribe(t),n=S.subscribe(t);t()}),J=async e=>{try{let t,a;if(e==="start"){const d=await Be();t=d.session,a=d.config}else t=_.getState().session,a=S.getState().config;const n=`api/notify/get/${t.is_premium?"premium":"free"}/${a.chromeStoreID}`,s=(await D.get(`${b.backend_plugin}${n}`,{headers:{"Content-Type":"application/json",accept:"application/json","access-token":b.cript_key}})).data;if(!s.success)return;const i=s.notify.reverse(),r=i.filter(d=>d.viewer==="NOTIFY"),l=i.filter(d=>d.viewer==="MODAL"),p=i.filter(d=>d.viewer==="INBOX"),x=i.filter(d=>d.viewer==="EXTERNAL_PAGE");m.setState(d=>({notify:{...d.notify,notify:r},modal:{...d.modal,notify:l},inbox:{...d.inbox,notify:p},external_page:{...d.external_page,notify:x}}))}catch(t){console.error("Error ao capturar as notificações",t)}},Z=async e=>{e.action==="Remote-Notificacao"&&J("validate")};chrome.runtime.onMessage.addListener(Z);window.addEventListener("beforeunload",()=>{chrome.runtime.onMessage.removeListener(Z)});const P=v()(e=>({notifyNotVisualized:0,getCaixaDeEntrada:()=>{const t=M.getState().notifications,a=m.getState().notify,n=a.notify.filter(i=>!a.views.includes(i.id)),s=[...t,...n];return s.sort((i,r)=>r.data-i.data),s},getNotifyNotVisualized:()=>e(()=>{const{naoVisualizadaTam:t}=M.getState(),a=m.getState().notify;return{notifyNotVisualized:a.notify.filter(i=>!a.views.includes(i.id)).length+t}})})),We=e=>{setTimeout(()=>{m.getState().setActive("modal",e)},1e4)},$e=e=>{setTimeout(()=>{m.getState().setActive("inbox",e)},5e3)},Ye=e=>{m.getState().setViews("external_page",e.id),setTimeout(()=>{chrome.runtime.sendMessage({message:"promotional",path:e.link})},3e4)},j=e=>{const{notify:t,views:a}=e,n=new Set(a);return t.find(s=>!n.has(s.id))},Ue=()=>{const e=m.subscribe(i=>({notify:i.notify}),({notify:i})=>{P.getState().getNotifyNotVisualized()},{equalityFn:w,fireImmediately:!0}),t=m.subscribe(i=>({modal:i.modal}),({modal:i})=>{const r=j(i);r&&r.id!==i.active?.id&&We(r)},{equalityFn:w,fireImmediately:!0}),a=m.subscribe(i=>({inbox:i.inbox}),({inbox:i})=>{const r=j(i);r&&r.id!==i.active?.id&&$e(r)},{equalityFn:w,fireImmediately:!0}),n=m.subscribe(i=>i.external_page,i=>{const r=j(i);r&&Ye(r)},{equalityFn:w,fireImmediately:!0}),s=M.subscribe(()=>{P.getState().getNotifyNotVisualized()});window.addEventListener("beforeunload",()=>{e(),t(),a(),n(),s()})},m=v()(ue(pe(e=>({notify:{notify:[],views:[],active:null},modal:{notify:[],views:[],active:null},inbox:{notify:[],views:[],active:null},external_page:{notify:[],views:[],active:null},setViews:(t,a)=>e(n=>({[t]:{...n[t],views:[...n[t].views,a],active:null}})),setActive:(t,a)=>e(n=>({[t]:{...n[t],active:a}}))}),{name:"core_wam_notify",storage:me(()=>fe(`core_wam_${chrome.runtime.id}`,"core_wam_notify")),version:2,partialize:e=>({notify:{notify:[],views:e.notify.views,active:null},modal:{notify:[],views:e.modal.views,active:null},inbox:{notify:[],views:e.inbox.views,active:null},external_page:{notify:[],views:e.external_page.views,active:null}}),onRehydrateStorage:()=>()=>{J("start")}})));Ue();const Xe=c.lazy(() => __vitePreload(()=>import(chrome.runtime.getURL("content/assets/js/v_7_4_3_47_2921691c-bc65-4843-8fa4-72b450fb58c654.js")),[]));function Ge({notificacao:e}){return o.jsx(c.Suspense,{fallback:o.jsx(o.Fragment,{}),children:o.jsx(Xe,{notificacao:e})})}function Je(){const{modal:e,setViews:t}=m(xe(a=>({modal:a.modal.active,setViews:a.setViews})));return o.jsx("section",{"data-id":"Notificacao-Modal",children:o.jsx(R,{children:e&&o.jsx(h.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2},className:"fixed inset-0 z-[99999999999999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4",children:o.jsxs(h.div,{initial:{opacity:0,scale:.95,y:10},animate:{opacity:1,scale:1,y:0},exit:{opacity:0,scale:.95,y:10},transition:{type:"spring",stiffness:300,damping:25,duration:.3},className:"relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-fit max-h-[90vh] flex flex-col",onClick:a=>a.stopPropagation(),children:[o.jsx("button",{onClick:()=>t("modal",e.id),className:"absolute top-3 right-3 z-50 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 transition-colors cursor-pointer shadow-sm group",title:"Fechar",children:o.jsx(z,{className:"w-5 h-5 text-gray-500 group-hover:text-[var(--primaria)] transition-colors"})}),o.jsx("div",{className:"w-full h-full overflow-y-auto custom-scrollbar",children:o.jsx(Ge,{notificacao:e})})]})},"notify-overlay")})})}const K=v(e=>({modalExterno:null,zIndex:900,btnClose:!1,auxFunc:{mounted:null,desmouted:null},open:(t,a=900,n=!1,s={mounted:null,desmouted:null})=>{s.mounted&&s.mounted(),e(()=>({modalExterno:t,zIndex:a,btnClose:n,auxFunc:s}))},close:()=>e(t=>(t.auxFunc.desmouted&&t.auxFunc.desmouted(),{modalExterno:null})),openRendertype:(t,a=900,n=!1,s={mounted:null,desmouted:null})=>{let i;t==="Active_IA"&&(i=o.jsx(ne,{})),K.getState().open(i,a,n,s)}}));function Ze(){const{modalExterno:e,btnClose:t,close:a,zIndex:n}=K(),s=c.useRef(null),i=c.useRef(null);return c.useEffect(()=>{const r=l=>{const p=document.querySelector(".iziToast-wrapper"),x=document.querySelector('section[data-id="Modal Options"]'),d=document.querySelector('section[data-id="Modal"]');t&&s.current&&!i.current.contains(l.target)&&(!p||!p.contains(l.target))&&!x&&!d&&a()};return e&&document.addEventListener("mousedown",r),()=>{document.removeEventListener("mousedown",r)}},[e]),e&&o.jsx("section",{"data-id":"Modal Externo",children:o.jsx("dialog",{id:"my_modal_5",ref:s,className:"modal modal-bottom sm:modal-middle !absolute bg-[var(--modal-backdrop)] overflow-hidden !opacity-100 !pointer-events-auto !visible",style:{zIndex:n},children:o.jsxs("div",{ref:i,className:"animate__animated animate__zoomIn relative overflow-hidden !max-w-none !max-h-none !w-fit !h-fit p-[2px]",children:[t&&o.jsx("span",{className:"absolute w-5 h-5 top-3 right-3 pulse !cursor-pointer",onClick:a,children:o.jsx(z,{className:"w-full h-full text-[var(--primary-strong)]"})}),o.jsx("div",{className:"w-full h-full",children:e})]})})})}const Ke=v()(e=>({modal:null,btnClose:!0,auxFunc:{mounted:null,desmouted:null},open:(t,a=!0,n={mounted:null,desmouted:null})=>e(()=>(n.mounted&&n.mounted(),{modal:t,btnClose:a,auxFunc:n})),close:()=>e(t=>(t.auxFunc.desmouted&&t.auxFunc.desmouted(),{modal:null}))}));function Qe(){const{modal:e,btnClose:t,close:a}=Ke(),n=c.useRef(null),s=c.useRef(null);return c.useLayoutEffect(()=>{const i=r=>{const l=document.querySelector(".iziToast-wrapper"),p=document.querySelector('section[data-id="Modal Options"]'),x=document.querySelector('section[data-id="Modal Emoji"]'),d=document.querySelector('section[data-id="Modal Externo"]');t&&n.current&&!s.current.contains(r.target)&&(!l||!l.contains(r.target))&&!p&&!x&&!d&&a()};return e&&document.addEventListener("mousedown",i),()=>{document.removeEventListener("mousedown",i)}},[e]),o.jsx(R,{children:e&&o.jsx("section",{"data-id":"ModalLateral",children:o.jsx(h.div,{ref:n,initial:{opacity:0,backdropFilter:"blur(0px)"},animate:{opacity:1,backdropFilter:"blur(4px)"},exit:{opacity:0,backdropFilter:"blur(0px)"},transition:{duration:.3,ease:[.4,0,.2,1]},className:"h-full w-full fixed top-0 shadow-lg overflow-auto box-sizing z-[400] bg-black/20",style:{backgroundColor:"rgba(15, 23, 42, 0.3)"},children:o.jsxs(h.div,{ref:s,initial:{x:-400,opacity:0},animate:{x:0,opacity:1},exit:{x:-400,opacity:0},transition:{type:"spring",damping:30,stiffness:300,mass:.8},className:"modalLateral bg-white dark:bg-black border-[var(--conversation-header-border)] border-solid border-r overflow-hidden relative",children:[t&&o.jsx(h.span,{initial:{opacity:0,scale:.8},animate:{opacity:1,scale:1},transition:{delay:.2,duration:.2},className:"absolute w-5 h-5 top-3 right-3 pulse !cursor-pointer z-10",onClick:a,children:o.jsx(z,{className:"w-full h-full text-[var(--primary-strong)]"})}),o.jsx("div",{className:"absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--primaria)] via-[var(--secundaria)] to-[var(--terciaria)]"}),o.jsx("div",{className:"w-full h-full",children:e})]})})})})}const et=v()((e,t)=>({isHover:!1,content:"",options:{},referenceElement:null,style:{},open:(a,n,s,i={})=>e(()=>({isHover:!0,content:a,referenceElement:s,options:n,style:i})),close:()=>e(()=>({isHover:!1,content:"",referenceElement:null,options:{},style:{}})),openWithGetEvents:(a,n={placement:"bottom"},s={})=>{const{open:i,close:r}=t(),l=p=>{i(a,n,p.currentTarget,s)};return{onMouseEnter:l,onMouseMove:l,onFocus:l,onBlur:r,onMouseLeave:r}}}));function tt(){const{isHover:e,content:t,referenceElement:a,options:n,style:s}=et(),i=c.useRef(null),{refs:r,floatingStyles:l,context:p}=he({...n,middleware:[be(10),ve({element:i})]});return c.useEffect(()=>{a&&r.setReference(a)},[a,r]),e&&o.jsx("section",{"data-id":"Tooltip",children:o.jsx("div",{ref:r.setFloating,className:"z-[9999999] outline-none",style:{...l,...s},children:o.jsxs("div",{className:`
            rounded-md 
            shadow-md 
            bg-[var(--primaria)]
            dark:bg-[var(--primaria)]
            light:bg-white 
            border 
            border-[var(--terciaria)]
            animate-in 
            fade-in 
            zoom-in-95 
            duration-150
        `,children:[o.jsx(we,{ref:i,context:p,className:"fill-[var(--primaria)] light:fill-white border-[var(--terciaria)]",strokeWidth:1}),o.jsx("div",{className:"text-[#fafafa] light:text-[#09090b] px-3 py-1.5 text-xs font-medium",children:t})]})})})}function at(){const e=u(t=>t.getSeletor);return Le(),c.useLayoutEffect(()=>{e("afiliadoMain",t=>{f.appendChild(t)})},[]),o.jsxs(ke,{children:[o.jsx(ee,{}),o.jsx(re,{}),o.jsx(ye,{}),o.jsx(Je,{}),o.jsx(Ze,{}),o.jsx(tt,{}),o.jsx(Qe,{}),o.jsx(qe,{}),o.jsx(Ne,{}),o.jsx(Oe,{}),o.jsx(Re,{}),o.jsx(He,{}),o.jsx(Se,{theme:"system",position:"top-right"})]})}const f=document.createElement("main");document.body.prepend(f);f.setAttribute("theme-active","default");f.setAttribute("active-view-menu","true");const Q=e=>{try{return e.is_load?(H(e.getElement("paneSide"),()=>{te.createRoot(f).render(o.jsx(at,{})),f.setAttribute("active-assistente-chat",String(C.getState().assistente.active)),f.setAttribute("theme-active",String(k.getState().tema)),setTimeout(()=>{q.Whatsapp("theme",ge.getState().theme?"dark":"light")},2e3),ce(),Ae(),setTimeout(()=>{le.setState({loadStates:!0})},3e5)}),Ce(),!0):!1}catch(t){return console.error("Erro ao inicializar o plugin:",t),!1}},it=Q(u.getState());if(!it){const e=u.subscribe(t=>{Q(t)&&e()})}const vt=Object.freeze(Object.defineProperty({__proto__:null,main:f},Symbol.toStringTag,{value:"Module"}));export{X as A,$ as C,E as F,Y as M,m as a,U as b,N as c,I as d,G as e,K as f,Ke as g,P as h,bt as i,vt as j,et as u};
