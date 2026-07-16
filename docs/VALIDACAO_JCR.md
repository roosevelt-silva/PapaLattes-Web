# Validação da integração JCR

## Tabela de referência

A planilha `Journal_Impact_Factor_2026.xlsx` foi consolidada em `data/jcr_2026.csv`.

- registros originais por categoria: 32.215;
- periódicos consolidados: 22.643;
- periódicos com JIF numérico: 22.594;
- identificadores indexados no aplicativo, considerando ISSN e eISSN: 39.645;
- JIF máximo: 685,2;
- edição: JCR 2026;
- indicador utilizado: Fator de Impacto de 2025.

Periódicos presentes em mais de uma categoria mantêm todas as categorias e quartis. A coluna `QuartilMelhor` usa a melhor posição entre Q1 e Q4.

Valores originalmente apresentados como `<0.1` foram representados por `0.05` para a formação das faixas numéricas.

## Faixas calculadas

A aplicação usa quantis tipo 7 e os mesmos pesos da tabela `pesos_artigos.csv`.

| Faixa JCR | JIF mínimo | JIF máximo | Peso |
|---|---:|---:|---:|
| ArtigoCOMDOI | 0,0 | 0,3 | 20 |
| ArtigoP1 | 0,3 | 0,6 | 25 |
| ArtigoP2 | 0,6 | 1,1 | 40 |
| ArtigoP3 | 1,1 | 1,6 | 55 |
| ArtigoP4 | 1,6 | 2,3 | 70 |
| ArtigoP5 | 2,3 | 3,1 | 85 |
| ArtigoP6 | 3,1 | 4,8 | 100 |
| ArtigoP7 | 4,8 | 685,2 | 115 |

Os limites são recalculados automaticamente quando a tabela JCR padrão é substituída.

## Testes automatizados

Foram verificados:

- leitura do CSV JCR;
- indexação simultânea de ISSN e eISSN;
- criação das oito faixas de pontuação;
- modo `JCR`;
- modo `MELHOR_JCR`;
- seleção da maior pontuação entre CAPES e JCR;
- registro de JIF, faixa, quartil e categorias no artigo;
- indicadores de cobertura JCR e artigos Q1;
- geração dos arquivos históricos;
- geração de `JCR_Faixas.xlsx`;
- inclusão das faixas JCR no arquivo completo;
- geração dos CSVs analíticos e do relatório HTML.

O teste unitário utilizou um ISSN presente simultaneamente nas bases CAPES e JCR e confirmou a atribuição JCR na faixa `ArtigoP7`.
