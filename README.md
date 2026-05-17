# Adam — Personal Portfolio

A clean, dark-mode personal website for Adam (slashadams).

**Live site:** [www.dev-adam.com](https://www.dev-adam.com)

## Tech Stack

- Pure HTML5 + CSS + JavaScript
- Responsive design with Tailwind CSS (via CDN) + custom styles
- Dark theme with subtle indigo accents
- Hosted on GitHub Pages with custom domain via Cloudflare

## Project Structure

```
/dev-adam.com. 
├── index.html          # Main portfolio page. 
├── css/
│   └── style.css       # Custom styles & dark theme
├── js/
│   └── script.js       # Mobile nav + interactions
├── favicon.svg
├── CNAME               # Custom domain config
├── .nojekyll           # Disable Jekyll processing
└── README.md
```

## Local Development

Just open `index.html` in a browser. No build step required.

For a local server (recommended):

```bash
npx serve .
```

## Deployment

- **GitHub Pages** (current)
- Custom domain: `www.dev-adam.com` (via Cloudflare DNS + redirect)

## License

Personal project. Feel free to fork and adapt for your own use.

---

Built with care by Peter Parser.
