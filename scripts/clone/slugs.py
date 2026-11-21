"""Generate Spanish URL slugs for every English page path.

    python3 scripts/clone/slugs.py <paths.txt> translations/es/slugs.json

Existing entries in the output file are kept, so hand edits survive re-runs.
"""
import json
import os
import re
import sys

DIRS = {
    "single-peptide-dosages": "dosis-peptidos-individuales",
    "peptide-blend-dosages": "dosis-mezclas-peptidos",
    "peptide-stack-dosages": "dosis-combinaciones-peptidos",
    "category": "categoria",
}

MANUAL = {
    "": "",
    "blog": "blog",
    "contact-us": "contacto",
    "dosages": "dosis",
    "terms-conditions": "terminos-y-condiciones",
    "disclaimer": "aviso-legal",
    "syringe-measurement-guide": "guia-medicion-jeringa",
    "calculator": "calculadora",
    "editorial-policy": "politica-editorial",
    "privacy-policy": "politica-de-privacidad",
    "cookie-policy": "politica-de-cookies",
    "peptide-dosage-chart": "tabla-dosificacion-peptidos",
    "peptide-drop": "peptide-drop",
    "peptide-prep": "preparacion-peptidos",
    "peptide-prep-2": "preparacion-peptidos-2",
    "peptide-explorer": "explorador-peptidos",
    "peptide-sort": "peptide-sort",
    "peptide-slice": "peptide-slice",
    "about-us": "quienes-somos",
    "faq": "preguntas-frecuentes",
    "glossary": "glosario",
    "beginners-guide-peptides": "guia-principiantes-peptidos",
    "reconstitution-guide-peptides": "guia-reconstitucion-peptidos",
    "peptide-storage-guide": "guia-almacenamiento-peptidos",
    "break-room": "sala-de-descanso",
    "aicar-research": "investigacion-aicar",
    "glutathione-benefits": "beneficios-glutation",
    "cagrilintide-semaglutide": "cagrilintida-semaglutida",
    "tesamorelin-ipamorelin": "tesamorelina-ipamorelina",
    "aod-9604-cjc-1295-ipamorelin": "aod-9604-cjc-1295-ipamorelina",
    "category/bioregulators": "biorreguladores",
    "category/brain-health-nootropics": "salud-cerebral-nootropicos",
    "category/experimental-research": "investigacion-experimental",
    "category/growth-hormone-performance": "hormona-crecimiento-rendimiento",
    "category/healing-recovery": "curacion-recuperacion",
    "category/hormonal-sexual-health": "salud-hormonal-sexual",
    "category/immune-inflammation": "inmunidad-inflamacion",
    "category/longevity-mitochondrial-health": "longevidad-salud-mitocondrial",
    "category/metabolic-weight-loss": "metabolismo-perdida-peso",
    "category/peptide-hormone": "hormonas-peptidicas",
    "category/skin-cosmetic": "piel-cosmetica",
}


def leaf(slug: str) -> str:
    if slug.endswith("-dosage-protocol") or re.search(r"-dosage-.*-protocol$", slug):
        core = re.sub(r"-dosage-protocol$", "", slug)
        core = re.sub(r"-dosage-(.*)-protocol$", r"-\1", core)
        core = core.replace("-blend", "-mezcla")
        return f"protocolo-dosificacion-{core}"
    if slug.startswith("what-is-"):
        return "que-es-" + slug[len("what-is-"):]
    if slug.endswith("-peptide"):
        return "peptido-" + slug[: -len("-peptide")]
    if slug.endswith("-blend"):
        return "mezcla-" + slug[: -len("-blend")]
    raise ValueError(f"no rule for {slug!r}; add it to MANUAL")


def spanish(path: str) -> str:
    if path in MANUAL:
        m = MANUAL[path]
        return f"categoria/{m}" if path.startswith("category/") else m
    parts = path.split("/")
    if len(parts) == 2 and parts[0] in DIRS:
        return f"{DIRS[parts[0]]}/{leaf(parts[1])}"
    if len(parts) == 1 and parts[0] in DIRS:
        return DIRS[parts[0]]
    return leaf(path)


def main(paths_file, out):
    existing = json.load(open(out, encoding="utf8")) if os.path.exists(out) else {}
    paths = [p.strip().strip("/") for p in open(paths_file, encoding="utf8")]
    result = {p: existing.get(p) or spanish(p) for p in paths}
    seen = {}
    for en, es in result.items():
        if es in seen:
            raise SystemExit(f"duplicate Spanish slug {es!r} for {seen[es]!r} and {en!r}")
        seen[es] = en
    json.dump(result, open(out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"{len(result)} slugs -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
