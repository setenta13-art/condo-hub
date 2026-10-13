# CondoHub — execução técnica e bloqueios de homologação — 12/10/2026

Branch: `fix/invitation-onboarding-20261012`. Base: `2a1a84085530cba57553098e0d53bb93390856a1`.
Status: correções técnicas testadas; **homologação completa não aprovada**.

## Mudanças
- Aceite transacional e idempotente pelo mesmo usuário; não recria vínculo revogado/removido.
- Papéis independentes por identidade/condomínio/bloco/unidade; outro convite não sobrescreve o papel existente. Seleção explícita no menu de contextos, com rótulo do papel.
- RPC verifica e-mail confirmado contra `auth.users` e `app_users`; execução restrita ao servidor/service_role.
- Link explícito expirado/revogado/incorreto nunca ativa outro convite como fallback.
- Convites únicos por e-mail filtram expiração antes de limitar resultados; múltiplos exigem escolha.
- Cookies renovados de autenticação são preservados na seleção de vínculo. Cookies de vínculo são limpos em login/callback novos; cookie adulterado falha fechado; logout reinicia a página e limpa convites locais.
- Callback tem prazo de 20s, erro recuperável e botão de login; Supabase tem limite de 15s; falha de ativação mantém o login e permite tentar novamente.
- Funcionários só podem convidar moradores e não podem editar/remover vínculos; gestores não podem alterar o administrador global; remoção do vínculo do administrador global é bloqueada inclusive para administração da plataforma.
- Opções de chamados para moradores não retornam diretório de nomes/e-mails/unidades. Preview público do convite limita administradora/condomínio a ID e nome.
- TypeScript inclui os handlers `api/**/*` no gate técnico.
- `APP_BASE_URL` configurada somente para a branch de preview atual.

## Evidências executadas
- `pnpm build`: TypeScript, testes, Vite e esbuild passaram (aviso de bundle >500 kB, sem falha).
- Vitest: 42 testes determinísticos passaram. Três testes externos são opcionais no build.
- Smoke externo separado: 2 testes Supabase Auth passaram (settings e rejeição de credenciais fictícias). Ajustado prazo dos testes externos para 20s; o limite anterior de 5s causava timeout por latência.
- SQL antes e depois da migração: identidade confirmada, e-mail incorreto, falsificação de identidade, aceite repetido com mesmo ID, dois papéis sem sobrescrita, dois condomínios na mesma identidade, expirado/revogado e grants de RPC passaram. Fixtures fictícias foram revertidas com ROLLBACK. A concorrência simultânea ainda exige teste de duas sessões; a função usa lock de linha e índice único.
- Integridade preservada: 6 usuários Auth, 6 app_users, 9 convites, 6 vínculos, 1 administrador global antes/depois. Digest dos vínculos `1e6b515f0e3139e3fcf2dff2f0f367c7`; digest do administrador `c11e2fa55ae62773bbe256dd5fe6dc27`, iguais antes/depois.
- Supabase `ACTIVE_HEALTHY`. Deploy base `dpl_5u8xRXh9uvuxWGWFN7fqXBBF4Z9r` confirmado `READY`, não QUEUED.

## Matriz do plano (não confundir teste técnico com aceite humano)
| IDs | Resultado nesta rodada |
|---|---|
| ONB-01 | BLOCKED: não há RESEND_API_KEY/INVITE_FROM_EMAIL configurados na Vercel; entrega de convite não comprovada. Link pode ser compartilhado manualmente. |
| ONB-02 | Token preservado no código; reteste humano/browser com convite real pendente. |
| ONB-03 | PASS de redirect e template padrão após correção da allowlist; fluxo positivo com e-mail real BLOCKED por SMTP não configurado. |
| ONB-04, ONB-06, ONB-07 | PASS técnico de RPC e papéis; confirmação real/e2e pendente. |
| ONB-05 | Login negativo externo comprovado; login positivo pós-cadastro pendente de confirmação real. |
| ONB-08, ONB-09 | PASS técnico de RPC e servidor; interface/e2e pendente. |
| ONB-10 | PASS de repetição sequencial; concorrência de duas sessões pendente. |
| ONB-11 | PASS de resposta 503 e falhas de ativação; captura visual de falha sem sessão pendente. |
| ONB-12 | Token em URL é suficiente pelo código; confirmação em outro dispositivo pendente. |
| AUTH-01 | PASS cookies/login/logout por teste; recuperação de senha real pendente. |
| AUTH-02 | PASS resolução real de escopo com mock de transporte e switchContext negativo. |
| TEN-01 | PASS técnico de ID direto e unidade incorreta, contexto de duas administradoras; e2e de recursos completo pendente. |
| TEN-02 | PASS técnico staff/gestor/admin global. |
| TEN-03 | PASS técnico: opções de chamado do morador sem diretório pessoal. |
| REG-01 | CRUD completo de comunicados/chamados/documentos após ativação pendente. |
| OPS-01 | Build/saúde comprovados; callbacks/entrega/alertas pendentes. |
| OPS-02 | Backup e restauração isolada não executados. Não houve exclusão de dados existentes. |

## P0 confirmado: callback do Supabase aponta para deploy antigo
Teste sem envio de e-mail: GET `/auth/v1/verify` com token propositalmente inválido e `redirect_to` do preview atual retornou 303 para `https://condo-72tkvfc76-condo-hub.vercel.app#error=access_denied...` (request ID `01a13275-5a7f-7664-ac3d-6325189638b8`). A mesma requisição com callback no hostname antigo preservou `/auth/callback?invite=...`. O alias da branch migration também foi descartado. Não registrar tokens reais.

Configuração necessária no Supabase: manter configurações existentes e acrescentar somente os redirects deste preview:
- `https://condo-hub-git-fix-invitation-onboarding-20261012-condo-hub.vercel.app/auth/callback**`
- `https://condo-hub-git-fix-invitation-onboarding-20261012-condo-hub.vercel.app/reset-password**`

Conferir template de confirmação/recovery usando ConfirmationURL/RedirectTo, não um SiteURL antigo fixo. Não habilitar wildcard global de todas as contas Vercel nem desativar confirmação de e-mail.
O conector Supabase não expõe Auth URL Configuration. O painel foi aberto e exige login; nenhuma credencial foi solicitada em texto nem extraída.

## Segurança e continuidade
RLS habilitado sem policies em 14 tabelas: acesso direto anon/authenticated negado por desenho, pois API usa service_role e aplica autorização no servidor. Não interpretar advisor INFO como teste completo de isolamento. Advisor WARN: proteção de senhas vazadas desabilitada; referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Backups/restauração, rate limiting, revogação de sessão remota e storage privado permanecem no plano, não foram declarados resolvidos.

Não houve promoção a produção nem exclusão de usuários/convites/vínculos/dados. Migração preserva todos os vínculos e papéis preexistentes; eventual segundo papel sobrescrito antes desta rodada não é reconstruído automaticamente.

## Verificação da compilação serverless
O preview do commit `21941d1c` ficou READY, porém os logs da etapa serverless registraram incompatibilidades de tipagem de Response/getHeader/setHeader. O primeiro ajuste para métodos Express também revelou o problema de resolução dos tipos herdados na compilação da Vercel. A solução final centraliza a escrita/leitura de headers em adaptador HTTP com validação de métodos em runtime, mantendo callers tipados e preservando os cookies renovados. TypeScript local e os 42 testes passaram novamente; conferir os logs do deploy seguinte, pois READY sozinho não é evidência suficiente.

## Preview verificado para retestes técnicos
- Código: `00fb6f8efb8ec4ee446fe717e2d94ffd108d2037`.
- Vercel: `dpl_5f76wwTatrhE54M5ARYzmoSKqLFA`, READY; GitHub status Vercel success.
- Build Vercel: 42 testes passaram; etapa serverless final sem os erros de tipagem anteriores.
- Snapshot: https://condo-akv19v9li-condo-hub.vercel.app/login
- Host canônico para iniciar convites/login: https://condo-hub-git-fix-invitation-onboarding-20261012-condo-hub.vercel.app/login
- Smoke de 6 endpoints passou: GET login 200, signup sem convite 403, sessão inválida 401, senha fictícia 401, chamados sem login 401, auth.me público 200.
- Browser: `/auth/callback` sem sessão mostra erro recuperável e link Voltar ao login; clique abre o formulário de login. Não há spinner indefinido nesse cenário.
- Última consulta de runtime errors no deploy: nenhum registro no filtro de 5 minutos; essa janela limitada não comprova ausência de todo erro.
- Redirect Supabase rechecado: callback atual continua descartado (request ID `01a13284-2b0c-718b-9713-3d9385816f2f`). ONB-03 e fluxo positivo completo continuam BLOCKED até login no painel, ajuste de callbacks e e-mail real.


## Atualização após autenticação no painel — callbacks corrigidos
- Login Supabase concluído por GitHub. Acrescentadas duas entradas restritas do hostname canônico: `/auth/callback**` e `/reset-password**`. Mantidas a entrada anterior e a Site URL existentes; não houve troca de domínio principal nem desativação de confirmação de e-mail.
- UI confirmou 3 Redirect URLs. Templates padrão Confirm sign up e Reset password usam `{{ .ConfirmationURL }}`; não contêm link fixo ao Site URL antigo.
- Requisições de teste com token propositalmente inválido retornaram HTTP 303 preservando, respectivamente, o callback de confirmação e o de recuperação, ambos com `?invite=synthetic_test_token_20261012`. Antes da correção, eram descartados e retornavam ao domínio antigo.
- Request IDs: signup `01a1329c-3e96-74ef-ac25-81f60149cfa7`; recovery `01a1329c-5785-7603-b019-f07d28309fa2`.
- Evidências: `evidencias/supabase-callbacks-2026-10-12.json` e `evidencias/supabase-callbacks-2026-10-12.jpg`. A imagem está limitada ao painel de URLs, sem contatos pessoais, senhas ou tokens reais.
- **Novo bloqueio operacional confirmado:** SMTP customizado do Supabase não configurado. Serviço padrão restringe entrega a membros da equipe do projeto. Necessário configurar SMTP para e-mails de confirmação/recuperação de usuários externos; ver https://supabase.com/docs/guides/auth/auth-smtp . Isso é distinto do envio do convite pelo Resend na aplicação, também ainda não configurado.
- P0 de redirect encerrado tecnicamente; ONB-03 permanece parcial até confirmação real, ativação e login posteriores. Não afirmar que o teste com token inválido confirma entrega, validade de um e-mail real ou homologação do fluxo completo.
- Contagens após alteração: 6 usuários Auth, 6 app_users, 9 convites, 6 vínculos, 1 administrador global. Nenhum usuário, convite ou vínculo alterado/excluído nesta etapa.

### SMTP gratuito sem domínio próprio — cadastro pendente
Usuário informou outlook.com; é domínio público de terceiro e não pode ser autenticado como domínio próprio no Resend. Para manter o requisito gratuito durante a homologação, foi preparado o cadastro Brevo Free (300 envios/dia). A documentação oficial descreve substituição temporária de remetente público por endereço autenticado do serviço, inclusive em mensagens transacionais. Não equivale a domínio próprio/branding definitivo e precisa ter entrega comprovada após validação da conta. Cadastro aberto no navegador compartilhado; nenhuma conta, assinatura ou credencial criada pelo assistente. Usuário deve concluir criação da conta, credenciais e aceite dos termos, mantendo o plano Free. Depois: validar remetente, configurar SMTP no Supabase e envio de convites na aplicação; testar entrega, confirmação, ativação e login. Fonte: https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders . Evidência pública da tela de cadastro: docs/qualidade/evidencias/brevo-cadastro-gratuito-2026-10-12.jpg. Nenhum dado pessoal foi inserido/transmitido no cadastro.

### Brevo — SMTP salvo e integração de convites
Usuário confirmou criação da conta gratuita e salvamento do SMTP no navegador local. Painel Supabase verificado: custom SMTP habilitado, host smtp-relay.brevo.com, porta 587, remetente CondoHub, senha armazenada oculta e Save changes desabilitado. Nenhuma credencial foi lida, copiada ou registrada. A configuração salva não comprova entrega.

Aplicação agora aceita BREVO_API_KEY + INVITE_FROM_EMAIL para convites via API transacional Brevo; Resend continua compatível quando Brevo não está configurada. Conteúdo HTML escapado, link clicável, timeout 15 s, falhas recuperáveis e sem reenvio automático por outro provedor para evitar duplicatas. Testes de contrato com fetch simulado abrangem credenciais ausentes, payload, escape HTML, compatibilidade Resend, 401/429/500 e falha de rede.

Ainda faltam variáveis na Vercel: BREVO_API_KEY (chave API, diferente da chave SMTP) e INVITE_FROM_EMAIL (remetente verificado). Configurar apenas Preview da branch fix/invitation-onboarding-20261012; nunca prefixar com VITE_, nunca publicar chaves em chat/Git/Drive. Após configurar, redeploy e validar entrega de convite, confirmação de e-mail, ativação e login com destinatário de teste informado pelo usuário. O SMTP do Supabase cobre Auth; a API Brevo cobre convites da aplicação. Sem mensagem real enviada nesta rodada; entrega, concorrência real, CRUD e backup/restauração continuam pendentes.

### Reteste — cadastro repetido interpretado como confirmação pendente
Usuário informou convite recebido, mas ausência do e-mail de confirmação. Auth log às 2026-10-13T02:48:30Z (12/10 23:48:30 America/Sao_Paulo) registrou user_repeated_signup em /signup com status 200. Consulta somente de leitura confirmou que a conta dessa tentativa já existia e tinha email_confirmed_at preenchido desde antes da rodada; nenhuma nova conta foi criada. Não há erro SMTP nessa tentativa e ela não comprova envio para conta nova.

Causa da tela enganosa: cliente tratava toda resposta de signup sem sessão como “Cadastro criado. Confirme seu e-mail”. Supabase pode retornar usuário ofuscado para cadastro repetido de conta confirmada. Correção: mensagem condicional sem afirmar criação/envio nem revelar existência de conta; muda para modo login, limpa senha recém-digitada e preserva e-mail/convite. Orienta senha anterior ou recuperação. Texto de criação avisa que outro convite pode ser aceito com conta existente. Não muda confirmação obrigatória, senha ou usuários. Fluxo novo usuário/entrega SMTP real permanece pendente; usuário deve testar login com conta existente pelo convite.

Dados pessoais, tokens de convite, endereços/IPs e senhas não registrados nesta evidência. Nenhuma mensagem enviada pelo assistente, nenhum dado removido. Recebimento do convite confirmado pelo usuário; confirmação de novo cadastro não homologada.

### Reteste — múltiplos condomínios e reenvio
Usuário validou acesso de conta existente. Consulta read-only: convite de morador para TESTE segue pendente; convite aceito em Buena Vista está registrado como staff/Funcionário, e vínculo correspondente também staff. Não corrigir papel por sobrescrita silenciosa. Formulário carregava seleção anterior ao abrir Novo convite; agora reinicia com Morador e campos vazios. Aceites separados por convite continuam necessários para múltiplos condomínios.

Reenvio anterior revogava o convite e criava substituto antes de tentar entregar o e-mail. Os registros mostraram dois convites revogados e um substituto pendente durante os cliques do usuário; backend executou, apesar de ausência de feedback na tela. UI não mostrava resend.error nem loading. Correção: reenvio preserva id/token/prazo/condomínio/papel, sem criar nem revogar convites; expirados exigem novo convite. Falhas na mutação e configuração/envio de e-mail são visíveis, botão mostra Reenviando e impede cliques simultâneos. Não altera histórico ou vínculo existente.

55 testes aprovados e TypeScript/build local aprovados (3 externos pulados). Cinco testes de reenvio: sucesso/falha/não configurado preservam convite; fora do escopo e expirado não enviam/não alteram dados. Não foi enviado e-mail pelo assistente; entrega ao outro endereço ainda não comprovada. Capturas anexadas não disponíveis nos caminhos locais; console não foi lido. Runtime Vercel últimos 10 min não retornou logs para os filtros consultados, não prova ausência de falha.

Comparação HTTP dos bundles: endereço canônico da branch contém mensagem condicional corrigida e não contém mensagem antiga; deploy histórico condo-72tkvfc76-condo-hub.vercel.app ainda contém mensagem antiga. Não comprovado qual hostname estava no navegador do usuário; orientar uso do endereço canônico, sem afirmar cache ou versão incorreta como causa confirmada.
