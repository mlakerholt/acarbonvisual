# Retro Protein Backbone Visualizer

A simple static web app with a 90s-inspired UI that loads structures from wwPDB (via RCSB endpoints) and renders a 2D projection of the **alpha-carbon (Cα) backbone**.

## Features

- Enter a 4-character PDB ID and load that structure.
- Click **Random Protein** to load a random known entry.
- Fetches PDB coordinate files from `files.rcsb.org`.
- Uses only `ATOM` records with atom name `CA`.
- Projects 3D cartesian coordinates `(x, y, z)` to 2D on an HTML canvas.
- Adjustable X/Y rotation and rendering scale.

## App link

- Local app link (when running locally): [http://localhost:8000](http://localhost:8000)
- Repository file link (opens app entry file): [index.html](./index.html)

## Run locally

Because this app fetches data from remote APIs, run it via a local server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Run from GitHub

This repository is a plain static app (`index.html`, `styles.css`, `script.js`) and can be hosted directly with **GitHub Pages**.
