from pathlib import Path
from PIL import Image

# =========================================================
# CONFIGURAÇÕES
# =========================================================

PASTA_ENTRADA = Path("imagens_png")
PASTA_SAIDA = Path("imagens_webp")

# Qualidade da imagem WebP.
# 80 a 90 costuma ser excelente para sites.
QUALIDADE = 85

# Se True, procura imagens também dentro de subpastas.
BUSCAR_SUBPASTAS = True


def converter_imagem(caminho_png: Path):
    """
    Converte uma imagem PNG para WebP mantendo transparência,
    quando ela existir.
    """

    try:
        caminho_relativo = caminho_png.relative_to(PASTA_ENTRADA)

        caminho_saida = (
            PASTA_SAIDA
            / caminho_relativo.parent
            / f"{caminho_png.stem}.webp"
        )

        caminho_saida.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(caminho_png) as imagem:
            # Mantém transparência caso o PNG possua canal alpha.
            if imagem.mode in ("RGBA", "LA"):
                imagem = imagem.convert("RGBA")
            else:
                imagem = imagem.convert("RGB")

            imagem.save(
                caminho_saida,
                format="WEBP",
                quality=QUALIDADE,
                method=6
            )

        tamanho_original = caminho_png.stat().st_size
        tamanho_webp = caminho_saida.stat().st_size

        reducao = 0

        if tamanho_original > 0:
            reducao = (
                (tamanho_original - tamanho_webp)
                / tamanho_original
            ) * 100

        print(
            f"✅ {caminho_png.name} -> {caminho_saida.name} "
            f"| Redução: {reducao:.1f}%"
        )

        return True

    except Exception as erro:
        print(f"❌ Erro ao converter {caminho_png}: {erro}")
        return False


def main():
    print("=" * 60)
    print("CONVERSOR AUTOMÁTICO PNG -> WEBP")
    print("=" * 60)

    if not PASTA_ENTRADA.exists():
        PASTA_ENTRADA.mkdir(parents=True, exist_ok=True)

        print()
        print(f'⚠ Pasta "{PASTA_ENTRADA}" criada.')
        print("Coloque suas imagens PNG dentro dela e execute novamente.")
        return

    PASTA_SAIDA.mkdir(parents=True, exist_ok=True)

    if BUSCAR_SUBPASTAS:
        imagens = list(PASTA_ENTRADA.rglob("*.png"))
    else:
        imagens = list(PASTA_ENTRADA.glob("*.png"))

    if not imagens:
        print()
        print("⚠ Nenhuma imagem PNG encontrada.")
        return

    print()
    print(f"📁 Imagens encontradas: {len(imagens)}")
    print()

    convertidas = 0
    erros = 0

    for imagem in imagens:
        sucesso = converter_imagem(imagem)

        if sucesso:
            convertidas += 1
        else:
            erros += 1

    print()
    print("=" * 60)
    print("CONVERSÃO FINALIZADA")
    print("=" * 60)
    print(f"✅ Convertidas: {convertidas}")
    print(f"❌ Erros: {erros}")
    print(f"📁 Pasta de saída: {PASTA_SAIDA.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()