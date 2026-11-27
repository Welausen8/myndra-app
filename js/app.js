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
    return '<div class="marca"><img class="logo-img" src="icons/logo-myndra.png" alt="Myndra" width="190"><div class="lema">Rotina com Alma</div></div>';
  }

  function lembrarSenha(sim) {
    try { if (sim) localStorage.setItem("myndra_usa_senha", "1"); else localStorage.removeItem("myndra_usa_senha"); } catch (e) {}
  }
  function usaSenha() {
    try { return localStorage.getItem("myndra_usa_senha") === "1"; } catch (e) { return false; }
  }

  function telaLogin(aviso, modo, nota) {
    modo = modo || (usaSenha() ? "senha" : "codigo");
    var senha = modo === "senha";
    var info = nota || "";
    try {
      if (sessionStorage.getItem("myndra_saiu")) { sessionStorage.removeItem("myndra_saiu"); info = info || "Você saiu da conta. Até breve."; }
    } catch (e) {}
    app.innerHTML =
      '<main class="centro">' +
      cabecalhoMarca() +
      '<h1 style="font-size:30px;margin-top:34px;text-align:center">Todas estamos em movimento, cada uma na sua semana.</h1>' +
      '<p id="intro" class="suave" style="text-align:center;margin-top:12px">' +
      (senha ? "Entre com o seu e-mail e a sua senha." : "Digite seu e-mail e enviamos um código para você entrar. Sem senha.") + "</p>" +
      '<form id="f-login" novalidate>' +
      '<label for="email">Seu e-mail</label>' +
      '<input id="email" type="email" inputmode="email" autocomplete="username" placeholder="voce@exemplo.com" required>' +
      (senha
        ? '<label for="senha">Sua senha</label><input id="senha" type="password" autocomplete="current-password" required>'
        : "") +
      '<button class="btn" type="submit">' + (senha ? "Entrar" : "Enviar código de acesso") + "</button>" +
      '<p id="msg" class="msg' + (aviso ? " erro" : (info ? " ok" : "")) + '" role="status">' + esc(aviso || info) + "</p>" +
      (senha ? '<button class="sair" type="button" id="esqueci">Esqueci minha senha</button>' : "") +
      '<button class="sair" type="button" id="trocar">' + (senha ? "Prefiro receber um código por e-mail" : "Entrar com e-mail e senha") + "</button>" +
      "</form>" +
      '<form id="f-codigo" novalidate hidden>' +
      '<label for="codigo">Código recebido por e-mail</label>' +
      '<input id="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Digite o código" style="letter-spacing:.3em;text-align:center;font-size:22px">' +
      '<button class="btn" type="submit">Entrar</button>' +
      '<p id="msg2" class="msg" role="status"></p>' +
      '<button class="sair" type="button" id="outro">Usar outro e-mail</button>' +
      "</form>" +
      "</main>";

    var fLogin = document.getElementById("f-login");
    var fCodigo = document.getElementById("f-codigo");
    var emailEnviado = "";

    document.getElementById("trocar").addEventListener("click", function () {
      telaLogin("", senha ? "codigo" : "senha");
    });
    var esq = document.getElementById("esqueci");
    if (esq) esq.addEventListener("click", function () {
      try { sessionStorage.setItem("myndra_recuperar", "1"); } catch (e) {}
      telaLogin("", "codigo", "Sem problema. Digite seu e-mail e enviamos um código. Depois de entrar, você cria uma nova senha.");
    });

    fLogin.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var campo = document.getElementById("email");
      var msg = document.getElementById("msg");
      var botao = fLogin.querySelector("button.btn");
      var email = campo.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.className = "msg erro";
        msg.textContent = "Confira o e-mail digitado.";
        return;
      }

      if (senha) {
        var pw = document.getElementById("senha").value;
        if (!pw) { msg.className = "msg erro"; msg.textContent = "Digite a sua senha."; return; }
        botao.disabled = true;
        msg.className = "msg";
        msg.textContent = "Entrando...";
        var rs = await sb.auth.signInWithPassword({ email: email, password: pw });
        botao.disabled = false;
        if (rs.error) {
          msg.className = "msg erro";
          msg.textContent = (rs.error.status === 429)
            ? "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo."
            : "E-mail ou senha não conferem. Confira os dados, ou toque em \"Esqueci minha senha\".";
        }
        // se deu certo, onAuthStateChange abre o Inicio
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
        msg.textContent = (r.error.status === 429 || /rate/i.test(r.error.code || r.error.message || ""))
          ? "Já enviamos alguns códigos. Aguarde um pouco e tente de novo."
          : "Não consegui enviar agora. Tente de novo em instantes.";
        return;
      }
      emailEnviado = email;
      fLogin.hidden = true;
      fCodigo.hidden = false;
      document.getElementById("intro").textContent = "Enviamos um código para " + email + ". Digite o código abaixo. Vale olhar também o spam.";
      document.getElementById("codigo").focus();
    });

    fCodigo.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var msg = document.getElementById("msg2");
      var botao = fCodigo.querySelector("button.btn");
      var codigo = document.getElementById("codigo").value.replace(/\D/g, "");
      if (codigo.length < 6 || codigo.length > 10) {
        msg.className = "msg erro";
        msg.textContent = "Confira o código: só números, como no e-mail.";
        return;
      }
      botao.disabled = true;
      msg.className = "msg";
      msg.textContent = "Entrando...";
      var r = await sb.auth.verifyOtp({ email: emailEnviado, token: codigo, type: "email" });
      botao.disabled = false;
      if (r.error) {
        msg.className = "msg erro";
        msg.textContent = "Esse código não funcionou. Confira os números ou peça um novo.";
      }
    });

    document.getElementById("outro").addEventListener("click", function () {
      telaLogin("", modo);
    });
  }

  /* ---------- Perfil (por enquanto: conta e senha) ---------- */
  function telaPerfil(user, opts) {
    var recuperar = !!(opts && opts.recuperar);
    app.innerHTML =
      '<main class="tela">' + cabecalhoMarca() +
      (recuperar ? '<div class="card"><div class="rotulo">Você entrou</div><h2>Agora crie uma nova senha</h2><p class="suave" style="margin-top:6px">Assim, da próxima vez você entra com e-mail e senha.</p></div>' : "") +
      '<div class="card"><div class="rotulo">Sua conta</div><h2>' + esc(user.email || "") + "</h2>" +
      '<p class="suave" style="margin-top:6px">Mais opções de perfil e de privacidade chegam em breve.</p></div>' +
      '<div class="card" id="cartao-senha"></div>' +
      '<button class="sair" id="sair">Sair da conta</button></main>' + abas("perfil");
    document.getElementById("sair").addEventListener("click", sair);

    function cartaoCriada(mensagem) {
      var c = document.getElementById("cartao-senha");
      c.innerHTML =
        '<div class="rotulo">Senha</div><h2>Senha criada</h2>' +
        '<p class="suave" style="margin-top:6px">Você já pode entrar com e-mail e senha neste aparelho. Se esquecer, é só pedir um código por e-mail.</p>' +
        (mensagem ? '<p class="msg ok" role="status">' + esc(mensagem) + "</p>" : "") +
        '<button class="btn btn-sec" type="button" id="trocar-senha">Trocar senha</button>';
      document.getElementById("trocar-senha").addEventListener("click", function () { cartaoForm(false); });
    }

    function cartaoForm(primeira) {
      var c = document.getElementById("cartao-senha");
      c.innerHTML =
        '<div class="rotulo">Senha</div><h2>' + (primeira ? "Criar senha" : "Trocar senha") + "</h2>" +
        '<p class="suave" style="margin-top:6px">Use pelo menos 8 caracteres. O seu celular pode guardar a senha para você. Você continua podendo entrar por código, se preferir.</p>' +
        '<form id="f-senha" novalidate>' +
        '<input type="text" autocomplete="username" value="' + esc(user.email || "") + '" hidden>' +
        '<label for="nova">Nova senha</label>' +
        '<input id="nova" type="password" autocomplete="new-password" minlength="8" required>' +
        '<label for="repete">Repita a nova senha</label>' +
        '<input id="repete" type="password" autocomplete="new-password" minlength="8" required>' +
        '<button class="btn" type="submit">Salvar senha</button>' +
        '<p id="msg" class="msg" role="status"></p></form>';
      document.getElementById("f-senha").addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var msg = document.getElementById("msg");
        var botao = ev.target.querySelector("button.btn");
        var pw = document.getElementById("nova").value;
        var pw2 = document.getElementById("repete").value;
        if (pw.length < 8) { msg.className = "msg erro"; msg.textContent = "Use pelo menos 8 caracteres."; return; }
        if (pw !== pw2) { msg.className = "msg erro"; msg.textContent = "As duas senhas não são iguais. Digite de novo."; return; }
        if (pw.toLowerCase() === (user.email || "").toLowerCase()) { msg.className = "msg erro"; msg.textContent = "A senha não pode ser igual ao e-mail."; return; }
        botao.disabled = true;
        msg.className = "msg";
        msg.textContent = "Salvando...";
        var r = await sb.auth.updateUser({ password: pw });
        botao.disabled = false;
        if (r.error) {
          msg.className = "msg erro";
          var t = r.error.message || "";
          msg.textContent = /different|same/i.test(t)
            ? "Essa já é a sua senha atual. Escolha uma diferente."
            : (/weak|short|least|characters/i.test(t)
              ? "Essa senha é fraca demais. Use 8 ou mais caracteres, misturando letras e números."
              : "Não consegui salvar agora. Tente de novo em instantes.");
          return;
        }
        lembrarSenha(true);
        cartaoCriada("Senha salva com sucesso. Da próxima vez, entre com e-mail e senha.");
      });
    }

    if (usaSenha() && !recuperar) cartaoCriada(""); else cartaoForm(true);
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
      .select("numero,microfase,palavra_tema,frase")
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

  /* ---------- Ritual da semana ---------- */
  function linhasRotuladas(txt) {
    return String(txt || "").split("\n").filter(function (l) { return l.trim(); }).map(function (l) {
      var i = l.indexOf(":");
      if (i > 0 && i < 28) return '<p class="lin"><strong>' + esc(l.slice(0, i)) + "</strong> " + esc(l.slice(i + 1).trim()) + "</p>";
      return '<p class="lin">' + esc(l) + "</p>";
    }).join("");
  }

  async function telaRitual(user) {
    telaCarregando();
    var ra = await sb.from("acessos_flow").select("macrofase_id,inicio_em").eq("status", "ativo").order("inicio_em", { ascending: true }).limit(1).maybeSingle();
    if (!ra.data) { location.hash = "#/escolher"; return; }
    var dias = Math.max(0, diasEntre(dataLocalISO(ra.data.inicio_em), hojeISO()));
    var semana = Math.floor(dias / 7) + 1;
    var rr = await sb.from("rituals_semanas").select("*").eq("macrofase_id", ra.data.macrofase_id).order("numero", { ascending: true }).limit(semana);
    var r = rr.data && rr.data.length ? rr.data[rr.data.length - 1] : null;
    if (!r) { location.hash = "#/inicio"; return; }

    function secao(titulo, corpo, aberta) {
      if (!corpo) return "";
      return '<details class="secao"' + (aberta ? " open" : "") + "><summary>" + esc(titulo) + "</summary><div class=\"corpo\">" + corpo + "</div></details>";
    }
    var move = r.move_titulo || r.move_texto
      ? (r.move_titulo ? '<h3 class="move-t">' + esc(r.move_titulo) + "</h3>" : "") + (r.move_texto ? '<p class="lin">' + esc(r.move_texto) + "</p>" : "")
      : "";

    app.innerHTML =
      '<main class="tela"><a class="voltar" href="#/inicio">‹ Início</a>' +
      '<div class="card"><div class="rotulo">Life Ritual · Semana ' + esc(semana) + "</div>" +
      (r.microfase ? '<div class="ritual-fase">' + esc(r.microfase) + "</div>" : "") +
      '<div class="ritual-tema">' + esc(r.palavra_tema) + "</div>" +
      '<p class="ritual-frase">' + esc(r.frase) + "</p>" +
      (r.editorial_curto ? '<p class="suave" style="margin-top:14px">' + esc(r.editorial_curto) + "</p>" : "") + "</div>" +
      secao("Por que importa", r.por_que_importa ? '<p class="lin">' + esc(r.por_que_importa) + "</p>" : "", true) +
      secao("O Move da semana", move, true) +
      secao("Reflexão", linhasRotuladas(r.reflexao), false) +
      secao("Plano da semana", linhasRotuladas(r.plano), false) +
      secao("Métrica", r.metrica ? '<p class="lin">' + esc(r.metrica) + "</p>" : "", false) +
      secao("Curadoria", linhasRotuladas(r.curadoria), false) +
      (r.encerramento ? '<p class="encerra">' + esc(r.encerramento) + "</p>" : "") +
      "</main>" + abas("inicio");
    window.scrollTo(0, 0);
  }

  /* ---------- Escolha do Flow gratuito ---------- */
  // Palavras-tema das 6 primeiras semanas de cada foco (mesmo conteudo dos Rituals).
  var FOCOS = [
    { id: 1, nome: "Fundamento Interno", semanas: ["Presença", "Coerência", "Padrão", "Gentileza", "Nomeação", "Pausa"] },
    { id: 2, nome: "Mente Organizada", semanas: ["Prioridade", "Conclusão", "Decisão", "Ordem", "Sistema", "Revisão"] },
    { id: 3, nome: "Corpo e Energia", semanas: ["Presença", "Prazer", "Descanso", "Prevenção", "Nutrientes", "Atenção"] },
    { id: 4, nome: "Conexão Ampliada", semanas: ["Silêncio", "Intuição", "Sentido", "Prática", "Cotidiano", "Legado"] },
    { id: 5, nome: "Expressão e Realização", semanas: ["Presença", "Coragem", "Talento", "Visibilidade", "Alinhamento", "Origem"] },
    { id: 6, nome: "Afetos Conscientes", semanas: ["Origem", "Papel", "Verdade", "Liberdade", "Integração", "Apoio"] }
  ];

  async function telaEscolherFlow(user) {
    telaCarregando();
    var rp = await sb.from("perfis").select("prioridade_1,prioridade_2").eq("id", user.id).maybeSingle();
    var p1 = rp.data ? rp.data.prioridade_1 : null;
    var p2 = rp.data ? rp.data.prioridade_2 : null;
    var temMapa = p1 != null;

    function cartao(f) {
      var prioridade = temMapa && (f.id === p1 || f.id === p2);
      var travado = temMapa && !prioridade;
      return (
        '<button type="button" class="foco' + (prioridade ? " foco-prioridade" : "") + (travado ? " foco-travado" : "") + '" data-id="' + f.id + '"' + (travado ? " disabled" : "") + ">" +
        (prioridade ? '<span class="tag">Prioridade do seu mapa</span>' : "") +
        (travado ? '<span class="tag tag-cinza">Faz parte do Myndra365</span>' : "") +
        '<span class="foco-nome">' + esc(f.nome) + "</span>" +
        '<span class="foco-sem">' + esc(f.semanas.join(" · ")) + "</span>" +
        "</button>"
      );
    }

    var ordenados = FOCOS.slice();
    if (temMapa) {
      ordenados.sort(function (a, b) {
        var pa = (a.id === p1 || a.id === p2) ? 0 : 1;
        var pb = (b.id === p1 || b.id === p2) ? 0 : 1;
        return pa - pb || a.id - b.id;
      });
    }

    app.innerHTML =
      '<main class="tela">' + cabecalhoMarca() +
      '<h1 class="saudacao" style="font-size:28px">Escolha o foco das suas 6 primeiras semanas.</h1>' +
      '<p class="suave saudacao-sub">É a sua escolha gratuita, com acesso a tudo: Ritual, Flow e Life Body. Você escolhe uma vez, e depois acompanhamos o seu movimento, uma semana de cada vez.</p>' +
      '<div class="focos">' + ordenados.map(cartao).join("") + "</div>" +
      '<p id="msg" class="msg" role="status"></p>' +
      '<a class="sair" href="#/inicio" style="display:block;text-align:center">Voltar</a>' +
      '</main>' + abas("inicio") +
      '<div id="confirma" class="folha" hidden></div>';

    app.querySelectorAll(".foco:not([disabled])").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = FOCOS.filter(function (x) { return x.id === Number(b.dataset.id); })[0];
        var folha = document.getElementById("confirma");
        folha.innerHTML =
          '<div class="folha-caixa" role="dialog" aria-modal="true">' +
          '<div class="rotulo">Sua escolha</div>' +
          "<h2>" + esc(f.nome) + "</h2>" +
          '<p class="suave" style="margin-top:8px">Você começa hoje as suas 6 primeiras semanas neste foco. Essa escolha gratuita é única, então vale respirar antes de confirmar.</p>' +
          '<button class="btn" id="ok" type="button">Começar este Flow</button>' +
          '<button class="btn btn-sec" id="volta" type="button">Voltar</button>' +
          '<p id="msg2" class="msg" role="status"></p></div>';
        folha.hidden = false;
        document.getElementById("volta").addEventListener("click", function () { folha.hidden = true; });
        document.getElementById("ok").addEventListener("click", async function () {
          var ok = document.getElementById("ok");
          var m = document.getElementById("msg2");
          ok.disabled = true;
          m.className = "msg";
          m.textContent = "Preparando suas semanas...";
          var r = await sb.rpc("escolher_flow_gratuito", { p_macrofase: f.id });
          if (r.error) {
            ok.disabled = false;
            m.className = "msg erro";
            m.textContent = /já foi escolhido/i.test(r.error.message || "")
              ? "O seu Flow gratuito já foi escolhido. Vou te levar ao Início."
              : "Não consegui concluir agora. Tente de novo em instantes.";
            if (/já foi escolhido/i.test(r.error.message || "")) setTimeout(function () { location.hash = "#/inicio"; telaInicio(user); }, 1500);
            return;
          }
          location.hash = "#/inicio";
          telaInicio(user);
        });
      });
    });
  }

  /* ---------- Boas-vindas: primeiro nome ---------- */
  function telaNome(user) {
    app.innerHTML =
      '<main class="centro">' + cabecalhoMarca() +
      '<h1 style="font-size:30px;margin-top:34px;text-align:center">Que bom ter você aqui.</h1>' +
      '<p class="suave" style="text-align:center;margin-top:12px">Como você gosta de ser chamada?</p>' +
      '<form id="f-nome" novalidate>' +
      '<label for="nome">Seu primeiro nome</label>' +
      '<input id="nome" type="text" autocomplete="given-name" maxlength="40" required>' +
      '<button class="btn" type="submit">Continuar</button>' +
      '<p id="msg" class="msg" role="status"></p>' +
      '</form></main>';
    document.getElementById("f-nome").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var msg = document.getElementById("msg");
      var botao = ev.target.querySelector("button");
      var nome = document.getElementById("nome").value.trim();
      if (nome.length < 2) { msg.className = "msg erro"; msg.textContent = "Digite o seu primeiro nome."; return; }
      botao.disabled = true;
      var r = await sb.from("perfis").update({ nome: nome }).eq("id", user.id);
      botao.disabled = false;
      if (r.error) { msg.className = "msg erro"; msg.textContent = "Não consegui guardar agora. Tente de novo."; return; }
      telaInicio(user);
    });
  }

  function convidarSenha() {
    var dispensado = false;
    try { dispensado = localStorage.getItem("myndra_convite_senha") === "0"; } catch (e) {}
    if (usaSenha() || dispensado) return "";
    return '<div class="card"><div class="rotulo">Entre mais rápido</div><h2>Crie uma senha</h2>' +
      '<p class="suave" style="margin-top:6px">Assim você não precisa pedir um código toda vez.</p>' +
      '<a class="btn" href="#/perfil" style="display:block;text-align:center;text-decoration:none">Criar senha</a>' +
      '<button class="sair" type="button" id="dispensa-senha" style="margin-top:12px">Agora não</button></div>';
  }

  /* ---------- Inicio ---------- */
  async function telaInicio(user) {
    telaCarregando();
    var d = await carregarInicio(user);
    var primeiroNome = d.perfil && d.perfil.nome ? d.perfil.nome.split(" ")[0] : "";
    if (!primeiroNome) { return telaNome(user); }

    var humores = [["1", "😔", "Esgotada"], ["2", "😕", "Cansada"], ["3", "😐", "Em paz"], ["4", "🙂", "Bem"], ["5", "😊", "Inteira"]];

    var cartaoRitual = "";
    if (!d.acesso) {
      cartaoRitual =
        '<div class="card"><div class="rotulo">Life Ritual</div><h2>Seu Ritual começa quando você escolher seu Flow</h2>' +
        '<p class="suave" style="margin-top:8px">Escolha o foco das suas 6 primeiras semanas, com acesso a tudo.</p>' +
        '<a class="btn" href="#/escolher" style="display:block;text-align:center;text-decoration:none">Escolher meu Flow</a></div>';
    } else if (d.ritual) {
      cartaoRitual =
        '<div class="card"><div class="rotulo">Life Ritual · Semana ' + esc(d.semana) + "</div>" +
        (d.ritual.microfase ? '<div class="ritual-fase">' + esc(d.ritual.microfase) + "</div>" : "") +
        '<div class="ritual-tema">' + esc(d.ritual.palavra_tema) + "</div>" +
        '<p class="ritual-frase">' + esc(d.ritual.frase) + "</p>" +
        '<a class="btn" href="#/ritual" style="display:block;text-align:center;text-decoration:none">Abrir o Ritual desta semana</a></div>';
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
      '' +
      cartaoRitual + cartaoPasso +
      '<div class="card"><div class="rotulo">Como você está chegando hoje</div>' +
      '<p class="suave">Observe e escolha o que mais combina.</p>' +
      '<div class="humor" role="group" aria-label="Como você está chegando hoje">' +
      humores.map(function (h) {
        return '<button type="button" data-n="' + h[0] + '" aria-pressed="' + (String(d.humor) === h[0]) + '" aria-label="' + h[2] + '"><span class="em">' + h[1] + '</span><span class="hl">' + h[2] + "</span></button>";
      }).join("") +
      '</div><p id="humor-ok" class="humor-ok" role="status"></p></div>' +
      convidarSenha() +
      '<p class="bordao">Todas estamos em movimento, cada uma na sua semana.</p>' +
      '<button class="sair" id="sair">Sair da conta</button></main>' + abas("inicio");

    document.getElementById("sair").addEventListener("click", sair);
    var dsp = document.getElementById("dispensa-senha");
    if (dsp) dsp.addEventListener("click", function () {
      try { localStorage.setItem("myndra_convite_senha", "0"); } catch (e) {}
      dsp.closest(".card").remove();
    });

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
    try { sessionStorage.setItem("myndra_saiu", "1"); } catch (e) {}
    await sb.auth.signOut();
  }

  function rota() {
    return (location.hash.replace(/^#\//, "") || "inicio").split("?")[0];
  }

  async function desenhar() {
    if (!usuario) return telaLogin();
    var recuperando = false;
    try { recuperando = sessionStorage.getItem("myndra_recuperar") === "1"; if (recuperando) sessionStorage.removeItem("myndra_recuperar"); } catch (e) {}
    if (recuperando) { location.hash = "#/perfil"; return telaPerfil(usuario, { recuperar: true }); }
    var r = rota();
    if (r === "escolher") return telaEscolherFlow(usuario);
    if (r === "ritual") return telaRitual(usuario);
    if (r === "flow") return telaEmBreve("flow", "Life Flow", "Aqui ficam as 7 tarefas da sua semana, uma por dia.");
    if (r === "body") return telaEmBreve("body", "Life Body", "Seu espaço para observar corpo, humor e ciclo. Só você vê.");
    if (r === "perfil") return telaPerfil(usuario);
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
