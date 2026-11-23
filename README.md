# danyw24.github.io

Personal site of Daniel Tolosa. Static, served by GitHub Pages.

Visitors first see a 3D 1980s computer asking **"Are you from HR? [Y/n]"**:

- **Y** (or `?hr`) shows the recruiter view: plain HTML, no animation.
- **N** (or `?terminal`) shows the full site as a terminal inside the computer's screen, driven by scroll.

The recruiter view is the default without JavaScript, so parsers, link previews and locked-down browsers always get it. The terminal content is real HTML too (`#terminal` opens it with CSS only).

## Files

| Path | What |
|---|---|
| `index.html` | both views, all content |
| `assets/site.css` | styles for both views, CRT effects |
| `assets/site.js` | view switching, scroll-driven typing, power-off at `exit` |
| `src/intro.js` | three.js scene (source) |
| `assets/intro.min.js` | built scene, loaded only for the intro and the framed terminal |
| `assets/zyxel-board.png` | board photo from the ZyXEL writeup, dithered to green |
| `assets/fonts/VT323.woff2` | VT323 font (SIL OFL, see `VT323-OFL.txt`) |

## Build

Only needed after editing `src/intro.js`:

```
npm install
npm run build
```

Preview locally with `python3 -m http.server 8765` and open http://127.0.0.1:8765/ (add `?hr` or `?terminal` to skip the question; the choice is remembered in `localStorage`).
