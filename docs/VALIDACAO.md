# Validação da versão web analítica

## Conjunto de teste

- 8 currículos Lattes;
- período de 2021 a 2026;
- pontuação de artigos pelo modo `MELHOR`;
- tabelas CAPES, SJR, eventos, pesos e bolsistas fornecidas com o PapaLattes 2026;
- regras corrigidas do PapaLattes 1.2.1.

## Resultado da execução corrigida

- currículos processados: **8**;
- participações em artigos: **63**;
- artigos institucionais únicos: **63**;
- pontuação acumulada: **7.089,5**;
- ISSNs CAPES indexados: **33.347**;
- ISSNs SJR indexados: **50.986**.

## Correções verificadas nos XMLs de teste

- Maurício José Alves Bolzam: **1 livro**;
- Fabio Luiz Paranhos Costa: **3 capítulos de livro**;
- Matheus de Souza Lima Ribeiro: **1 capítulo de livro**;
- Monica Rodrigues Ferreira Machado: **2 coorientações de doutorado em andamento**.

A diferença em relação ao total antigo de 6.959,5 pontos decorre das categorias corrigidas e das últimas categorias anteriormente excluídas da soma.

## Validação dos arquivos gerados

Foram verificados:

- presença dos quatro arquivos XLSX tradicionais;
- presença da planilha consolidada tradicional;
- preservação dos CSVs de artigos por docente;
- criação dos CSVs detalhados;
- criação da planilha de análises institucionais;
- criação das tabelas de produção anual, qualidade, periódicos, colaborações e artigos únicos;
- abertura dos arquivos XLSX gerados;
- sintaxe do JavaScript;
- consistência das contagens de livros, capítulos e coorientações.

## Observação sobre colaboração

No conjunto de oito currículos utilizado, não foram encontrados artigos duplicados entre os docentes analisados. Por isso, o indicador de colaboração interna ficou zerado nesse teste. A funcionalidade permanece ativa para conjuntos que contenham coautorias internas.
