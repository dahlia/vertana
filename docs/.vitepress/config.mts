import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import deflist from "markdown-it-deflist";
import footnote from "markdown-it-footnote";
import process from "node:process";
import { ModuleKind, ModuleResolutionKind, ScriptTarget } from "typescript";
import { defineConfig } from "vitepress";
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
} from "vitepress-plugin-group-icons";
import llmstxt from "vitepress-plugin-llms";

let extraNav: { text: string; link: string }[] = [];
if (process.env.EXTRA_NAV_TEXT && process.env.EXTRA_NAV_LINK) {
  extraNav = [
    {
      text: process.env.EXTRA_NAV_TEXT,
      link: process.env.EXTRA_NAV_LINK,
    },
  ];
}

let plausibleScript: [string, Record<string, string>][] = [];
if (process.env.PLAUSIBLE_DOMAIN) {
  plausibleScript = [
    [
      "script",
      {
        defer: "defer",
        "data-domain": process.env.PLAUSIBLE_DOMAIN,
        src: "https://plausible.io/js/plausible.js",
      },
    ],
  ];
}

const MANUALS = {
  text: "Manuals",
  items: [
    { text: "Glossary deep dive", link: "/manuals/glossary" },
    { text: "Translation quality", link: "/manuals/quality" },
    { text: "Context sources", link: "/manuals/context" },
    { text: "Web context", link: "/manuals/context-web" },
    { text: "Memory context", link: "/manuals/context-memory" },
    { text: "CLI reference", link: "/manuals/cli" },
  ],
};

const REFERENCES = {
  text: "References",
  items: [
    { text: "@vertana/core", link: "https://jsr.io/@vertana/core/doc" },
    { text: "@vertana/facade", link: "https://jsr.io/@vertana/facade/doc" },
    { text: "@vertana/context-web", link: "https://jsr.io/@vertana/context-web/doc" },
    { text: "@vertana/context-memory", link: "https://jsr.io/@vertana/context-memory/doc" },
    { text: "@vertana/cli", link: "https://jsr.io/@vertana/cli/doc" },
  ],
};

const TOP_NAV = [
  { text: "What is Vertana?", link: "/about" },
  { text: "Getting started", link: "/start" },
  { text: "Tutorial", link: "/tutorial" },
];

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Vertana",
  description: "LLM-powered agentic translation library for TypeScript",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/vertana.svg",
    nav: [
      { text: "Home", link: "/" },
      ...TOP_NAV,
      MANUALS,
      REFERENCES,
      ...extraNav,
    ],

    sidebar: [
      ...TOP_NAV,
      MANUALS,
      REFERENCES,
      { text: "Changelog", link: "/changelog" },
    ],

    socialLinks: [
      { icon: "jsr", link: "https://jsr.io/@vertana" },
      { icon: "npm", link: "https://www.npmjs.com/package/@vertana/facade" },
      { icon: "github", link: "https://github.com/dahlia/vertana" },
    ],

    editLink: {
      pattern: "https://github.com/dahlia/vertana/edit/main/docs/:path",
    },

    outline: "deep",

    search: {
      provider: "local",
      options: {},
    },
  },

  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/favicon-192x192.png",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
    ],
    [
      "meta",
      {
        property: "og:image",
        content: "/og.png",
      },
    ],
    ...plausibleScript,
  ],

  cleanUrls: true,

  markdown: {
    languages: ["js", "jsx", "ts", "tsx"],
    codeTransformers: [
      transformerTwoslash({
        twoslashOptions: {
          compilerOptions: {
            moduleResolution: ModuleResolutionKind.Bundler,
            module: ModuleKind.ESNext,
            target: ScriptTarget.ESNext,
            lib: ["dom", "dom.iterable", "esnext"],
            types: ["dom", "dom.iterable", "esnext", "node"],
          },
        },
      }),
    ],
    config(md) {
      md.use(deflist);
      md.use(footnote);
      md.use(groupIconMdPlugin);
    },
  },

  sitemap: {
    hostname: process.env.SITEMAP_HOSTNAME!,
  },

  vite: {
    plugins: [
      groupIconVitePlugin(),
      llmstxt({
        ignoreFiles: [
          "changelog.md",
        ],
      }),
    ],
  },

  transformHead(context) {
    return [
      [
        "meta",
        { property: "og:title", content: context.title },
      ],
      [
        "meta",
        { property: "og:description", content: context.description },
      ],
    ];
  },
});
