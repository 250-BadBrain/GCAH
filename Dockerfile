FROM --platform=$BUILDPLATFORM node:26-bookworm AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
COPY tsconfig*.json eslint.config.js vitest.workspace.ts ./
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:26-bookworm AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV GCAH_MODE=public-demo
RUN useradd --system --create-home --uid 10001 gcah && mkdir -p /data && chown -R gcah:gcah /data /app
COPY --from=build --chown=gcah:gcah /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=gcah:gcah /app/apps ./apps
COPY --from=build --chown=gcah:gcah /app/packages ./packages
COPY --from=build --chown=gcah:gcah /app/examples ./examples
USER gcah
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/dist/src/index.js", "public-demo"]
