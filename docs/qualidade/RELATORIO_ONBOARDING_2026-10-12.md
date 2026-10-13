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
