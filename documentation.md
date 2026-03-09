# Especificação Técnica do Projeto: SAP CAP Margin Analysis API

## 1. Identificação do Projeto
- **Nome:** SAP CAP Margin Analysis API
- **Tecnologias Core:** SAP CAP (Cloud Application Programming Model), Node.js, CDS, OData V4, REST.
- **Integração:** SAP S/4HANA Cloud (APIs Produtivas)
- **Tipo de Aplicação:** Serviço sem estado (Stateless Service) construído com Virtual Entities (`@cds.persistence.skip`).

---

## 2. Objetivo
Prover uma API analítica para **Agentes de Inteligência Artificial** (ex: Joule Studio, Custom Copilots no BTP) calcularem a Rentabilidade e a Margem Bruta de Materiais vendidos. O sistema busca dados em tempo real no ERP SAP (Vendas e Custos Contáembeis), executa regras de negócio para encontrar a fração de custos indiretos, classifica a rentabilidade, projeta tendências históricas e devolve um relatório completo estruturado sob o protocolo **HTTP REST** (para compatibilidade total com LLMs e agentes de LLM Tools).

---

## 3. Arquitetura e Integração SAP

A arquitetura não armazena dados. Na chegada do request HTTP `/margin-analysis/analyze`, a aplicação orquestra um _fetch_ paralelo (_Promise.all_) em três pilares principais de APIs nativas do **SAP S/4HANA Cloud**:

1. **API_BILLING_DOCUMENT_SRV (A_BillingDocumentItem)**
   - **Objetivo:** Adquirir as linhas de Faturamentos de vendas emitidas.
   - **Campos Coletados:** `BillingDocument`, `BillingDocumentItem`, `Material`, `BillingQuantity`, `NetAmount`, `TransactionCurrency`.
2. **API_GLACCOUNTLINEITEM (GLAccountLineItem)**
   - **Objetivo:** Extrair valores brutos despendidos lançados na contabilidade (Razão).
   - **Campos Coletados:** Todo o lote disponível sem `$select` delimitador para bypassar restrições das views da SAP, importando especialmente: `GLAccount`, `AmountInCompanyCodeCurrency`, `DebitCreditCode`.
3. **API_JOURNALENTRYITEMBASIC_SRV (JournalEntryItemBasic)**
   - **Objetivo:** Complementar custos de produção amarrados na fonte por Item de Diário.
   - **Campos Coletados:** `CompanyCode`, `AccountingDocument`, `FiscalYear`, `GLAccount`, `AmountInTransactionCurrency`, `DebitCreditCode`, `Material`.

> **Autenticação Inbound (S/4HANA)**: Todas as requisições para a SAP ocorrem sob Autenticação Básica (Basic Auth), com as chaves injetadas globalmente via variáveis sensíveis no `.env` (`SAP_USERNAME`, `SAP_PASSWORD`).

---

## 4. O Pipeline de Dados (ETL em Memória)

O serviço orquestra a chamada interceptando através de `srv/service.js` na função (Handler) `this.on('analyze')`. 

### Fase A: Ingestão (`lib/apiClients.js`)
- Chama as três APIs em paralelo.
- Usa paginação em OData V4 (looping the `$skip` e `$top=100`) até extrair todo o volume de dados liberado da carga. 
- Retém num cache em memória de curtos milissegundos a carga (Timeout/TTL).

### Fase B: Normalização (Data Mappers - `lib/mappers.js`)
Nesta etapa, os layouts herméticos da SAP deixam de existir para criar instâncias padronizadas (Virtuais CDS `MaterialSales` e `MaterialCosts`).
- **Filtragem de Custos (COGS - Cost of Goods Sold):** Apenas linhas cujas contas financeiras iniciem com `"5"` ou `"6"` são transportadas pro motor, pois são consideradas contas de despesa de Produto. Contas 1, 2, 3 e 4 ou >7 são ignoradas.
- **Regra de Crédito/Débito:** Linhas com indicador `S` (Débito) entram como valor de custo agregado (+), enquanto `H` (Crédito) entram como desconto do custo agregado (-).

### Fase C: Motor de Cálculo (`lib/calculationEngine.js`)
Aqui ocorre a inteligência de negócios core, mapeada na função `calculateMargins`:

1. **Mapeamento de Receita (Revenue):** Os faturamentos são agrupados pela chave do Produto (`MaterialID`). Soma-se a `QuantitySold` total e o `Revenue` total.
2. **Distribuição de Custo Indireto (Rateio por Volume):** Grande parte dos itens da API de Livro-Razão (GLAccount) chega **sem a tag do Produto** de onde o custo supostamente surgiu. O nosso motor faz a varredura: todo custo orfão vira *Unallocated Cost* (Custo Indireto total).
3. **Equação do Rateio Unitário:** A aplicação pega os Unallocated Costs e distribui proporcionalmente sobre os materiais a partir de sua **Quantidade de Unidades Vendidas (`totalQuantity`)**.
   - _Lógica:_ Dividir pro-rata por receita viciaria 100% dos materiais na mesma faixa de percentual de margem matemática. A divisão ponderada pela quantia movida emite o "overhead-rate" real por custo de volume operacional logístico.
4. **Cálculo dos KPIs base:** Calcula Unidade de Receita (Ticket médio), Margem Unitária e Custo Unitário.
5. **Classificação (Rules Engine):** O Motor executa uma função condicional para classificar em Linguagem Natural:
   - Margens de Lucro Líquido menores que 15% (ou Custos maiores que Receita) ganham a Flag `"Low Profitability"`.
   - Margens entre 15% e 40% indicam `"Healthy Margin"`.
   - Margens de >40% são tipificadas como `"High Profitability"`.

### Fase D: Histórico Variável
Para enriquecer a análise do Agente de IA com contexto sobre a variação mensal de custos:
- O sistema forja ("mocks") o array `history[]` com três recortes contábeis, retrocedendo a Receita e o Custo por multiplicadores imperfeitos assimétricos (`revenue * 0.75` vs `cost * 0.85`), recriando um flutuação vívida de margem.
- Analisa-se o histórico e preenche-se a tag de **Tendência** (`Metrics.marginTrend`) cravando "increasing" ou "decreasing".

### Fase E: Filtragem por Parâmetros REST
De volta no handler (`srv/service.js`), o App intercepta as consultas inseridas pela URL REST e aplica filtros no lote pronto em memória:
- `?material=MAT-123`
- `?periodStart=YYYY-MM&periodEnd=YYYY-MM`
- `?plant=1000`

### Fase F: Formatação de Resposta
O JSON OData é formatado semanticamente e devolvido aninhado para processamento final da LLM (Descrito no Schema OpenAPI).

---

## 5. Estrutura do Dicionário (CDS Schema)

A aplicação foi migrada de um modelo de "Unbound Function" V4 (`/analyze()`) para uma Exposição Restful sem protocolo OData estrito (`/analyze`), usando a anotação `@protocol: 'rest'`.

**Topologia Hierárquica Devolvida (Definitions):**

```json
{
  "AnalysisResponse": {
    "analysisDate": "String",
    "analysisType": "String",
    "currency": "String",
    "totalMaterials": "Integer",
    "materials": ["Array de MarginResult"]
  },
  "MarginResult": {
    "materialId": "String",
    "classification": "String",
    "currentPeriod": {
        "quantitySold": "Double",
        "revenue": "Double",
        "cost": "Double",
        "grossMargin": "Double",
        "grossMarginPercent": "Double"
    },
    "history": ["Array de HistoryRecord"],
    "revenueBreakdown": { "billingDocuments": "Int", "averagePrice": "Double" },
    "costBreakdown": { "materialCost": "Double", "overheadCost": "Double", "logisticsCost": "Double" },
    "metrics": { "unitRevenue": "Double", "unitCost": "Double", "unitMargin": "Double", "marginTrend": "String" }
  }
}
```

---

## 6. Modelagem para AI/LLMs (Por que a arquitetura evoluiu?)

Para comportar uma infraestrutura Agentic e não ser um simples CRUD, a API:
1. Retirou a responsabilidade de equacionar contas dos prompts. Ela emite o cenário completo processado.
2. Expôs um arquivo nativo corporativo global (`openapi.json` e `openapi.yaml`) no topo do repositório contendo todas as descrições em linguagem natural sobre o que é cada filtro (`?plant`, `?material`) e o que é o `AnalysisResponse`. Apenas apontando a LLM para importar esse JSON/YAML, a IA ganha um Tooling Skill inteiro e funcional (autônomo) para interpretar.
3. Removeu nomenclaturas proprietárias do OData (`A_Billing`) em retornos do JSON, favorecendo tokens de inglês natural puro que um Large Language Model compreende no ato (`grossMargin`, `overheadCost`).

---

## 7. Como Iniciar e Testar Localmente

O serviço roda fora do Fiori com um servidor emulado via lib `@sap/cds`.
1. Editar o arquivo `.env` para inserir as credenciais nativas de *Communication User* do Tenant Cloud.
2. Iniciar no Terminal: `npm run watch`.
3. Disparar testes em REST-Client usando o arquivo central `test.http` emulando as filtragens:

```http
GET http://localhost:4004/margin-analysis/analyze?material=TG11
```
