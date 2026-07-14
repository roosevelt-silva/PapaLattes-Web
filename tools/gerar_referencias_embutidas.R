# Gera js/reference-data.js a partir dos CSVs da pasta data/.
# Execute este script somente quando quiser atualizar também a versão que abre
# por duplo clique (file://). No GitHub Pages, basta substituir os CSVs de data/.

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  install.packages("jsonlite")
}

arquivos <- c(
  qualis = "qualis_periodicos.csv",
  sjr = "sjr.csv",
  events = "qualis_eventos.csv",
  articleWeights = "pesos_artigos.csv",
  generalWeights = "pesos_producao_geral.csv",
  fellows = "bolsistas_produtividade.csv"
)

# O script deve ser executado a partir da raiz da pasta PapaLattes_Web.
pasta_dados <- "data"
arquivo_saida <- file.path("js", "reference-data.js")

faltantes <- file.path(pasta_dados, arquivos)
faltantes <- faltantes[!file.exists(faltantes)]
if (length(faltantes) > 0) {
  stop("Arquivos não encontrados: ", paste(faltantes, collapse = ", "))
}

ler_texto <- function(caminho) {
  tamanho <- file.info(caminho)$size
  conexao <- file(caminho, open = "rb")
  on.exit(close(conexao), add = TRUE)
  bruto <- readBin(conexao, what = "raw", n = tamanho)
  texto <- tryCatch(
    rawToChar(bruto),
    error = function(e) iconv(rawToChar(bruto), from = "latin1", to = "UTF-8")
  )
  enc2utf8(texto)
}

referencias <- lapply(file.path(pasta_dados, arquivos), ler_texto)
names(referencias) <- names(arquivos)

json <- jsonlite::toJSON(
  referencias,
  auto_unbox = TRUE,
  pretty = FALSE,
  null = "null",
  na = "null"
)

cabecalho <- paste0(
  "'use strict';\n\n",
  "// Cópia integrada das tabelas padrão para permitir execução por file://.\n",
  "// No GitHub Pages/servidor, os CSVs da pasta data/ continuam tendo prioridade.\n",
  "window.PAPALATTES_REFERENCE_DATA = "
)

writeLines(
  paste0(cabecalho, json, ";"),
  con = arquivo_saida,
  useBytes = TRUE
)

cat("Arquivo atualizado:", arquivo_saida, "\n")
cat("Tamanho:", round(file.info(arquivo_saida)$size / 1024^2, 2), "MB\n")
