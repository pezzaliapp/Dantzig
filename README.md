# Dantzig — Demo interattiva (HTML/JS/CSS)

Una app didattica in **un’unica cartella** che illustra i due problemi resi celebri da George B. Dantzig:
- **(1)** La potenza del test t (σ ignoto) **dipende da σ**: non esiste un test con potenza indipendente da σ.
- **(2)** **Lemma di Neyman–Pearson**: il **Likelihood-Ratio Test** è il più potente (a parità di livello α) rispetto ad alternative fissate.

## Come usare
1. Metti l’intera cartella su GitHub in una repository chiamata **`Dantzig`**.
2. Abilita **GitHub Pages** su `main` / `/root` (cartella principale).
3. Apri l’URL di Pages e prova la demo. È installabile come PWA (manifest + service worker).

## Struttura
- `index.html` – UI e spiegazioni.
- `style.css` – Stili.
- `script.js` – Simulazioni Monte Carlo e grafici Canvas (niente librerie esterne).
- `manifest.json`, `service-worker.js`, `icon-192.png`, `icon-512.png` – PWA minimal.

## Licenza
MIT — uso libero anche per scopi didattici e divulgativi.

—
*Demo educativa ispirata alla storia di George B. Dantzig.*
