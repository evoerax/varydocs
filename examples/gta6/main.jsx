import { gta6Theme } from '@varydocs/react/themes/gta6';
import '@varydocs/react/themes/gta6.css';
import './article.css';
import { defaultLocale, languages, locales } from './.varydocs/index.mjs';
import { searchUrls } from './.varydocs/search-urls.mjs';
import { renderDocs } from '../vite-embed/render-docs.jsx';

await renderDocs({ theme: gta6Theme, defaultLocale, languages, locales, searchUrls });
