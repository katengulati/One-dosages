"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

type Strings = Dictionary["calculator"];

const SYRINGES = [0.3, 0.5, 1]; // mL; U-100 means 100 units per mL

export function Calculator({ t, locale }: { t: Strings; locale: Locale }) {
  const [vialMg, setVialMg] = useState("5");
  const [waterMl, setWaterMl] = useState("2");
  const [dose, setDose] = useState("250");
  const [unit, setUnit] = useState<"mcg" | "mg">("mcg");
  const [syringeMl, setSyringeMl] = useState(1);

  const fmt = (n: number, digits = 2) =>
    n.toLocaleString(locale, { maximumFractionDigits: digits });

  const v = Number(vialMg.replace(",", "."));
  const w = Number(waterMl.replace(",", "."));
  const d = Number(dose.replace(",", "."));
  const valid = v > 0 && w > 0 && d > 0;

  const doseMg = unit === "mcg" ? d / 1000 : d;
  const mgPerMl = v / w;
  const drawMl = doseMg / mgPerMl;
  const units = drawMl * 100;
  const doses = v / doseMg;
  const over = drawMl > syringeMl;
  const fill = Math.min(drawMl / syringeMl, 1);

  return (
    <div className="calc">
      <div className="calc-form">
        <label>
          {t.vialMg}
          <input inputMode="decimal" value={vialMg} onChange={(e) => setVialMg(e.target.value)} />
        </label>
        <label>
          {t.waterMl}
          <input inputMode="decimal" value={waterMl} onChange={(e) => setWaterMl(e.target.value)} />
        </label>
        <div className="calc-row">
          <label>
            {t.dose}
            <input inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} />
          </label>
          <label>
            {t.doseUnit}
            <select value={unit} onChange={(e) => setUnit(e.target.value as "mcg" | "mg")}>
              <option value="mcg">mcg</option>
              <option value="mg">mg</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>{t.syringe}</legend>
          <div className="seg">
            {SYRINGES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={syringeMl === s}
                onClick={() => setSyringeMl(s)}
              >
                {fmt(s, 1)} mL ({s * 100} {t.units})
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="calc-out" aria-live="polite">
        {!valid ? (
          <p className="warn">{t.invalid}</p>
        ) : (
          <>
            <dl>
              <div>
                <dt>{t.concentration}</dt>
                <dd>
                  {fmt(mgPerMl * 1000, 0)} mcg {t.perMl} ({fmt(mgPerMl, 3)} mg/mL)
                </dd>
              </div>
              <div>
                <dt>{t.drawVolume}</dt>
                <dd>{fmt(drawMl, 3)} mL</dd>
              </div>
              <div className="big">
                <dt>{t.drawUnits}</dt>
                <dd>
                  {fmt(units, 1)} {t.units}
                </dd>
              </div>
              <div>
                <dt>{t.dosesPerVial}</dt>
                <dd>{fmt(doses, 1)}</dd>
              </div>
            </dl>
            <div className="syringe" role="img" aria-label={`${fmt(units, 1)} ${t.units}`}>
              <div className="barrel">
                <div className="liquid" style={{ width: `${fill * 100}%` }} />
                {Array.from({ length: 11 }, (_, i) => (
                  <span key={i} className="tick" style={{ left: `${i * 10}%` }}>
                    <small>{fmt((syringeMl * 100 * i) / 10, 0)}</small>
                  </span>
                ))}
              </div>
              <div className="plunger" />
            </div>
            {over && <p className="warn">{t.overSyringe}</p>}
          </>
        )}
      </div>
    </div>
  );
}
