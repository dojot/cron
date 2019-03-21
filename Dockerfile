FROM node:8.14.0-alpine as basis

WORKDIR /opt/cron

RUN apk --no-cache add gcc g++ musl-dev make python bash zlib-dev

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
RUN npm install

FROM node:8.14.0-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=basis /opt/cron /opt/cron
WORKDIR /opt/cron
COPY . .

CMD ["node", "server.js"]
