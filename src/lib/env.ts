// Lectura de variables de entorno a prueba de Turbopack/webpack.
// Motivo: en desarrollo (Turbopack), las referencias directas a
// `process.env.X` se sustituyen en tiempo de COMPILACIÓN, y si el módulo
// se compiló antes de que existiera la variable, queda "undefined"
// horneado aunque el entorno real la tenga. Leyendo el proceso real a
// través de globalThis, la lectura SIEMPRE es en tiempo de ejecución.
export function envValue(name: string): string | undefined {
  try {
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process;
    const e = p?.env;
    if (e && typeof e === "object") {
      const v = e[name];
      if (v !== undefined && v !== null && String(v).length > 0) {
        return String(v);
      }
    }
  } catch {
    // ignorar: caemos al process.env directo
  }
  const direct = (process.env as Record<string, string | undefined>)[name];
  return direct && direct.length > 0 ? direct : undefined;
}
