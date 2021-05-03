#
# ---- Base Image ----
FROM node:12.18-alpine AS base

WORKDIR /opt/cron

RUN apk --no-cache add \
    bash \
    ca-certificates \
    cyrus-sasl-dev \
    g++ \
    lz4-dev \
    make \
    musl-dev \
    python

RUN apk add --no-cache --virtual \
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
RUN npm install

COPY ./config ./config
COPY ./server.js ./server.js
COPY . .

FROM node:12.18-alpine

WORKDIR /opt/cron

RUN apk --no-cache add \
    bash \
    libsasl \
    lz4-libs \
    tini

COPY --from=base /opt/cron /opt/cron

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "server.js"]

HEALTHCHECK --start-period=5s --interval=30s --timeout=5s --retries=3 \
    CMD curl -s "http://localhost:9000/health" | grep -q "SERVER_IS_READY"
