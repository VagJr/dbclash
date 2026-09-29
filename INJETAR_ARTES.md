# Entrada das artes da coleção NEXUS

A coleção tem 714 IDs permanentes, organizados em **15 folhas de 7×7**. As folhas 1–14 têm 49 cartas; a folha 15 tem 28, nas quatro primeiras linhas. As três últimas linhas da folha 15 ficam vazias. A ordem é da esquerda para a direita, de cima para baixo.

Os arquivos `assets/rework/art-prompts-sheet-01.txt` até `art-prompts-sheet-15.txt` especificam personagem, cena e ação de cada posição. O `art-manifest.json` relaciona cada posição ao ID usado por decks e partidas. Trocar uma ilustração não muda esse ID.

Mantenha rosto, cabelo e mãos dentro da área da imagem, com margem de segurança. Títulos, custos, descrições, poder e molduras são renderizados pelo jogo; não devem ser desenhados na folha. A resolução desejada é 4900×6860 por folha, equivalente a 700×980 por carta. O processo registra a resolução real e não amplia imagens para simular definição.

Para importar uma folha recebida, na pasta do projeto:

```powershell
python scripts/build-nexus-assets.py --sheet 1 --source "C:\caminho\folha-01.png"
```

O processo preserva o original, guarda versões anteriores, divide as 49 posições sem cortar a cena e salva cada PNG em `assets/rework/cards/<id>.png`. Atualiza o manifesto para `imported-review`; o jogo passa a renderizar esses recortes ao recarregar a página. Na última folha, apenas as 28 posições ocupadas são injetadas.

A revisão final precisa conferir rosto inteiro, olhos e boca coerentes, identidade e roupa corretas, cena correspondente à carta, detalhes nítidos e ausência de repetição involuntária. O importador não declara aprovação visual automaticamente.

Por enquanto, o jogo reaproveita o fundo NEXUS, os componentes de interface e artes existentes dos personagens. Quando não há uma ilustração adequada, usa o símbolo neutro da simulação, evitando mostrar o personagem errado. As folhas 12×12 antigas e seu manifesto ficam preservados como fontes de conceito; sua geometria não é aplicada às novas folhas.
