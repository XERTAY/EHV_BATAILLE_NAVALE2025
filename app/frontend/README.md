# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Local WebSocket setup

When running `npm run dev`, Vite proxies `/api` and (by default) `/ws` to the backend set by `VITE_BACKEND_ORIGIN` (`http://localhost:4784` if unset).

If you see noisy `ws proxy error: write EPIPE` logs in local development, you can bypass the Vite WebSocket proxy and connect directly to the backend:

- set `VITE_WS_URL=ws://localhost:4784/ws/game`
- keep `VITE_BACKEND_ORIGIN` for REST proxying (`/api`)

When `VITE_WS_URL` is defined, `/ws` is no longer proxied by Vite.
