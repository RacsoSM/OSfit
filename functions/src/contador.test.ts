import { describe, expect, it, vi } from "vitest";
import { contarEntrada } from "./contador";

/** Un `DocumentReference` de mentiras: solo interesa qué se le pide y si tira. */
function referencia(opciones: { tira?: boolean } = {}) {
  return {
    update: vi.fn(async (datos: Record<string, unknown>) => {
      if (opciones.tira) throw new Error("no se pudo escribir");
      return datos;
    }),
  };
}

describe("contarEntrada", () => {
  it("suma uno y deja la marca de cuándo fue", async () => {
    const ref = referencia();
    await contarEntrada(ref as never);
    expect(ref.update).toHaveBeenCalledTimes(1);
    expect(Object.keys(ref.update.mock.calls[0][0]).sort()).toEqual([
      "entradas",
      "ultimoAcceso",
    ]);
  });

  /**
   * Lo importante de todo el archivo. El contador es un extra; el canje es el acceso de la
   * clienta a su página. Si contar falla —cuota, red, el documento borrado a medio canje—
   * tiene que hundirse solo, en silencio, sin llevarse la entrada de ella.
   */
  it("si contar falla, no tira: la clienta entra igual", async () => {
    const ref = referencia({ tira: true });
    await expect(contarEntrada(ref as never)).resolves.toBeUndefined();
  });
});
