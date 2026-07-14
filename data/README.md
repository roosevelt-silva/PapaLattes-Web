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
