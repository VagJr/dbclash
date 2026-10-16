# Próxima remessa de artes em alta resolução

**Este fluxo só valida e injeta imagens já geradas; não gera nem faz upscale das artes atuais.** Se a pasta estiver vazia, nenhuma carta muda.

Cada carta tem um ID estável. Gere uma ilustração por carta e salve o arquivo em `cards_image_hq` com o ID exato, por exemplo `atk_01.png`. A lista completa, incluindo nome, personagem, tipo, arquétipo e direção de cena, está em `assets/rework/card-art-generation-index.csv`.

Para a renderização atual, gere a cena em retrato com pelo menos **1024 × 1536 px**; dimensões maiores também funcionam. Envie só a ilustração: sem moldura, números, custo, nome ou texto, porque o jogo compõe esses elementos sobre a imagem. Prefira PNG; JPG e WebP também são aceitos. O importador preserva o quadro original, valida as dimensões e associa cada imagem pelo ID, sem recortar nem ampliar.

Depois de colocar as imagens na pasta:

1. Execute `npm run art:import:hq:dry-run` para conferir os 714 IDs e a resolução.
2. Quando o relatório indicar zero arquivos ausentes ou inválidos, execute `npm run art:import:hq`.

O importador conserva a remessa e os arquivos anteriores em `assets/rework/import-backups`. A importação técnica não aprova rostos, anatomia ou correspondência da cena; essa revisão continua registrada como pendente até inspeção visual.
