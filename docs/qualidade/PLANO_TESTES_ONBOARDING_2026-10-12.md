# CondoHub — Plano de testes de homologação do onboarding (12/10/2026)

**Status:** proposto; nenhum cenário abaixo aprovado nesta rodada. **Fonte:** relatório manual de 9 páginas enviado em 12/10 e inspeção dos arquivos Login, Invite, AuthCallback, AccessPending, sign-up, session e invitations. **Objetivo:** liberar com evidência o ciclo convite → cadastro/login → confirmação → ativação → contexto correto.

## Pré-condições
- Testar no **mesmo hostname canônico** do início ao fim; conferir APP_BASE_URL e redirects autorizados do Supabase, sem expor chaves.
- Usar contas fictícias, 2 administradoras, 3 condomínios e 2 unidades, com usuário novo, usuário existente, morador, staff e gestor. Registrar e-mail mascarado, timestamps, request IDs, URL sem token.
- Banco ativo, deploy de teste READY, pipeline limpo, sem uso de credenciais ou links de convite em evidências compartilháveis.
- Consultar Vercel e Supabase para comparar logs com horário do defeito. Evitar testes destrutivos nas contas reais.

## Matriz de execução (estado inicial: NÃO EXECUTADO)
| ID | Cenário | Resultado esperado | Evidência |
|---|---|---|---|
| ONB-01 | Emitir convite por e-mail para novo usuário | Mensagem entregue com link canônico, token válido e prazo | e-mail sanitizado e logs de envio |
| ONB-02 | Abrir convite deslogado e clicar em entrar | Login preserva token ao navegar | URL sanitizada e captura |
| ONB-03 | Criar conta via convite e confirmar e-mail | Redirect retorna ao domínio do app e callback processa sessão | host/origem e logs |
| ONB-04 | Concluir ativação de ONB-03 | convite accepted, membership criada exatamente uma vez, contexto selecionado | consultas de leitura com IDs fictícios |
| ONB-05 | Login posterior de usuário novo | dashboard do condomínio convidado, sem AccessPending | vídeo / screenshot |
| ONB-06 | Usuário existente recebe convite de outro condomínio | mesma identidade, novo vínculo; pode trocar contexto | memberships e screenshot |
| ONB-07 | Usuário com dois papéis no mesmo condomínio | papéis modelados conforme regra acordada, sem escalada acidental | matriz de privilégios |
| ONB-08 | Convite expirado/revogado/utilizado | mensagens adequadas; sem criação de vínculo indevido | retornos e logs |
| ONB-09 | Convite de e-mail A tentado por conta B | 403 / sem ativação ou vazamento | teste negativo API |
| ONB-10 | Duplicar aceite simultâneo e atualizar página | estado consistente, sem duplicidade de vínculos | dados e logs |
| ONB-11 | Simular indisponibilidade do callback/API em ambiente controlado | mensagem recuperável, sem spinner infinito | captura |
| ONB-12 | Abrir convite em outro dispositivo/aba sem localStorage prévio | caminho de ativação completo pelo link | mobile / incógnito |
| AUTH-01 | Entrar/sair/trocar usuário e recuperar senha | sessão e cookies corretos, sem herdar contexto anterior | browser devtools sanitizado |
| AUTH-02 | Alterar membershipId cookie / token / parâmetros | servidor rejeita vínculo de terceiros | 401/403 e log |
| TEN-01 | Morador A chama APIs/recursos do condomínio B | sem acesso, inclusive por ID direto | 403 e dados isolados |
| TEN-02 | Staff muda permissões ou remove gestor/admin | respeita regra de autorização acordada | matriz e API |
| TEN-03 | Residente consulta opções de chamados | nenhum contato pessoal de terceiros sem necessidade | payload sanitizado |
| REG-01 | Comunicados/chamados/documentos funcionam após ativação | operações CRUD autorizadas e regressão aprovada | roteiro e logs |
| OPS-01 | Deploy, callbacks, SMTP e observabilidade | build/testes verdes, redirect canônico, alertas configurados | links de implantação |
| OPS-02 | Backup e recuperação | backup criptografado e restauração testada em ambiente isolado | ata técnica |

## Gates (todos obrigatórios)
1. Todos os ONB-01..12 passam em ambiente preview; ao menos um fluxo novo e um existente homologados pelo responsável humano.
2. AUTH-01..02, TEN-01..03 e REG-01 passam; nenhum P0/P1 aberto ou exceção de privacidade sem decisão formal.
3. `pnpm test`, `pnpm build` e verificações de TypeScript passam em pipeline isolado; nenhum teste de disponibilidade de serviço externo bloqueia build por falha transitória (separar smoke operacional).
4. Deploy de teste READY; domínio e Supabase callbacks corretos; conferir status e logs após implantação.
5. Reteste dos problemas relatados nas páginas 2–9 do PDF; registrar data, build SHA e evidências.
6. O responsável pelo produto concede aceite; só então promover para endereço de validação principal.

## Achados abertos e ordem
- P0: confirmação de e-mail redireciona para landing page, convite não ativa: investigar SITE_URL / redirect allow list do Supabase, APP_BASE_URL da Vercel e callback; não considerar resolvido por correções apenas de interface.
- P1: painel AccessPending com conta existente não consegue ativar: testar pendingForMe e RPC; não presumir falha de banco sem logs.
- P1: UX de login/cadastro por convite, erro de spinner indefinido, orientação para usuário existente.
- P1: mesmo e-mail com papéis múltiplos precisa de especificação e teste negativo.
- P1: separação de administrador global, administradora e gestor/morador deve ser explícita.
- P1: deploy 12/10 falhou porque teste de conectividade Supabase recebeu HTTP 502 enquanto serviço recuperava. Isolar smoke de dependência externa das verificações determinísticas de build.

## Relatório por teste
`ID | versão/commit | ambiente | data/hora | executor | pré-condições | passos | esperado | observado | PASS/FAIL/BLOCKED | evidência sanitizada | issue`.

**Não publicar nem marcar concluído enquanto os Gates não forem atendidos.**

## Execução técnica desta continuidade
Consultar `RELATORIO_ONBOARDING_2026-10-12.md`: 42 testes determinísticos e SQL transacional passaram; smoke Auth separado executado. Aceite humano/e2e não concluído. P0 de redirects confirmado em Supabase; e-mail de convites não configurado. Preview técnico autorizado pelo usuário, sem promoção a produção. Gates de liberação permanecem abertos.

### Atualização: callbacks liberados
Após login no painel, allowlist corrigida e redirecionamentos de confirmação/recuperação aprovados tecnicamente (HTTP 303 preserva host/path/invite). Templates padrão usam ConfirmationURL. O próximo bloqueio de ONB-03 é a ausência de SMTP para destinatários externos; testes de e-mail real e aceite humano permanecem abertos. Ver atualização final no relatório e evidências JSON/JPG.
