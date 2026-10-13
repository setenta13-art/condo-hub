# CondoHub — Checkpoint operacional — 12/10/2026
> Resumo versionado. Não é exportação integral de conversas ou backup de banco de dados.

## Referências
- Repo: setenta13-art/condo-hub; branch de implantação migration/supabase-vercel.
- Vercel: projeto condo-hub, deployment dpl_EUXDrwzs2BG3zbFTXGW6ttca2Kv4, commit e3ec4f4a7e8c78343406259fe1955fa66f2a52ff, READY em preview. READY não garante disponibilidade.
- Supabase: ref wnsroqywgazcccppqrij, sa-east-1.
- Objetivo: primeiro cliente-piloto até 06/11/2026, condicionado à homologação, segurança e aceite.

## INC-001: login indisponível
- Evidências: PDF "Ajustes identificados do CondoHub.pdf" enviado pelo usuário; tentativas de login falham, inclusive falha na inicialização da autenticação.
- Vercel runtime em 12/10: falha de DNS `getaddrinfo ENOTFOUND wnsroqywgazcccppqrij.supabase.co` no POST /api/auth/sign-in.
- Projeto Supabase encontrado `INACTIVE`.
- Usuário autorizou expressamente a restauração.
- Chamado `restore_project` retornou `success: true`.
- Primeiro retorno ainda `INACTIVE`; em seguida passou para `COMING_UP`.
- Não declarar resolvido até confirmação de `ACTIVE_HEALTHY`, conectividade e teste real de login.
- Causa imediata confirmada: endpoint de autenticação inalcançável enquanto Supabase inativo. Causa-raiz da inatividade ainda não comprovada; investigar painel de atividade/pausa, notificações de faturamento e suporte oficial.

## CHAT-001: histórico e sincronização do ChatGPT
- Usuário mostrou captura com duas respostas "Não foi possível carregar esta resposta" e relatou ausência das mensagens recentes no celular.
- Perda definitiva de mensagens não demonstrada; também não é possível garantir integridade de armazenamento pelo assistente.
- Solicitar exportação oficial do ChatGPT, conferir mesma conta/workspace, preservar capturas e abrir suporte se necessário.
- A memória neste Projeto está desativada; não há ação do assistente capaz de ativá-la por si só. Consultar Configurações > Personalização e configurações aplicáveis; mesmo ativa, memória não é backup nem transcrição integral.

## Gestão e qualidade
- Plano mestre baseline V0.1, WBS, marcos: 14/10 segurança, 21/10 testes de isolamento, 28/10 operação, 03/11 aceite, 06/11 piloto; revisar com evidências.
- Ações prioritárias após login: testes negativos de multi-tenancy e papéis, sessão/logout, limitação de requisições, armazenamento privado, SMTP, backups testados, monitoramento e LGPD.
- Achados que exigem validação: `tickets.options` pode expor contatos de outros vínculos ao residente; `staff` pode ter capacidade excessiva sobre perfis; grants amplos existem mas RLS sem policies atualmente restringe acesso direto.
- Agenda: 10/10 10:00–11:30 e 12/10 19:00–20:30 (America/Sao_Paulo); preferência futura por tarefas Google Tasks, não eventos.
- Dono do produto: usuário. Assistente conduz análises e ações explicitamente autorizadas com conectores.
- Rotina: checar branch/commit, estado Vercel/Supabase, registrar mudança/teste e atualizar checkpoint a cada rodada.

## Regras de proteção
- Repositório guarda documentação e código, nunca senhas/tokens nem dump com dados pessoais.
- Drive fornece cópia externa do checkpoint; exportação oficial ChatGPT necessária para o histórico integral.
- Backup do banco deve ser separado, com criptografia, retenção e teste de restauração.

## Continuidade — rodada de correções de onboarding
- Branch atual: `fix/invitation-onboarding-20261012`, base `2a1a84085530cba57553098e0d53bb93390856a1`, base Vercel READY confirmada diretamente.
- Supabase ACTIVE_HEALTHY. Migração `invitation_roles_idempotent` aplicada e testada com fixtures transacionais revertidas. Mantidos 6 usuários Auth, 6 app_users, 9 convites, 6 vínculos, 1 administrador global; digests antes/depois iguais.
- Correções: aceite idempotente, papéis separados sem sobrescrita, identidade confirmada, isolamento de contextos, restrição de staff e proteção admin, remoção de diretório pessoal das opções de chamados, callback recuperável, limpeza de contexto na troca de conta.
- Evidências detalhadas: `docs/qualidade/RELATORIO_ONBOARDING_2026-10-12.md` e `docs/qualidade/TESTE_RPC_ONBOARDING_TRANSACIONAL.sql`.
- Bloqueio P0: Supabase redirect allowlist descarta hostname atual e retorna para `condo-72tkvfc76-condo-hub.vercel.app`; painel URL Configuration exige login e o conector não oferece essa operação. Não considerar confirmação de e-mail homologada.
- Convites automáticos por e-mail: Resend não configurado; fluxo de link manual disponível. Validação SMTP/caixa real, usuário novo/existente, concorrência real e CRUD e2e pendentes.
- Endereço de reteste técnico: `https://condo-hub-git-fix-invitation-onboarding-20261012-condo-hub.vercel.app/login`; só declarar preview novo pronto após verificar SHA/READY.

### Evidência final do preview de código
Código `00fb6f8efb8ec4ee446fe717e2d94ffd108d2037`, deployment `dpl_5f76wwTatrhE54M5ARYzmoSKqLFA` READY e GitHub/Vercel success. Build remoto com 42 testes e compilação serverless sem os erros anteriores. Snapshot: https://condo-akv19v9li-condo-hub.vercel.app/login . Endereço canônico: https://condo-hub-git-fix-invitation-onboarding-20261012-condo-hub.vercel.app/login . Seis checks HTTP passaram; callback inválido e retorno ao login verificados no navegador. P0 de URL Configuration Supabase continua aberto e requer autenticação no painel (não senha no chat). Sem Resend configurado, entrega automática de convites segue pendente. Homologação humana/e-mail real, concorrência simultânea, CRUD e backup/restauração ainda não aprovados.

### Continuidade após login Supabase — URL Configuration corrigida
Login pelo GitHub concluído. Callbacks canônicos `/auth/callback**` e `/reset-password**` acrescentados à allowlist sem remover entradas anteriores nem alterar Site URL. Testes HTTP 303 de signup e recovery preservaram hostname/path/invite; templates padrão usam ConfirmationURL. Evidências em docs/qualidade/evidencias/supabase-callbacks-2026-10-12.{json,jpg}. P0 de redirect encerrado tecnicamente. Novo bloqueio: SMTP customizado ausente no Supabase (padrão restrito à equipe); entrega automática de convites via Resend também ausente. Fluxo real de e-mail → ativação → login ainda precisa ser homologado após configurar envio. Mantidas contagens 6/6/9/6 e administrador global único. Próxima decisão: usar SMTP existente ou configurar provedor, tratando credenciais por acesso seguro e sem aceitar custos/contratos automaticamente.

### SMTP gratuito sem domínio próprio — cadastro pendente
Usuário informou outlook.com; é domínio público de terceiro e não pode ser autenticado como domínio próprio no Resend. Para manter o requisito gratuito durante a homologação, foi preparado o cadastro Brevo Free (300 envios/dia). A documentação oficial descreve substituição temporária de remetente público por endereço autenticado do serviço, inclusive em mensagens transacionais. Não equivale a domínio próprio/branding definitivo e precisa ter entrega comprovada após validação da conta. Cadastro aberto no navegador compartilhado; nenhuma conta, assinatura ou credencial criada pelo assistente. Usuário deve concluir criação da conta, credenciais e aceite dos termos, mantendo o plano Free. Depois: validar remetente, configurar SMTP no Supabase e envio de convites na aplicação; testar entrega, confirmação, ativação e login. Fonte: https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders . Evidência pública da tela de cadastro: docs/qualidade/evidencias/brevo-cadastro-gratuito-2026-10-12.jpg. Nenhum dado pessoal foi inserido/transmitido no cadastro.
