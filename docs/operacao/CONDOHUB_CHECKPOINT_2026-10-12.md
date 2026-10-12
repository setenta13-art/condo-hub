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
