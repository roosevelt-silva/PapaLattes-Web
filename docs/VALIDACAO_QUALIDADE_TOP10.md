# Validação — qualidade e comparação dos 10 melhores

## Teste completo

A aplicação foi executada em navegador Chromium com oito currículos Lattes de exemplo.

Resultados verificados:

- 8 docentes carregados no seletor individual;
- histograma institucional CAPES com 10 categorias;
- histograma SJR com 8 categorias no modo CAPES + SJR;
- histograma individual CAPES com 10 categorias;
- dez artigos exibidos no ranking individual quando disponíveis;
- 8 docentes na comparação de soma e média dos dez melhores;
- 8 linhas nos histogramas empilhados CAPES e SJR;
- link ZIP criado automaticamente após o processamento;
- ausência de erros JavaScript durante o teste.

## Testes por modo

- `CAPES`: mostra o histograma CAPES e oculta painéis SJR/JCR.
- `SJR`: mostra CAPES + faixas SJR.
- `JCR`: mostra CAPES + faixas JCR + quartis JCR.
- `MELHOR — CAPES + JCR`: mostra CAPES + faixas JCR + quartis JCR.

## Arquivos históricos

O ZIP baixado foi aberto e conferido. Permanecem presentes:

- `PontuacaoTotal.xlsx`;
- `QuantidadeProdutos.xlsx`;
- `PontuacaoProdutos.xlsx`;
- `SJR_Percentis.xlsx`;
- `JCR_Faixas.xlsx`;
- `Completo.xlsx`.
