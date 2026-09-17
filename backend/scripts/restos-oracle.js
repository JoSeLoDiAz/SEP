"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const postgres_sql_1 = require("../src/common/db/postgres-sql");
const RAIZ = path.join(__dirname, '..', 'src');
function archivos(dir) {
    const salida = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory())
            salida.push(...archivos(p));
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts'))
            salida.push(p);
    }
    return salida;
}
function sqlDe(fuente) {
    const trozos = [];
    const plantillas = fuente.match(/`(?:[^`\\]|\\[\s\S])*`/g) ?? [];
    const comillas = fuente.match(/'(?:[^'\\\n]|\\.)*'/g) ?? [];
    for (const t of [...plantillas, ...comillas]) {
        const s = t.slice(1, -1);
        if (/\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE)\b/i.test(s))
            trozos.push(s);
    }
    return trozos;
}
function main() {
    const porMotivo = new Map();
    const porArchivo = new Map();
    let consultas = 0;
    let limpias = 0;
    for (const f of archivos(RAIZ)) {
        const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
        for (const sql of sqlDe(fs.readFileSync(f, 'utf8'))) {
            consultas++;
            const restos = (0, postgres_sql_1.restosDeOracle)(sql);
            if (!restos.length) {
                limpias++;
                continue;
            }
            porArchivo.set(rel, (porArchivo.get(rel) ?? 0) + 1);
            for (const r of restos)
                porMotivo.set(r, (porMotivo.get(r) ?? 0) + 1);
        }
    }
    const pct = consultas ? Math.round((limpias / consultas) * 100) : 0;
    console.log(`consultas encontradas: ${consultas}`);
    console.log(`las resuelve el traductor: ${limpias} (${pct} %)`);
    console.log(`necesitan criterio humano: ${consultas - limpias}`);
    console.log('\npor motivo:');
    for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1]))
        console.log(`  ${String(n).padStart(4)}  ${m}`);
    console.log('\npor archivo (los 15 con más):');
    for (const [a, n] of [...porArchivo].sort((x, y) => y[1] - x[1]).slice(0, 15))
        console.log(`  ${String(n).padStart(4)}  ${a}`);
}
main();
//# sourceMappingURL=restos-oracle.js.map