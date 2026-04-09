# Screenshot Color Picker

A fully client-side tool for extracting colour palettes from screenshots and building texture swatches. No server, no dependencies, no install.

<img src="docs/screenshot-overview.png" width="100%">

---

## Features

- **Drop or browse** any image (PNG, JPG, GIF, WebP, BMP)
- **Median-Cut colour quantisation** - extract 8, 16, or 32 dominant colours
- **Sort palette** by frequency, hue, brightness, or saturation
- **Session history** - upload multiple images and switch between them; extracted palettes are remembered per image
- **Texture Builder** - drag colours from the palette into an N×N grid (type any size 1-64); drag within the grid to reorder; duplicate colours are blocked
- **Collapsible sections** - keep the interface tidy by folding panels you don't need
- **Export palette** as PNG or SVG at 256 / 512 / 1024 px in grid or strip layout
- **Export texture** as PNG or SVG at 256 / 512 / 1024 / 2048 px
- **Copy hex codes** individually (click a swatch) or all at once
- 100% private - all processing happens in your browser; no image is ever sent to a server

<img src="docs/screenshot-detail.jpg" width="100%">

### Example texture export

![Texture export example](docs/screenshot-texture-export.png)

---

## How to use

1. Open the app (see [Live demo](#live-demo) below)
2. Drop a screenshot onto the upload zone, or click **Browse a file**
3. Adjust the extraction options and click **Extract Colors**
4. Click **+** on a swatch (or drag it) to add it to the Texture Builder
5. Rearrange slots by dragging within the grid; click **x** on a slot or swatch to remove it
6. Export the palette or texture with your chosen format and size

To load a second image without losing the first, click **Add Image** - the Session Images panel lets you switch freely between all uploaded images.

---

## Live demo

The app is hosted via GitHub Pages:  
**[https://pausefish.github.io/Screenshot-Colorpicker](https://pausefish.github.io/Screenshot-Colorpicker)**
