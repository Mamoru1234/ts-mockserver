#!/usr/bin/env sh
set -e;

npm run buildServer
cp Dockerfile package.server.json ./build/server
cd ./build/server
docker build -t alexeigontarcyber/mockserver:$1 .
