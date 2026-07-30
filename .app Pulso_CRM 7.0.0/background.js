async function g(e) {
  try {
    const t = await chrome.tabs.query({ url: e });
    if (t.length === 0)
      return;
    const o = t.map((a) => a.id);
    await chrome.tabs.remove(o);
  } catch (t) {
    console.error("Erro ao tentar fechar as abas do WhatsApp:", t);
  }
}
function M(e) {
  const t = new Date(e), o = /* @__PURE__ */ new Date(), a = t.getTime() - o.getTime();
  return a <= 12e4 || a < 0;
}
const c = {
  // NomeID Da WL Ativa
  name: "wpres",
  // Versão de build
  version: "7.4.3.47",
  // Chave de criptografia
  cript_key: "ffce211a-7b07-4d91-ba5d-c40bb4034a83",
  // Url do backend principal
  backend_plugin: "https://wacrm.digital/api/v1/",
  // Url do backend Antigo
  backend: "https://painel-old.wascript.com.br/",
  // Url do backend de funções auxiliares
  backend_utils: "https://backend-utils.wascript.com.br/",
  // WebSockets
  webSocket: {
    "multi-atendimento": "https://multi-atendimento.wascript.com.br",
    "api-whatsapp": "https://api-whatsapp.wascript.com.br"
  },
  // Url do painel de clientes
  painel_cliente: "https://wacrm.digital/api/v1",
  // Url do audio transcriber
  audio_transcriber: "https://audio-transcriber.wascript.com.br/transcription",
  // Url do código remoto
  remote_code: "https://wacrm.digital/api/v1/",
  //remote_code: "https://dev.watools.com.br/",
  // Limite de mídia no Resposta Rápida
  midiaLimit: 50
};
function I(e) {
  e.reason === "install" && fetch(`${c.backend_plugin}api/urls/install/${chrome.runtime.id}`).then((t) => {
    if (!t.ok)
      throw new Error("Erro na requisição: " + t.status);
    return t.json();
  }).then((t) => {
    t.success && chrome.tabs.create({ url: t.url });
  }).catch((t) => {
    console.error("Erro ao fazer a requisição:", t);
  });
}
const U = () => {
  fetch(`${c.backend_plugin}api/urls/active-notes/${chrome.runtime.id}`).then((e) => {
    if (!e.ok)
      throw new Error("Erro na requisição: " + e.status);
    return e.json();
  }).then((e) => {
    e.success && e.path_note_update.redirect && chrome.tabs.create({ url: `${c.backend_plugin}api/urls/notes/${chrome.runtime.id}` });
  }).catch((e) => {
    console.error("Erro ao fazer a requisição:", e);
  });
};
function h(e) {
  const t = chrome.runtime.getURL(e + "/src/index.html");
  chrome.tabs.query({ url: t }, function(o) {
    o.length > 0 && o.forEach((a) => {
      a.id !== void 0 && chrome.tabs.remove(a.id);
    }), chrome.tabs.create({ url: t });
  });
}
async function T(e) {
  const { success: t, bearer_token: o } = await E();
  if (!t) {
    d();
    return;
  }
  if (e.reason !== "install") {
    d();
    return;
  }
  await g("*://web.whatsapp.com/*"), await g("*://chromewebstore.google.com/*"), chrome.tabs.create({ url: `https://web.whatsapp.com?bearer_token=${o}` });
}
function d() {
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, function(e) {
    e.length > 0 && e[0].id !== void 0 ? chrome.tabs.reload(e[0].id) : chrome.tabs.create({ url: "https://web.whatsapp.com" });
  });
}
async function E() {
  const e = "*://chromewebstore.google.com/*";
  try {
    const t = await chrome.tabs.query({ url: e });
    if (t.length === 0)
      return { success: !1, bearer_token: "" };
    for (const o of t)
      if (o.url)
        try {
          const r = new URL(o.url).searchParams.get("bearer_token");
          if (r)
            return { success: !0, bearer_token: r };
        } catch (a) {
          console.warn(`Erro ao processar a URL da aba ${o.id}:`, a);
        }
    return { success: !1, bearer_token: "" };
  } catch (t) {
    return console.error("Erro ao consultar as abas do Chrome:", t), { success: !1, bearer_token: "" };
  }
}
async function v(e) {
  return new Promise((t, o) => {
    chrome.storage.local.get([e], function(a) {
      a[e] === void 0 ? o() : t(a[e]);
    });
  });
}
function s(e, t, o) {
  chrome.tabs.query({ url: e }, function(a) {
    a.length > 0 && a.forEach((r) => {
      chrome.tabs.sendMessage(r.id, { action: t, dados: o });
    });
  });
}
function L() {
  chrome.runtime.setUninstallURL(`${c.backend_plugin}api/urls/uninstall/${chrome.runtime.id}`);
}
const A = async () => {
  try {
    const t = await (await fetch(`${c.remote_code}config.json`, {
      method: "GET"
    })).json();
    return s("https://web.whatsapp.com/*", "Update_DomSelector", t), t;
  } catch (e) {
    return console.error("Erro ao buscar configurações externas:", e), null;
  }
};
async function R() {
  const e = await v("notifications"), t = [], o = [];
  let a = 0;
  for (let r of e)
    !r.timeOut && M(`${r.date}T${r.time}`) && (r.timeOut = !0, o.push(r)), r.timeOut && !r.read && a++, t.push(r);
  s("https://web.whatsapp.com/*", "Update_Notificação", { update: t, dispart: o, tam: a });
}
function f() {
  chrome.alarms.get("One_Minute", (e) => {
    e || chrome.alarms.create("One_Minute", { periodInMinutes: 1 });
  }), chrome.alarms.get("Five_Minutes", (e) => {
    e || chrome.alarms.create("Five_Minutes", { periodInMinutes: 5 });
  }), chrome.alarms.get("Ten_Minutes", (e) => {
    e || chrome.alarms.create("Ten_Minutes", { periodInMinutes: 10 });
  }), chrome.alarms.get("Thirty_Minutes", (e) => {
    e || chrome.alarms.create("Thirty_Minutes", { periodInMinutes: 30 });
  });
}
chrome.alarms.onAlarm.addListener((e) => {
  switch (e.name) {
    // 1 Minuto
    case "One_Minute":
      s("https://web.whatsapp.com/*", "Update_Agendamento", {}), s("https://web.whatsapp.com/*", "Update_Status", {}), s("https://web.whatsapp.com/*", "Update_BackupAutomatico", {}), s("https://web.whatsapp.com/*", "Update_MeetAoVivo", {}), R();
      break;
    // 5 Minutos
    case "Five_Minutes":
      s("https://web.whatsapp.com/*", "license_update", {}), s("https://web.whatsapp.com/*", "dispatch_timing_follow", {});
      break;
    // 10 Minutos
    case "Ten_Minutes":
      A();
      break;
    // 30 Minutos
    case "Thirty_Minutes":
      s("https://web.whatsapp.com/*", "Remote-Notificacao", {});
      break;
    // Alarme de manter o sistema ativo
    case "keepAwake":
      chrome.runtime.getPlatformInfo();
      break;
  }
});
const O = () => {
  const e = /* @__PURE__ */ new Date();
  e.setDate(e.getDate() + 1);
  const t = e.getFullYear(), o = String(e.getMonth() + 1).padStart(2, "0"), a = String(e.getDate()).padStart(2, "0");
  return `${t}-${o}-${a}`;
}, D = {
  date: O(),
  items: [
    "respostasRapidas",
    "respostasRapidasAcao",
    "categoria",
    "agendamentos",
    "agendamentosNaoDisparados",
    "sendAfterWhatsAppOpens",
    "crm",
    "contatos",
    "notes",
    "notifications",
    "perfil",
    "userTabs",
    "agrupamentos",
    "relatorio",
    "encomendas",
    "autoatendimento",
    "webhook",
    "IA",
    "status",
    "pinChat",
    "atendimento",
    "backupAutomatico",
    "whatsApi",
    "replacementStorage",
    "FollowUp",
    "fluxo"
  ],
  recurrency: "diario",
  time: "10:30"
};
async function $() {
  chrome.storage.local.get(null, (e) => {
    chrome.storage.local.set({
      agendamentos: e.agendamentos || [],
      agendamentosNaoDisparados: e.agendamentosNaoDisparados || [],
      sendAfterWhatsAppOpens: e.sendAfterWhatsAppOpens || !1,
      notifications: e.notifications || [],
      userTabs: e.userTabs || [],
      contatos: e.contatos || [],
      notes: e.notes || [],
      agendaMsg: e.agendaMsg || [],
      perfil: e.perfil || [],
      categoria: e.categoria || [],
      initSystem: e.initSystem || !1,
      backupAutomatico: e.backupAutomatico || D,
      crm: e.crm || [],
      fluxo: e.fluxo || { workflows: [], currentWorkflow: null },
      fluxoFiles: e.fluxoFiles || [],
      relatorio: e.relatorio || [],
      encomendas: e.encomendas || [],
      autoatendimento: e.autoatendimento || [],
      FollowUp: e.FollowUp || [],
      webhook: e.webhook || [],
      IA: e.IA || { activeIA: "Gemini", keyGemini: "", keyGPT: "", keyGroq: "", instance: null },
      status: e.status || [],
      pinChat: e.pinChat || [],
      atendimento: e.atendimento || void 0,
      whatsApi: e.whatsApi || { active: !1, token: "", userID: "" },
      replacementStorage: e.replacementStorage || { items: [], isEnabled: !0 },
      initDate: e.initDate || !1,
      //Armazena a data em que o plugin foi instalado para validar a utilização de algumas funções do usuário free
      modalLead: e.modalLead || {},
      // Agrupamentos do novo e antigo envio em massa
      agrupamentos: e.agrupamentos || [],
      groupments: e.groupments || [],
      // Respostas Rapidas OLD
      guardaMsg: e.guardaMsg || [],
      medias: e.medias || [],
      // Respostas Rapidas New
      respostasRapidas: e.respostasRapidas || [],
      respostasRapidasAcao: e.respostasRapidasAcao || []
    });
  });
}
const b = /* @__PURE__ */ new Map(), _ = (e, t, o) => {
  o.url && b.set(e, o.url);
}, k = (e) => {
  const t = b.get(e);
  b.delete(e), t && t.includes("https://web.whatsapp") && chrome.runtime.sendMessage({ action: "whatsIsClosed" });
}, w = () => {
  try {
    chrome.tabs.onUpdated.removeListener(_), chrome.tabs.onRemoved.removeListener(k);
  } catch (e) {
    console.error("erro ao remover os ouvintes do WhatsIsOpen", e);
  } finally {
    chrome.tabs.onUpdated.addListener(_), chrome.tabs.onRemoved.addListener(k);
  }
}, x = async (e) => {
  try {
    const { remote_code: t } = await A();
    if (!t)
      throw new Error("Error url remote code não capturada");
    const a = await (await fetch(t.url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${e}`,
        "Content-Type": "application/json",
        "access-token": c.cript_key
      }
    })).json(), r = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    for (const u of r)
      if (u.id) {
        await chrome.scripting.executeScript({
          target: { tabId: u.id },
          world: "MAIN",
          // Injeta no contexto da janela da página web
          func: (i, p) => {
            window.extend_variables = {
              extension_id: i,
              remote_code: p
            };
          },
          args: [chrome.runtime.id, t]
        }), await chrome.scripting.executeScript({
          target: { tabId: u.id },
          world: "MAIN",
          func: (i) => {
            const p = new Blob([i], { type: "text/css" }), m = URL.createObjectURL(p), n = document.createElement("link");
            n.rel = "stylesheet", n.href = m, n.id = "remote-style", document.head.appendChild(n);
          },
          args: [a.external_style]
        });
        for (const i of [a.wpp, a.wpp_module])
          await chrome.scripting.executeScript({
            target: { tabId: u.id },
            world: "MAIN",
            func: (p) => {
              const m = new Blob([p], { type: "text/javascript" }), n = URL.createObjectURL(m), l = document.createElement("script");
              l.src = n, document.head.appendChild(l), l.remove();
            },
            args: [i]
          });
      }
  } catch (t) {
    console.error("Erro ao injetar WPP:", t), s("https://web.whatsapp.com/*", "module-error", { code: "MODULO_EXTERNAL_NOT_INITIALIZED_IN_BACKGROUND" });
  }
}, y = (e) => {
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (t) => {
    if (t && t.length > 0) {
      const o = t[0], a = o.id, r = `https://web.whatsapp.com/?bearer_token=${e}`;
      chrome.windows.update(o.windowId, { focused: !0 }), chrome.tabs.update(a, {
        active: !0,
        url: r
      });
    } else
      chrome.tabs.create({
        url: `https://web.whatsapp.com/?bearer_token=${e}`
      });
  });
}, N = () => {
  chrome.runtime.onMessageExternal.addListener(async (e, t, o) => {
    switch (e.action) {
      // Informa que a extensão foi Instalada
      case "is_instaled":
        o({ success: !0 });
        break;
      case "open_whatsapp":
        y(e.bearer);
        break;
      case "user_auth":
        y(e.bearer_token), e.close_painel && t.tab && t.tab.id && setTimeout(() => {
          chrome.tabs.remove(t.tab.id);
        }, 100);
        break;
    }
    return !0;
  });
};
f();
w();
N();
chrome.action.onClicked.addListener(() => {
  f(), w(), d();
});
chrome.runtime.onInstalled.addListener(async function(e) {
  I(e), T(e), f(), $(), w(), L(), e.reason === "update" && U();
});
chrome.runtime.onMessage.addListener((e, t, o) => {
  switch (e.message) {
    case "CRM":
      h("crm");
      break;
    case "FLOW":
      h("fluxo");
      break;
    case "funnil":
      h("funnil");
      break;
    case "inject-code":
      x(e.bearer_token);
      break;
    case "promotional":
      chrome.tabs.create({ url: e.path });
      break;
  }
});
