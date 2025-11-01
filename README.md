# Become the Answer

AI Answer Engine Optimization platform that helps businesses become the go-to answer for AI engines like ChatGPT, Claude, Perplexity, and Gemini.

## Astro Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Developing Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v18.14+
- [Supabase account](https://supabase.com/)

### Setup

1. Clone this repository, then run `npm install` in its root directory.

2. Copy `.env-example` to `.env` and add your Supabase credentials.

3. Run the database migrations found in the `supabase/migrations` directory.

4. Start the development server:

```bash
npm run dev
```

Visit [localhost:4321](http://localhost:4321) to view the site.
