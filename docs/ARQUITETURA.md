# Arquitetura do PapaLattes Web Analítico

## Visão geral

O PapaLattes Web Analítico é uma aplicação estática composta por HTML, CSS, JavaScript, uma imagem institucional e tabelas CSV. Todo o processamento ocorre no navegador.

```text
Currículos ZIP/XML
        ↓
Leitor ZIP e parser XML
        ↓
Extração corrigida das produções
        ↓
Correspondência CAPES, SJR, JCR e eventos
        ↓
Aplicação de pesos e limites
        ↓
Deduplicação e indicadores analíticos
        ↓
Painel, tabelas e arquivos de saída
```

## Componentes

### `index.html`

Interface, seleção de currículos, configuração do período, painel analítico e tabelas.

### `assets/logo-ufj.png`

Assinatura visual horizontal da Universidade Federal de Jataí usada no cabeçalho e no rodapé.

### `css/styles.css`

Layout responsivo, identidade visual, tabelas, cartões e gráficos SVG/CSS.

### `js/app.js`

Contém:

- leitor de CSV;
- leitor e gravador de ZIP sem dependências externas;
- parser de XML Lattes;
- normalização de ISSN, títulos e nomes;
- cálculo das faixas SJR e JCR;
- regras CAPES, SJR, JCR, MELHOR CAPES + SJR e MELHOR CAPES + JCR;
- correções do PapaLattes 1.2.1;
- contagem e pontuação das produções;
- deduplicação de artigos por DOI ou metadados;
- identificação de colaborações internas;
- indicadores anuais, individuais e institucionais;
- gráficos em SVG e CSS;
- criação de CSV, XLSX, HTML e ZIP.

### `js/reference-data.js`

Cópia integrada das referências, utilizada quando o projeto é aberto por `file://`.

### `data/`

Referências padrão do site. Em HTTP/HTTPS, esses CSVs têm prioridade sobre a cópia integrada.

## Artigos únicos e colaboração

A deduplicação segue esta ordem:

1. DOI normalizado, quando disponível;
2. combinação normalizada de título, ano, ISSN e periódico.

Quando o mesmo artigo aparece em currículos de dois ou mais docentes do conjunto analisado, ele é contado uma vez na análise institucional e gera uma ligação de colaboração interna entre esses docentes.

As tabelas tradicionais continuam usando a produção de cada currículo individualmente, preservando a lógica de pontuação por docente.

## Ausência de backend

A aplicação não depende de R, Shiny, PHP, Python, Node.js, banco de dados ou API externa no servidor. O GitHub Pages apenas entrega os arquivos estáticos.

## Privacidade

Não existe requisição para upload de currículos. Os arquivos selecionados são lidos localmente pelo navegador.

## Escalabilidade

O limite prático depende da memória do navegador. Para conjuntos grandes:

- use navegador atualizado;
- feche abas pesadas;
- processe por unidade quando necessário;
- consolide lotes posteriormente se o computador tiver pouca memória.
