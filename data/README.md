# Tabelas de referência

Os arquivos podem usar vírgula ou ponto e vírgula como separador. Cabeçalhos são reconhecidos por normalização de maiúsculas, acentos e espaços, mas é recomendado preservar os nomes abaixo.

## `qualis_periodicos.csv`

Colunas mínimas:

```text
ISSN;Titulo;Area;Estrato
```

A coluna `Area` é informativa. Quando há somente uma linha por ISSN, qualquer área pode ser mantida, desde que o Estrato seja o mesmo.

## `sjr.csv`

Deve conter, no mínimo:

```text
Issn;SJR
```

Uma célula de `Issn` pode conter mais de um ISSN separado por vírgula.


## `jcr_2026.csv`

Tabela consolidada da edição JCR 2026, com o Fator de Impacto referente a 2025.

Colunas usadas pela aplicação:

```text
Titulo;ISSN;eISSN;Categorias;Indices;Citacoes;JIF_2025;QuartilMelhor;Quartis
```

O ISSN impresso e o eISSN são indexados. Quando um periódico pertence a mais de uma categoria, `QuartilMelhor` mantém o melhor quartil, enquanto `Quartis` e `Categorias` preservam todas as classificações. Valores originalmente informados como `<0.1` foram representados por `0.05` para permitir a estratificação numérica.

## `qualis_eventos.csv`

```text
Siglas;Conferencia;Qualis
```

## `pesos_artigos.csv`

```text
TipoCAPES,TipoSJR,Pesos,Maximo
```

## `pesos_producao_geral.csv`

```text
TIPOPRODUTO,PESOS,MAXIMO
```

## `bolsistas_produtividade.csv`

```text
NomeBolsista;IDLattes
```

O `IDLattes` pode ser usado para uma identificação mais robusta quando estiver preenchido.
