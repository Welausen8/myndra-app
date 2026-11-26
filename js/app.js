/* MyndraLife: app (PWA). Sem etapa de build: arquivos estaticos. */
(function () {
  "use strict";

  var CFG = window.MYNDRA_CONFIG;
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  var app = document.getElementById("app");

  /* ---------- utilitarios ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function hojeISO() {
    // data de hoje no fuso de Sao Paulo, formato AAAA-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone: CFG.fusoHorario }).format(new Date());
  }

  function diasEntre(isoA, isoB) {
    var a = Date.parse(isoA + "T00:00:00Z");
    var b = Date.parse(isoB + "T00:00:00Z");
    return Math.round((b - a) / 86400000);
  }

  function dataLocalISO(timestamp) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: CFG.fusoHorario }).format(new Date(timestamp));
  }

  function saudacaoDoHorario() {
    var h = Number(new Intl.DateTimeFormat("en-US", { timeZone: CFG.fusoHorario, hour: "numeric", hour12: false }).format(new Date()));
    if (h < 5) return "Boa madrugada";
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }

  var DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  /* ---------- telas ---------- */
  function telaCarregando() {
    app.innerHTML = '<div class="carregando">Rotina com Alma</div>';
  }

  function cabecalhoMarca() {
    return '<div class="marca"><div class="logo">MyndraLife</div><div class="lema">Rotina com Alma</div></div>';
  }

  function telaLogin(aviso) {
    app.innerHTML =
      '<main class="centro">' +
      cabecalhoMarca() +
      '<h1 style="font-size:30px;margin-top:34px;text-align:center">Todas estamos em movimento, cada uma na sua semana.</h1>' +
      '<p class="suave" style="text-align:center;margin-top:12px">Digite seu e-mail e enviamos um link para você entrar. Sem senha.</p>' +
      '<form id="f-login" novalidate>' +
      '<label for="email">Seu e-mail</label>' +
      '<input id="email" type="email" inputmode="email" autocomplete="email" placeholder="voce@exemplo.com" required>' +
      '<button class="btn" type="submit">Enviar link de acesso</button>' +
      '<p id="msg" class="msg' + (aviso ? " erro" : "") + '" role="status">' + esc(aviso || "") + "</p>" +
      "</form>" +
      "</main>";

    document.getElementById("f-login").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var campo = document.getElementById("email");
      var msg = document.getElementById("msg");
      var botao = ev.target.querySelector("button");
      var email = campo.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.className = "msg erro";
        msg.textContent = "Confira o e-mail digitado.";
        return;
      }
      botao.disabled = true;
      msg.className = "msg";
      msg.textContent = "Enviando...";
      var r = await sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true }
      });
      botao.disabled = false;
      if (r.error) {
        msg.className = "msg erro";
        msg.textContent = "Não consegui enviar agora. Tente de novo em instantes.";
        return;
      }
      msg.className = "msg ok";
      msg.textContent = "Pronto. Abra seu e-mail e toque no link para entrar. Pode levar um minutinho, e vale olhar também o spam.";
    });
  }

  function abas(atual) {
    var itens = [
      ["inicio", "Início", "◌"],
      ["flow", "Life Flow", "∿"],
      ["body", "Life Body", "◍"],
      ["perfil", "Perfil", "○"]
    ];
    return (
      '<nav class="abas" aria-label="Navegação">' +
      itens.map(function (i) {
        return '<a href="#/' + i[0] + '"' + (i[0] === atual ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + i[2] + "</span>" + i[1] + "</a>";
      }).join("") +
      "</nav>"
    );
  }

  function telaEmBreve(aba, titulo, texto) {
    app.innerHTML =
      '<main class="tela">' + cabecalhoMarca() +
      '<div class="card"><div class="rotulo">Em breve</div><h2>' + esc(titulo) + "</h2>" +
      '<p class="suave" style="margin-top:8px">' + esc(texto) + "</p></div>" +
      '<button class="sair" id="sair">Sair da conta</button></main>' + abas(aba);
    document.getElementById("sair").addEventListener("click", sair);
  }

  /* ---------- dados ---------- */
  async function carregarInicio(user) {
    var out = { perfil: null, acesso: null, ritual: null, passo: null, diasComRegistro: 0, humor: null, semana: 1, diaDaSemana: 1 };

    var rp = await sb.from("perfis").select("nome,visibilidade").eq("id", user.id).maybeSingle();
    out.perfil = rp.data;

    var ra = await sb.from("acessos_flow").select("macrofase_id,tipo,inicio_em").eq("status", "ativo").order("inicio_em", { ascending: true }).limit(1).maybeSingle();
    out.acesso = ra.data;

    var hoje = hojeISO();
    var rh = await sb.from("corpo_registros").select("dia_nivel").eq("data", hoje).maybeSingle();
    out.humor = rh.data ? rh.data.dia_nivel : null;

    if (!out.acesso) return out;

    var inicio = dataLocalISO(out.acesso.inicio_em);
    var dias = Math.max(0, diasEntre(inicio, hoje));
    out.semana = Math.floor(dias / 7) + 1;
    out.diaDaSemana = (dias % 7) + 1;

    // Ritual da semana: n-esima semana da macrofase
    var rr = await sb.from("rituals_semanas")
      .select("numero,palavra_tema,frase")
      .eq("macrofase_id", out.acesso.macrofase_id)
      .order("numero", { ascending: true })
      .limit(out.semana);
    if (rr.data && rr.data.length) out.ritual = rr.data[rr.data.length - 1];

    if (out.ritual) {
      var rt = await sb.from("flow_tarefas").select("titulo,tipo").eq("semana_numero", out.ritual.numero).eq("dia", out.diaDaSemana).maybeSingle();
      out.passo = rt.data;
      var rd = await sb.rpc("dias_com_registro", { p_semana: out.ritual.numero });
      out.diasComRegistro = rd.data || 0;
    }
    return out;
  }

  /* ---------- Inicio ---------- */
  async function telaInicio(user) {
    telaCarregando();
    var d = await carregarInicio(user);
    var primeiroNome = d.perfil && d.perfil.nome ? d.perfil.nome.split(" ")[0] : "";

    var humores = [["1", "😔"], ["2", "😕"], ["3", "😐"], ["4", "🙂"], ["5", "😊"]];

    var cartaoRitual = "";
    if (!d.acesso) {
      cartaoRitual =
        '<div class="card"><div class="rotulo">Life Ritual</div><h2>Seu Ritual começa quando você escolher seu Flow</h2>' +
        '<p class="suave" style="margin-top:8px">Em breve você escolhe aqui o foco das suas 6 primeiras semanas.</p></div>';
    } else if (d.ritual) {
      cartaoRitual =
        '<div class="card"><div class="rotulo">Life Ritual · Semana ' + esc(d.semana) + "</div>" +
        '<div class="ritual-tema">' + esc(d.ritual.palavra_tema) + "</div>" +
        '<p class="ritual-frase">' + esc(d.ritual.frase) + "</p></div>";
    }

    var cartaoPasso = "";
    if (d.acesso) {
      var pontos = "";
      for (var i = 1; i <= 7; i++) pontos += '<i class="' + (i <= d.diasComRegistro ? "on" : "") + '"></i>';
      cartaoPasso =
        '<div class="card"><div class="rotulo">Seu passo de hoje</div>' +
        '<div class="passo"><div class="dia">' + esc(DIAS[d.diaDaSemana - 1].slice(0, 3)) + "</div><div>" +
        (d.passo
          ? "<h3>" + esc(d.passo.titulo) + "</h3>"
          : '<h3>Hoje, observe o seu dia</h3><p class="suave" style="margin-top:4px">As tarefas desta semana estão sendo preparadas.</p>') +
        "</div></div>" +
        '<div class="pontos" aria-label="Dias com registro nesta semana">' + pontos + "<span>" + esc(d.diasComRegistro) + " de 7 dias com registro</span></div></div>";
    }

    app.innerHTML =
      '<main class="tela">' + cabecalhoMarca() +
      '<h1 class="saudacao">' + esc(saudacaoDoHorario()) + (primeiroNome ? ", " + esc(primeiroNome) : "") + ".</h1>" +
      '<p class="suave saudacao-sub">Observe como você chegou hoje.</p>' +
      '<div class="card"><div class="rotulo">Como você chegou</div>' +
      '<div class="humor" role="group" aria-label="Como você chegou hoje">' +
      humores.map(function (h) {
        return '<button type="button" data-n="' + h[0] + '" aria-pressed="' + (String(d.humor) === h[0]) + '" aria-label="Nível ' + h[0] + ' de 5">' + h[1] + "</button>";
      }).join("") +
      '</div><div class="humor-leg"><span>Pesado</span><span>Leve</span></div>' +
      '<p id="humor-ok" class="humor-ok" role="status"></p></div>' +
      cartaoRitual + cartaoPasso +
      '<p class="bordao">Todas estamos em movimento, cada uma na sua semana.</p>' +
      '<button class="sair" id="sair">Sair da conta</button></main>' + abas("inicio");

    document.getElementById("sair").addEventListener("click", sair);

    app.querySelectorAll(".humor button").forEach(function (b) {
      b.addEventListener("click", async function () {
        var n = Number(b.dataset.n);
        var ok = document.getElementById("humor-ok");
        var r = await sb.from("corpo_registros").upsert(
          { perfil_id: user.id, data: hojeISO(), dia_nivel: n },
          { onConflict: "perfil_id,data" }
        );
        if (r.error) { ok.textContent = "Não consegui guardar agora. Tente de novo."; return; }
        app.querySelectorAll(".humor button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        ok.textContent = "Registrado. Só você vê.";
      });
    });
  }

  /* ---------- sessao e rotas ---------- */
  var usuario = null;

  async function sair() {
    await sb.auth.signOut();
  }

  function rota() {
    return (location.hash.replace(/^#\//, "") || "inicio").split("?")[0];
  }

  async function desenhar() {
    if (!usuario) return telaLogin();
    var r = rota();
    if (r === "flow") return telaEmBreve("flow", "Life Flow", "Aqui ficam as 7 tarefas da sua semana, uma por dia.");
    if (r === "body") return telaEmBreve("body", "Life Body", "Seu espaço para observar corpo, humor e ciclo. Só você vê.");
    if (r === "perfil") return telaEmBreve("perfil", "Perfil", "Seus dados e o que fica visível para as outras mulheres.");
    return telaInicio(usuario);
  }

  async function iniciar() {
    telaCarregando();
    var s = await sb.auth.getSession();
    usuario = s.data.session ? s.data.session.user : null;
    // limpa os dados do link magico da barra de endereco
    if (location.hash && /access_token|error_description/.test(location.hash)) {
      history.replaceState(null, "", location.pathname);
    }
    desenhar();

    sb.auth.onAuthStateChange(function (evento, sessao) {
      var novo = sessao ? sessao.user : null;
      var mudou = (novo && novo.id) !== (usuario && usuario.id);
      usuario = novo;
      if (mudou) desenhar();
    });
    window.addEventListener("hashchange", desenhar);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  iniciar();
})();
