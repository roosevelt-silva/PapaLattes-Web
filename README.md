# PapaLattes Web Analítico — UFJ

Aplicação estática para extrair, classificar, pontuar e analisar a produção acadêmica de currículos Lattes diretamente no navegador.

A aplicação utiliza exclusivamente as **regras corrigidas do PapaLattes 1.2.1**. Não existe mais a opção de executar o modo de compatibilidade com a versão 1.2.

## Principais recursos

- leitura de currículos Lattes em **ZIP** ou **XML**;
- seleção simultânea de vários currículos;
- leitura de um ZIP agregador contendo XMLs ou outros ZIPs de currículos;
- pontuação de artigos por **CAPES**, **SJR** ou pelo maior valor entre os dois (**MELHOR**);
- leitura corrigida de livros, capítulos e coorientações em andamento;
- distinção entre artigos não indexados com e sem DOI;
- inclusão de todas as categorias na soma final;
- ranking e tabelas detalhadas por docente;
- painel institucional com indicadores, gráficos e análises de perfil;
- exportação em **XLSX**, **CSV**, **HTML** e pacote ZIP;
- processamento local: os currículos permanecem no computador do usuário.

## Painel analítico

Além das tabelas tradicionais, a página apresenta:

- evolução anual da produção;
- composição da pontuação por categoria;
- distribuição dos artigos por estrato CAPES;
- relação entre quantidade de artigos e pontuação total;
- média, mediana, índice de Gini e participação do grupo de maior pontuação;
- cobertura de DOI, CAPES e SJR;
- periódicos mais frequentes;
- artigos únicos, sem duplicar coautorias entre docentes analisados;
- colaborações internas identificadas por artigos presentes em mais de um currículo;
- perfil individual de cada docente;
- indicadores de orientação, produção técnica, inovação e produtividade.

## Correções incorporadas

A versão web aplica as correções realizadas nas bibliotecas em R:

1. leitura correta de `LIVRO-PUBLICADO-OU-ORGANIZADO`;
2. leitura correta de `CAPITULO-DE-LIVRO-PUBLICADO`;
3. contabilização de coorientações de mestrado e doutorado em andamento;
4. uso do peso `ArtigoCOMDOI` quando o artigo não está indexado, mas possui DOI;
5. inclusão de `ProdMusicas` e `ProdutividadeCNPq` na soma final.

## Como usar

### Pela internet

Publique o projeto no GitHub Pages e abra o endereço fornecido pelo GitHub.

1. Informe o período da análise.
2. Escolha `CAPES`, `SJR` ou `MELHOR`.
3. Selecione os currículos Lattes.
4. Clique em **Processar currículos**.
5. Consulte o ranking, os gráficos e as tabelas.
6. Clique em **Baixar todos os resultados** para obter o ZIP completo.

### Localmente, sem servidor

1. Descompacte o projeto.
2. Mantenha as pastas `assets`, `css`, `data` e `js` junto do `index.html`.
3. Abra `index.html` por duplo clique.
4. Selecione somente os currículos.

A aplicação usa automaticamente a cópia integrada das referências em `js/reference-data.js` quando executada por `file://`.

## Tabelas de referência

A pasta `data/` contém:

- `qualis_periodicos.csv`;
- `sjr.csv`;
- `qualis_eventos.csv`;
- `pesos_artigos.csv`;
- `pesos_producao_geral.csv`;
- `bolsistas_produtividade.csv`.

Em uma página publicada, os CSVs da pasta `data/` têm prioridade. Assim, para atualizar as referências institucionais, basta substituir os arquivos mantendo os mesmos nomes e publicar um novo commit.

Para atualizar também a execução local por duplo clique, execute na raiz do projeto:

```r
source("tools/gerar_referencias_embutidas.R")
```

## Arquivos de saída preservados

Os arquivos tradicionais continuam sendo produzidos com os mesmos nomes:

- `Prod_PERIODO_MODO_PontuacaoTotal.xlsx`;
- `Prod_PERIODO_MODO_QuantidadeProdutos.xlsx`;
- `Prod_PERIODO_MODO_PontuacaoProdutos.xlsx`;
- `Prod_PERIODO_MODO_SJR_Percentis.xlsx`;
- `Prod_PERIODO_MODO_Completo.xlsx`;
- pasta `Artigos_docentes/`;
- pasta `Trabalhos_completos/`;
- `Relatorio_PapaLattes.html`;
- `LEIA-ME.txt`.

## Novos arquivos de saída

Também são gerados:

- `Prod_PERIODO_MODO_AnalisesInstitucionais.xlsx`;
- indicadores por docente;
- produção anual;
- distribuição de qualidade dos artigos;
- periódicos mais frequentes;
- colaborações internas;
- artigos institucionais únicos;
- composição da pontuação;
- CSVs analíticos na pasta `Analises/`;
- artigos detalhados na pasta `Artigos_docentes_detalhados/`.

A planilha `Completo.xlsx` mantém as quatro abas tradicionais e acrescenta as novas análises.

## Publicação no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todo o conteúdo desta pasta para a raiz do repositório.
3. Abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main` e a pasta `/ (root)`.
6. Salve e aguarde a publicação.

O arquivo `.nojekyll` já está incluído.

## Estrutura

```text
PapaLattes_Web_Analitico/
├── index.html
├── assets/
│   └── logo-ufj.png
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   └── reference-data.js
├── data/
├── docs/
├── tools/
│   └── gerar_referencias_embutidas.R
└── .nojekyll
```

## Privacidade

Os currículos são processados pelas APIs do próprio navegador. A aplicação não contém rotina de upload dos arquivos nem backend. As referências publicadas são lidas do próprio site; ao abrir localmente, são usadas as referências integradas ao projeto.

## Identidade visual

A página utiliza a assinatura visual horizontal oficial da Universidade Federal de Jataí, armazenada localmente em `assets/logo-ufj.png`.
