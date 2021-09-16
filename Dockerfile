#
# ---- Base Image ----
FROM node:12.22-alpine AS base

WORKDIR /opt/cron

RUN apk --no-cache add \
  bash \
  ca-certificates \
  cyrus-sasl-dev \
  g++ \
  lz4-dev \
  make \
  musl-dev \
  python \
  && \
  apk add --no-cache --virtual \
  .build-deps \
  gcc \
  zlib-dev \
  libc-dev \
  bsd-compat-headers \
  py-setuptools bash

COPY package.json .
COPY package-lock.json .

#
# ---- Install dependencies
RUN npm install --only=prod

COPY ./app ./app
COPY ./config ./config
COPY ./schemas ./schemas
COPY ./server.js ./server.js

FROM node:12.22-alpine

WORKDIR /opt/cron

RUN apk --no-cache add \
  bash \
  libsasl \
  lz4-libs \
  tini \
  curl

COPY --from=base /opt/cron /opt/cron

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["npm", "start"]

HEALTHCHECK --start-period=5s --interval=30s --timeout=5s --retries=3 \
  CMD curl -s "http://localhost:9000/health" | grep -q "SERVER_IS_READY"

