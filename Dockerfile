FROM node:16 as builder

RUN corepack prepare pnpm@7.27.0 --activate && corepack enable

RUN mkdir /app
WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD 1

COPY pnpm-lock.yaml .

RUN pnpm fetch

COPY . .

RUN pnpm install --offline

RUN pnpm run build

#######################################################################

FROM node:16 as prod

RUN corepack prepare pnpm@7.27.0 --activate && corepack enable

RUN mkdir /app
WORKDIR /app

ENV NODE_ENV production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD 1

COPY pnpm-lock.yaml .

RUN pnpm fetch --prod

COPY package.json .

RUN pnpm install --prod --offline

#######################################################################

FROM mcr.microsoft.com/playwright:v1.30.0-focal

LABEL fly_launch_runtime="nodejs"

COPY --from=builder /app/dist /app
COPY --from=prod /app/node_modules /app/node_modules

WORKDIR /app
ENV NODE_ENV production

CMD [ "node", "index.js" ]
